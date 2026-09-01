const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { setTimeout: sleep } = require("node:timers/promises");

const MODEL_URL =
  process.env.LOCAL_MODEL_URL ||
  "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf";

const MODEL_DIR = process.env.LOCAL_MODEL_DIR || "models";
const MODEL_FILE =
  process.env.LOCAL_MODEL_FILE || "Llama-3.2-3B-Instruct-Q4_K_M.gguf";

const MAX_ATTEMPTS = Number(process.env.LOCAL_MODEL_ATTEMPTS || 6);
const LOG_EVERY_BYTES = 100 * 1024 * 1024;

function resolveDir() {
  return path.isAbsolute(MODEL_DIR)
    ? MODEL_DIR
    : path.resolve(process.cwd(), MODEL_DIR);
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sizeOf(file) {
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

/**
 * One pass at the file, resuming from whatever is already on disk.
 *
 * Returns the number of bytes present afterwards and the full size the server
 * reported, so the caller can decide whether another pass is needed. A dropped
 * connection part-way through a 2 GB download is common enough that starting
 * over every time would rarely finish.
 */
async function fetchInto(partial) {
  let startAt = sizeOf(partial);

  const response = await fetch(MODEL_URL, {
    redirect: "follow",
    headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
  });

  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  // A server that ignores Range answers 200 with the whole file, which would
  // otherwise be appended onto the bytes already there.
  if (startAt > 0 && response.status !== 206) {
    fs.rmSync(partial, { force: true });
    startAt = 0;
  }

  const remaining = Number(response.headers.get("content-length") ?? 0);
  const total = remaining ? startAt + remaining : 0;

  if (startAt > 0) {
    console.log(`  resuming from ${formatMb(startAt)}`);
  }

  let received = startAt;
  let lastLogged = startAt;

  const source = Readable.fromWeb(response.body);
  source.on("data", (chunk) => {
    received += chunk.length;
    if (received - lastLogged < LOG_EVERY_BYTES) return;
    lastLogged = received;
    console.log(
      total
        ? `  ${formatMb(received)} / ${formatMb(total)}`
        : `  ${formatMb(received)}`
    );
  });

  await pipeline(
    source,
    fs.createWriteStream(partial, { flags: startAt > 0 ? "a" : "w" })
  );

  return { received, total };
}

async function main() {
  const dir = resolveDir();
  const target = path.join(dir, MODEL_FILE);

  if (fs.existsSync(target)) {
    console.log(
      `Local model already present at ${target} (${formatMb(
        sizeOf(target)
      )}). Skipping download.`
    );
    return;
  }

  fs.mkdirSync(dir, { recursive: true });

  // Downloaded under a temporary name: an interrupted deploy would otherwise
  // leave a truncated file that looks present and fails to load.
  const partial = `${target}.partial`;

  console.log(`Downloading local model from ${MODEL_URL}`);
  console.log(`  -> ${target}`);

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { received, total } = await fetchInto(partial);

      if (total && received < total) {
        throw new Error(
          `truncated at ${formatMb(received)} of ${formatMb(total)}`
        );
      }

      fs.renameSync(partial, target);
      console.log(`Local model ready (${formatMb(received)}).`);
      return;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);

      if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
    }
  }

  fs.rmSync(partial, { force: true });
  throw lastError ?? new Error("download failed");
}

main().catch((err) => {
  // A missing local model is a degraded deploy, not a broken one: the API path
  // still works. Failing the build over it would take the whole service down.
  console.error(
    `Local model download failed: ${err instanceof Error ? err.message : err}`
  );
  console.error("Continuing without it — the Anthropic API path still works.");
  process.exitCode = 0;
});
