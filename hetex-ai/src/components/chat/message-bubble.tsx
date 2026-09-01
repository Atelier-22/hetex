"use client";

import ReactMarkdown from "react-markdown";
import { Cloud, HardDrive } from "lucide-react";
import { CodeBlock } from "./code-block";
import { MessageActions } from "./message-actions";
import { useSettingsGroup } from "@/lib/settings/store";

export function MessageBubble({
  id,
  role,
  content,
  timestamp,
  conversationId,
  isStreaming,
  onRetry,
  model,
  processedLocally,
  routingReason,
  showTypingIndicator = true,
}: {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date | string;
  conversationId?: string;
  isStreaming?: boolean;
  onRetry?: () => void;
  /** Set when "Show which model answered" is on. */
  model?: string;
  processedLocally?: boolean;
  /** Developer mode only. */
  routingReason?: string;
  showTypingIndicator?: boolean;
}) {
  const behavior = useSettingsGroup("behavior");

  const isUser = role === "user";
  const time =
    timestamp &&
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        // Wider on a phone: 85% of a narrow screen wastes the margin without
        // helping readability, which is what that limit is for on desktop.
        //
        // chat-bubble and chat-message carry the density, shape and line-height
        // that Appearance controls; the padding and radius live in CSS so a
        // preference change does not need this component to re-render.
        className={`chat-bubble chat-message max-w-[92%] text-[15px] sm:max-w-[85%] sm:text-sm ${
          isUser
            ? "chat-bubble--user bg-accent-gradient text-white"
            : "border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : !content ? (
          showTypingIndicator ? (
            // Waiting on the first token. A static ellipsis is indistinguishable
            // from a stalled request; movement says the connection is alive.
            <span
              className="flex items-center gap-1 py-1"
              role="status"
              aria-label="Hetex AI is typing"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          ) : (
            <span className="sr-only" role="status">
              Waiting for a reply
            </span>
          )
        ) : behavior.useMarkdown ? (
          <div className="prose-hetex">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = className?.includes("language-");
                  // With code formatting off the model is asked not to fence
                  // code, but an older message may still contain a block.
                  if (isBlock && behavior.codeFormatting) {
                    return (
                      <CodeBlock
                        language={match?.[1]}
                        code={String(children).replace(/\n$/, "")}
                      />
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          // Markdown off: show exactly what came back, unrendered.
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>

      {(time || model) && (
        <span className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-[var(--text-secondary)]">
          {time}
          {model && (
            <span className="flex items-center gap-1">
              {processedLocally ? <HardDrive size={10} /> : <Cloud size={10} />}
              {model}
            </span>
          )}
          {routingReason && (
            <span className="font-mono opacity-70">{routingReason}</span>
          )}
        </span>
      )}

      {!isUser && content && !isStreaming && (
        <MessageActions
          content={content}
          onRetry={onRetry}
          messageId={id}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}
