const { spawn } = require("child_process");

const processes = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    ...options
  });
  processes.push(child);
  child.on("exit", (code) => {
    if (code && !process.exitCode) {
      process.exitCode = code;
    }
    stopAll();
  });
  return child;
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit();
});

start("node", ["server.js"], {
  env: { ...process.env, PORT: "3001", API_ONLY: "true" }
});
start("npx", ["vite", "--host", "0.0.0.0", "--port", "3000"]);
