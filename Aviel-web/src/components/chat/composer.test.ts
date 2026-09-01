import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composerPlaceholder } from "./composer-placeholder.ts";
import { DEFAULT_SETTINGS, mergeSettings } from "../../lib/settings/types.ts";

describe("composer placeholder", () => {
  it("stays neutral when no name is set", () => {
    assert.equal(composerPlaceholder(DEFAULT_SETTINGS), "Ask Aviel anything…");
  });

  it("greets by preferred name when there is one", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      profile: { preferredName: "Peter" },
    });
    assert.equal(composerPlaceholder(settings), "How can I help you, Peter?");
  });

  it("falls back to the display name", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      profile: { displayName: "Sarah" },
    });
    assert.equal(composerPlaceholder(settings), "How can I help you, Sarah?");
  });

  it("prefers the preferred name over the display name", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      profile: { displayName: "Jonathan Alafi", preferredName: "Jon" },
    });
    assert.equal(composerPlaceholder(settings), "How can I help you, Jon?");
  });

  it("uses only the first word of a full name", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      profile: { displayName: "Muhwezi Peter" },
    });
    assert.equal(composerPlaceholder(settings), "How can I help you, Muhwezi?");
  });

  it("treats a whitespace-only name as no name", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      profile: { displayName: "   ", preferredName: "  " },
    });
    assert.equal(composerPlaceholder(settings), "Ask Aviel anything…");
  });

  it("never renders an empty or undefined name into the greeting", () => {
    for (const profile of [
      { displayName: null, preferredName: null },
      { displayName: "", preferredName: "" },
    ]) {
      const text = composerPlaceholder(mergeSettings(DEFAULT_SETTINGS, { profile }));
      assert.doesNotMatch(text, /undefined|null|,\s*\?/);
    }
  });
});
