// Aviel AI — the settings map.
//
// Every section, the category it belongs to, and the individual settings inside
// it. The nav renders from this, and so does search: typing "voice" has to find
// Voice, Live Voice, speech recognition, speech speed and voice language, which
// means search needs to know what is *inside* a section, not only its title.
//
// Keeping that index here rather than scraping the rendered DOM means a section
// that has not been opened is still searchable.

import {
  Accessibility,
  Bell,
  Blocks,
  BookMarked,
  Bot,
  Braces,
  CircleHelp,
  Cpu,
  CreditCard,
  Database,
  FileText,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  type LucideIcon,
  MessagesSquare,
  Mic,
  Palette,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Brain,
  User,
} from "lucide-react";
import type { SettingsGroup } from "@/lib/settings/types";

export const SECTION_IDS = [
  "profile",
  "models",
  "personality",
  "behavior",
  "memory",
  "conversations",
  "voice",
  "live-voice",
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
  "integrations",
  "offline",
  "subscription",
  "advanced",
  "help",
  "about",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type CategoryId =
  | "account"
  | "ai"
  | "media"
  | "app"
  | "privacy"
  | "workspace"
  | "offline"
  | "billing"
  | "system";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "ai", label: "AI" },
  { id: "media", label: "Voice & media" },
  { id: "app", label: "App" },
  { id: "privacy", label: "Privacy & security" },
  { id: "workspace", label: "Workspace" },
  { id: "offline", label: "Offline" },
  { id: "billing", label: "Billing" },
  { id: "system", label: "System" },
];

export interface SectionDef {
  id: SectionId;
  category: CategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** The settings group this section resets, when it maps to exactly one. */
  group?: SettingsGroup;
  /** Individual settings inside, so search can find them by name. */
  entries: string[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: "profile",
    category: "account",
    label: "Profile & account",
    description: "Who you are, and how you sign in.",
    icon: User,
    group: "profile",
    entries: [
      "profile picture",
      "avatar",
      "full name",
      "display name",
      "username",
      "email",
      "change email",
      "phone number",
      "country",
      "time zone",
      "preferred name",
      "preferred greeting",
      "pronunciation",
      "birthday",
      "occupation",
      "interests",
      "change password",
      "delete account",
    ],
  },
  {
    id: "models",
    category: "ai",
    label: "AI & models",
    description: "Which model answers you, and where it runs.",
    icon: Bot,
    group: "ai",
    entries: [
      "provider",
      "local ai",
      "on-device",
      "default model",
      "fast model",
      "reasoning model",
      "vision model",
      "coding model",
      "automatic model selection",
      "model routing",
      "context length",
      "web search",
      "fallback",
      "install model",
      "ollama",
    ],
  },
  {
    id: "personality",
    category: "ai",
    label: "AI personality",
    description: "How Aviel sounds when it talks to you.",
    icon: Sparkles,
    group: "personality",
    entries: [
      "personality",
      "persona",
      "friendly",
      "professional",
      "casual",
      "academic",
      "creative",
      "direct",
      "supportive",
      "concise",
      "response style",
      "detailed",
      "tone",
      "warm",
      "creativity",
      "formality",
      "assistant name",
      "custom instructions",
    ],
  },
  {
    id: "behavior",
    category: "ai",
    label: "AI behavior",
    description: "What Aviel does when it answers.",
    icon: Braces,
    group: "behavior",
    entries: [
      "follow-up questions",
      "explain answers",
      "show reasoning",
      "examples",
      "remember context",
      "avoid repetition",
      "summarize long conversations",
      "cite sources",
      "verify information",
      "admit uncertainty",
      "markdown",
      "code formatting",
      "tables",
      "bullets",
      "step-by-step",
    ],
  },
  {
    id: "memory",
    category: "ai",
    label: "Memory",
    description: "What Aviel remembers between conversations.",
    icon: Brain,
    group: "memory",
    entries: [
      "memory",
      "remember",
      "view memories",
      "edit memory",
      "delete memory",
      "delete all memories",
      "preferences",
      "project memory",
      "personalization",
      "conversation memory",
      "do not remember this conversation",
    ],
  },
  {
    id: "conversations",
    category: "ai",
    label: "Conversations",
    description: "History, retention, and how the chat behaves.",
    icon: MessagesSquare,
    group: "conversation",
    entries: [
      "save conversations",
      "chat history",
      "auto-save",
      "auto-delete",
      "retention",
      "delete after 30 days",
      "delete after 90 days",
      "keep indefinitely",
      "auto-title",
      "timestamps",
      "show model used",
      "token usage",
      "stream responses",
      "automatic scroll",
      "enter to send",
      "ctrl+enter",
      "typing indicator",
    ],
  },
  {
    id: "voice",
    category: "media",
    label: "Voice",
    description: "Speaking to Aviel, and hearing it back.",
    icon: Mic,
    group: "voice",
    entries: [
      "voice",
      "read aloud",
      "text to speech",
      "speech speed",
      "speech rate",
      "pitch",
      "volume",
      "microphone",
      "dictation",
      "speech recognition",
      "voice language",
      "transcription",
      "transcript",
      "auto-submit",
      "tap to talk",
      "hold to talk",
      "noise reduction",
      "sound effects",
      "haptic feedback",
    ],
  },
  {
    id: "live-voice",
    category: "media",
    label: "Live voice",
    description: "Hands-free back-and-forth conversation.",
    icon: RadioTower,
    group: "liveVoice",
    entries: [
      "live voice",
      "continuous listening",
      "voice activity detection",
      "interrupt",
      "auto response",
      "session length",
      "save transcript",
      "save audio",
    ],
  },
  {
    id: "images",
    category: "media",
    label: "Images",
    description: "Reading images, and making them.",
    icon: ImageIcon,
    group: "images",
    entries: [
      "image analysis",
      "image generation",
      "vision",
      "ocr",
      "screenshot analysis",
      "auto-analyze uploads",
      "save images",
      "image history",
      "aspect ratio",
      "resolution",
      "image quality",
    ],
  },
  {
    id: "files",
    category: "media",
    label: "Files",
    description: "Uploads, limits and how long they are kept.",
    icon: FileText,
    group: "files",
    entries: [
      "files",
      "attachments",
      "maximum file size",
      "allowed file types",
      "pdf",
      "docx",
      "csv",
      "xlsx",
      "file indexing",
      "document analysis",
      "keep uploaded files",
      "storage",
    ],
  },
  {
    id: "appearance",
    category: "app",
    label: "Appearance",
    description: "Theme, colour, density and type.",
    icon: Palette,
    group: "appearance",
    entries: [
      "theme",
      "dark mode",
      "light mode",
      "amoled",
      "system theme",
      "accent colour",
      "accent color",
      "custom colour",
      "glass",
      "background",
      "animations",
      "message density",
      "bubble style",
      "font size",
      "text size",
      "code font size",
      "line spacing",
      "sidebar",
    ],
  },
  {
    id: "language",
    category: "app",
    label: "Language",
    description: "What language Aviel reads and replies in.",
    icon: Languages,
    group: "language",
    entries: [
      "language",
      "interface language",
      "ai response language",
      "reply language",
      "voice input language",
      "voice output language",
      "automatic language detection",
      "translation",
    ],
  },
  {
    id: "accessibility",
    category: "app",
    label: "Accessibility",
    description: "Text size, contrast, motion and input.",
    icon: Accessibility,
    group: "accessibility",
    entries: [
      "large text",
      "extra large text",
      "bold text",
      "high contrast",
      "reduce motion",
      "screen reader",
      "keyboard navigation",
      "captions",
      "haptic feedback",
      "larger buttons",
    ],
  },
  {
    id: "notifications",
    category: "app",
    label: "Notifications",
    description: "What reaches you, and how.",
    icon: Bell,
    group: "notifications",
    entries: [
      "notifications",
      "email notifications",
      "push notifications",
      "desktop notifications",
      "completion alerts",
      "security alerts",
      "product updates",
      "usage alerts",
      "notification sound",
      "quiet hours",
    ],
  },
  {
    id: "privacy",
    category: "privacy",
    label: "Privacy & data",
    description: "What is kept, where it is processed, and how to take it back.",
    icon: ShieldCheck,
    group: "privacy",
    entries: [
      "privacy",
      "data",
      "processing location",
      "processed locally",
      "external provider",
      "download my data",
      "export conversations",
      "export projects",
      "delete all data",
      "delete account",
      "training",
      "retention period",
      "voice recordings",
    ],
  },
  {
    id: "security",
    category: "privacy",
    label: "Security",
    description: "Password, two-factor and signed-in devices.",
    icon: KeyRound,
    group: "security",
    entries: [
      "password",
      "change password",
      "two-factor authentication",
      "2fa",
      "totp",
      "authenticator",
      "recovery codes",
      "passkeys",
      "biometric",
      "login alerts",
      "active sessions",
      "connected devices",
      "sign out of all devices",
      "session timeout",
    ],
  },
  {
    id: "safety",
    category: "privacy",
    label: "Safety",
    description: "Protections that stay on, and how refusals are worded.",
    icon: ShieldAlert,
    group: "safety",
    entries: [
      "safety",
      "self-harm",
      "crisis resources",
      "emergency",
      "gentle response",
      "direct response",
      "content protections",
    ],
  },
  {
    id: "projects",
    category: "workspace",
    label: "Projects",
    description: "Defaults for every project.",
    icon: FolderKanban,
    group: "projects",
    entries: [
      "projects",
      "project memory",
      "project context",
      "project instructions",
      "default model",
      "file indexing",
      "project notifications",
    ],
  },
  {
    id: "library",
    category: "workspace",
    label: "Library",
    description: "Saved chats, files and images.",
    icon: BookMarked,
    group: "library",
    entries: [
      "library",
      "auto-save chats",
      "saved files",
      "saved images",
      "bookmarks",
      "collections",
      "sorting",
      "newest",
      "alphabetical",
    ],
  },
  {
    id: "integrations",
    category: "workspace",
    label: "Integrations",
    description: "Services Aviel can connect to.",
    icon: Blocks,
    entries: [
      "integrations",
      "plugins",
      "connect",
      "disconnect",
      "google",
      "google drive",
      "microsoft",
      "github",
      "cloud storage",
      "calendar",
      "email",
      "permissions",
    ],
  },
  {
    id: "offline",
    category: "offline",
    label: "Offline & local AI",
    description: "Working without a connection, and models on this server.",
    icon: Cpu,
    group: "offline",
    entries: [
      "offline",
      "local ai",
      "local models",
      "download models",
      "wi-fi only",
      "mobile data",
      "cached conversations",
      "storage used",
      "automatic updates",
      "ollama",
      "llama.cpp",
    ],
  },
  {
    id: "subscription",
    category: "billing",
    label: "Subscription & usage",
    description: "Your plan, your limits and what you have used.",
    icon: CreditCard,
    entries: [
      "subscription",
      "plan",
      "billing",
      "upgrade",
      "free",
      "plus",
      "pro",
      "business",
      "usage",
      "messages used",
      "storage used",
      "invoices",
      "payment",
    ],
  },
  {
    id: "advanced",
    category: "system",
    label: "Advanced",
    description: "Generation parameters and developer tools.",
    icon: Database,
    group: "advanced",
    entries: [
      "advanced",
      "temperature",
      "maximum output",
      "max tokens",
      "context length",
      "streaming",
      "debug mode",
      "developer mode",
      "experimental features",
      "fallback model",
      "export settings",
      "import settings",
      "reset all settings",
    ],
  },
  {
    id: "help",
    category: "system",
    label: "Help & support",
    description: "Guides, and how to reach us.",
    icon: CircleHelp,
    entries: [
      "help",
      "help center",
      "faq",
      "contact support",
      "report a bug",
      "report an AI response",
      "report a safety issue",
      "send feedback",
      "system diagnostics",
    ],
  },
  {
    id: "about",
    category: "system",
    label: "About Aviel AI",
    description: "Version, build and what is running.",
    icon: Info,
    entries: [
      "about",
      "version",
      "build",
      "ai engine",
      "database version",
      "installed models",
      "system status",
      "terms",
      "privacy policy",
      "licenses",
      "open source",
    ],
  },
];

export const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export interface SearchHit {
  section: SectionDef;
  /** The individual settings inside that matched, for the result subtitle. */
  matches: string[];
}

/**
 * Search across section names, descriptions and every setting inside them.
 *
 * Scored so that a section whose *name* matches ranks above one that merely
 * contains a matching control — searching "voice" should offer Voice before
 * Privacy, even though Privacy mentions voice recordings.
 */
export function searchSections(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return SECTIONS.map((section) => ({ section, matches: [] }));

  const terms = q.split(/\s+/).filter(Boolean);

  const scored = SECTIONS.map((section) => {
    const label = section.label.toLowerCase();
    const description = section.description.toLowerCase();

    let score = 0;
    const matches: string[] = [];

    for (const term of terms) {
      if (label === term) score += 100;
      else if (label.startsWith(term)) score += 60;
      else if (label.includes(term)) score += 40;

      if (description.includes(term)) score += 8;

      for (const entry of section.entries) {
        if (entry === term) {
          score += 25;
          matches.push(entry);
        } else if (entry.includes(term)) {
          score += 12;
          matches.push(entry);
        }
      }
    }

    return {
      section,
      // Deduplicated and capped: a subtitle listing fifteen matches is noise.
      matches: [...new Set(matches)].slice(0, 4),
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.section.label.localeCompare(b.section.label))
    .map(({ section, matches }) => ({ section, matches }));
}
