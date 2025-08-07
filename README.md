# Package.swift LSP for Visual Studio Code

A Visual Studio Code extension that provides language server protocol (LSP) support for Swift Package Manager's Package.swift manifest files.

Powered by the [Package.swift LSP](https://github.com/kattouf/package-swift-lsp) server.

![demo](https://github.com/user-attachments/assets/4caa7126-a2d7-45dd-b663-2d3f31817f74)

## Features

Language server for Package.swift files that provides:

- Smart code completion for Package.swift manifest files:
  - In `.package(...)` function:
    - `url:` argument with GitHub repository suggestions
    - `from:` and `exact:` arguments with version suggestions
    - `branch:` argument with available branch names
  - In `.product(...)` function:
    - `name:` argument with available product suggestions from dependencies
    - `package:` argument with package name suggestions
  - In `.target(...)` function:
    - `name:` argument with local target name suggestions from your package
  - In target dependencies string literals:
    - Product name completion that automatically expands to `.product(name: "ProductName", package: "PackageName")` format
    - Local target name completion for referencing targets within your package to `.target(name: "LocalTarget")` format
> [!NOTE]
> After editing package dependencies (`.package(...)`), save the file for changes to be reflected in target completions.

- Contextual hover information:
  - Package details including location and state when hovering over package names
  - Available products in the package

## Requirements

- macOS or Linux
- x86_64 or arm64 architecture

## Installation

### Quick Install Options

**Option 1: Terminal command (macOS only)**
```bash
open vscode:extension/kattouf.package-swift-lsp
# For Cursor users:
open vscode:extension/kattouf.package-swift-lsp
```

**Option 2: From Marketplace**
- Visit the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kattouf.package-swift-lsp)

**Option 3: From VS Code Extensions**
1. Open VS Code
2. Go to Extensions tab (Ctrl+Shift+X / Cmd+Shift+X)  
3. Search for "Package.swift LSP"
4. Click Install

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

## How it Works

On first activation, the extension will:

1. Check if a custom path to the language server is configured
2. If not, look for the language server in PATH
3. If not found, download the latest release from GitHub
4. Start the language server for Package.swift files and versioned manifest files (Package@swift-X.Y.Z.swift)

The extension will only activate for files that exactly match the pattern `Package.swift` or `Package@swift-X.Y.Z.swift` where X, Y, and Z are version numbers.

## License

This extension is available under the MIT license.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
