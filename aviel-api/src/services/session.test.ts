import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_TYPES,
  SESSION_TYPE_META,
  contextFactsFrom,
  sessionDuration,
  sessionPromptBlock,
} from "./session.service";

const bare = { title: "Untitled", contextNotes: [] as string[] };

describe("session types", () => {
  it("has metadata for every type", () => {
    for (const type of SESSION_TYPES) {
      assert.ok(SESSION_TYPE_META[type], `${type} has no metadata`);
      assert.ok(SESSION_TYPE_META[type].label.length > 0);
      assert.ok(SESSION_TYPE_META[type].description.length > 0);
    }
  });

  it("gives every type except plain chat a real instruction", () => {
    for (const type of SESSION_TYPES) {
      const block = sessionPromptBlock({ ...bare, type });
      if (type === "chat") {
        // A plain chat session adds framing, not behaviour, so with no context
        // yet it contributes nothing to the prompt.
        assert.equal(block, "", "chat should add nothing on its own");
      } else {
        assert.ok(block.length > 0, `${type} contributes nothing to the prompt`);
      }
    }
  });
});

describe("type instructions change behaviour, not adjectives", () => {
  const block = (type: string) => sessionPromptBlock({ ...bare, type });

  it("tells a coding session to give runnable code", () => {
    assert.match(block("coding"), /complete, runnable code/i);
    assert.match(block("coding"), /trade-off/i);
  });

  it("tells a study session not to hand over the answer", () => {
    assert.match(block("study"), /find out what they already know/i);
    assert.match(block("study"), /offer a hint first/i);
  });

  it("tells a research session to separate evidence from inference", () => {
    assert.match(block("research"), /established, what is contested/i);
    assert.match(block("research"), /cite sources/i);
  });

  it("tells a brainstorm session to withhold judgement", () => {
    assert.match(block("brainstorm"), /do not evaluate or rank/i);
    assert.match(block("brainstorm"), /genuinely different/i);
  });

  it("tells a voice session to drop markdown, which cannot be heard", () => {
    assert.match(block("voice"), /no markdown/i);
    assert.match(block("voice"), /short enough to listen to/i);
  });

  it("tells a creative session to produce rather than describe", () => {
    assert.match(block("creative"), /produce the thing/i);
  });

  it("tells a discussion session to surface disagreement", () => {
    assert.match(block("meeting"), /surface disagreement/i);
  });

  it("falls back to chat for an unrecognised type instead of throwing", () => {
    assert.equal(block("nonsense-type"), "");
  });
});

describe("session context", () => {
  it("carries established facts into the prompt", () => {
    const block = sessionPromptBlock({
      title: "Marketplace",
      type: "chat",
      contextNotes: ["The user is building a marketplace application."],
    });

    assert.match(block, /building a marketplace/);
    // This line is what makes "how should I handle the payments" resolve.
    assert.match(block, /When the user refers to "it", "the app" or "the project"/);
  });

  it("names the session so the model knows what it is in", () => {
    const block = sessionPromptBlock({
      title: "Payments design",
      type: "coding",
      contextNotes: [],
    });
    assert.match(block, /session titled "Payments design"/);
  });

  it("says nothing about context when none has accumulated", () => {
    assert.doesNotMatch(
      sessionPromptBlock({ ...bare, type: "coding" }),
      /established so far/
    );
  });
});

describe("context extraction", () => {
  it("reads the documented shape", () => {
    assert.deepEqual(contextFactsFrom('{"facts":["Building a marketplace"]}'), [
      "Building a marketplace",
    ]);
  });

  it("finds JSON inside a fenced block", () => {
    assert.deepEqual(
      contextFactsFrom('Sure\n```json\n{"facts":["Uses Postgres"]}\n```'),
      ["Uses Postgres"]
    );
  });

  it("returns nothing for junk rather than throwing", () => {
    assert.deepEqual(contextFactsFrom("nothing to record"), []);
    assert.deepEqual(contextFactsFrom('{"facts": "not a list"}'), []);
    assert.deepEqual(contextFactsFrom("{broken"), []);
    assert.deepEqual(contextFactsFrom(""), []);
  });

  it("keeps at most three facts and drops over-long ones", () => {
    assert.equal(
      contextFactsFrom('{"facts":["a","b","c","d","e"]}').length,
      3
    );
    assert.deepEqual(contextFactsFrom(`{"facts":["${"x".repeat(500)}"]}`), []);
  });
});

describe("duration", () => {
  it("counts to now while a session is still running", () => {
    const startedAt = new Date(Date.now() - 65_000);
    const seconds = sessionDuration({ startedAt, endedAt: null });
    assert.ok(seconds >= 64 && seconds <= 67, `got ${seconds}`);
  });

  it("freezes once the session has ended", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const endedAt = new Date("2026-01-01T10:30:00Z");
    assert.equal(sessionDuration({ startedAt, endedAt }), 1800);
  });

  it("never returns a negative duration", () => {
    const startedAt = new Date("2026-01-01T10:30:00Z");
    const endedAt = new Date("2026-01-01T10:00:00Z");
    assert.equal(sessionDuration({ startedAt, endedAt }), 0);
  });
});
