"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Project = { id: string; name: string; _count: { conversations: number } };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Project[]>("/projects")
      .then(setProjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load projects")
      );
  }

  useEffect(load, []);

  async function createProject() {
    if (!name.trim()) return;
    setError(null);
    try {
      await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      setCreating(false);
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the project"
      );
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-hetex-green-500 to-hetex-blue-500 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={15} /> New project
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-hetex-red-500/30 bg-hetex-red-500/10 px-3 py-2 text-sm text-hetex-red-500">
            {error}
          </p>
        )}

        {creating && (
          <div className="mt-4 flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="Project name"
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-hetex-green-500"
            />
            <button
              onClick={createProject}
              className="rounded-lg bg-hetex-green-500 px-4 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--border-subtle)] p-4"
            >
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-hetex-green-500" />
                <span className="font-medium">{p.name}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {p._count.conversations} conversation
                {p._count.conversations === 1 ? "" : "s"}
              </p>
            </div>
          ))}
          {projects.length === 0 && !creating && (
            <p className="text-sm text-[var(--text-secondary)]">
              No projects yet. Create one to group related conversations,
              files, and instructions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
