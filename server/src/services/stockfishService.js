const { spawn } = require("node:child_process");
const { createHttpError } = require("../utils/createHttpError");

const DIFFICULTY_TO_DEPTH = {
  easy: 6,
  medium: 10,
  hard: 14,
};

function getSearchDepth(difficulty) {
  return DIFFICULTY_TO_DEPTH[difficulty] ?? DIFFICULTY_TO_DEPTH.medium;
}

function runStockfishCommand({ fen, difficulty }) {
  return new Promise((resolve, reject) => {
    const enginePath = require.resolve("stockfish/scripts/cli.js");
    const child = spawn(process.execPath, [enginePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const depth = getSearchDepth(difficulty);
    let settled = false;
    let output = "";
    let errorOutput = "";

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGTERM");
      reject(createHttpError(500, "Stockfish timed out while searching"));
    }, 8_000);

    function finishError(message) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(createHttpError(500, message));
    }

    function finishSuccess(bestMove) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve(bestMove);
    }

    child.stdout.on("data", (chunk) => {
      const data = chunk.toString();
      output += data;
      const lines = output.split(/\r?\n/);
      output = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("bestmove ")) {
          const [_, move] = trimmed.split(/\s+/);
          finishSuccess(move);
          return;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on("error", () => {
      finishError("Stockfish failed to start");
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      const message =
        errorOutput.trim() ||
        `Stockfish exited unexpectedly (code ${code ?? "unknown"})`;
      finishError(message);
    });

    child.stdin.write("uci\n");
    child.stdin.write("isready\n");
    child.stdin.write("ucinewgame\n");
    child.stdin.write(`position fen ${fen}\n`);
    child.stdin.write(`go depth ${depth}\n`);
  });
}

module.exports = {
  runStockfishCommand,
};
