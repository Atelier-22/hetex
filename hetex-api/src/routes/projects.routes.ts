import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await db.query.projects.findMany({
      where: eq(schema.projects.userId, req.userId!),
      orderBy: [desc(schema.projects.updatedAt)],
      with: { conversations: { columns: { id: true } } },
    });

    res.json(
      projects.map((p) => ({
        ...p,
        _count: { conversations: p.conversations.length },
      }))
    );
  })
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const instructions =
      typeof req.body?.instructions === "string" ? req.body.instructions : null;

    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    const [project] = await db
      .insert(schema.projects)
      .values({ userId: req.userId!, name, instructions })
      .returning();

    res.status(201).json({ ...project, _count: { conversations: 0 } });
  })
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = await db
      .delete(schema.projects)
      .where(
        and(
          eq(schema.projects.id, req.params.id),
          eq(schema.projects.userId, req.userId!)
        )
      )
      .returning({ id: schema.projects.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  })
);
