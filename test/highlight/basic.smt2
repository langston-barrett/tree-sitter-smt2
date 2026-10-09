(set-logic QF_UFLIA)
; <- punctuation.bracket
;^ keyword
;          ^ constant.builtin
(declare-fun f (Int) Bool)
;            ^ function
;               ^ type
(declare-datatypes ((List 1)) ((par (T) ((nil) (cons (head T) (tail (List T)))))))
;                    ^ type.definition
;                                    ^ type.parameter
;                                         ^ constructor
;                                                     ^ function
(assert (forall ((x Int)) (! (f x) :pattern ((f x)))))
;        ^ keyword.operator
;                 ^ variable.parameter
;                          ^ operator
;                                  ^ attribute
(assert (= ((_ extract 3 0) #b10101010) #x5 "str" 42 true))
;            ^ operator
;              ^ function.call
;                           ^ number
;                                           ^ string
;                                                    ^ boolean
(check-sat-using (then simplify smt))
;^ keyword
(foo-bar 1)
;^ keyword
