import XCTest
import SwiftTreeSitter
import TreeSitterSmt2

final class TreeSitterSmt2Tests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_smt2())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading SMT-LIB 2 grammar")
    }
}
