// Aviel AI — the settings document, as the browser sees it.
//
// This mirrors the zod schema in aviel-api/src/settings/schema.ts, which is the
// canonical definition. The mirror exists for types and for a first paint
// before the network answers; it is not a second source of truth:
//
//   * GET /settings returns the whole document, and the store replaces its
//     state with it. Anything wrong here is corrected on load.
//   * GET /settings/meta returns the server's own `defaults`, which the store
//     folds in, so a value added on the server appears here without a redeploy.
//   * Every write is validated server-side, so a key this file gets wrong is
//     rejected rather than silently stored.
//
// Drift is therefore visible (a control renders from a stale default until the
// first load) rather than dangerous.

export type Theme = "light" | "dark" | "system" | "amoled";
export type Accent = "green" | "blue" | "violet" | "amber" | "rose" | "custom";
export type NotificationChannel = "push" | "email" | "push_email" | "off";
export type MemoryCategory =
  | "preferences"
  | "projects"
  | "personalization"
  | "conversation";

export interface UserSettings {
  profile: {
    fullName: string | null;
    displayName: string | null;
    username: string | null;
    phone: string | null;
    country: string | null;
    timezone: string | null;
    preferredName: string | null;
    preferredGreeting: string | null;
    pronunciation: string | null;
    birthday: string | null;
    occupation: string | null;
    interests: string[];
  };
  ai: {
    provider: string;
    defaultModel: string;
    fastModel: string | null;
    reasoningModel: string | null;
    visionModel: string | null;
    codingModel: string | null;
    autoRouting: boolean;
    fallbackToLocal: boolean;
    webSearch: boolean;
  };
  personality: {
    persona:
      | "friendly"
      | "professional"
      | "casual"
      | "academic"
      | "creative"
      | "direct"
      | "supportive"
      | "concise";
    responseStyle: "concise" | "balanced" | "detailed" | "very_detailed";
    tone: "warm" | "neutral" | "professional" | "enthusiastic" | "calm";
    creativity: "low" | "medium" | "high";
    formality: "casual" | "balanced" | "formal";
    assistantName: string;
    customInstructions: string | null;
  };
  behavior: {
    askFollowUps: boolean;
    explainAnswers: boolean;
    showReasoning: boolean;
    giveExamples: boolean;
    rememberContext: boolean;
    avoidRepetition: boolean;
    autoSummarizeLong: boolean;
    useConversationContext: boolean;
    citeSources: boolean;
    verifyInformation: boolean;
    admitUncertainty: boolean;
    useMarkdown: boolean;
    codeFormatting: boolean;
    useTables: boolean;
    useBullets: boolean;
    stepByStep: boolean;
  };
  memory: {
    enabled: boolean;
    autoCapture: boolean;
    rememberPreferences: boolean;
    rememberPersonal: boolean;
    rememberProjects: boolean;
    rememberConversationContext: boolean;
    maxEntriesInPrompt: number;
  };
  conversation: {
    saveConversations: boolean;
    autoSave: boolean;
    retentionDays: 0 | 30 | 90 | 365;
    autoTitle: boolean;
    showTimestamps: boolean;
    showModelUsed: boolean;
    showUsage: boolean;
    streamResponses: boolean;
    autoScroll: boolean;
    sendKey: "enter" | "ctrl_enter";
    showTypingIndicator: boolean;
  };
  voice: {
    outputVoice: string | null;
    rate: number;
    pitch: number;
    volume: number;
    autoReadReplies: boolean;
    dictationEnabled: boolean;
    inputLanguage: string;
    autoDetectInputLanguage: boolean;
    liveTranscription: boolean;
    showTranscript: boolean;
    editTranscript: boolean;
    autoSubmit: boolean;
    micMode: "tap" | "hold" | "continuous";
    noiseReduction: boolean;
    audioQuality: "standard" | "high";
    soundEffects: boolean;
    hapticFeedback: boolean;
  };
  liveVoice: {
    enabled: boolean;
    continuousListening: boolean;
    voiceActivityDetection: boolean;
    allowInterrupt: boolean;
    allowAiInterruption: boolean;
    autoResponse: boolean;
    showTranscript: boolean;
    saveTranscript: boolean;
    saveAudio: boolean;
    autoDeleteAudioDays: number;
    maxSessionMinutes: number;
  };
  images: {
    analysisEnabled: boolean;
    generationEnabled: boolean;
    autoAnalyzeUploads: boolean;
    askBeforeAnalyzing: boolean;
    saveUploads: boolean;
    saveGenerated: boolean;
    deleteAfterConversation: boolean;
    keepHistory: boolean;
    retentionDays: number;
    visionModel: string | null;
    ocr: boolean;
    screenshotAnalysis: boolean;
    documentImageAnalysis: boolean;
    generationModel: string | null;
    aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:2";
    generationResolution: "512" | "768" | "1024";
    generationQuality: "draft" | "standard" | "high";
  };
  files: {
    autoAnalyze: boolean;
    autoIndex: boolean;
    keepUploads: boolean;
    deleteAfterConversation: boolean;
    retentionDays: number;
    storage: "database" | "cloud" | "local";
  };
  appearance: {
    theme: Theme;
    visualStyle: "glass" | "solid" | "minimal";
    accent: Accent;
    customAccent: string | null;
    background: "gradient" | "static" | "ambient" | "minimal" | "none";
    animations: "full" | "reduced" | "off";
    messageDensity: "compact" | "comfortable" | "spacious";
    bubbleStyle: "rounded" | "square" | "minimal";
    fontSize: "small" | "medium" | "large" | "xlarge";
    codeFontSize: "small" | "medium" | "large";
    lineSpacing: "tight" | "normal" | "relaxed";
    sidebar: "expanded" | "collapsed" | "auto";
  };
  language: {
    app: string;
    aiResponse: string;
    voiceInput: string;
    voiceOutput: string;
    autoDetect: boolean;
  };
  accessibility: {
    largeText: boolean;
    extraLargeText: boolean;
    boldText: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
    screenReaderHints: boolean;
    keyboardNavigation: boolean;
    voiceNavigation: boolean;
    captions: boolean;
    hapticFeedback: boolean;
    largerButtons: boolean;
  };
  notifications: {
    categories: Record<string, NotificationChannel>;
    sound: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    desktopCompletion: boolean;
  };
  privacy: {
    saveVoiceRecordings: boolean;
    saveVoiceTranscripts: boolean;
    trainingOptIn: boolean;
    showProcessingLocation: boolean;
    localOnly: boolean;
  };
  security: {
    loginAlerts: boolean;
    securityNotifications: boolean;
    sessionTimeoutMinutes: number;
  };
  safety: {
    responseStyle: "gentle" | "direct" | "emergency";
    showCrisisResources: boolean;
  };
  projects: {
    autoSave: boolean;
    projectMemory: boolean;
    useProjectContext: boolean;
    fileIndexing: boolean;
    notifications: boolean;
    defaultModel: string | null;
    defaultInstructions: string | null;
    defaultResponseStyle:
      | "inherit"
      | "concise"
      | "balanced"
      | "detailed"
      | "very_detailed";
  };
  library: {
    autoSaveChats: boolean;
    autoSaveGeneratedFiles: boolean;
    autoSaveGeneratedImages: boolean;
    sort: "newest" | "oldest" | "alphabetical" | "most_used";
  };
  offline: {
    cacheConversations: boolean;
    cacheLimit: number;
    downloadOverWifiOnly: boolean;
    allowMobileData: boolean;
    autoUpdateModels: boolean;
    preferLocalWhenOffline: boolean;
  };
  advanced: {
    temperature: number;
    maxOutputTokens: number;
    streaming: boolean;
    debugMode: boolean;
    developerMode: boolean;
    experimentalFeatures: boolean;
    fallbackModel: string | null;
    launchAtLogin: boolean;
  };
}

export type SettingsGroup = keyof UserSettings;

export type SettingsPatch = {
  [K in SettingsGroup]?: Partial<UserSettings[K]>;
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  "profile",
  "ai",
  "personality",
  "behavior",
  "memory",
  "conversation",
  "voice",
  "liveVoice",
  "images",
  "files",
  "appearance",
  "language",
  "accessibility",
  "notifications",
  "privacy",
  "security",
  "safety",
  "projects",
  "library",
  "offline",
  "advanced",
];

export const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    fullName: null,
    displayName: null,
    username: null,
    phone: null,
    country: null,
    timezone: null,
    preferredName: null,
    preferredGreeting: null,
    pronunciation: null,
    birthday: null,
    occupation: null,
    interests: [],
  },
  ai: {
    provider: "auto",
    defaultModel: "standard",
    fastModel: null,
    reasoningModel: null,
    visionModel: null,
    codingModel: null,
    autoRouting: false,
    fallbackToLocal: true,
    webSearch: true,
  },
  personality: {
    persona: "friendly",
    responseStyle: "balanced",
    tone: "neutral",
    creativity: "medium",
    formality: "balanced",
    assistantName: "Aviel AI",
    customInstructions: null,
  },
  behavior: {
    askFollowUps: false,
    explainAnswers: true,
    showReasoning: false,
    giveExamples: true,
    rememberContext: true,
    avoidRepetition: true,
    autoSummarizeLong: false,
    useConversationContext: true,
    citeSources: true,
    verifyInformation: true,
    admitUncertainty: true,
    useMarkdown: true,
    codeFormatting: true,
    useTables: true,
    useBullets: true,
    stepByStep: false,
  },
  memory: {
    enabled: false,
    autoCapture: true,
    rememberPreferences: true,
    rememberPersonal: true,
    rememberProjects: true,
    rememberConversationContext: true,
    maxEntriesInPrompt: 20,
  },
  conversation: {
    saveConversations: true,
    autoSave: true,
    retentionDays: 0,
    autoTitle: true,
    showTimestamps: true,
    showModelUsed: false,
    showUsage: false,
    streamResponses: true,
    autoScroll: true,
    sendKey: "enter",
    showTypingIndicator: true,
  },
  voice: {
    outputVoice: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    autoReadReplies: false,
    dictationEnabled: true,
    inputLanguage: "en-US",
    autoDetectInputLanguage: false,
    liveTranscription: true,
    showTranscript: true,
    editTranscript: true,
    autoSubmit: false,
    micMode: "tap",
    noiseReduction: true,
    audioQuality: "standard",
    soundEffects: true,
    hapticFeedback: true,
  },
  liveVoice: {
    enabled: true,
    continuousListening: true,
    voiceActivityDetection: true,
    allowInterrupt: true,
    allowAiInterruption: false,
    autoResponse: true,
    showTranscript: true,
    saveTranscript: true,
    saveAudio: false,
    autoDeleteAudioDays: 0,
    maxSessionMinutes: 15,
  },
  images: {
    analysisEnabled: true,
    generationEnabled: false,
    autoAnalyzeUploads: true,
    askBeforeAnalyzing: false,
    saveUploads: true,
    saveGenerated: true,
    deleteAfterConversation: false,
    keepHistory: true,
    retentionDays: 0,
    visionModel: null,
    ocr: false,
    screenshotAnalysis: true,
    documentImageAnalysis: true,
    generationModel: null,
    aspectRatio: "1:1",
    generationResolution: "1024",
    generationQuality: "standard",
  },
  files: {
    autoAnalyze: true,
    autoIndex: false,
    keepUploads: true,
    deleteAfterConversation: false,
    retentionDays: 0,
    storage: "database",
  },
  appearance: {
    theme: "system",
    visualStyle: "glass",
    accent: "green",
    customAccent: null,
    background: "static",
    animations: "full",
    messageDensity: "comfortable",
    bubbleStyle: "rounded",
    fontSize: "medium",
    codeFontSize: "medium",
    lineSpacing: "normal",
    sidebar: "expanded",
  },
  language: {
    app: "auto",
    aiResponse: "auto",
    voiceInput: "auto",
    voiceOutput: "auto",
    autoDetect: true,
  },
  accessibility: {
    largeText: false,
    extraLargeText: false,
    boldText: false,
    highContrast: false,
    reduceMotion: false,
    screenReaderHints: false,
    keyboardNavigation: true,
    voiceNavigation: false,
    captions: false,
    hapticFeedback: true,
    largerButtons: false,
  },
  notifications: {
    categories: {},
    sound: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    desktopCompletion: false,
  },
  privacy: {
    saveVoiceRecordings: false,
    saveVoiceTranscripts: true,
    trainingOptIn: false,
    showProcessingLocation: true,
    localOnly: false,
  },
  security: {
    loginAlerts: true,
    securityNotifications: true,
    sessionTimeoutMinutes: 0,
  },
  safety: {
    responseStyle: "gentle",
    showCrisisResources: true,
  },
  projects: {
    autoSave: true,
    projectMemory: true,
    useProjectContext: true,
    fileIndexing: false,
    notifications: true,
    defaultModel: null,
    defaultInstructions: null,
    defaultResponseStyle: "inherit",
  },
  library: {
    autoSaveChats: true,
    autoSaveGeneratedFiles: true,
    autoSaveGeneratedImages: true,
    sort: "newest",
  },
  offline: {
    cacheConversations: true,
    cacheLimit: 20,
    downloadOverWifiOnly: true,
    allowMobileData: false,
    autoUpdateModels: false,
    preferLocalWhenOffline: true,
  },
  advanced: {
    temperature: 1,
    maxOutputTokens: 4096,
    streaming: true,
    debugMode: false,
    developerMode: false,
    experimentalFeatures: false,
    fallbackModel: null,
    launchAtLogin: false,
  },
};

/** One level deep, which is exactly how deep the document goes. */
export function mergeSettings(
  base: UserSettings,
  patch: SettingsPatch
): UserSettings {
  const next = { ...base };
  for (const group of SETTINGS_GROUPS) {
    const incoming = patch[group];
    if (!incoming) continue;
    next[group] = { ...(base[group] as object), ...(incoming as object) } as never;
  }
  return next;
}

/**
 * Fold a partial document (the server's defaults, or a cached copy) onto the
 * built-in defaults without letting a missing group blank anything out.
 */
export function withDefaults(partial: unknown): UserSettings {
  if (!partial || typeof partial !== "object") return DEFAULT_SETTINGS;

  const source = partial as Record<string, unknown>;
  const next = { ...DEFAULT_SETTINGS };

  for (const group of SETTINGS_GROUPS) {
    const value = source[group];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      next[group] = { ...(DEFAULT_SETTINGS[group] as object), ...value } as never;
    }
  }

  return next;
}
