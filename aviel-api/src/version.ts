// Aviel AI — build identity.
//
// Reported by /system/about and the settings meta endpoint so "About Aviel AI"
// shows what is actually deployed rather than a number typed into a component.
//
// The build id comes from whichever commit hash the host exposes. Render sets
// RENDER_GIT_COMMIT; Vercel sets VERCEL_GIT_COMMIT_SHA. With neither, it is
// reported as "local" rather than as a fabricated value.

export const APP_VERSION = "1.1.0";

export const BUILD_ID = (
  process.env.RENDER_GIT_COMMIT ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT ??
  "local"
).slice(0, 12);

export const BUILT_AT = process.env.BUILD_TIME ?? null;

/** Bumped when the settings document's shape changes in a breaking way. */
export const SETTINGS_SCHEMA_VERSION = 1;
