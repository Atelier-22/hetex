import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SETTINGS_GROUPS,
  defaultSettings,
  mergeSettings,
  resetGroup,
  sanitizeImport,
  settingsPatchSchema,
  userSettingsSchema,
} from "./schema";

describe("settings schema", () => {
  it("produces a complete document from an empty object", () => {
    const settings = defaultSettings();
    for (const group of SETTINGS_GROUPS) {
      assert.ok(settings[group], `${group} is missing from the defaults`);
    }
    assert.equal(settings.personality.responseStyle, "balanced");
    assert.equal(settings.memory.enabled, false);
    assert.equal(settings.conversation.retentionDays, 0);
  });

  it("hands out a fresh object each time, not a shared one", () => {
    const a = defaultSettings();
    a.personality.assistantName = "Changed";
    assert.equal(defaultSettings().personality.assistantName, "Aviel AI");
  });

  it("round-trips through its own parser", () => {
    const settings = defaultSettings();
    assert.deepEqual(userSettingsSchema.parse(settings), settings);
  });
});

describe("patch validation", () => {
  it("accepts a partial group", () => {
    const parsed = settingsPatchSchema.safeParse({
      appearance: { theme: "dark" },
    });
    assert.ok(parsed.success);
    assert.deepEqual(parsed.data, { appearance: { theme: "dark" } });
  });

  it("rejects an unknown key inside a known group", () => {
    const parsed = settingsPatchSchema.safeParse({
      appearance: { theme: "dark", isAdmin: true },
    });
    assert.equal(parsed.success, false);
  });

  it("rejects an unknown group", () => {
    const parsed = settingsPatchSchema.safeParse({ billing: { plan: "pro" } });
    assert.equal(parsed.success, false);
  });

  it("rejects a value outside the allowed set", () => {
    assert.equal(
      settingsPatchSchema.safeParse({ appearance: { theme: "neon" } }).success,
      false
    );
    assert.equal(
      settingsPatchSchema.safeParse({ conversation: { retentionDays: 7 } })
        .success,
      false
    );
    assert.equal(
      settingsPatchSchema.safeParse({ voice: { rate: 9 } }).success,
      false
    );
  });

  it("rejects a custom accent that is not a hex colour", () => {
    assert.equal(
      settingsPatchSchema.safeParse({ appearance: { customAccent: "red" } })
        .success,
      false
    );
    assert.ok(
      settingsPatchSchema.safeParse({ appearance: { customAccent: "#14b366" } })
        .success
    );
  });

  it("has no way to switch safety protections off", () => {
    const safetyKeys = Object.keys(defaultSettings().safety);
    assert.deepEqual(safetyKeys.sort(), ["responseStyle", "showCrisisResources"]);
    // The only enum values are wordings of a refusal, not an on/off.
    assert.equal(
      settingsPatchSchema.safeParse({ safety: { enabled: false } }).success,
      false
    );
  });
});

describe("merge", () => {
  it("changes only the keys in the patch", () => {
    const base = defaultSettings();
    const next = mergeSettings(base, { appearance: { theme: "dark" } });

    assert.equal(next.appearance.theme, "dark");
    assert.equal(next.appearance.accent, base.appearance.accent);
    assert.equal(next.personality.persona, base.personality.persona);
  });

  it("leaves the original untouched", () => {
    const base = defaultSettings();
    mergeSettings(base, { appearance: { theme: "dark" } });
    assert.equal(base.appearance.theme, "system");
  });

  it("merges several groups at once", () => {
    const next = mergeSettings(defaultSettings(), {
      appearance: { theme: "amoled" },
      memory: { enabled: true },
      personality: { persona: "direct" },
    });

    assert.equal(next.appearance.theme, "amoled");
    assert.equal(next.memory.enabled, true);
    assert.equal(next.personality.persona, "direct");
  });
});

describe("reset", () => {
  it("restores one group and leaves the rest", () => {
    const changed = mergeSettings(defaultSettings(), {
      appearance: { theme: "dark", accent: "rose" },
      memory: { enabled: true },
    });

    const reset = resetGroup(changed, "appearance");

    assert.equal(reset.appearance.theme, "system");
    assert.equal(reset.appearance.accent, "green");
    // Untouched: resetting Appearance must not turn memory off.
    assert.equal(reset.memory.enabled, true);
  });
});

describe("import", () => {
  it("accepts a document exported by this build", () => {
    const { patch, skipped } = sanitizeImport({
      kind: "Aviel.settings",
      settings: {
        appearance: { theme: "dark", accent: "violet" },
        personality: { persona: "academic" },
      },
    });

    assert.deepEqual(patch.appearance, { theme: "dark", accent: "violet" });
    assert.deepEqual(patch.personality, { persona: "academic" });
    assert.deepEqual(skipped, []);
  });

  it("accepts a bare settings document too", () => {
    const { patch } = sanitizeImport({ appearance: { theme: "light" } });
    assert.deepEqual(patch.appearance, { theme: "light" });
  });

  it("refuses to let a file claim a username or a phone number", () => {
    const { patch, skipped } = sanitizeImport({
      settings: {
        profile: { username: "admin", phone: "+100", preferredName: "Sam" },
      },
    });

    assert.deepEqual(patch.profile, { preferredName: "Sam" });
    assert.ok(skipped.includes("profile.username"));
    assert.ok(skipped.includes("profile.phone"));
  });

  it("refuses to let a file raise its own token ceiling", () => {
    const { patch, skipped } = sanitizeImport({
      settings: { advanced: { maxOutputTokens: 32000, streaming: false } },
    });

    assert.deepEqual(patch.advanced, { streaming: false });
    assert.ok(skipped.includes("advanced.maxOutputTokens"));
    assert.ok(skipped.includes("advanced.developerMode") === false);
  });

  it("keeps the valid keys when one key in a group is bad", () => {
    const { patch, skipped } = sanitizeImport({
      settings: { appearance: { theme: "dark", accent: "chartreuse" } },
    });

    assert.deepEqual(patch.appearance, { theme: "dark" });
    assert.ok(skipped.includes("appearance.accent"));
  });

  it("drops groups it does not recognise instead of failing", () => {
    const { patch } = sanitizeImport({
      settings: { appearance: { theme: "dark" }, quantumMode: { on: true } },
    });

    assert.deepEqual(Object.keys(patch), ["appearance"]);
  });

  it("returns nothing for junk", () => {
    assert.deepEqual(sanitizeImport(null).patch, {});
    assert.deepEqual(sanitizeImport("nope").patch, {});
    assert.deepEqual(sanitizeImport({ settings: 42 }).patch, {});
  });

  it("produces a patch its own validator accepts", () => {
    const { patch } = sanitizeImport({
      settings: defaultSettings(),
    });
    assert.ok(settingsPatchSchema.safeParse(patch).success);
  });
});
