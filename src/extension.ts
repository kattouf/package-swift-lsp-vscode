import * as vscode from "vscode";
import { window, ExtensionContext } from "vscode";
import { state } from "./shared";
import { startLanguageServer } from "./server";

export async function activate(context: ExtensionContext) {
  state.outputChannel = window.createOutputChannel("Package.swift LSP");
  state.outputChannel.appendLine("Activating Package.swift LSP extension");

  const config = vscode.workspace.getConfiguration("package-swift-lsp");
  const isEnabled = config.get<boolean>("enable", true);

  if (!isEnabled) {
    state.outputChannel.appendLine("Extension is disabled via configuration");
    return;
  }

  state.client = await startLanguageServer(context);
}

export function deactivate(): Thenable<void> | undefined {
  if (!state.client) {
    return undefined;
  }
  return state.client.stop();
}
