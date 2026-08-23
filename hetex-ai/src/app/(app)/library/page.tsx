"use client";

import { useEffect, useState } from "react";
import { Library as LibraryIcon } from "lucide-react";

type Asset = { id: string; type: string; url: string; prompt: string | null };

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then(setAssets);
  }, []);

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Generated images, videos, and saved files will appear here once
          those providers are connected.
        </p>

        {assets.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
            <LibraryIcon size={28} className="text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Nothing here yet
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {assets.map((a) => (
              <div
                key={a.id}
                className="aspect-square rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
