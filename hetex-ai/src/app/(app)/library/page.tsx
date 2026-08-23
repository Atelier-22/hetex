"use client";

import { useEffect, useState } from "react";
import { Library as LibraryIcon, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Asset = {
  id: string;
  type: string;
  url: string;
  name: string | null;
  mediaType: string | null;
  prompt: string | null;
};

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Asset[]>("/library")
      .then(setAssets)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load the library")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Files you attach to a conversation are collected here. Generated
          images and video will join them once those providers are connected.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-hetex-red-500/30 bg-hetex-red-500/10 px-3 py-2 text-sm text-hetex-red-500">
            {error}
          </p>
        )}

        {!loading && !error && assets.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
            <LibraryIcon size={28} className="text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)]">Nothing here yet</p>
          </div>
        )}

        {assets.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {assets.map((a) => (
              <figure
                key={a.id}
                className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                {a.type === "image" && a.url ? (
                  // Stored as a data: URL in Postgres, so next/image's optimiser
                  // has nothing to fetch and a plain img is the right element.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt={a.name ?? a.prompt ?? "Attached image"}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 px-3 text-center">
                    <FileText size={22} className="text-[var(--text-secondary)]" />
                    <span className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {a.name ?? "File"}
                    </span>
                  </div>
                )}
                {a.name && (
                  <figcaption className="truncate border-t border-[var(--border-subtle)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)]">
                    {a.name}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
