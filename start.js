#!/usr/bin/env node

/**
 * CardioMind Full-Stack Launcher
 * Concurrently starts the FastAPI backend (port 8000) and Vite React frontend (port 5173).
 * Zero external dependencies required.
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

// Terminal colors
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";

console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
console.log(`${BOLD}${CYAN}  🫀  CardioMind — Full-Stack Application Launcher   ${RESET}`);
console.log(`${BOLD}${CYAN}====================================================${RESET}\n`);

// Parse CLI flags
const args = process.argv.slice(2);
const backendOnly = args.includes("--backend-only") || args.includes("--backend");
const frontendOnly = args.includes("--frontend-only") || args.includes("--frontend");

/**
 * Free a port if it is occupied by an orphaned process
 */
function freePort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const lines = out.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") {
          execSync(`taskkill /pid ${pid} /F`, { stdio: "ignore" });
        }
      }
    } else {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim().split(/\s+/);
      for (const pid of pids) {
        if (pid && Number(pid) !== process.pid) {
          try {
            process.kill(Number(pid), "SIGKILL");
          } catch {}
        }
      }
    }
  } catch {
    // Port is already free
  }
}

/**
 * Locate Python executable
 */
function getPythonCommand() {
  const venvPythonMacLinux = path.join(ROOT_DIR, ".venv", "bin", "python");
  const venvPythonWin = path.join(ROOT_DIR, ".venv", "Scripts", "python.exe");

  if (fs.existsSync(venvPythonMacLinux)) {
    return { cmd: venvPythonMacLinux, isVenv: true };
  } else if (fs.existsSync(venvPythonWin)) {
    return { cmd: venvPythonWin, isVenv: true };
  }

  // Fallback to system python3 or python
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return { cmd: "python3", isVenv: false };
  } catch {
    return { cmd: "python", isVenv: false };
  }
}

const childProcesses = [];

function killProcesses() {
  console.log(`\n${YELLOW}Shutting down CardioMind processes...${RESET}`);
  childProcesses.forEach(({ proc }) => {
    if (proc && !proc.killed) {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
        } else {
          proc.kill("SIGTERM");
        }
      } catch {
        // Process might have already exited
      }
    }
  });
  process.exit(0);
}

process.on("SIGINT", killProcesses);
process.on("SIGTERM", killProcesses);
process.on("exit", killProcesses);

function startBackend() {
  freePort(8000);

  const { cmd: pyCmd, isVenv } = getPythonCommand();
  const venvNotice = isVenv ? `(using .venv)` : `(using system python)`;
  console.log(`${GREEN}[Backend]${RESET} Starting FastAPI backend on http://localhost:8000 ${venvNotice}...`);

  const env = {
    ...process.env,
    PYTHONPATH: ROOT_DIR,
    PYTHONUNBUFFERED: "1"
  };

  const backendProc = spawn(pyCmd, ["-m", "uvicorn", "backend.main:app", "--reload", "--port", "8000"], {
    cwd: ROOT_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  childProcesses.push({ name: "Backend", proc: backendProc });

  backendProc.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${GREEN}[Backend]${RESET} ${line}`);
      }
    }
  });

  backendProc.stderr.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${GREEN}[Backend]${RESET} ${line}`);
      }
    }
  });

  backendProc.on("error", (err) => {
    console.error(`${RED}[Backend Error]${RESET} Failed to start backend: ${err.message}`);
  });

  backendProc.on("close", (code) => {
    if (code !== null && code !== 0) {
      console.log(`${YELLOW}[Backend]${RESET} Exited with code ${code}`);
    }
  });
}

function startFrontend() {
  freePort(5173);

  // Ensure frontend dependencies are installed
  const nodeModulesPath = path.join(FRONTEND_DIR, "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`${BLUE}[Frontend]${RESET} node_modules not found. Running npm install in frontend...`);
    execSync("npm install", { cwd: FRONTEND_DIR, stdio: "inherit" });
  }

  console.log(`${BLUE}[Frontend]${RESET} Starting Vite dev server on http://localhost:5173...`);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const frontendProc = spawn(npmCmd, ["run", "dev"], {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  childProcesses.push({ name: "Frontend", proc: frontendProc });

  frontendProc.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${BLUE}[Frontend]${RESET} ${line}`);
      }
    }
  });

  frontendProc.stderr.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${BLUE}[Frontend]${RESET} ${line}`);
      }
    }
  });

  frontendProc.on("error", (err) => {
    console.error(`${RED}[Frontend Error]${RESET} Failed to start frontend: ${err.message}`);
  });

  frontendProc.on("close", (code) => {
    if (code !== null && code !== 0) {
      console.log(`${YELLOW}[Frontend]${RESET} Exited with code ${code}`);
    }
  });
}

// Start requested services
if (!frontendOnly) {
  startBackend();
}

if (!backendOnly) {
  startFrontend();
}

console.log(`${BOLD}${MAGENTA}✨ Access Points:${RESET}`);
if (!frontendOnly) {
  console.log(`   🔗 FastAPI Docs:      ${BOLD}http://localhost:8000/docs${RESET}`);
  console.log(`   🔗 API Health:        ${BOLD}http://localhost:8000/health${RESET}`);
}
if (!backendOnly) {
  console.log(`   🔗 Web Dashboard:     ${BOLD}http://localhost:5173${RESET}`);
}
console.log(`\n${YELLOW}Press Ctrl+C at any time to gracefully stop all services.${RESET}\n`);
