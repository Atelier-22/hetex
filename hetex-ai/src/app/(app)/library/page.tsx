"use client";

import { useEffect, useMemo, useState } from "react";
import { Library as LibraryIcon, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useSettingsGroup } from "@/lib/settings/store";

type Asset = {
  id: string;
  type: string;
  url: string;
  name: string | null;
  mediaType: string | null;
  prompt: string | null;
  createdAt?: string;
};

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sort } = useSettingsGroup("library");

  useEffect(() => {
    apiFetch<Asset[]>("/library")
      .then(setAssets)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load the library")
      )
      .finally(() => setLoading(false));
  }, []);

  /**
   * Ordered by the Library setting.
   *
   * The API returns newest first; the other orders are applied here rather than
   * as a query parameter, because the whole list is already loaded and a round
   * trip to reorder it would be slower and no more correct.
   *
   * "Most used" has nothing to count yet — usage is not recorded per asset — so
   * it falls back to newest rather than pretending to a ranking it does not
   * have. That is stated in the header when it is in effect.
   */
  const ordered = useMemo(() => {
    const copy = [...assets];
    const at = (a: Asset) => (a.createdAt ? Date.parse(a.createdAt) : 0);

    switch (sort) {
      case "oldest":
        return copy.sort((a, b) => at(a) - at(b));
      case "alphabetical":
        return copy.sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", undefined, {
            sensitivity: "base",
          })
        );
      case "newest":
      case "most_used":
      default:
        return copy.sort((a, b) => at(b) - at(a));
    }
  }, [assets, sort]);

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Files you attach to a conversation are collected here. Generated
          images and video will join them once those providers are connected.
        </p>
        {sort === "most_used" && ordered.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Sorted newest first: per-file usage isn&apos;t recorded, so
            &ldquo;most used&rdquo; has nothing to rank by yet.
          </p>
        )}

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

        {ordered.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ordered.map((a) => (
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
