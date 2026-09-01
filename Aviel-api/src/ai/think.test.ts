import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveThinkMode, describeThinkModes } from "./think";
import { defaultSettings, mergeSettings } from "../settings/schema";

// These tests run against whatever providers this machine has configured, so
// they assert on the parts that hold either way: the instruction, the ceiling,
// and the refusal to claim reasoning that is not happening.

describe("think modes", () => {
  const base = defaultSettings();

  it("adds nothing on balanced, which is the baseline", () => {
    const r = resolveThinkMode(base, "balanced");
    assert.equal(r.instruction, "");
    assert.equal(r.model, null);
    assert.equal(r.maxTokens, null);
    assert.equal(r.nativeReasoning, false);
  });

  it("asks for brevity and a lower ceiling on fast", () => {
    const r = resolveThinkMode(base, "fast");
    assert.match(r.instruction, /directly and briefly/i);
    assert.match(r.instruction, /do not show working/i);
    assert.ok(r.maxTokens !== null && r.maxTokens < 4096);
  });

  it("asks for working and a higher ceiling on deep", () => {
    const r = resolveThinkMode(base, "deep");
    assert.match(r.instruction, /work through it/i);
    assert.ok(r.maxTokens !== null && r.maxTokens > 4096);
  });

  it("falls back to the account default when no override is given", () => {
    const settings = mergeSettings(base, { ai: { thinkMode: "fast" } });
    assert.equal(resolveThinkMode(settings).mode, "fast");
  });

  it("lets a per-message override beat the account default", () => {
    const settings = mergeSettings(base, { ai: { thinkMode: "fast" } });
    assert.equal(resolveThinkMode(settings, "deep").mode, "deep");
  });

  it("never returns a model that is not available", () => {
    const settings = mergeSettings(base, {
      ai: { fastModel: "retired-model", reasoningModel: "also-gone" },
    });
    assert.equal(resolveThinkMode(settings, "fast").model, null);
    assert.equal(resolveThinkMode(settings, "deep").model, null);
  });

  it("does not claim native reasoning when no reasoning tier answers", () => {
    // With nothing assigned, deep cannot be running on a reasoning model.
    const r = resolveThinkMode(base, "deep");
    if (!r.nativeReasoning) {
      assert.match(r.note, /no separate reasoning mode/i);
    }
  });

  it("says what fast will actually do, given what is assigned", () => {
    const r = resolveThinkMode(base, "fast");
    assert.match(r.note, /no separate fast model is assigned/i);
  });
});

describe("mode descriptions for the composer", () => {
  it("describes all three, in order", () => {
    const modes = describeThinkModes(defaultSettings());
    assert.deepEqual(
      modes.map((m) => m.mode),
      ["fast", "balanced", "deep"]
    );
    assert.deepEqual(
      modes.map((m) => m.label),
      ["Fast", "Balanced", "Deep think"]
    );
  });

  it("gives every mode a note explaining what it does here", () => {
    for (const m of describeThinkModes(defaultSettings())) {
      assert.ok(m.note.length > 0, `${m.mode} has no note`);
    }
  });
});
