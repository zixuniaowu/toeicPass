import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, watch } from "node:fs";
import path from "node:path";

const packageDir = process.cwd();
const webDir = path.join(packageDir, "web");
const distWebDir = path.join(packageDir, "dist", "web");
const tscArgs = ["-p", "tsconfig.json", ...process.argv.slice(2)];
const isWatchMode = process.argv.includes("--watch");

function walkFiles(dirPath, visitor) {
  if (!existsSync(dirPath)) {
    return;
  }

  for (const entry of readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, visitor);
      continue;
    }
    visitor(fullPath);
  }
}

function isWebAsset(filePath) {
  return filePath.endsWith(".css");
}

function syncWebAssets() {
  const copiedAssets = new Set();

  walkFiles(webDir, (sourcePath) => {
    if (!isWebAsset(sourcePath)) {
      return;
    }

    const relativePath = path.relative(webDir, sourcePath);
    const targetPath = path.join(distWebDir, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    copiedAssets.add(targetPath);
  });

  walkFiles(distWebDir, (targetPath) => {
    if (!isWebAsset(targetPath) || copiedAssets.has(targetPath)) {
      return;
    }
    rmSync(targetPath);
  });
}

syncWebAssets();

if (isWatchMode && existsSync(webDir)) {
  let syncTimer;
  watch(webDir, { recursive: true }, () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncWebAssets();
    }, 25);
  });
}

const tscCommand = process.platform === "win32" ? "cmd.exe" : "tsc";
const child = spawn(tscCommand, process.platform === "win32" ? ["/d", "/s", "/c", "tsc", ...tscArgs] : tscArgs, {
  cwd: packageDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (!isWatchMode) {
    syncWebAssets();
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});