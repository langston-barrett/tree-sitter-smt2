#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["z3-solver==5.1.0.0"]
# ///
"""Classify SMT-LIB 2 files using Z3's parser.

For each file argument, prints one line:

    ok       FILE
    syntax   FILE<TAB>MESSAGE   (lexical or grammatical error)
    semantic FILE<TAB>MESSAGE   (rejected for another reason, e.g., an
                                 undeclared symbol or a sort error)
    crash    FILE<TAB>MESSAGE   (Z3 crashed)
    timeout  FILE<TAB>MESSAGE   (Z3 took too long)

Only files labelled `syntax` are expected to be rejected by tree-sitter.

Files are parsed with Z3's `parse_smt2_file`, which runs the commands in the
file except that `check-sat` does nothing, so that classifying a file does not
involve solving it.  Z3's parser does name resolution and sort checking as it
parses, and after an error it skips to the next command and continues, so a
file can have several errors.  Each is classified by its message (see
`is_syntax`).  Z3 merely warns about unknown commands, so they are not errors.

Skipping to the next command hides syntax errors in the rest of the command
with the error.  When that command is the last, and is unterminated, the
oracle reports the unexpected end of file that Z3 would have (see
`ends_in_command`).  Other hidden syntax errors are listed in
script/differential-exceptions.
"""

import concurrent.futures
import os
import re
import sys
import tempfile

import z3

# Messages of syntax errors, as produced by src/parsers/smt2/smt2scanner.cpp
# and src/parsers/smt2/smt2parser.cpp in Z3.
SYNTAX = re.compile(
    "|".join(
        [
            # Lexical errors.
            r"^unexpected character$",
            r"^unexpected end of (file|string|quoted symbol)$",
            r"^invalid (empty )?bit-vector literal",
            # S-expressions and the arguments of extension commands.
            r"^invalid s-expression",
            r"^invalid command, (argument\(s\) missing|too many arguments)$",
            r"^(invalid/)?unexpected argument$",
            r"^invalid option value$",
            # Terms with missing or unexpected parts.
            r"invalid (expression|sort), unexpected",
            r"^invalid function application, arguments missing$",
            r"^invalid quantifier, list of sorted variables is empty$",
            r"^invalid quantified expression, syntax error",
            r"^(malformed|invalid) let expression$",
            r"^invalid expression$",
            r"^invalid datatype declaration, datatype does not have any constructors$",
            # Errors from functions like check_lparen_next, which say what
            # token was expected.
            r"\bexpected\b|\bExpecting\b",
        ]
    )
)

# Messages that match SYNTAX but are not syntax errors: sort errors, which
# say what sort was expected; errors that depend on what a symbol denotes or
# on options; and errors in the arguments of options and of tactics, which
# are s-expressions as far as the grammar is concerned.
NOT_SYNTAX = re.compile(
    "|".join(
        [
            r"mismatch",
            # Errors about sorts are prefixed with what was being parsed,
            # e.g., "Expecting sort list '(': unknown sort 'S'".
            r"unknown sort",
            r"number of arguments|^Invalid function application\. At least one argument",
            r"^invalid (constant |empty )?pattern(,|$)",
            r"bit-vector constant",
            r"const array",
            r"combinator|tactic|probe|parameter value|option value,|error setting",
            r"simplify command",
        ]
    )
)


def is_syntax(msg: str) -> bool:
    return SYNTAX.search(msg) is not None and NOT_SYNTAX.search(msg) is None


QUOTED_SYMBOL = re.compile(rb"\|(?:[^|\\]|\\.)*\|", re.S)


def ends_in_command(data: bytes) -> bool:
    """Whether the file ends inside a command (i.e., a parenthesis is open).

    After an error, Z3 skips to the next command, and stops without another
    error if it reaches the end of the file first.  This tokenizes the file
    as Z3 does, to find out whether that happened.
    """
    depth = 0
    i = 0
    n = len(data)
    while i < n:
        c = data[i : i + 1]
        if c == b";":
            j = data.find(b"\n", i)
            i = n if j < 0 else j + 1
        elif c == b'"':
            i += 1
            while True:
                j = data.find(b'"', i)
                if j < 0:
                    return False  # Z3 reports unterminated strings.
                if data[j + 1 : j + 2] == b'"':
                    i = j + 2
                    continue
                i = j + 1
                break
        elif c == b"|":
            m = QUOTED_SYMBOL.match(data, i)
            if m is None:
                return False  # Z3 reports unterminated quoted symbols.
            i = m.end()
        elif data.startswith(b"#|", i):
            j = data.find(b"|#", i + 2)
            i = n if j < 0 else j + 2
        else:
            if c == b"(":
                depth += 1
            elif c == b")":
                depth = max(0, depth - 1)
            i += 1
    return depth > 0


ERROR = re.compile(r'^\(error "(?:line \d+ column \d+: )?((?:[^"\\]|\\.)*)"\)$', re.M)


def init_worker(cwd: str) -> None:
    # Commands like `echo` and `display` print to stdout, and some options
    # write files; keep both out of the way.
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, 1)
    os.dup2(devnull, 2)
    os.chdir(cwd)


def classify(path: str) -> tuple[str, str]:
    ctx = z3.Context()
    try:
        z3.parse_smt2_file(path, ctx=ctx)
    except z3.Z3Exception as e:
        value = e.value
        text = value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)
        errors = [" ".join(m.split()) for m in ERROR.findall(text)]
        if not errors:
            return ("error", " ".join(text.split()))
        syntax = [m for m in errors if is_syntax(m)]
        with open(path, "rb") as f:
            if ends_in_command(f.read()):
                syntax.append("unexpected end of file (after an earlier error)")
        if syntax:
            return ("syntax", syntax[0])
        return ("semantic", errors[0])
    return ("ok", "")


# Seconds to wait for Z3 to classify a file.
TIMEOUT = 60


def kill(pool: concurrent.futures.ProcessPoolExecutor) -> None:
    for proc in list(pool._processes.values()):  # noqa: SLF001
        proc.kill()
    pool.shutdown(wait=False, cancel_futures=True)


def classify_isolated(path: str, cwd: str) -> tuple[str, str]:
    """Classify a file in a process of its own, in case Z3 crashes or hangs."""
    pool = concurrent.futures.ProcessPoolExecutor(
        1, initializer=init_worker, initargs=(cwd,)
    )
    try:
        return pool.submit(classify, path).result(timeout=TIMEOUT)
    except concurrent.futures.process.BrokenProcessPool:
        return ("crash", "Z3 crashed")
    except concurrent.futures.TimeoutError:
        return ("timeout", f"Z3 took over {TIMEOUT} seconds")
    finally:
        kill(pool)


def main() -> None:
    files = sys.argv[1:]
    paths = [os.path.abspath(f) for f in files]
    batch = 256
    with tempfile.TemporaryDirectory() as cwd:
        pool = concurrent.futures.ProcessPoolExecutor(
            initializer=init_worker, initargs=(cwd,)
        )
        for i in range(0, len(files), batch):
            futures = [pool.submit(classify, p) for p in paths[i : i + batch]]
            _, pending = concurrent.futures.wait(futures, timeout=TIMEOUT * 4)
            broken = bool(pending) or any(
                f.exception() is not None for f in futures if f.done()
            )
            if broken:
                # Rerun the files that did not finish one at a time.
                kill(pool)
                pool = concurrent.futures.ProcessPoolExecutor(
                    initializer=init_worker, initargs=(cwd,)
                )
            for f, p, fut in zip(files[i : i + batch], paths[i : i + batch], futures, strict=True):
                if fut.done() and fut.exception() is None:
                    label, msg = fut.result()
                else:
                    label, msg = classify_isolated(p, cwd)
                line = f"{label:<8} {f}"
                if msg:
                    line += "\t" + msg
                print(line, flush=True)
        pool.shutdown()


if __name__ == "__main__":
    main()
