"use client";

import type { SectionId } from "./settings-context";
import { GeneralSection } from "./sections/general";
import { NotificationsSection } from "./sections/notifications";
import { PersonalizationSection } from "./sections/personalization";
import { PluginsSection } from "./sections/plugins";
import { VoiceSection } from "./sections/voice";
import { BillingSection } from "./sections/billing";
import { DataControlsSection } from "./sections/data-controls";
import { StorageSection } from "./sections/storage";
import { SecuritySection } from "./sections/security";
import { AccountSection } from "./sections/account";
import { KeyboardSection } from "./sections/keyboard";

export function SettingsSection({ id }: { id: SectionId }) {
  switch (id) {
    case "general":
      return <GeneralSection />;
    case "notifications":
      return <NotificationsSection />;
    case "personalization":
      return <PersonalizationSection />;
    case "plugins":
      return <PluginsSection />;
    case "voice":
      return <VoiceSection />;
    case "billing":
      return <BillingSection />;
    case "data-controls":
      return <DataControlsSection />;
    case "storage":
      return <StorageSection />;
    case "security":
      return <SecuritySection />;
    case "account":
      return <AccountSection />;
    case "keyboard":
      return <KeyboardSection />;
  }
}
