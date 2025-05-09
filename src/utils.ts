import * as fs from "fs";
import * as os from "os";
import * as child_process from "child_process";
import { state } from "./shared";

/**
 * Make a file executable (chmod 755)
 */
export function makeFileExecutable(filePath: string): void {
  if (os.platform() === "darwin" || os.platform() === "linux") {
    try {
      fs.chmodSync(filePath, 0o755);
      state.outputChannel?.appendLine(`Made ${filePath} executable`);
    } catch (error) {
      state.outputChannel?.appendLine(
        `Failed to make ${filePath} executable: ${error}`,
      );
    }
  }
}

/**
 * Execute a command with the given arguments
 */
export function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    child_process.execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\nStderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Extract a zip file
 */
export async function extractZip(
  zipPath: string,
  destination: string,
): Promise<void> {
  if (os.platform() === "darwin" || os.platform() === "linux") {
    await execCommand("unzip", ["-o", zipPath, "-d", destination]);
  } else {
    throw new Error("Unsupported platform for extraction");
  }
}
