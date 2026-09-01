import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORIES,
  SECTIONS,
  SECTION_IDS,
  searchSections,
} from "./registry.ts";

const ids = (query: string) => searchSections(query).map((h) => h.section.id);

describe("the section map", () => {
  it("has a definition for every id", () => {
    assert.equal(SECTIONS.length, SECTION_IDS.length);
    for (const id of SECTION_IDS) {
      assert.ok(
        SECTIONS.some((s) => s.id === id),
        `${id} has no definition`
      );
    }
  });

  it("puts every section in a real category", () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const section of SECTIONS) {
      assert.ok(known.has(section.category), `${section.id} has no category`);
    }
  });

  it("gives every section searchable entries", () => {
    for (const section of SECTIONS) {
      assert.ok(
        section.entries.length > 0,
        `${section.id} has nothing to search for`
      );
    }
  });

  it("covers the 25 sections the product promises", () => {
    assert.equal(SECTIONS.length, 25);
  });
});

describe("search", () => {
  it("returns everything for an empty query", () => {
    assert.equal(searchSections("").length, SECTIONS.length);
    assert.equal(searchSections("   ").length, SECTIONS.length);
  });

  it('finds voice, live voice and the controls inside them for "voice"', () => {
    const found = ids("voice");

    assert.equal(found[0], "voice", "Voice should rank first");
    assert.ok(found.includes("live-voice"));
    assert.ok(found.includes("language"), "voice language lives in Language");

    // The individual settings that matched come back for the subtitle.
    const voiceHit = searchSections("voice").find((h) => h.section.id === "voice");
    assert.ok(voiceHit && voiceHit.matches.length > 0);
  });

  it('finds memory and privacy for "memory"', () => {
    const found = ids("memory");
    assert.equal(found[0], "memory");
    assert.ok(found.includes("projects"), "project memory lives in Projects");
  });

  it('finds appearance for "theme", "accent" and "background"', () => {
    assert.equal(ids("theme")[0], "appearance");
    assert.equal(ids("accent")[0], "appearance");
    assert.equal(ids("background")[0], "appearance");
  });

  it("finds a setting by a word that is not in any section title", () => {
    assert.ok(ids("two-factor").includes("security"));
    assert.ok(ids("recovery codes").includes("security"));
    assert.ok(ids("ollama").includes("offline"));
    assert.ok(ids("retention").includes("conversations"));
    assert.ok(ids("ocr").includes("images"));
    assert.ok(ids("invoices").includes("subscription"));
  });

  it("ranks a title match above a mere mention", () => {
    const found = ids("security");
    assert.equal(found[0], "security");
  });

  it("returns nothing for a query that matches nothing", () => {
    assert.deepEqual(searchSections("zzzzqqq"), []);
  });

  it("ignores case", () => {
    assert.deepEqual(ids("THEME"), ids("theme"));
  });

  it("caps the matches shown per section", () => {
    for (const hit of searchSections("a")) {
      assert.ok(hit.matches.length <= 4);
    }
  });

  it("does not repeat a match", () => {
    for (const hit of searchSections("model")) {
      assert.equal(new Set(hit.matches).size, hit.matches.length);
    }
  });
});
