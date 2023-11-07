import * as vscode from "vscode";
import * as path from "path";
import * as findUp from "find-up";
import { configFiles } from "./vitest-config-files";

function getCwd(testFile: string) {
  const configFilePath = findUp.findUpSync(configFiles, { cwd: testFile });

  if (!configFilePath) {
    return;
  }
  return path.dirname(configFilePath);
}

function buildVitestArgs({
  caseName,
  casePath,
  sanitize = true,
}: {
  caseName: string;
  casePath: string;
  sanitize?: boolean;
}) {
  let sanitizedCasePath = casePath;
  if (sanitize) {
    sanitizedCasePath = JSON.stringify(casePath);
    caseName = JSON.stringify(caseName);
  }

  const args = ["run", "--testNamePattern", caseName, sanitizedCasePath];

  const rootDir = getCwd(casePath);
  if (rootDir) {
    args.push("--root", rootDir);
  }

  return args;
}

function buildVitestDebugArgs({
  caseName,
  casePath,
  sanitize = true,
}: {
  caseName: string;
  casePath: string;
  sanitize?: boolean;
}) {
  let sanitizedCasePath = casePath;
  if (sanitize) {
    sanitizedCasePath = JSON.stringify(casePath);
    caseName = JSON.stringify(caseName);
  }

  const args = [
    "vitest",
    "run",
    "--testNamePattern",
    caseName,
    sanitizedCasePath,
  ];

  const rootDir = getCwd(casePath);
  if (rootDir) {
    args.push("--root", rootDir);
  }

  return args;
}

let terminal: vscode.Terminal | undefined;

async function saveFile(filePath: string) {
  await vscode.workspace.textDocuments
    .find((doc) => doc.fileName === filePath)
    ?.save();
}

export async function runInTerminal(text: string, filename: string) {
  let config = vscode.workspace.getConfiguration("simpleVitestRunner");
  let runCommand = config.get("runCommand") as string;
  let runPath = (config.get("runPath") as string) ?? "";

  let terminalAlreadyExists = true;
  if (!terminal || terminal.exitStatus) {
    terminalAlreadyExists = false;
    terminal?.dispose();

    terminal = vscode.window.createTerminal({
      name: "Vitest",
      location: {
        parentTerminal: vscode.window.activeTerminal!,
      },
    });

    if (runPath) {
      terminal.sendText(`cd ${runPath}`);
    }
  }

  const vitestArgs = buildVitestArgs({ caseName: text, casePath: filename });

  const npxArgs = [runCommand, ...vitestArgs];

  if (terminalAlreadyExists) {
    // CTRL-C to stop the previous run
    terminal.sendText("\x03");
  }

  await saveFile(filename);

  terminal.sendText(npxArgs.join(" "), true);
  terminal.show();
}

function buildDebugConfig(
  casePath: string,
  text: string
): vscode.DebugConfiguration {
  return {
    name: "Debug vitest case",
    request: "launch",
    runtimeArgs: buildVitestDebugArgs({
      caseName: text,
      casePath: casePath,
      sanitize: false,
    }),
    cwd: getCwd(casePath) || path.dirname(casePath),
    runtimeExecutable: "npx",
    skipFiles: ["<node_internals>/**"],
    type: "pwa-node",
    console: "integratedTerminal",
    internalConsoleOptions: "neverOpen",
  };
}

export async function debugInTerminal(text: string, filename: string) {
  const config = buildDebugConfig(filename, text);

  await saveFile(filename);
  vscode.debug.startDebugging(undefined, config);
}
