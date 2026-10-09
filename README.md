# tree-sitter-smt2

[Tree-sitter] parser for [SMT-LIB 2], the input language of SMT solvers.

Vibe-coded. Passes extensive SMT-LIB corpus, including positive and negative
tests.

The grammar follows the SMT-LIB standard as [Z3] implements it, including Z3's
departures from the standard and its extensions, e.g., `#| ... |#` comments,
`define-fun-rec`, `check-sat-using`, and the SMT-LIB 2.5 syntax of
`declare-datatypes`. Commands that Z3 does not know are parsed as a symbol
followed by s-expressions, as Z3 ignores them.

A [differential test](script/differential) checks that tree-sitter accepts
exactly the files that Z3's parser accepts, over the regression test suites of
several SMT solvers ([script/corpus.tsv](script/corpus.tsv)), including their
tests of parse errors. The [oracle](oracle/z3-parse-oracle.py) parses each file
with Z3, and tells syntax errors apart from other errors (e.g., undeclared
symbols) by their messages.

[Tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[SMT-LIB 2]: https://smt-lib.org/
[Z3]: https://github.com/Z3Prover/z3
