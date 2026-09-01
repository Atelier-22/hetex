"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LiveVoiceScreen } from "@/components/voice/live-voice-screen";

/**
 * Live voice, as its own route.
 *
 * A route rather than a panel inside the chat window: it is a full-screen,
 * immersive mode with its own back gesture and its own entry in history, so
 * leaving it should be a navigation rather than a state flag. It also means a
 * phone's back button exits voice mode instead of the whole conversation.
 */
export default function VoicePage() {
  return (
    <Suspense fallback={null}>
      <VoiceRoute />
    </Suspense>
  );
}

function VoiceRoute() {
  const router = useRouter();
  const params = useSearchParams();

  const conversationId = params.get("conversation") ?? undefined;
  const sessionId = params.get("session") ?? undefined;

  return (
    <LiveVoiceScreen
      conversationId={conversationId}
      sessionId={sessionId}
      onExit={() => {
        // Back where they came from when there is history, so exiting voice
        // returns to the conversation rather than to a new empty chat.
        if (window.history.length > 1) router.back();
        else router.push(conversationId ? `/chat/${conversationId}` : "/chat");
      }}
    />
  );
}
