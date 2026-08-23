import { eq } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Notification preferences.
 *
 * Nothing sends notifications yet — there is no push service and no mail
 * transport. What exists is the decision layer: preferences are stored per
 * category, and `shouldNotify` is the single place that answers whether a given
 * message may be delivered.
 *
 * Writing this now means the first sender to be built asks permission rather
 * than being retrofitted with it, which is the order that gets it wrong.
 */

export const NOTIFICATION_CATEGORIES = [
  {
    id: "responses",
    label: "Responses",
    description: "When a long-running reply finishes.",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Updates on work you asked Hetex to do in the background.",
  },
  {
    id: "usage",
    label: "Usage",
    description: "When you approach a limit on your plan.",
  },
  {
    id: "tips",
    label: "Personalized tips",
    description: "Occasional suggestions based on how you use Hetex.",
  },
  {
    id: "marketing",
    label: "Product news",
    description: "New features and announcements.",
  },
] as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORIES)[number]["id"];

export type NotificationChannel = "push" | "email" | "push_email" | "off";

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  "push",
  "email",
  "push_email",
  "off",
];

/**
 * Defaults chosen so an account that has never opened this screen behaves
 * conservatively: things you asked for are on, marketing is off. Opting people
 * into product news by default is the kind of thing that gets a domain
 * blocked.
 */
export const DEFAULT_NOTIFICATION_PREFS: Record<
  NotificationCategory,
  NotificationChannel
> = {
  responses: "push",
  tasks: "push",
  usage: "email",
  tips: "off",
  marketing: "off",
};

export function withDefaults(
  stored: Record<string, string> | null | undefined
): Record<NotificationCategory, NotificationChannel> {
  const merged = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const { id } of NOTIFICATION_CATEGORIES) {
    const value = stored?.[id];
    if (value && NOTIFICATION_CHANNELS.includes(value as NotificationChannel)) {
      merged[id] = value as NotificationChannel;
    }
  }
  return merged;
}

/**
 * Whether a notification may be delivered to this user on this channel.
 *
 * Every future sender must call this before dispatching. It is not wired to a
 * transport yet because none exists — but it is a real check against real
 * stored preferences, not a placeholder that returns true.
 */
export async function shouldNotify(
  userId: string,
  category: NotificationCategory,
  channel: "push" | "email"
): Promise<boolean> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
    columns: { notificationPrefs: true },
  });

  const preference = withDefaults(settings?.notificationPrefs)[category];

  if (preference === "off") return false;
  if (preference === "push_email") return true;
  return preference === channel;
}
