"use client";

import { SettingsModal } from "./settings-modal";
import { SettingsSection } from "./sections";

/**
 * Mounted once in the authenticated layout. The modal renders nothing until
 * something calls `openSettings()`, so this costs nothing when closed.
 */
export function SettingsOverlay() {
  return <SettingsModal renderSection={(id) => <SettingsSection id={id} />} />;
}

export { SettingsUiProvider, useSettingsUi } from "./settings-context";
export type { SectionId } from "./registry";
