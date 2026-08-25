"use client";

import React from "react";
import { motion } from "framer-motion";
import CarResultCard from "./CarResultCard";
import { cleanMessageContent } from "@/lib/chat-helpers";
import type { CarResult } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant" | "data" | "system";
  content: string;
  car?: CarResult;
  isStreaming?: boolean;
  onAskCopilot?: (question: string) => void;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-pure-light">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mint-glow underline underline-offset-2 hover:text-pure-light transition-colors font-medium"
          >
            {linkMatch[1]} ↗
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (trimmed === "---") {
          return <hr key={idx} className="border-white/10 my-2" />;
        }
        if (trimmed.startsWith("#### ")) {
          return (
            <h4 key={idx} className="text-sm font-semibold text-pure-light mt-3 mb-1 font-teodor tracking-wide">
              {renderInline(trimmed.replace(/^####\s+/, ""))}
            </h4>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-base font-semibold text-mint-glow mt-3 mb-1 font-teodor">
              {renderInline(trimmed.replace(/^###\s+/, ""))}
            </h3>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-mint-glow font-bold shrink-0 mt-0.5">•</span>
              <span className="text-mist-gray/90 flex-1">{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="text-mist-gray/90">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  car,
  isStreaming,
  onAskCopilot,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const displayContent = cleanMessageContent(content);

  if (!displayContent && !car) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
    >
      <div className={`${isUser ? "max-w-[85%]" : "max-w-[95%] md:max-w-[90%]"}`}>
        {car ? (
          <CarResultCard car={car} variant="compact" onAskCopilot={onAskCopilot} />
        ) : (
          <div
            className={`px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-mint-glow text-forest-depths font-medium rounded-2xl rounded-br-sm shadow-sm"
                : "glass-card bg-shadow-teal/40 text-pure-light/90 rounded-2xl rounded-bl-sm border border-white/6 shadow-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{displayContent}</p>
            ) : (
              <FormattedContent text={displayContent} />
            )}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-mint-glow/80 animate-pulse rounded-sm align-middle" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
