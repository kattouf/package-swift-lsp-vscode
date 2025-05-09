import * as path from "path";
import { TextDocument } from "vscode";

const PACKAGE_SWIFT_REGEX =
  /^Package@swift-(\d+)(?:\.(\d+))?(?:\.(\d+))?\.swift$/;

/**
 * Validate that a document is either Package.swift or matches the Swift Package Manager
 * versioned manifest pattern: Package@swift-X.Y.Z.swift
 */
export function isValidPackageSwiftFile(document: TextDocument): boolean {
  const fileName = path.basename(document.uri.fsPath);

  if (fileName === "Package.swift") {
    return true;
  }

  return PACKAGE_SWIFT_REGEX.test(fileName);
}
