// swift-tools-version:5.6

import Foundation
import PackageDescription

let dir = Context.packageDirectory
var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "\(dir)/src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterSmt2",
    products: [
        .library(name: "TreeSitterSmt2", targets: ["TreeSitterSmt2"]),
    ],
    dependencies: [
        .package(url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.10.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterSmt2",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterSmt2Tests",
            dependencies: [
                .product(name: "SwiftTreeSitter", package: "swift-tree-sitter"),
                "TreeSitterSmt2",
            ],
            path: "bindings/swift/TreeSitterSmt2Tests"
        )
    ],
    cLanguageStandard: .c11
)
