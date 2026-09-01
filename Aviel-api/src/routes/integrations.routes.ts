import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

/**
 * The catalogue of integrations Aviel knows about.
 *
 * `available: false` means no provider is implemented — connecting is refused
 * rather than recorded, so the Plugins screen shows what is coming without
 * offering a switch that silently does nothing.
 */
export const PROVIDERS = [
  {
    id: "web-search",
    name: "Web search",
    description:
      "Let Aviel look things up live instead of answering from training data alone.",
    available: false,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Bring documents from Drive into a conversation.",
    available: false,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Reference code and issues from your repositories.",
    available: false,
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function findProvider(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

integrationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db.query.userIntegrations.findMany({
      where: eq(schema.userIntegrations.userId, req.userId!),
    });

    // The catalogue is the source of truth for what exists; stored rows only
    // say what this account has done about it.
    res.json(
      PROVIDERS.map((p) => {
        const row = rows.find((r) => r.provider === p.id);
        return {
          ...p,
          status: row?.status ?? "disconnected",
          connectedAt: row?.connectedAt ?? null,
        };
      })
    );
  })
);

integrationsRouter.post(
  "/:provider/connect",
  asyncHandler(async (req, res) => {
    const provider = findProvider(req.params.provider);

    if (!provider) {
      res.status(404).json({ error: "Unknown integration" });
      return;
    }

    if (!provider.available) {
      // Refusing is the honest answer. Writing "connected" for a provider with
      // no implementation would make the UI claim a capability that does not
      // exist.
      res.status(409).json({
        error: `${provider.name} isn't available yet. It will appear here when it's ready.`,
      });
      return;
    }

    const [row] = await db
      .insert(schema.userIntegrations)
      .values({
        userId: req.userId!,
        provider: provider.id as ProviderId,
        status: "connected",
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.userIntegrations.userId,
          schema.userIntegrations.provider,
        ],
        set: { status: "connected", connectedAt: new Date() },
      })
      .returning();

    res.json({ ...provider, status: row.status, connectedAt: row.connectedAt });
  })
);

integrationsRouter.post(
  "/:provider/disconnect",
  asyncHandler(async (req, res) => {
    const provider = findProvider(req.params.provider);
    if (!provider) {
      res.status(404).json({ error: "Unknown integration" });
      return;
    }

    await db
      .update(schema.userIntegrations)
      .set({ status: "disconnected", connectedAt: null, config: null })
      .where(
        and(
          eq(schema.userIntegrations.userId, req.userId!),
          eq(schema.userIntegrations.provider, provider.id)
        )
      );

    res.json({ ...provider, status: "disconnected", connectedAt: null });
  })
);
