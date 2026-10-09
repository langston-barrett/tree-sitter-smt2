; Commands

[
  "assert"
  "check-sat"
  "check-sat-assuming"
  "declare-const"
  "declare-datatype"
  "declare-datatypes"
  "declare-fun"
  "declare-sort"
  "define-const"
  "define-fun"
  "define-fun-rec"
  "define-funs-rec"
  "define-sort"
  "echo"
  "exit"
  "get-assertions"
  "get-assignment"
  "get-info"
  "get-model"
  "get-option"
  "get-proof"
  "get-unsat-assumptions"
  "get-unsat-core"
  "get-value"
  "pop"
  "push"
  "reset"
  "reset-assertions"
  "set-info"
  "set-logic"
  "set-option"
  ; Z3's
  "apply"
  "assert-soft"
  "check-sat-using"
  "display"
  "eval"
  "get-objectives"
  "get-user-tactics"
  "help"
  "help-tactic"
  "labels"
  "maximize"
  "minimize"
  "model-add"
  "simplify"
] @keyword

(command
  name: (symbol) @keyword)

; Binders

[
  "let"
  "match"
  "par"
] @keyword

[
  "forall"
  "exists"
  "lambda"
  "choice"
] @keyword.operator

[
  "!"
  "_"
  "as"
] @operator

"root-obj" @function.builtin

; Literals

[
  (numeral)
  (decimal)
  (hexadecimal)
  (binary)
] @number

(string) @string

(comment) @comment

(keyword) @attribute

; Sorts

(sort
  (symbol) @type)

(sort
  name: (symbol) @type)

(sort
  (indexed_identifier
    name: (symbol) @type))

(sort_declaration
  name: (_) @type.definition)

(declare_sort
  name: (_) @type.definition)

(define_sort
  name: (_) @type.definition)

(define_sort
  parameters: (_) @type.parameter)

(datatype
  parameters: (_) @type.parameter)

(declare_datatypes
  parameters: (_) @type.parameter)

(declare_datatype
  name: (_) @type.definition)

(constructor
  name: (_) @constructor)

(selector
  name: (_) @function)

; Declarations

(declare_const
  name: (_) @constant)

(declare_fun
  name: (_) @function)

(define_const
  name: (_) @constant)

(define_fun
  name: (_) @function)

(define_fun_rec
  name: (_) @function)

(function_declaration
  name: (_) @function)

(sorted_var
  name: (_) @variable.parameter)

(binding
  name: (_) @variable)

(set_logic
  logic: (_) @constant.builtin)

; Terms

(application
  function: [
    (symbol)
    (quoted_symbol)
  ] @function.call)

(application
  function: (indexed_identifier
    name: (_) @function.call))

(qualified_identifier
  name: [
    (symbol)
    (quoted_symbol)
  ] @function.call)

((symbol) @boolean
  (#any-of? @boolean "true" "false"))

; Punctuation

[
  "("
  ")"
] @punctuation.bracket
