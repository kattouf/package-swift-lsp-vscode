# Package.swift LSP for Visual Studio Code

A Visual Studio Code extension that provides language server protocol (LSP) support for Swift Package Manager's Package.swift manifest files.

## Features

- Code completion for Package.swift manifest files
- Hover information for SPM declarations and syntax elements
- Powered by the [Package.swift LSP](https://github.com/kattouf/package-swift-lsp) server

## Requirements

- macOS (currently only supported on macOS platforms)
- x86_64 or arm64 architecture

## Installation

You can install this extension directly from the Visual Studio Code Marketplace or by building it from source.

### Building from Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript files
4. Run `npm run package` to create the VSIX package
5. Install the VSIX package in VS Code using the "Install from VSIX..." command

## Extension Settings

This extension contributes the following settings:

* `package-swift-lsp.enable`: Enable/disable the Package.swift LSP extension
* `package-swift-lsp.path`: Optional path to a custom package-swift-lsp executable
* `package-swift-lsp.trace.server`: Trace communication between VS Code and the language server

## How it Works

On first activation, the extension will:

1. Check if a custom path to the language server is configured
2. If not, look for the language server in PATH
3. If not found, download the latest release from GitHub
4. Start the language server for Package.swift files

## License

This extension is available under the MIT license.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.