"use client";

import type { SectionId } from "./registry";
import { ProfileSection } from "./sections/profile";
import { ModelsSection } from "./sections/models";
import { PersonalitySection } from "./sections/personality";
import { BehaviorSection } from "./sections/behavior";
import { MemorySection } from "./sections/memory";
import { ConversationsSection } from "./sections/conversations";
import { VoiceSection } from "./sections/voice";
import { LiveVoiceSection } from "./sections/live-voice";
import { ImagesSection } from "./sections/images";
import { FilesSection } from "./sections/files";
import { AppearanceSection } from "./sections/appearance";
import { LanguageSection } from "./sections/language";
import { AccessibilitySection } from "./sections/accessibility";
import { NotificationsSection } from "./sections/notifications";
import { PrivacySection } from "./sections/privacy";
import { SecuritySection } from "./sections/security";
import { SafetySection } from "./sections/safety";
import { ProjectsSection } from "./sections/projects";
import { LibrarySection } from "./sections/library";
import { IntegrationsSection } from "./sections/integrations";
import { OfflineSection } from "./sections/offline";
import { SubscriptionSection } from "./sections/subscription";
import { AdvancedSection } from "./sections/advanced";
import { HelpSection } from "./sections/help";
import { AboutSection } from "./sections/about";

/**
 * The switch is exhaustive over SectionId, so adding a section to the registry
 * without writing it is a compile error rather than a blank panel.
 */
export function SettingsSection({ id }: { id: SectionId }) {
  switch (id) {
    case "profile":
      return <ProfileSection />;
    case "models":
      return <ModelsSection />;
    case "personality":
      return <PersonalitySection />;
    case "behavior":
      return <BehaviorSection />;
    case "memory":
      return <MemorySection />;
    case "conversations":
      return <ConversationsSection />;
    case "voice":
      return <VoiceSection />;
    case "live-voice":
      return <LiveVoiceSection />;
    case "images":
      return <ImagesSection />;
    case "files":
      return <FilesSection />;
    case "appearance":
      return <AppearanceSection />;
    case "language":
      return <LanguageSection />;
    case "accessibility":
      return <AccessibilitySection />;
    case "notifications":
      return <NotificationsSection />;
    case "privacy":
      return <PrivacySection />;
    case "security":
      return <SecuritySection />;
    case "safety":
      return <SafetySection />;
    case "projects":
      return <ProjectsSection />;
    case "library":
      return <LibrarySection />;
    case "integrations":
      return <IntegrationsSection />;
    case "offline":
      return <OfflineSection />;
    case "subscription":
      return <SubscriptionSection />;
    case "advanced":
      return <AdvancedSection />;
    case "help":
      return <HelpSection />;
    case "about":
      return <AboutSection />;
  }
}
