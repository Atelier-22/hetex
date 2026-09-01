import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampToPlatform } from "./clamp";
import { defaultSettings, mergeSettings } from "./schema";
import { defaultPlatformConfig, mergePlatformConfig } from "./platform";

const config = defaultPlatformConfig();

describe("platform clamping", () => {
  it("leaves settings alone when everything is enabled", () => {
    const settings = mergeSettings(defaultSettings(), {
      memory: { enabled: true },
      voice: { dictationEnabled: true },
    });

    const clamped = clampToPlatform(settings, config);

    assert.equal(clamped.memory.enabled, true);
    assert.equal(clamped.voice.dictationEnabled, true);
  });

  it("turns off what an administrator has disabled", () => {
    const settings = mergeSettings(defaultSettings(), {
      memory: { enabled: true },
      voice: { dictationEnabled: true, autoReadReplies: true },
      liveVoice: { enabled: true },
      images: { analysisEnabled: true },
    });

    const restricted = mergePlatformConfig(config, {
      features: { memory: false, voice: false, imageAnalysis: false },
    });

    const clamped = clampToPlatform(settings, restricted);

    assert.equal(clamped.memory.enabled, false);
    assert.equal(clamped.voice.dictationEnabled, false);
    assert.equal(clamped.voice.autoReadReplies, false);
    // Live voice needs voice; disabling voice disables it too.
    assert.equal(clamped.liveVoice.enabled, false);
    assert.equal(clamped.images.analysisEnabled, false);
  });

  it("never switches something on that the user turned off", () => {
    const settings = defaultSettings(); // memory off by default
    const clamped = clampToPlatform(settings, config);
    assert.equal(clamped.memory.enabled, false);
  });

  it("caps the output ceiling at the platform limit", () => {
    const settings = mergeSettings(defaultSettings(), {
      advanced: { maxOutputTokens: 32000 },
    });

    const capped = mergePlatformConfig(config, {
      limits: { maxOutputTokens: 4096 },
    });

    assert.equal(
      clampToPlatform(settings, capped).advanced.maxOutputTokens,
      4096
    );
  });

  it("caps how many memories may reach the prompt", () => {
    const settings = mergeSettings(defaultSettings(), {
      memory: { maxEntriesInPrompt: 60 },
    });

    const capped = mergePlatformConfig(config, {
      limits: { maxMemoryEntries: 10 },
    });

    assert.equal(clampToPlatform(settings, capped).memory.maxEntriesInPrompt, 10);
  });

  it("refuses audio storage no matter what is stored", () => {
    const settings = mergeSettings(defaultSettings(), {
      liveVoice: { saveAudio: true },
    });
    assert.equal(clampToPlatform(settings, config).liveVoice.saveAudio, false);
  });

  it("refuses image generation, because nothing implements it", () => {
    const settings = mergeSettings(defaultSettings(), {
      images: { generationEnabled: true },
    });
    assert.equal(
      clampToPlatform(settings, config).images.generationEnabled,
      false
    );
  });

  it("forces file storage back to the only backend that exists", () => {
    const settings = mergeSettings(defaultSettings(), {
      files: { storage: "cloud" },
    });
    assert.equal(clampToPlatform(settings, config).files.storage, "database");
  });

  it("cannot be used to weaken safety", () => {
    const settings = defaultSettings();
    const clamped = clampToPlatform(settings, config);
    assert.deepEqual(clamped.safety, settings.safety);
  });
});

describe("platform config", () => {
  it("merges one feature without dropping the others", () => {
    const next = mergePlatformConfig(config, { features: { voice: false } });
    assert.equal(next.features.voice, false);
    assert.equal(next.features.chat, true);
    assert.equal(next.features.memory, true);
  });

  it("merges one limit without dropping the others", () => {
    const next = mergePlatformConfig(config, {
      limits: { messagesPerDay: 20 },
    });
    assert.equal(next.limits.messagesPerDay, 20);
    assert.equal(next.limits.maxUploadMb, config.limits.maxUploadMb);
  });

  it("starts with image generation and billing off", () => {
    assert.equal(config.features.imageGeneration, false);
    assert.equal(config.billingConfigured, false);
  });

  it("does not reveal vendor names by default", () => {
    assert.equal(config.revealProviderNames, false);
  });
});
