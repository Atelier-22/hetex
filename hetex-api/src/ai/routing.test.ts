import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyTask, selectModel } from "./routing";
import { defaultSettings, mergeSettings } from "../settings/schema";

const AVAILABLE = ["standard", "advanced", "fast", "reasoning"];

/** Routing decisions must not depend on which API keys this machine happens to have. */
const options = {
  available: AVAILABLE,
  supportsImages: (m: string) => m === "standard" || m === "advanced",
};

describe("task classification", () => {
  it("routes an attachment to vision, whatever the text says", () => {
    assert.equal(classifyTask({ message: "hi", hasImages: true }), "vision");
    assert.equal(
      classifyTask({ message: "write a function", hasImages: true }),
      "vision"
    );
  });

  it("recognises code", () => {
    const cases = [
      "```js\nconst x = 1\n```",
      "const total = items.reduce((a, b) => a + b)",
      "Why does my TypeScript build fail with a null pointer?",
      "Can you review this code and find bugs",
      "refactor this python script",
    ];
    for (const message of cases) {
      assert.equal(
        classifyTask({ message, hasImages: false }),
        "coding",
        `not classified as code: ${message}`
      );
    }
  });

  it("recognises work that needs reasoning", () => {
    const cases = [
      "Prove that the sum of two even numbers is even",
      "Walk me through this step-by-step",
      "Compare Postgres and MySQL for a write-heavy workload",
      "What are the trade-offs of a monorepo?",
    ];
    for (const message of cases) {
      assert.equal(
        classifyTask({ message, hasImages: false }),
        "reasoning",
        `not classified as reasoning: ${message}`
      );
    }
  });

  it("treats a very long message as reasoning", () => {
    assert.equal(
      classifyTask({ message: "a ".repeat(700), hasImages: false }),
      "reasoning"
    );
  });

  it("recognises a quick question early in a conversation", () => {
    assert.equal(
      classifyTask({ message: "hi", hasImages: false, historyLength: 0 }),
      "fast"
    );
    assert.equal(
      classifyTask({
        message: "What is the capital of Uganda?",
        hasImages: false,
        historyLength: 0,
      }),
      "fast"
    );
  });

  it("stops treating short messages as quick deep into a conversation", () => {
    assert.equal(
      classifyTask({ message: "thanks", hasImages: false, historyLength: 12 }),
      "general"
    );
  });

  it("falls back to general", () => {
    assert.equal(
      classifyTask({
        message: "Draft an email to my landlord about the broken tap",
        hasImages: false,
      }),
      "general"
    );
  });

  it("puts code ahead of reasoning when a message is both", () => {
    assert.equal(
      classifyTask({
        message: "Explain step-by-step why this TypeScript function throws",
        hasImages: false,
      }),
      "coding"
    );
  });
});

describe("model selection", () => {
  const base = mergeSettings(defaultSettings(), {
    ai: {
      defaultModel: "standard",
      fastModel: "fast",
      reasoningModel: "reasoning",
      codingModel: "advanced",
      visionModel: "standard",
    },
  });

  it("uses the default and says it did not route when routing is off", () => {
    const decision = selectModel(base, { message: "hi", hasImages: false }, options);
    assert.equal(decision.model, "standard");
    assert.equal(decision.routed, false);
  });

  it("routes each kind of work to its assigned model", () => {
    const settings = mergeSettings(base, { ai: { autoRouting: true } });

    assert.equal(
      selectModel(settings, { message: "```js\nx\n```", hasImages: false }, options)
        .model,
      "advanced"
    );
    assert.equal(
      selectModel(
        settings,
        { message: "Prove this theorem", hasImages: false },
        options
      ).model,
      "reasoning"
    );
    assert.equal(
      selectModel(settings, { message: "hi", hasImages: false }, options).model,
      "fast"
    );
    assert.equal(
      selectModel(settings, { message: "look", hasImages: true }, options).model,
      "standard"
    );
  });

  it("reports what it routed and why", () => {
    const settings = mergeSettings(base, { ai: { autoRouting: true } });
    const decision = selectModel(
      settings,
      { message: "const a = 1", hasImages: false },
      options
    );

    assert.equal(decision.routed, true);
    assert.equal(decision.task, "coding");
    assert.match(decision.reason, /code/);
  });

  it("falls back to the default when the assigned model is gone", () => {
    const settings = mergeSettings(base, {
      ai: { autoRouting: true, codingModel: "retired-model" },
    });

    const decision = selectModel(
      settings,
      { message: "const a = 1", hasImages: false },
      options
    );

    assert.equal(decision.model, "standard");
    assert.equal(decision.routed, false);
    assert.match(decision.reason, /isn't available/);
  });

  it("falls back when nothing is assigned to that task", () => {
    const settings = mergeSettings(base, {
      ai: { autoRouting: true, reasoningModel: null },
    });

    const decision = selectModel(
      settings,
      { message: "Prove this theorem", hasImages: false },
      options
    );

    assert.equal(decision.model, "standard");
    assert.equal(decision.routed, false);
  });

  it("refuses to route an image to a model that cannot see", () => {
    const settings = mergeSettings(base, {
      ai: { autoRouting: true, visionModel: "fast" },
    });

    const decision = selectModel(
      settings,
      { message: "what is this", hasImages: true },
      options
    );

    assert.equal(decision.model, "standard");
    assert.equal(decision.routed, false);
    assert.match(decision.reason, /cannot read images/);
  });

  it("never returns a model that is not available", () => {
    const settings = mergeSettings(base, {
      ai: { autoRouting: true, defaultModel: "retired-model" },
    });

    const decision = selectModel(
      settings,
      { message: "hello there", hasImages: false },
      options
    );

    assert.ok(AVAILABLE.includes(decision.model));
  });
});
