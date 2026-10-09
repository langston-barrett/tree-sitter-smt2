/**
 * @file SMT-LIB 2 grammar for tree-sitter
 * @license MIT
 *
 * This grammar follows the SMT-LIB 2.7 standard, as Z3 implements it, so that
 * it accepts the same language as Z3's parser (src/parsers/smt2/smt2scanner.cpp
 * and src/parsers/smt2/smt2parser.cpp in Z3Prover/z3).  Where Z3 departs from
 * the standard, the grammar follows Z3.
 *
 * Commands that Z3 does not know are accepted as a symbol followed by
 * s-expressions, as Z3 ignores them.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Characters of simple symbols, other than letters and digits.  Z3 also
// allows `,`.
const SYMBOL_CHAR = '~!@$%^&*_+=<>.?/,';
const SYMBOL_FIRST = `a-zA-Z${SYMBOL_CHAR}`;
const SYMBOL_NEXT = `a-zA-Z0-9${SYMBOL_CHAR}\\-`;
const SYMBOL_REST = `[${SYMBOL_NEXT.replace('/', '\\/')}]*`;

const parens = (...rules) => seq('(', ...rules, ')');
const list = (rule) => parens(repeat(rule));
const list1 = (rule) => parens(repeat1(rule));

export default grammar({
  name: 'smt2',

  extras: $ => [/[ \t\r\n]/, $.comment],

  word: $ => $.symbol,

  // Z3 does not allow `_` and `as` as the names of declared functions and
  // sorts, or of sort parameters.
  reserved: {
    global: _ => [],
    declaration: _ => ['_', 'as'],
  },

  rules: {
    source_file: $ => repeat($._command),

    // -----------------------------------------------------------------------
    // Lexical structure

    // Z3 does not require whitespace between tokens: `1a` is the numeral `1`
    // followed by the symbol `a`.  Z3 reads a `-` followed by a digit as the
    // start of a (negative) numeral, not as a symbol.
    symbol: _ => token(choice(
      new RegExp(`[${SYMBOL_FIRST.replace('/', '\\/')}]${SYMBOL_REST}`),
      new RegExp(`-([${SYMBOL_FIRST.replace('/', '\\/')}\\-]${SYMBOL_REST})?`),
    )),

    // Z3 allows `\|` in quoted symbols.
    quoted_symbol: _ => /\|([^|\\]|\\[\s\S])*\|/,

    keyword: _ => token(seq(':', new RegExp(SYMBOL_REST))),

    numeral: _ => /-?[0-9]+/,
    decimal: _ => /-?[0-9]+\.[0-9]*/,
    hexadecimal: _ => /#x[0-9a-fA-F]+/,
    binary: _ => /#b[01]+/,
    string: _ => /"([^"]|"")*"/,

    comment: _ => token(choice(
      /;[^\n]*/,
      // Z3 also allows block comments.
      /#\|([^|]|\|+[^|#])*\|+#/,
    )),

    _symbol: $ => choice($.symbol, $.quoted_symbol),

    _declared_symbol: $ => reserved('declaration', choice($.symbol, $.quoted_symbol)),

    _spec_constant: $ => choice(
      $.numeral,
      $.decimal,
      $.hexadecimal,
      $.binary,
      $.string,
    ),

    // -----------------------------------------------------------------------
    // S-expressions

    _s_expr: $ => choice(
      $._spec_constant,
      $._symbol,
      $.keyword,
      $.list,
    ),

    list: $ => list($._s_expr),

    // -----------------------------------------------------------------------
    // Sorts

    sort: $ => choice(
      $._symbol,
      alias($._indexed_sort_identifier, $.indexed_identifier),
      parens(field('name', $._symbol), repeat(field('argument', $.sort))),
    ),

    _indexed_sort_identifier: $ => parens(
      '_',
      field('name', $._symbol),
      repeat(field('index', $.numeral)),
    ),

    // -----------------------------------------------------------------------
    // Terms

    _term: $ => choice(
      $._spec_constant,
      $._symbol,
      $._paren_term,
    ),

    _paren_term: $ => choice(
      $.indexed_identifier,
      $.qualified_identifier,
      $.application,
      $.let_term,
      $.quantified_term,
      $.annotated_term,
      $.match_term,
      $.root_obj,
    ),

    // Z3 allows no indices, and indices other than numerals.
    indexed_identifier: $ => parens(
      '_',
      field('name', $._symbol),
      repeat(field('index', $._index)),
    ),

    _index: $ => choice(
      $.numeral,
      $.decimal,
      $.hexadecimal,
      $.binary,
      $.keyword,
      $._symbol,
      $.function_reference,
    ),

    _identifier: $ => choice($._symbol, $.indexed_identifier),

    qualified_identifier: $ => parens(
      'as',
      field('name', $._identifier),
      field('sort', $.sort),
    ),

    // The function can also be a term, in which case Z3 applies it to the
    // arguments with `select`.
    application: $ => parens(
      field('function', choice($._symbol, $._paren_term)),
      repeat1(field('argument', $._term)),
    ),

    // Z3 allows an empty list of bindings.  It also allows any number of
    // bodies, of which the last is the value; with none, the value is that of
    // the last binding.
    let_term: $ => parens(
      'let',
      choice(
        seq(
          field('bindings', alias(list1($.binding), $.bindings)),
          repeat(field('body', $._term)),
        ),
        seq(
          field('bindings', alias(parens(), $.bindings)),
          repeat1(field('body', $._term)),
        ),
      ),
    ),

    binding: $ => parens(field('name', $._symbol), field('value', $._term)),

    quantified_term: $ => parens(
      field('quantifier', choice('forall', 'exists', 'lambda', 'choice')),
      field('variables', list1($.sorted_var)),
      field('body', $._term),
    ),

    sorted_var: $ => parens(field('name', $._symbol), field('sort', $.sort)),

    // Z3 allows no attributes.
    annotated_term: $ => parens(
      '!',
      field('term', $._term),
      repeat(field('attribute', $._term_attribute)),
    ),

    _term_attribute: $ => choice(
      alias($._named_attribute, $.attribute),
      alias($._pattern_attribute, $.attribute),
      alias($._no_pattern_attribute, $.attribute),
      alias($._weight_attribute, $.attribute),
      alias($._term_generic_attribute, $.attribute),
    ),

    _named_attribute: $ => seq(
      field('keyword', alias(
        choice(':named', ':qid', ':skolemid', ':lblpos', ':lblneg'),
        $.keyword,
      )),
      field('value', $._symbol),
    ),

    // Z3 ignores malformed patterns.
    _pattern_attribute: $ => seq(
      field('keyword', alias(':pattern', $.keyword)),
      field('value', choice(
        $._spec_constant,
        $._symbol,
        $.keyword,
        $.pattern,
      )),
    ),

    // A list of terms, or (in Z3) a single application.  Z3 ignores a
    // pattern like `(c)` if `c` is a constant, but rejects it if `c` is a
    // variable.
    pattern: $ => choice(
      parens(),
      parens($._paren_term, repeat($._term)),
      parens($._symbol, repeat($._term)),
    ),

    _no_pattern_attribute: $ => seq(
      field('keyword', alias(':no-pattern', $.keyword)),
      field('value', $._term),
    ),

    _weight_attribute: $ => seq(
      field('keyword', alias(':weight', $.keyword)),
      field('value', $.numeral),
    ),

    // Z3 requires a value for other attributes.
    _term_generic_attribute: $ => seq(
      field('keyword', $.keyword),
      field('value', $._s_expr),
    ),

    match_term: $ => parens(
      'match',
      field('term', $._term),
      field('cases', list($.match_case)),
    ),

    match_case: $ => parens(
      field('pattern', $._match_pattern),
      field('body', $._term),
    ),

    _match_pattern: $ => choice(
      $._symbol,
      alias(parens(
        field('constructor', $._symbol),
        repeat(field('variable', $._symbol)),
      ), $.constructor_pattern),
    ),

    // Z3's algebraic numbers, as Z3 prints them in models.
    root_obj: $ => parens(
      'root-obj',
      field('polynomial', $._s_expr),
      field('index', $.numeral),
    ),

    // A function, given by its name or by its signature, as an index.
    function_reference: $ => parens(
      field('name', choice($._symbol, alias($._indexed_sort_identifier, $.indexed_identifier))),
      field('domain', list($.sort)),
      field('range', $.sort),
    ),

    // -----------------------------------------------------------------------
    // Commands

    _command: $ => choice(
      $.assert,
      $.check_sat,
      $.check_sat_assuming,
      $.declare_const,
      $.declare_datatype,
      $.declare_datatypes,
      $.declare_fun,
      $.declare_sort,
      $.define_const,
      $.define_fun,
      $.define_fun_rec,
      $.define_funs_rec,
      $.define_sort,
      $.echo,
      $.get_model,
      $.get_value,
      $.get_info,
      $.get_option,
      $.pop,
      $.push,
      $.set_info,
      $.set_logic,
      $.set_option,
      $.simple_command,
      $.term_command,
      $.tactic_command,
      $.help,
      $.command,
    ),

    assert: $ => parens('assert', field('term', $._term)),

    // Z3 allows assumptions, as in `check-sat-assuming`.
    check_sat: $ => parens('check-sat', repeat(field('assumption', $._term))),

    check_sat_assuming: $ => parens(
      'check-sat-assuming',
      field('assumptions', list($._term)),
    ),

    declare_const: $ => parens(
      'declare-const',
      field('name', $._declared_symbol),
      field('sort', $.sort),
    ),

    declare_datatype: $ => parens(
      'declare-datatype',
      field('name', $._symbol),
      field('datatype', $.datatype),
      optional(seq(
        alias(':subterm', $.keyword),
        field('subterm', $._symbol),
      )),
    ),

    // Z3 also accepts the syntax of SMT-LIB 2.5, in which the first list
    // holds the sort parameters and each datatype starts with its name.
    declare_datatypes: $ => parens(
      'declare-datatypes',
      choice(
        seq(
          field('sorts', list1($.sort_declaration)),
          field('datatypes', list($.datatype)),
        ),
        seq(
          field('parameters', list($._symbol)),
          field('datatypes', list(alias($._named_datatype, $.datatype))),
        ),
      ),
    ),

    sort_declaration: $ => parens(
      field('name', $._symbol),
      field('arity', $.numeral),
    ),

    datatype: $ => choice(
      list1($.constructor),
      parens(
        'par',
        field('parameters', list($._symbol)),
        list1($.constructor),
      ),
    ),

    _named_datatype: $ => parens(
      field('name', $._symbol),
      repeat1($.constructor),
    ),

    // Z3 allows nullary constructors without parentheses.
    constructor: $ => choice(
      field('name', $._symbol),
      parens(field('name', $._symbol), repeat($.selector)),
    ),

    selector: $ => parens(field('name', $._symbol), field('sort', $.sort)),

    declare_fun: $ => parens(
      'declare-fun',
      field('name', $._declared_symbol),
      field('domain', list($.sort)),
      field('range', $.sort),
    ),

    declare_sort: $ => parens(
      'declare-sort',
      field('name', $._declared_symbol),
      optional(field('arity', $.numeral)),
    ),

    define_const: $ => parens(
      'define-const',
      field('name', $._symbol),
      field('sort', $.sort),
      field('body', $._term),
    ),

    define_fun: $ => parens(
      choice('define-fun', 'model-add'),
      field('name', $._declared_symbol),
      $._function_signature,
      field('body', $._term),
    ),

    define_fun_rec: $ => parens(
      'define-fun-rec',
      $._function_declaration,
      field('body', $._term),
    ),

    _function_declaration: $ => seq(
      field('name', $._symbol),
      $._function_signature,
    ),

    _function_signature: $ => seq(
      field('parameters', list($.sorted_var)),
      field('range', $.sort),
    ),

    define_funs_rec: $ => parens(
      'define-funs-rec',
      field('declarations', list($.function_declaration)),
      field('bodies', list($._term)),
    ),

    function_declaration: $ => parens($._function_declaration),

    define_sort: $ => parens(
      'define-sort',
      field('name', $._declared_symbol),
      field('parameters', list($._declared_symbol)),
      field('sort', $.sort),
    ),

    echo: $ => parens('echo', field('string', $.string)),

    get_value: $ => parens(
      'get-value',
      field('terms', list($._term)),
      optional(seq(
        alias(choice(':model-index', ':model_index'), $.keyword),
        field('model_index', $.numeral),
      )),
    ),

    // Z3 allows the indices of models.
    get_model: $ => parens('get-model', repeat(field('index', $.numeral))),

    get_info: $ => parens('get-info', field('flag', $.keyword)),

    get_option: $ => parens('get-option', field('option', $.keyword)),

    pop: $ => parens('pop', optional(field('levels', $.numeral))),

    push: $ => parens('push', optional(field('levels', $.numeral))),

    // Z3 only allows atoms as the values of options and info.
    _option_value: $ => choice($._spec_constant, $._symbol),

    set_info: $ => parens(
      'set-info',
      field('keyword', $.keyword),
      field('value', $._option_value),
    ),

    set_logic: $ => parens('set-logic', field('logic', $._symbol)),

    set_option: $ => parens(
      'set-option',
      field('option', $.keyword),
      field('value', $._option_value),
    ),

    // Commands without arguments.
    simple_command: $ => parens(choice(
      'exit',
      'get-assertions',
      'get-assignment',
      'get-proof',
      'get-unsat-assumptions',
      'get-unsat-core',
      'reset',
      'reset-assertions',
      // Z3's
      'get-objectives',
      'get-user-tactics',
      'help-tactic',
      'labels',
    )),

    // Z3's commands that take a term, followed by attributes for some.
    term_command: $ => choice(
      parens(
        choice('display', 'maximize', 'minimize'),
        field('term', $._term),
      ),
      parens(
        choice('assert-soft', 'eval', 'simplify'),
        field('term', $._term),
        repeat(field('attribute', alias($._generic_attribute, $.attribute))),
      ),
    ),

    // Z3's commands that take a tactic, followed by attributes.
    tactic_command: $ => parens(
      choice('apply', 'check-sat-using'),
      field('tactic', $._s_expr),
      repeat(field('attribute', alias($._generic_attribute, $.attribute))),
    ),

    help: $ => parens('help', repeat(field('command', $._symbol))),

    _generic_attribute: $ => seq(
      field('keyword', $.keyword),
      field('value', $._s_expr),
    ),

    command: $ => parens(
      field('name', $.symbol),
      repeat(field('argument', $._s_expr)),
    ),
  },
});
