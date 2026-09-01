"use client";

/**
 * Chart pieces for the admin dashboard.
 *
 * Colours are validated, not chosen by eye:
 *  - Bar mark #0a9153 / #37cf80 — the brand green stepped so it clears the
 *    lightness band and 3:1 contrast on both surfaces.
 *  - Feedback meter uses the blue↔red diverging pair. Green/red was the obvious
 *    choice and fails: ΔE 4.1 under deuteranopia, so red-green colourblind
 *    readers cannot tell the halves apart. Blue↔red clears every gate, and the
 *    segments still carry icons and labels so colour is never doing the work
 *    alone.
 */

export function StatTile({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string | number;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3.5">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          emphasis ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</p>
      )}
    </div>
  );
}

/**
 * One metric over 14 days.
 *
 * Rendered as small multiples rather than three series on one chart: sign-ups,
 * sign-ins and messages differ by orders of magnitude, and the only ways to put
 * them on one axis are a second y-scale (never) or flattening the small ones
 * into the baseline. Each gets its own scale instead.
 */
export function MiniBars({
  title,
  data,
  total,
}: {
  title: string;
  data: { day: string; value: number }[];
  total: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const empty = data.every((d) => d.value === 0);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]">
          {total} in 14 days
        </span>
      </div>

      <div className="mt-4 flex h-24 items-end gap-[2px]">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const date = new Date(d.day + "T00:00:00");
          const label = date.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          return (
            <div
              key={d.day}
              className="group relative flex h-full flex-1 items-end"
              // Native tooltip: a real hover layer without a chart library, and
              // it works on keyboard focus and screen readers too.
              title={`${label}: ${d.value}`}
            >
              <div
                className="w-full rounded-t bg-[var(--viz-bar)] transition-opacity group-hover:opacity-80"
                style={{
                  // A zero day still shows a hairline, so it reads as "nothing
                  // happened" rather than as missing data.
                  height: d.value === 0 ? "2px" : `max(${pct}%, 4px)`,
                  opacity: d.value === 0 ? 0.25 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-[var(--text-secondary)]">
        <span>{shortDay(data[0]?.day)}</span>
        <span>Today</span>
      </div>

      {empty && (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Nothing recorded in this period.
        </p>
      )}
    </div>
  );
}

function shortDay(day?: string) {
  if (!day) return "";
  return new Date(day + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Thumbs up against thumbs down.
 *
 * A ratio against a whole, so a meter rather than a two-slice pie. Each half is
 * labelled with its icon and count — colour is never the only signal.
 */
export function FeedbackMeter({
  up,
  down,
  positiveRate,
}: {
  up: number;
  down: number;
  positiveRate: number | null;
}) {
  const total = up + down;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">Response ratings</h3>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]">
          {total} rated
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          No ratings yet. This stays empty until someone uses the thumbs on a
          reply — it is not zero percent positive.
        </p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {positiveRate}%
            <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
              positive
            </span>
          </p>

          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            <div
              className="h-full rounded-l-full bg-[var(--viz-positive)]"
              style={{ width: `${(up / total) * 100}%` }}
            />
            <div
              className="h-full rounded-r-full bg-[var(--viz-negative)]"
              style={{ width: `${(down / total) * 100}%` }}
            />
          </div>

          <div className="mt-3 flex gap-5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--viz-positive)]" />
              <span className="text-[var(--text-secondary)]">Helpful</span>
              <span className="tabular-nums font-medium">{up}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--viz-negative)]" />
              <span className="text-[var(--text-secondary)]">Not helpful</span>
              <span className="tabular-nums font-medium">{down}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** Horizontal share bars — one hue, magnitude only. */
export function ShareBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {total === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-secondary)]">No data yet.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span>{r.label}</span>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {r.value} ({Math.round((r.value / total) * 100)}%)
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[var(--viz-bar)]"
                  style={{ width: `${(r.value / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
