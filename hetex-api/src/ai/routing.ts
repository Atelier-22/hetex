// Hetex AI — automatic model selection.
//
// When "Choose the model automatically" is on, each message is classified and
// routed to whichever model the account has assigned to that kind of work. The
// classifier is a deterministic heuristic, not a model call: routing must not
// add a network round trip and a second-long delay to every message, and it has
// to be testable.
//
// Routing can only ever pick a model that is genuinely available. An assignment
// pointing at a model whose provider has since lost its key falls back to the
// default rather than failing on send.

import { availableModels, providerForModel } from "./index";
import type { UserSettings } from "../settings/schema";

export type TaskKind = "vision" | "coding" | "reasoning" | "fast" | "general";

export interface RoutingInput {
  message: string;
  hasImages: boolean;
  /** Turns already in the conversation — a long thread is not a quick question. */
  historyLength?: number;
}

export interface RoutingDecision {
  model: string;
  task: TaskKind;
  /** True when routing chose it; false when the account's default was used. */
  routed: boolean;
  reason: string;
}

const CODING_PATTERNS = [
  /```/,
  /\b(function|const|let|var|class|import|export|def|async|await|return)\b\s/,
  /\b(typescript|javascript|python|rust|golang|java|kotlin|swift|sql|regex|bash)\b/i,
  /\b(refactor|debug|stack ?trace|compile|compiler|runtime error|null pointer|segfault)\b/i,
  /\b(write|fix|review|optimi[sz]e)\b.{0,24}\b(code|function|script|query|component|api)\b/i,
  /[{};]\s*$/m,
];

const REASONING_PATTERNS = [
  /\b(prove|proof|derive|theorem|integral|derivative|probability|combinator)\b/i,
  /\b(step[- ]by[- ]step|reason through|work through|think through)\b/i,
  /\b(trade[- ]?offs?|architect(ure|ural)|design a system|scal(e|ing) to)\b/i,
  /\b(why (does|do|would|is|are)|explain how .{0,40} works)\b/i,
  /\b(compare|contrast|evaluate|analy[sz]e)\b.{0,40}\b(and|versus|vs\.?)\b/i,
  /\b(strategy|plan|roadmap)\b.{0,30}\b(for|to)\b/i,
];

const QUICK_PATTERNS = [
  /^(hi|hey|hello|yo|thanks|thank you|ok|okay|got it|cool|nice|great)\b/i,
  /^(what|who|when|where) (is|are|was|were)\b.{0,60}\??$/i,
  /^(translate|define|spell|summari[sz]e in one|tldr)\b/i,
];

const LONG_MESSAGE_CHARS = 1200;
const SHORT_MESSAGE_CHARS = 120;

/**
 * What kind of work this message is.
 *
 * Order matters: an image attachment beats everything, because a model that
 * cannot see is simply the wrong one. Code beats reasoning because a code
 * question phrased as "why does this fail" would otherwise be misfiled.
 */
export function classifyTask(input: RoutingInput): TaskKind {
  if (input.hasImages) return "vision";

  const text = input.message ?? "";
  if (CODING_PATTERNS.some((p) => p.test(text))) return "coding";
  if (REASONING_PATTERNS.some((p) => p.test(text))) return "reasoning";

  if (text.length >= LONG_MESSAGE_CHARS) return "reasoning";

  if (
    text.length <= SHORT_MESSAGE_CHARS &&
    (input.historyLength ?? 0) < 4 &&
    QUICK_PATTERNS.some((p) => p.test(text.trim()))
  ) {
    return "fast";
  }

  return "general";
}

const TASK_SETTING: Record<Exclude<TaskKind, "general">, keyof UserSettings["ai"]> =
  {
    vision: "visionModel",
    coding: "codingModel",
    reasoning: "reasoningModel",
    fast: "fastModel",
  };

const TASK_REASON: Record<TaskKind, string> = {
  vision: "the message includes an image",
  coding: "the message is about code",
  reasoning: "the message needs working through",
  fast: "the message is a quick question",
  general: "no more specific match",
};

export interface RoutingOptions {
  /**
   * Model ids that may be chosen. Defaults to whatever is configured on this
   * server; passed explicitly by the tests, which must not depend on which API
   * keys happen to be present.
   */
  available?: string[];
  /** Whether a model can read images. Defaults to asking the provider registry. */
  supportsImages?: (model: string) => boolean;
}

/**
 * Which model should answer this message.
 *
 * With routing off, or with no model assigned to the classified task, this
 * returns the account default and says so — the caller can show "routed to X"
 * honestly rather than implying a decision that was never made.
 */
export function selectModel(
  settings: UserSettings,
  input: RoutingInput,
  options: RoutingOptions = {}
): RoutingDecision {
  const available = new Set(
    options.available ?? availableModels().map((m) => m.value)
  );
  const supportsImages =
    options.supportsImages ??
    ((model: string) => providerForModel(model).capabilities.images);
  const fallback = available.has(settings.ai.defaultModel)
    ? settings.ai.defaultModel
    : ([...available][0] ?? settings.ai.defaultModel);

  if (!settings.ai.autoRouting) {
    return {
      model: fallback,
      task: "general",
      routed: false,
      reason: "automatic selection is off",
    };
  }

  const task = classifyTask(input);

  if (task === "general") {
    return { model: fallback, task, routed: false, reason: TASK_REASON.general };
  }

  const assigned = settings.ai[TASK_SETTING[task]];
  if (typeof assigned !== "string" || !assigned || !available.has(assigned)) {
    return {
      model: fallback,
      task,
      routed: false,
      reason: assigned
        ? "the model assigned to that task isn't available"
        : "no model is assigned to that task",
    };
  }

  // A vision task routed to a model that cannot see images is worse than not
  // routing at all — the attachment would be dropped with an apology.
  if (task === "vision" && !supportsImages(assigned)) {
    return {
      model: fallback,
      task,
      routed: false,
      reason: "the assigned vision model cannot read images",
    };
  }

  return { model: assigned, task, routed: true, reason: TASK_REASON[task] };
}
