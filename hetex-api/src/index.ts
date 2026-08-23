import path from "path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env, corsOrigins, isProduction } from "./env";
import { db, pool } from "./db";
import { getProvider } from "./ai";
import { authRouter } from "./routes/auth.routes";
import { accountRouter } from "./routes/account.routes";
import { chatRouter } from "./routes/chat.routes";
import { conversationsRouter } from "./routes/conversations.routes";
import { projectsRouter } from "./routes/projects.routes";
import { settingsRouter } from "./routes/settings.routes";
import { memoryRouter } from "./routes/memory.routes";
import { securityRouter } from "./routes/security.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { billingRouter } from "./routes/billing.routes";
import { adminRouter, adminCheckRouter } from "./routes/admin.routes";
import {
  libraryRouter,
  usageRouter,
  feedbackRouter,
} from "./routes/misc.routes";

const app = express();

// Render terminates TLS at its proxy. Without this, express sees every request
// as plain HTTP and rate-limit / secure-cookie logic would read the proxy's IP
// instead of the client's.
app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      // Native mobile clients and server-to-server calls send no Origin header.
      // Only browsers do, and only browsers are subject to CORS in the first
      // place — the bearer token is what actually authorizes every request.
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);

      // Vercel generates a unique hostname per preview deployment, so an exact
      // allowlist would break every preview branch.
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

// Image attachments arrive base64-encoded, which inflates them by ~33%. The
// per-attachment cap in the chat route is 5 MB, so the body ceiling has to sit
// comfortably above that.
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    aiProvider: getProvider().isConfigured() ? "configured" : "not_configured",
  });
});

app.use("/auth", authRouter);
app.use("/account", accountRouter);
app.use("/chat", chatRouter);
app.use("/conversations", conversationsRouter);
app.use("/projects", projectsRouter);
app.use("/settings", settingsRouter);
app.use("/memory", memoryRouter);
app.use("/security", securityRouter);
app.use("/integrations", integrationsRouter);
app.use("/billing", billingRouter);
app.use("/admin", adminCheckRouter);
app.use("/admin", adminRouter);
app.use("/library", libraryRouter);
app.use("/usage", usageRouter);
app.use("/feedback", feedbackRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);

  if (err.message?.includes("is not allowed by CORS")) {
    res.status(403).json({ error: err.message });
    return;
  }

  // Error detail is logged above but not returned in production — stack traces
  // and driver messages tell an attacker about the schema and dependencies.
  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
  });
});

/**
 * Drizzle reports the SQL it was running, which buries the real problem — a
 * wrong host or bad credentials only appears on `cause`. Node wraps connection
 * failures in an AggregateError whose own message is empty, so the useful text
 * (ECONNREFUSED, ENOTFOUND) lives one level further down.
 */
function describeCause(cause: unknown): string | null {
  if (!cause) return null;

  if (cause instanceof AggregateError) {
    const inner = cause.errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .filter(Boolean);
    if (inner.length > 0) return [...new Set(inner)].join("; ");
  }

  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (cause.message) return code ? `${cause.message} (${code})` : cause.message;
    if (code) return code;
  }

  return null;
}

async function start() {
  try {
    // Applying migrations at boot means a fresh Render deploy provisions its
    // own schema — no manual db:push step between creating the database and
    // the first request.
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "..", "drizzle"),
    });
    console.log("Database migrations applied");
  } catch (err) {
    console.error(
      "Failed to apply database migrations:",
      err instanceof Error ? err.message : err
    );
    const cause = describeCause(err instanceof Error ? err.cause : undefined);
    if (cause) {
      console.error("Cause:", cause);
      console.error(
        "Check DATABASE_URL — the host, port, credentials, and that the database exists."
      );
    }
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Hetex API listening on port ${env.PORT}`);
    console.log(`Allowed browser origins: ${corsOrigins.join(", ") || "(none)"}`);
    if (!getProvider().isConfigured()) {
      console.warn(
        "ANTHROPIC_API_KEY is not set — chat will return a 503 until it is."
      );
    }
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
