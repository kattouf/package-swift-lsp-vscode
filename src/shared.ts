import { LanguageClient } from "vscode-languageclient/node";
import { OutputChannel } from "vscode";

export const EXECUTABLE_NAME = "package-swift-lsp";

// Create an object to hold shared state
export const state = {
  client: undefined as LanguageClient | undefined,
  outputChannel: undefined as OutputChannel | undefined,
};
