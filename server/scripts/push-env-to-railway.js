/**
 * Push DATABASE_URL, DIRECT_URL, JWT_SECRET from server/.env to Railway (linked project).
 *
 * Prerequisites:
 *   npm install -g @railway/cli
 *   railway login
 *   From repo root: railway link   (pick Chesshub project + API service)
 *
 * Usage (from ChessHub repo root):  node server/scripts/push-env-to-railway.js
 * Optional:                           set RAILWAY_SERVICE=my-service-name
 */

const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const KEYS = ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET"];
const repoRoot = path.join(__dirname, "..", "..");
const service = process.env.RAILWAY_SERVICE;

for (const key of KEYS) {
  const value = process.env[key];
  if (!value) {
    console.warn(`[skip] ${key} is not set in server/.env`);
    continue;
  }

  const args = ["variable", "set"];
  if (service) {
    args.push("-s", service);
  }
  args.push(key, "--stdin", "--skip-deploys");

  const result = spawnSync("railway", args, {
    cwd: repoRoot,
    input: value,
    encoding: "utf-8",
    shell: process.platform === "win32",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    console.error(`[error] Failed to set ${key}`);
    if (result.stderr) {
      console.error(result.stderr);
    }
    if (result.stdout) {
      console.error(result.stdout);
    }
    process.exit(result.status ?? 1);
  }

  console.log(`[ok] ${key}`);
}

console.log("Done. Trigger a redeploy on Railway if needed.");
