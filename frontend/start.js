// frontend/start.js
const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  PORT: process.env.PORT || "3001",
  HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
};

const result = spawnSync(process.execPath, ["server.js"], {
  cwd: __dirname,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
