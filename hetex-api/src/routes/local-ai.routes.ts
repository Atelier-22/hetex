import { Router } from "express";
import { z } from "zod";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { requireAdmin } from "../auth/admin";
import {
  deleteLocalModel,
  getLocalRuntimeStatus,
  getPull,
  listPulls,
  LocalRuntimeUnavailable,
  startModelPull,
  testLocalModel,
} from "../ai/local-runtime";
import { getPlatformConfig } from "../settings/platform";

export const localAiRouter = Router();

localAiRouter.use(requireAuth);

/**
 * Local AI status.
 *
 * Readable by any signed-in user: whether their conversations can be processed
 * on-device is a privacy fact they are entitled to, and the Privacy screen
 * depends on it. Changing what is installed is a different matter — see below.
 */
localAiRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const [status, config] = await Promise.all([
      getLocalRuntimeStatus(),
      getPlatformConfig(),
    ]);

    res.json({
      ...status,
      // A server-wide switch beats a working runtime: an operator who turned
      // local AI off did so for a reason.
      available: status.available && config.features.localAI,
      disabledByAdmin: status.available && !config.features.localAI,
    });
  })
);

localAiRouter.get(
  "/pulls",
  asyncHandler(async (_req, res) => {
    res.json(listPulls());
  })
);

localAiRouter.get(
  "/pulls/:id",
  asyncHandler(async (req, res) => {
    const job = getPull(req.params.id);
    if (!job) {
      res.status(404).json({ error: "That install is no longer being tracked." });
      return;
    }
    res.json(job);
  })
);

/**
 * Test the runtime with one short prompt.
 *
 * Allowed for any signed-in user because it is read-only and bounded — it is
 * how someone confirms that "processing locally" is a working claim rather than
 * a label.
 */
localAiRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const model = typeof req.body?.model === "string" ? req.body.model : undefined;

    try {
      res.json(await testLocalModel(model));
    } catch (err) {
      if (err instanceof LocalRuntimeUnavailable) {
        res.status(503).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : "The model did not answer",
      });
    }
  })
);

// ---- Everything below changes what is installed on the server ---------------
//
// Installing a model writes gigabytes to the API host's disk and is a
// server-wide change — every account sees the result. That is an administrator
// action, not a user preference, so the rest of this router requires admin.
localAiRouter.use(requireAdmin);

const modelSchema = z.object({
  // Ollama model references, e.g. "llama3.2:3b" or "qwen2.5-coder:7b-instruct".
  model: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9._\/-]+(:[a-z0-9._-]+)?$/i,
      "That doesn't look like a model name"
    ),
});

localAiRouter.post(
  "/models",
  asyncHandler(async (req, res) => {
    const parsed = modelSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid model name" });
      return;
    }

    try {
      // A pull runs for minutes, so the job is returned immediately and polled.
      res.status(202).json(await startModelPull(parsed.data.model));
    } catch (err) {
      if (err instanceof LocalRuntimeUnavailable) {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

localAiRouter.delete(
  "/models/:model(*)",
  asyncHandler(async (req, res) => {
    const model = req.params.model;
    if (!model) {
      res.status(400).json({ error: "Which model?" });
      return;
    }

    try {
      await deleteLocalModel(model);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof LocalRuntimeUnavailable) {
        res.status(503).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : "Could not remove that model",
      });
    }
  })
);
