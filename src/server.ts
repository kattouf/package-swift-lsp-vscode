import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import { window } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import { execCommand } from "./utils";
import { downloadLanguageServer } from "./downloader";
import { isValidPackageSwiftFile } from "./validation";
import { EXECUTABLE_NAME, state } from "./shared";

/**
 * Start the language server
 */
export async function startLanguageServer(
  context: vscode.ExtensionContext,
): Promise<LanguageClient | undefined> {
  try {
    // Check if we're on a supported platform
    if (os.platform() !== "darwin" && os.platform() !== "linux") {
      window.showErrorMessage(
        "Package.swift LSP is currently only supported on macOS and Linux",
      );
      state.outputChannel?.appendLine("Unsupported platform: " + os.platform());
      return undefined;
    }

    if (os.arch() !== "x64" && os.arch() !== "arm64") {
      window.showErrorMessage(
        "Package.swift LSP is currently only supported on x86_64 and arm64 architectures",
      );
      state.outputChannel?.appendLine("Unsupported architecture: " + os.arch());
      return undefined;
    }

    const serverPath = await getLanguageServerPath(context);
    if (!serverPath) {
      return undefined;
    }

    // Create the server options
    const serverOptions: ServerOptions = {
      run: {
        command: serverPath,
        args: [],
      },
      debug: {
        command: serverPath,
        args: [],
      },
    };

    // Create the client options
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", pattern: "**/Package.swift" },
        { scheme: "file", pattern: "**/Package@swift-*.swift" },
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher(
          "**/{Package.swift,Package@swift-*.swift}",
        ),
      },
      middleware: {
        didOpen: (document, next) => {
          if (isValidPackageSwiftFile(document)) {
            return next(document);
          }
          return Promise.resolve();
        },
        didChange: (event, next) => {
          if (isValidPackageSwiftFile(event.document)) {
            return next(event);
          }
          return Promise.resolve();
        },
        didClose: (document, next) => {
          if (isValidPackageSwiftFile(document)) {
            return next(document);
          }
          return Promise.resolve();
        },
        didSave: (document, next) => {
          if (isValidPackageSwiftFile(document)) {
            return next(document);
          }
          return Promise.resolve();
        },
      },
      outputChannel: state.outputChannel!,
      traceOutputChannel: state.outputChannel!,
    };

    // Create and start the client
    const languageClient = new LanguageClient(
      "package-swift-lsp",
      "Package.swift LSP",
      serverOptions,
      clientOptions,
    );

    // Start the client
    languageClient.start();
    state.outputChannel?.appendLine("Package.swift LSP client started");

    return languageClient;
  } catch (error) {
    window.showErrorMessage(`Failed to start Package.swift LSP: ${error}`);
    state.outputChannel?.appendLine(`Error starting language server: ${error}`);
    return undefined;
  }
}
/**
 * Get the path to the language server executable
 */
async function getLanguageServerPath(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration("package-swift-lsp");
  const customPath = config.get<string>("path", "");

  // If user has specified a custom path, use that
  if (customPath) {
    state.outputChannel?.appendLine(
      `Using custom language server path: ${customPath}`,
    );

    if (!fs.existsSync(customPath)) {
      window.showErrorMessage(
        `Custom Package.swift LSP path not found: ${customPath}`,
      );
      return undefined;
    }

    return customPath;
  }

  // Look for the language server in PATH
  try {
    const whichPath = await execCommand("which", [EXECUTABLE_NAME]);
    if (whichPath.trim()) {
      state.outputChannel?.appendLine(
        `Found language server in PATH: ${whichPath.trim()}`,
      );
      return whichPath.trim();
    }
  } catch (error) {
    state.outputChannel?.appendLine(
      `Language server not found in PATH: ${error}`,
    );
  }

  // Download the language server from GitHub releases
  return downloadLanguageServer(context);
}
