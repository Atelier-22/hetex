// Aviel AI — local AI runtime.
//
// Two runtimes are supported, and which one is in play is detected rather than
// configured:
//
//   ollama    — an Ollama daemon reachable over HTTP. Full model management:
//               list, pull, delete, test. No API key, nothing leaves the host.
//   llamacpp  — the bundled GGUF file loaded through node-llama-cpp. One model,
//               managed as a file on disk, so it can be listed and tested but
//               not installed or removed through an API.
//
// Everything here reports what is actually true of the machine this process is
// running on. When neither runtime is present the status says so plainly and
// names what would be needed; nothing is stubbed out to look available.

import fs from "node:fs";
import { env } from "../env";
import {
  generateLocal,
  isLocalModelAvailable,
  localModelPath,
} from "./local-model";

export type LocalRuntimeKind = "ollama" | "llamacpp" | "none";

export interface LocalModelInfo {
  /** Identifier used to select, test or delete this model. */
  id: string;
  name: string;
  /** Bytes on disk. Null when the runtime does not report it. */
  sizeBytes: number | null;
  parameterSize: string | null;
  quantization: string | null;
  contextLength: number | null;
  capabilities: { text: boolean; vision: boolean; embedding: boolean };
  /**
   * Estimated resident memory to run it, derived from the file size plus KV
   * cache headroom. Explicitly an estimate — the runtimes do not report a
   * requirement, and inventing a precise number would be worse than a range.
   */
  estimatedRamBytes: number | null;
  estimatedVramBytes: number | null;
  installedAt: string | null;
}

export interface LocalRuntimeStatus {
  runtime: LocalRuntimeKind;
  available: boolean;
  endpoint: string | null;
  version: string | null;
  /** Can models be installed and removed through the API? */
  manageable: boolean;
  models: LocalModelInfo[];
  /** Why it is unavailable, when it is. */
  error: string | null;
  /** What the operator would have to do to make local AI work here. */
  requirement: string | null;
}

const OLLAMA_TIMEOUT_MS = 2_500;
const OLLAMA_LIST_TIMEOUT_MS = 6_000;

async function ollamaFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = OLLAMA_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** KV cache and runtime overhead on top of the weights, as a rough multiplier. */
function estimateMemory(sizeBytes: number | null): {
  ram: number | null;
  vram: number | null;
} {
  if (!sizeBytes) return { ram: null, vram: null };
  return {
    ram: Math.round(sizeBytes * 1.25 + 512 * 1024 * 1024),
    vram: Math.round(sizeBytes * 1.1),
  };
}

type OllamaTag = {
  name: string;
  model?: string;
  size?: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
    families?: string[];
  };
};

function tagToModel(tag: OllamaTag, contextLength: number | null): LocalModelInfo {
  const families = tag.details?.families ?? [];
  const size = tag.size ?? null;
  const { ram, vram } = estimateMemory(size);

  return {
    id: tag.name,
    name: tag.name,
    sizeBytes: size,
    parameterSize: tag.details?.parameter_size ?? null,
    quantization: tag.details?.quantization_level ?? null,
    contextLength,
    capabilities: {
      text: true,
      // Ollama reports a projector family for multimodal models.
      vision: families.some((f) => /clip|mllama|vision/i.test(f)),
      embedding: /embed/i.test(tag.name),
    },
    estimatedRamBytes: ram,
    estimatedVramBytes: vram,
    installedAt: tag.modified_at ?? null,
  };
}

async function ollamaContextLength(name: string): Promise<number | null> {
  try {
    const res = await ollamaFetch("/api/show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { model_info?: Record<string, unknown> };
    const info = body.model_info ?? {};
    const key = Object.keys(info).find((k) => k.endsWith(".context_length"));
    const value = key ? info[key] : null;
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

function llamaCppStatus(): LocalRuntimeStatus {
  const modelPath = localModelPath();

  if (!isLocalModelAvailable()) {
    return {
      runtime: "none",
      available: false,
      endpoint: null,
      version: null,
      manageable: false,
      models: [],
      error: "No local runtime was found.",
      requirement:
        `Either run an Ollama daemon reachable at ${env.OLLAMA_BASE_URL}, or download the bundled model with "npm run model:download" on the API host (it is written to ${modelPath}).`,
    };
  }

  let sizeBytes: number | null = null;
  let installedAt: string | null = null;
  try {
    const stat = fs.statSync(modelPath);
    sizeBytes = stat.size;
    installedAt = stat.mtime.toISOString();
  } catch {
    // The existence check passed a moment ago; a stat failure is not fatal.
  }

  const { ram, vram } = estimateMemory(sizeBytes);
  const quantMatch = env.LOCAL_MODEL_FILE.match(/(Q\d[_A-Z0-9]*)/i);
  const paramMatch = env.LOCAL_MODEL_FILE.match(/(\d+(?:\.\d+)?B)/i);

  return {
    runtime: "llamacpp",
    available: true,
    endpoint: modelPath,
    version: "node-llama-cpp",
    // The model is a file placed on the host. Pretending it can be installed
    // over HTTP would be a button that cannot work.
    manageable: false,
    models: [
      {
        id: env.LOCAL_MODEL_FILE,
        name: env.LOCAL_MODEL_FILE.replace(/\.gguf$/i, ""),
        sizeBytes,
        parameterSize: paramMatch?.[1] ?? null,
        quantization: quantMatch?.[1] ?? null,
        contextLength: 4096,
        capabilities: { text: true, vision: false, embedding: false },
        estimatedRamBytes: ram,
        estimatedVramBytes: vram,
        installedAt,
      },
    ],
    error: null,
    requirement: null,
  };
}

/**
 * What local AI can do on this host, right now.
 *
 * Ollama is preferred when it answers, because it can manage models; the
 * bundled GGUF is the fallback. Never cached — the whole point of the Local AI
 * screen is that it reflects the machine as it is when you look at it.
 */
export async function getLocalRuntimeStatus(): Promise<LocalRuntimeStatus> {
  try {
    const res = await ollamaFetch("/api/tags", {}, OLLAMA_LIST_TIMEOUT_MS);
    if (res.ok) {
      const body = (await res.json()) as { models?: OllamaTag[] };
      const tags = body.models ?? [];

      // Context length costs one request per model, so it is only fetched for a
      // sane number of them.
      const contexts = await Promise.all(
        tags.slice(0, 12).map((t) => ollamaContextLength(t.name))
      );

      let version: string | null = null;
      try {
        const v = await ollamaFetch("/api/version");
        if (v.ok) version = ((await v.json()) as { version?: string }).version ?? null;
      } catch {
        // Older builds have no /api/version. Not knowing is not a failure.
      }

      return {
        runtime: "ollama",
        available: true,
        endpoint: env.OLLAMA_BASE_URL,
        version,
        manageable: true,
        models: tags.map((t, i) => tagToModel(t, contexts[i] ?? null)),
        error: null,
        requirement:
          tags.length === 0
            ? "Ollama is running but has no models installed. Install one below."
            : null,
      };
    }
  } catch {
    // Not running, or not reachable. Fall through to the bundled model.
  }

  return llamaCppStatus();
}

/* -------------------------------------------------------------------------- */
/* Model management (Ollama only)                                             */
/* -------------------------------------------------------------------------- */

export class LocalRuntimeUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalRuntimeUnavailable";
  }
}

export type PullJob = {
  id: string;
  model: string;
  status: string;
  completedBytes: number;
  totalBytes: number;
  done: boolean;
  error: string | null;
  startedAt: string;
};

const pulls = new Map<string, PullJob>();

export function listPulls(): PullJob[] {
  return [...pulls.values()];
}

export function getPull(id: string): PullJob | undefined {
  return pulls.get(id);
}

/**
 * Start an Ollama pull and track its progress.
 *
 * A pull is minutes long, so the request returns a job id immediately and the
 * client polls. Progress figures come from Ollama's own stream — nothing here
 * is simulated, and a job that fails says why.
 */
export async function startModelPull(model: string): Promise<PullJob> {
  const status = await getLocalRuntimeStatus();
  if (status.runtime !== "ollama") {
    throw new LocalRuntimeUnavailable(
      "Installing models needs an Ollama runtime. The bundled llama.cpp model is a file on the server and is managed on the host."
    );
  }

  const job: PullJob = {
    id: `${Date.now()}-${model}`,
    model,
    status: "starting",
    completedBytes: 0,
    totalBytes: 0,
    done: false,
    error: null,
    startedAt: new Date().toISOString(),
  };
  pulls.set(job.id, job);

  void (async () => {
    try {
      // No AbortController timeout: a pull legitimately runs for many minutes.
      const res = await fetch(
        `${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/pull`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: true }),
        }
      );

      if (!res.ok || !res.body) {
        throw new Error(`Ollama refused the pull (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as {
              status?: string;
              completed?: number;
              total?: number;
              error?: string;
            };
            if (evt.error) throw new Error(evt.error);
            if (evt.status) job.status = evt.status;
            if (typeof evt.completed === "number") job.completedBytes = evt.completed;
            if (typeof evt.total === "number") job.totalBytes = evt.total;
          } catch (err) {
            if (err instanceof Error && !(err instanceof SyntaxError)) throw err;
          }
        }
      }

      job.status = "complete";
      job.done = true;
    } catch (err) {
      job.error = err instanceof Error ? err.message : "The pull failed";
      job.status = "failed";
      job.done = true;
    } finally {
      // Finished jobs are kept briefly so a poll can see the outcome, then
      // dropped rather than accumulating for the life of the process.
      setTimeout(() => pulls.delete(job.id), 5 * 60_000).unref?.();
    }
  })();

  return job;
}

export async function deleteLocalModel(model: string): Promise<void> {
  const status = await getLocalRuntimeStatus();
  if (status.runtime !== "ollama") {
    throw new LocalRuntimeUnavailable(
      "Removing models needs an Ollama runtime. The bundled model is a file on the server."
    );
  }

  const res = await ollamaFetch(
    "/api/delete",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    },
    10_000
  );

  if (!res.ok) {
    throw new Error(`Ollama could not remove that model (HTTP ${res.status})`);
  }
}

/** Runs one short prompt so "Test model" means the model actually answered. */
export async function testLocalModel(
  model?: string
): Promise<{ ok: boolean; reply: string; ms: number; runtime: LocalRuntimeKind }> {
  const status = await getLocalRuntimeStatus();
  const started = Date.now();

  if (status.runtime === "ollama") {
    const target = model ?? status.models[0]?.id;
    if (!target) throw new LocalRuntimeUnavailable("No local model is installed.");

    const res = await ollamaFetch(
      "/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: target,
          prompt: "Reply with exactly: ready",
          stream: false,
          options: { num_predict: 12 },
        }),
      },
      60_000
    );

    if (!res.ok) throw new Error(`The model did not answer (HTTP ${res.status})`);
    const body = (await res.json()) as { response?: string };
    return {
      ok: true,
      reply: (body.response ?? "").trim(),
      ms: Date.now() - started,
      runtime: "ollama",
    };
  }

  if (status.runtime === "llamacpp") {
    const reply = await generateLocal(
      "Reply with exactly: ready",
      "You are a test harness. Answer in one word."
    );
    return { ok: true, reply: reply.trim(), ms: Date.now() - started, runtime: "llamacpp" };
  }

  throw new LocalRuntimeUnavailable(
    status.requirement ?? "No local runtime is available on this server."
  );
}

/** One-line generation against whichever local runtime exists. */
export async function generateWithLocalRuntime(
  prompt: string,
  systemPrompt: string | undefined,
  options: { model?: string; maxTokens?: number } = {}
): Promise<string> {
  const status = await getLocalRuntimeStatus();

  if (status.runtime === "ollama") {
    const target = options.model ?? status.models[0]?.id;
    if (!target) throw new LocalRuntimeUnavailable("No local model is installed.");

    const res = await ollamaFetch(
      "/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: target,
          stream: false,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt },
          ],
          options: { num_predict: options.maxTokens ?? 1024 },
        }),
      },
      120_000
    );

    if (!res.ok) throw new Error(`The local model failed (HTTP ${res.status})`);
    const body = (await res.json()) as { message?: { content?: string } };
    return (body.message?.content ?? "").trim();
  }

  if (status.runtime === "llamacpp") {
    return generateLocal(prompt, systemPrompt);
  }

  throw new LocalRuntimeUnavailable(
    status.requirement ?? "No local runtime is available on this server."
  );
}
