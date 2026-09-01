// Aviel AI — clamping user settings against platform policy.
//
// Kept apart from the store so it is a pure function of (settings, config) with
// no database import: this is the rule that decides what an account is actually
// allowed to have switched on, and it should be readable and testable on its
// own.

import type { UserSettings } from "./schema";
import type { PlatformConfig } from "./platform";

/**
 * Apply what the platform currently allows on top of what the user asked for.
 *
 * Run on read as well as on write, so turning a feature off in the admin
 * dashboard takes effect for accounts that had already switched it on — without
 * rewriting their stored preference, which would silently lose it if the
 * feature came back.
 *
 * This only ever removes capability. It cannot switch something on that the
 * user turned off.
 */
export function clampToPlatform(
  settings: UserSettings,
  config: PlatformConfig
): UserSettings {
  const f = config.features;

  return {
    ...settings,
    memory: {
      ...settings.memory,
      enabled: settings.memory.enabled && f.memory,
      maxEntriesInPrompt: Math.min(
        settings.memory.maxEntriesInPrompt,
        config.limits.maxMemoryEntries
      ),
    },
    voice: {
      ...settings.voice,
      dictationEnabled: settings.voice.dictationEnabled && f.voice,
      autoReadReplies: settings.voice.autoReadReplies && f.voice,
    },
    liveVoice: {
      ...settings.liveVoice,
      enabled: settings.liveVoice.enabled && f.liveVoice && f.voice,
      // There is no audio store anywhere in Aviel, so this can never be true —
      // not by preference, not by import, not by a crafted request.
      saveAudio: false,
    },
    images: {
      ...settings.images,
      analysisEnabled: settings.images.analysisEnabled && f.imageAnalysis,
      generationEnabled: settings.images.generationEnabled && f.imageGeneration,
    },
    files: {
      ...settings.files,
      // Only database storage exists. Cloud and local are refused rather than
      // stored as an intention that nothing implements.
      storage: "database",
    },
    ai: {
      ...settings.ai,
      webSearch: settings.ai.webSearch && f.webSearch,
      fallbackToLocal: settings.ai.fallbackToLocal && f.localAI,
    },
    projects: {
      ...settings.projects,
      autoSave: settings.projects.autoSave && f.projects,
      projectMemory: settings.projects.projectMemory && f.memory && f.projects,
    },
    library: {
      ...settings.library,
      autoSaveChats: settings.library.autoSaveChats && f.library,
      autoSaveGeneratedFiles: settings.library.autoSaveGeneratedFiles && f.library,
      autoSaveGeneratedImages:
        settings.library.autoSaveGeneratedImages && f.library && f.imageGeneration,
    },
    advanced: {
      ...settings.advanced,
      maxOutputTokens: Math.min(
        settings.advanced.maxOutputTokens,
        config.limits.maxOutputTokens
      ),
    },
    // Safety is not clamped, because there is nothing to clamp: the schema has
    // no switch that turns protection off, only one that chooses the wording of
    // a refusal.
  };
}
