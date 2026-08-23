import { ChatWindow } from "@/components/chat/chat-window";

/**
 * New chat. Lives at /chat rather than "/" because the root route is now the
 * public landing page.
 */
export default function NewChatPage() {
  return <ChatWindow />;
}
