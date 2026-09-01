import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SETTINGS,
  SETTINGS_GROUPS,
  mergeSettings,
  withDefaults,
  type UserSettings,
} from "./types.ts";
import {
  accentShades,
  effectiveAnimations,
  effectiveFontSize,
  themeForNextThemes,
} from "./apply.ts";

/** A deep copy, so a test mutating one group cannot leak into the next. */
function base(): UserSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

describe("defaults", () => {
  it("has every group", () => {
    for (const group of SETTINGS_GROUPS) {
      assert.ok(DEFAULT_SETTINGS[group], `${group} is missing`);
    }
  });

  it("starts with memory off and training off", () => {
    assert.equal(DEFAULT_SETTINGS.memory.enabled, false);
    assert.equal(DEFAULT_SETTINGS.privacy.trainingOptIn, false);
  });

  it("starts with conversations kept indefinitely", () => {
    assert.equal(DEFAULT_SETTINGS.conversation.saveConversations, true);
    assert.equal(DEFAULT_SETTINGS.conversation.retentionDays, 0);
  });
});

describe("merge", () => {
  it("changes only the keys given", () => {
    const next = mergeSettings(base(), { appearance: { theme: "dark" } });
    assert.equal(next.appearance.theme, "dark");
    assert.equal(next.appearance.accent, "green");
    assert.equal(next.memory.enabled, false);
  });

  it("does not mutate the input", () => {
    const original = base();
    mergeSettings(original, { appearance: { theme: "amoled" } });
    assert.equal(original.appearance.theme, "system");
  });
});

describe("withDefaults", () => {
  it("fills in groups a partial response is missing", () => {
    const merged = withDefaults({ appearance: { theme: "dark" } });
    assert.equal(merged.appearance.theme, "dark");
    assert.equal(merged.personality.persona, "friendly");
    assert.equal(merged.safety.responseStyle, "gentle");
  });

  it("survives junk instead of throwing", () => {
    assert.deepEqual(withDefaults(null), DEFAULT_SETTINGS);
    assert.deepEqual(withDefaults("nope"), DEFAULT_SETTINGS);
    assert.equal(withDefaults({ appearance: 42 }).appearance.theme, "system");
    assert.equal(withDefaults({ appearance: [] }).appearance.theme, "system");
  });

  it("keeps keys the server sent that this build does not know", () => {
    // A newer server may return a key this client has not shipped yet. It has
    // to survive the round trip, or saving anything in that group would drop it.
    const merged = withDefaults({
      appearance: { theme: "dark", futureKey: "x" },
    }) as UserSettings & { appearance: { futureKey?: string } };
    assert.equal(merged.appearance.futureKey, "x");
  });
});

describe("accessibility overrides appearance", () => {
  it("large text beats the font-size preference", () => {
    const settings = mergeSettings(base(), {
      appearance: { fontSize: "small" },
      accessibility: { largeText: true },
    });
    assert.equal(effectiveFontSize(settings), "large");
  });

  it("extra large text beats large text", () => {
    const settings = mergeSettings(base(), {
      accessibility: { largeText: true, extraLargeText: true },
    });
    assert.equal(effectiveFontSize(settings), "xlarge");
  });

  it("large text does not shrink an already-larger choice", () => {
    const settings = mergeSettings(base(), {
      appearance: { fontSize: "xlarge" },
      accessibility: { largeText: true },
    });
    assert.equal(effectiveFontSize(settings), "xlarge");
  });

  it("leaves the font size alone when nothing is switched on", () => {
    const settings = mergeSettings(base(), { appearance: { fontSize: "small" } });
    assert.equal(effectiveFontSize(settings), "small");
  });

  it("reduce motion beats the animation preference", () => {
    const settings = mergeSettings(base(), {
      appearance: { animations: "full" },
      accessibility: { reduceMotion: true },
    });
    assert.equal(effectiveAnimations(settings), "off");
  });

  it("never turns motion back on", () => {
    const settings = mergeSettings(base(), {
      appearance: { animations: "off" },
      accessibility: { reduceMotion: false },
    });
    assert.equal(effectiveAnimations(settings), "off");
  });
});

describe("theme", () => {
  it("maps AMOLED onto the dark theme, since it is a dark palette", () => {
    assert.equal(themeForNextThemes("amoled"), "dark");
    assert.equal(themeForNextThemes("dark"), "dark");
    assert.equal(themeForNextThemes("light"), "light");
    assert.equal(themeForNextThemes("system"), "system");
  });
});

describe("custom accent", () => {
  it("derives a full palette from one colour", () => {
    const shades = accentShades("#14b366");
    assert.equal(shades["--accent-solid"], "#14b366");
    assert.equal(shades["--accent-from"], "#14b366");
    for (const key of [
      "--accent-to",
      "--accent-strong",
      "--accent-soft",
      "--accent-on-soft",
    ]) {
      assert.ok(shades[key], `${key} is missing`);
    }
  });

  it("produces a lighter 'to' and a darker 'strong'", () => {
    const shades = accentShades("#3178f5");
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    assert.ok(luminance(shades["--accent-to"]) > luminance("#3178f5"));
    assert.ok(luminance(shades["--accent-strong"]) < luminance("#3178f5"));
  });

  it("picks readable text for the soft tint on a pale colour", () => {
    // A very light accent must not put light text on its own pale tint.
    const pale = accentShades("#fdf6b2");
    assert.notEqual(pale["--accent-on-soft"], "#fdf6b2");
  });

  it("returns nothing for a colour it cannot parse", () => {
    assert.deepEqual(accentShades("#zzzzzz"), {});
  });
});
