import fs from "node:fs";
import path from "node:path";
import { env } from "../env";

const LOCAL_CONTEXT_SIZE = 4096;
const LOCAL_MAX_TOKENS = 1024;

// node-llama-cpp ships ESM only, and this package compiles to CommonJS. A bare
// `await import()` would be emitted as `require()` and fail at runtime, so the
// import is built at runtime where the compiler cannot rewrite it.
const importEsm = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<any>;

interface LoadedModel {
  LlamaChatSession: any;
  context: any;
}

let modelPromise: Promise<LoadedModel> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export function localModelPath(): string {
  const dir = path.isAbsolute(env.LOCAL_MODEL_DIR)
    ? env.LOCAL_MODEL_DIR
    : path.resolve(process.cwd(), env.LOCAL_MODEL_DIR);
  return path.join(dir, env.LOCAL_MODEL_FILE);
}

export function isLocalModelAvailable(): boolean {
  return fs.existsSync(localModelPath());
}

async function loadModel(): Promise<LoadedModel> {
  const modelPath = localModelPath();

  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `No local model at ${modelPath}. Run "node scripts/download-model.js" to fetch it.`
    );
  }

  const { getLlama, LlamaChatSession } = await importEsm("node-llama-cpp");
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  const context = await model.createContext({
    contextSize: LOCAL_CONTEXT_SIZE,
  });

  console.log(`Local model loaded from ${modelPath}`);

  return { LlamaChatSession, context };
}

export async function generateLocal(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!modelPromise) {
    modelPromise = loadModel().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }

  const loaded = await modelPromise;

  // llama.cpp holds one context sequence at a time here, so turns are queued
  // rather than run concurrently.
  const run = async (): Promise<string> => {
    const sequence = loaded.context.getSequence();
    try {
      const session = new loaded.LlamaChatSession({
        contextSequence: sequence,
        ...(systemPrompt ? { systemPrompt } : {}),
      });
      const answer: string = await session.prompt(prompt, {
        maxTokens: LOCAL_MAX_TOKENS,
      });
      return answer.trim();
    } finally {
      sequence.dispose();
    }
  };

  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
