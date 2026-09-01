import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { factsFrom, isDuplicate } from "./learning.service";

describe("fact extraction", () => {
  it("reads the documented shape", () => {
    const facts = factsFrom(
      '{"facts":[{"text":"Sam prefers TypeScript","category":"preferences"}]}'
    );
    assert.deepEqual(facts, [
      { text: "Sam prefers TypeScript", category: "preferences" },
    ]);
  });

  it("finds JSON inside a fenced block", () => {
    const facts = factsFrom(
      'Sure!\n```json\n{"facts":[{"text":"Sam is in Kampala","category":"personalization"}]}\n```'
    );
    assert.equal(facts.length, 1);
    assert.equal(facts[0].category, "personalization");
  });

  it("still accepts the older bare-string shape", () => {
    const facts = factsFrom('{"facts":["Sam prefers short answers"]}');
    assert.deepEqual(facts, [
      { text: "Sam prefers short answers", category: "preferences" },
    ]);
  });

  it("files an unknown category under preferences rather than dropping the fact", () => {
    const facts = factsFrom('{"facts":[{"text":"Sam codes","category":"nonsense"}]}');
    assert.equal(facts[0].category, "preferences");
  });

  it("returns nothing for an empty list, which is the normal outcome", () => {
    assert.deepEqual(factsFrom('{"facts":[]}'), []);
  });

  it("returns nothing for junk instead of throwing", () => {
    assert.deepEqual(factsFrom("I could not find anything."), []);
    assert.deepEqual(factsFrom('{"facts": "not a list"}'), []);
    assert.deepEqual(factsFrom("{broken json"), []);
    assert.deepEqual(factsFrom(""), []);
  });

  it("drops an over-long fact", () => {
    const long = "x".repeat(500);
    assert.deepEqual(factsFrom(`{"facts":["${long}"]}`), []);
  });

  it("keeps at most three facts from one exchange", () => {
    const facts = factsFrom(
      `{"facts":[${["a", "b", "c", "d", "e"]
        .map((t) => `{"text":"${t}","category":"preferences"}`)
        .join(",")}]}`
    );
    assert.equal(facts.length, 3);
  });
});

describe("duplicate detection", () => {
  it("catches a restatement", () => {
    assert.ok(
      isDuplicate("Sam prefers TypeScript", ["Sam prefers TypeScript."])
    );
    assert.ok(isDuplicate("sam prefers typescript", ["Sam prefers TypeScript"]));
  });

  it("lets a genuinely new fact through", () => {
    assert.equal(
      isDuplicate("Sam is learning Spanish", ["Sam prefers TypeScript"]),
      false
    );
  });

  it("treats an empty fact as a duplicate rather than storing it", () => {
    assert.ok(isDuplicate("", ["anything"]));
    assert.ok(isDuplicate("!!!", []));
  });
});
