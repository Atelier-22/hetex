"use client";

import ReactMarkdown from "react-markdown";
import { CodeBlock } from "./code-block";
import { MessageActions } from "./message-actions";

export function MessageBubble({
  id,
  role,
  content,
  timestamp,
  conversationId,
  isStreaming,
  onRetry,
}: {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date | string;
  conversationId?: string;
  isStreaming?: boolean;
  onRetry?: () => void;
}) {
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
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-hetex-green-500 to-hetex-blue-500 text-white"
            : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <div className="prose-hetex">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
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
              {content || "…"}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {time && (
        <span className="mt-1 px-1 text-[11px] text-[var(--text-secondary)]">
          {time}
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
