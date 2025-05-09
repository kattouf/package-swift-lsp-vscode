import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import * as child_process from 'child_process';
import { ExtensionContext, OutputChannel, window } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

const PACKAGE_SWIFT_LSP_GITHUB_REPO = 'kattouf/package-swift-lsp';
const EXECUTABLE_NAME = 'package-swift-lsp';

let client: LanguageClient | undefined;
let outputChannel: OutputChannel;

export async function activate(context: ExtensionContext) {
    outputChannel = window.createOutputChannel('Package.swift LSP');
    outputChannel.appendLine('Activating Package.swift LSP extension');

    const config = vscode.workspace.getConfiguration('package-swift-lsp');
    const isEnabled = config.get<boolean>('enable', true);

    if (!isEnabled) {
        outputChannel.appendLine('Extension is disabled via configuration');
        return;
    }

    // Check if we're on a supported platform
    if (os.platform() !== 'darwin') {
        window.showErrorMessage('Package.swift LSP is currently only supported on macOS');
        outputChannel.appendLine('Unsupported platform: ' + os.platform());
        return;
    }

    if (os.arch() !== 'x64' && os.arch() !== 'arm64') {
        window.showErrorMessage('Package.swift LSP is currently only supported on x86_64 and arm64 architectures');
        outputChannel.appendLine('Unsupported architecture: ' + os.arch());
        return;
    }

    try {
        const serverPath = await getLanguageServerPath(context);
        if (!serverPath) {
            return;
        }

        // Create the server options
        const serverOptions: ServerOptions = {
            run: {
                command: serverPath,
                transport: TransportKind.stdio
            },
            debug: {
                command: serverPath,
                transport: TransportKind.stdio
            }
        };

        // Create the client options
        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'swift', pattern: '**/Package.swift' }
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/Package.swift')
            },
            outputChannel: outputChannel
        };

        // Create and start the client
        client = new LanguageClient(
            'package-swift-lsp',
            'Package.swift LSP',
            serverOptions,
            clientOptions
        );

        // Start the client
        client.start();
        outputChannel.appendLine('Package.swift LSP client started');
    } catch (error) {
        window.showErrorMessage(`Failed to start Package.swift LSP: ${error}`);
        outputChannel.appendLine(`Error activating extension: ${error}`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

async function getLanguageServerPath(context: ExtensionContext): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('package-swift-lsp');
    const customPath = config.get<string>('path', '');

    // If user has specified a custom path, use that
    if (customPath) {
        outputChannel.appendLine(`Using custom language server path: ${customPath}`);
        
        if (!fs.existsSync(customPath)) {
            window.showErrorMessage(`Custom Package.swift LSP path not found: ${customPath}`);
            return undefined;
        }
        
        makeFileExecutable(customPath);
        return customPath;
    }

    // Look for the language server in PATH
    try {
        const whichPath = await execCommand('which', [EXECUTABLE_NAME]);
        if (whichPath.trim()) {
            outputChannel.appendLine(`Found language server in PATH: ${whichPath.trim()}`);
            return whichPath.trim();
        }
    } catch (error) {
        outputChannel.appendLine(`Language server not found in PATH: ${error}`);
    }

    // Download the language server from GitHub releases
    return downloadLanguageServer(context);
}

async function downloadLanguageServer(context: ExtensionContext): Promise<string | undefined> {
    const serverDir = path.join(context.globalStorageUri.fsPath, 'server');
    
    // Create server directory if it doesn't exist
    if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
    }

    // Get latest release from GitHub
    window.showInformationMessage('Downloading Package.swift LSP...');
    outputChannel.appendLine('Downloading Package.swift LSP from GitHub...');
    
    try {
        const latestReleaseInfo = await getLatestReleaseInfo();
        const version = latestReleaseInfo.tag_name;
        outputChannel.appendLine(`Latest version: ${version}`);
        
        const versionDir = path.join(serverDir, `${EXECUTABLE_NAME}-${version}`);
        const executablePath = path.join(versionDir, EXECUTABLE_NAME);
        
        // If the version is already downloaded, use that
        if (fs.existsSync(executablePath)) {
            outputChannel.appendLine(`Using cached version: ${executablePath}`);
            return executablePath;
        }
        
        // Create version directory
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }
        
        // Find the right asset for the current platform
        const arch = os.arch() === 'arm64' ? 'arm64' : 'x86_64';
        const assetName = `${EXECUTABLE_NAME}-${version.replace('v', '')}-${arch}-apple-macosx.zip`;
        
        const asset = latestReleaseInfo.assets.find((asset: GitHubAsset) => asset.name === assetName);
        if (!asset) {
            throw new Error(`No matching asset found for ${assetName}`);
        }
        
        // Download and extract the asset
        outputChannel.appendLine(`Downloading ${asset.browser_download_url}...`);
        
        // Download to a temporary zip file
        const zipPath = path.join(versionDir, `${assetName}`);
        await downloadFile(asset.browser_download_url, zipPath);
        
        // Extract the zip file
        outputChannel.appendLine(`Extracting ${zipPath}...`);
        await extractZip(zipPath, versionDir);
        
        // Cleanup
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
        
        // Make the binary executable
        makeFileExecutable(executablePath);
        
        // Clean up old versions
        cleanupOldVersions(serverDir, version);
        
        outputChannel.appendLine(`Language server ready at: ${executablePath}`);
        return executablePath;
    } catch (error) {
        window.showErrorMessage(`Failed to download Package.swift LSP: ${error}`);
        outputChannel.appendLine(`Download error: ${error}`);
        return undefined;
    }
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
}

interface GitHubRelease {
    tag_name: string;
    assets: GitHubAsset[];
}

function getLatestReleaseInfo(): Promise<GitHubRelease> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'package-swift-lsp-vscode'
            }
        };
        
        https.get(
            `https://api.github.com/repos/${PACKAGE_SWIFT_LSP_GITHUB_REPO}/releases/latest`,
            options,
            (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`GitHub API responded with status code ${res.statusCode}: ${data}`));
                        return;
                    }
                    
                    try {
                        const release = JSON.parse(data);
                        resolve(release);
                    } catch (error) {
                        reject(new Error(`Failed to parse GitHub API response: ${error}`));
                    }
                });
            }
        ).on('error', (error) => {
            reject(new Error(`Failed to fetch latest release: ${error}`));
        });
    });
}

function downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download file: Server responded with ${res.statusCode}`));
                return;
            }
            
            res.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (error) => {
            fs.unlink(destination, () => {});
            reject(error);
        });
    });
}

async function extractZip(zipPath: string, destination: string): Promise<void> {
    if (os.platform() === 'darwin' || os.platform() === 'linux') {
        await execCommand('unzip', ['-o', zipPath, '-d', destination]);
    } else {
        throw new Error('Unsupported platform for extraction');
    }
}

function makeFileExecutable(filePath: string): void {
    if (os.platform() === 'darwin' || os.platform() === 'linux') {
        try {
            fs.chmodSync(filePath, '755');
            outputChannel.appendLine(`Made ${filePath} executable`);
        } catch (error) {
            outputChannel.appendLine(`Failed to make ${filePath} executable: ${error}`);
        }
    }
}

function cleanupOldVersions(serverDir: string, currentVersion: string): void {
    try {
        const entries = fs.readdirSync(serverDir);
        const prefix = `${EXECUTABLE_NAME}-`;
        
        for (const entry of entries) {
            const entryPath = path.join(serverDir, entry);
            
            if (entry.startsWith(prefix) && !entry.includes(currentVersion)) {
                outputChannel.appendLine(`Cleaning up old version: ${entryPath}`);
                fs.rmSync(entryPath, { recursive: true, force: true });
            }
        }
    } catch (error) {
        outputChannel.appendLine(`Error cleaning up old versions: ${error}`);
    }
}

function execCommand(command: string, args: string[]): Promise<string> {
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