package tree_sitter_smt2_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_smt2 "github.com/langston-barrett/tree-sitter-smt2/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_smt2.Language())
	if language == nil {
		t.Errorf("Error loading SMT-LIB 2 grammar")
	}
}
