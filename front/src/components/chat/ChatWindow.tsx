"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { extractCarsFromMessageContent } from "@/lib/chat-helpers";
import type { UIMessage } from "ai";
import type { CarResult } from "@/types";

interface ChatWindowProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
  onCarsDiscovered?: (cars: CarResult[]) => void;
  onLoadingChange?: (loading: boolean) => void;
  externalQuery?: string | null;
  onClearExternalQuery?: () => void;
}

export default function ChatWindow({
  conversationId,
  initialMessages = [],
  onCarsDiscovered,
  onLoadingChange,
  externalQuery,
  onClearExternalQuery,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const lastProcessedMessageCount = useRef(0);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    messages: initialMessages,
  });

  // Load initial messages when conversationId changes
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [conversationId, initialMessages, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Notify parent of loading state
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Extract cars from messages and notify parent
  useEffect(() => {
    if (messages.length === 0) return;

    const allCars: CarResult[] = [];
    const seenUrls = new Set<string>();

    for (const msg of messages) {
      // 1. Check custom and data parts
      if (msg.parts) {
        for (const part of msg.parts as unknown as Record<string, unknown>[]) {
          if (part.type === "custom" && (part.kind === "automisho.cars" || part.kind === "cars") && Array.isArray(part.cars)) {
            const cars = part.cars as CarResult[];
            for (const c of cars) {
              const key = c.url || c.title;
              if (!seenUrls.has(key)) {
                seenUrls.add(key);
                allCars.push(c);
              }
            }
          }
          if (part.type === "data" && (part.data as Record<string, unknown>)?.cars) {
            const cars = (part.data as { cars: CarResult[] }).cars;
            for (const c of cars) {
              const key = c.url || c.title;
              if (!seenUrls.has(key)) {
                seenUrls.add(key);
                allCars.push(c);
              }
            }
          }
        }
      }

      // 2. Check message metadata (AI SDK UI Message Stream)
      const meta = (msg as unknown as { messageMetadata?: { cars?: CarResult[] } })?.messageMetadata;
      if (meta?.cars && Array.isArray(meta.cars)) {
        for (const c of meta.cars) {
          const key = c.url || c.title;
          if (!seenUrls.has(key)) {
            seenUrls.add(key);
            allCars.push(c);
          }
        }
      }

      // 3. Check message text for hidden comment payload
      const text = msg.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || "";

      if (text) {
        const extracted = extractCarsFromMessageContent(text);
        for (const c of extracted) {
          const key = c.url || c.title;
          if (!seenUrls.has(key)) {
            seenUrls.add(key);
            allCars.push(c);
          }
        }
      }
    }

    if (allCars.length > 0) {
      onCarsDiscovered?.(allCars);
    }

    if (!isLoading && messages.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("automisho:conversation_updated"));
    }
  }, [messages, onCarsDiscovered, isLoading]);

  const handleSubmit = (message: string, files?: FileList) => {
    if ((!message.trim() && (!files || files.length === 0)) || isLoading) return;
    if (files && files.length > 0) {
      sendMessage(
        {
          text: message,
          files: files as unknown as FileList,
        } as unknown as Parameters<typeof sendMessage>[0],
        { body: { conversationId } }
      );
    } else {
      sendMessage({ text: message }, { body: { conversationId } });
    }
    setInput("");
  };

  // Handle external query from suggestion chips or car card buttons
  useEffect(() => {
    if (externalQuery && !isLoading) {
      handleSubmit(externalQuery);
      onClearExternalQuery?.();
    }
  }, [externalQuery, isLoading]);

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const parts = (lastUser?.parts as unknown as { type: string; text?: string }[]) || [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("") || "";
    if (text) {
      sendMessage({ text }, { body: { conversationId } });
    } else if (input.trim()) {
      sendMessage({ text: input }, { body: { conversationId } });
    }
  };

  const handleAskCopilot = (question: string) => {
    handleSubmit(question);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-forest-depths">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onAskCopilot={handleAskCopilot}
        />
      </div>



      <div className="shrink-0 border-t border-midnight-tide bg-forest-depths/95 backdrop-blur-sm">
        <MessageInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
