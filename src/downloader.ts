import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { window } from "vscode";
import { EXECUTABLE_NAME, state } from "./shared";
import { makeFileExecutable, extractZip } from "./utils";

const PACKAGE_SWIFT_LSP_GITHUB_REPO = "kattouf/package-swift-lsp";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

/**
 * Download the language server from GitHub releases
 */
export async function downloadLanguageServer(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const serverDir = path.join(context.globalStorageUri.fsPath, "server");

  // Create server directory if it doesn't exist
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }

  // Get latest release from GitHub
  state.outputChannel?.appendLine(
    "Downloading Package.swift LSP from GitHub...",
  );

  try {
    const latestReleaseInfo = await getLatestReleaseInfo();
    const version = latestReleaseInfo.tag_name;
    state.outputChannel?.appendLine(`Latest version: ${version}`);

    const versionDir = path.join(serverDir, `${EXECUTABLE_NAME}-${version}`);
    const executablePath = path.join(versionDir, EXECUTABLE_NAME);

    // If the version is already downloaded, use that
    if (fs.existsSync(executablePath)) {
      state.outputChannel?.appendLine(
        `Using cached version: ${executablePath}`,
      );
      return executablePath;
    }

    // Create version directory
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    // Find the right asset for the current platform
    const arch = os.arch() === "arm64" ? "arm64" : "x86_64";
    const assetName = `${EXECUTABLE_NAME}-${version.replace("v", "")}-${arch}-apple-macosx.zip`;

    const asset = latestReleaseInfo.assets.find(
      (asset: GitHubAsset) => asset.name === assetName,
    );
    if (!asset) {
      throw new Error(`No matching asset found for ${assetName}`);
    }

    // Download and extract the asset
    state.outputChannel?.appendLine(
      `Downloading ${asset.browser_download_url}...`,
    );

    // Download to a temporary zip file
    const zipPath = path.join(versionDir, `${assetName}`);
    await downloadFile(asset.browser_download_url, zipPath);

    // Extract the zip file
    state.outputChannel?.appendLine(`Extracting ${zipPath}...`);
    await extractZip(zipPath, versionDir);

    // Cleanup
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Make the binary executable
    makeFileExecutable(executablePath);

    // Clean up old versions
    cleanupOldVersions(serverDir, version, EXECUTABLE_NAME);

    state.outputChannel?.appendLine(
      `Language server ready at: ${executablePath}`,
    );
    return executablePath;
  } catch (error) {
    window.showErrorMessage(`Failed to download Package.swift LSP: ${error}`);
    state.outputChannel?.appendLine(`Download error: ${error}`);
    return undefined;
  }
}

/**
 * Get the latest release information from GitHub
 */
function getLatestReleaseInfo(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "package-swift-lsp-vscode",
      },
    };

    https
      .get(
        `https://api.github.com/repos/${PACKAGE_SWIFT_LSP_GITHUB_REPO}/releases/latest`,
        options,
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(
                new Error(
                  `GitHub API responded with status code ${res.statusCode}: ${data}`,
                ),
              );
              return;
            }

            try {
              const release = JSON.parse(data);
              resolve(release);
            } catch (error) {
              reject(
                new Error(`Failed to parse GitHub API response: ${error}`),
              );
            }
          });
        },
      )
      .on("error", (error) => {
        reject(new Error(`Failed to fetch latest release: ${error}`));
      });
  });
}

/**
 * Download a file from the given URL to the specified destination
 */
function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    const handleResponse = (res: any) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        state.outputChannel?.appendLine(
          `Following redirect to ${res.headers.location}`,
        );
        file.close();
        downloadFile(res.headers.location, destination)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destination, () => {});
        reject(
          new Error(
            `Failed to download file: Server responded with ${res.statusCode}`,
          ),
        );
        return;
      }

      res.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });

      res.on("error", (error: Error) => {
        file.close();
        fs.unlink(destination, () => {});
        reject(error);
      });
    };

    state.outputChannel?.appendLine(`Starting download from ${url}`);

    const httpModule = url.startsWith("https:") ? https : require("http");
    const request = httpModule.get(url, handleResponse);

    request.on("error", (error: any) => {
      file.close();
      fs.unlink(destination, () => {});
      reject(error);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      fs.unlink(destination, () => {});
      reject(new Error("Request timed out after 30 seconds"));
    });
  });
}

/**
 * Clean up old versions of the language server
 */
function cleanupOldVersions(
  serverDir: string,
  currentVersion: string,
  executableName: string,
): void {
  try {
    const entries = fs.readdirSync(serverDir);
    const prefix = `${executableName}-`;

    for (const entry of entries) {
      const entryPath = path.join(serverDir, entry);

      if (entry.startsWith(prefix) && !entry.includes(currentVersion)) {
        state.outputChannel?.appendLine(
          `Cleaning up old version: ${entryPath}`,
        );
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    state.outputChannel?.appendLine(`Error cleaning up old versions: ${error}`);
  }
}
