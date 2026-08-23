"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Paperclip, FolderKanban, Globe, Check } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Project = { id: string; name: string };

export function ComposerMenu({
  onFilesSelected,
  webSearchEnabled,
  onToggleWebSearch,
  selectedProject,
  onSelectProject,
  showProjectPicker,
}: {
  onFilesSelected: (files: FileList) => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  showProjectPicker: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowProjects(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (showProjects) {
      apiFetch<Project[]>("/projects")
        .then(setProjects)
        .catch(() => setProjects([]));
    }
  }, [showProjects]);

  return (
    <div className="relative" ref={menuRef}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border sm:h-11 sm:w-11 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Add"
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1.5 shadow-lg">
          {!showProjects ? (
            <>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Paperclip size={15} className="text-[var(--text-secondary)]" />
                Add files or photos
              </button>

              {showProjectPicker && (
                <button
                  onClick={() => setShowProjects(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <FolderKanban size={15} className="text-[var(--text-secondary)]" />
                  Add to project
                  {selectedProject && (
                    <span className="ml-auto truncate text-xs text-accent">
                      {selectedProject.name}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  onToggleWebSearch();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Globe size={15} className="text-[var(--text-secondary)]" />
                Web search
                {webSearchEnabled && (
                  <Check size={14} className="ml-auto text-accent" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onSelectProject(null);
                  setShowProjects(false);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                No project
              </button>
              {projects.length === 0 && (
                <p className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                  No projects yet — create one from the sidebar first.
                </p>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p);
                    setShowProjects(false);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <FolderKanban size={15} className="text-[var(--text-secondary)]" />
                  {p.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
