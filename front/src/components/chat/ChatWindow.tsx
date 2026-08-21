"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { UIMessage } from "ai";

interface ChatWindowProps {
  conversationId?: string;
  initialMessages?: UIMessage[];
}

export default function ChatWindow({ conversationId, initialMessages = [] }: ChatWindowProps) {
  const [input, setInput] = useState("");

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
  }, [conversationId]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (message: string, files?: FileList) => {
    if ((!message.trim() && (!files || files.length === 0)) || isLoading) return;
    if (files && files.length > 0) {
      // Send with attachments for vision (qwen3.7-plus)
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

  const handleRetry = () => {
    // Re-send last user message if available, otherwise just clear error by sending empty retry signal
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

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {error && (
        <div className="shrink-0 px-4 py-3 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between gap-3">
          <span className="text-amber-300 text-xs leading-snug">
            El asistente IA tardó demasiado o no está disponible. Tus resultados (si había coches) ya están arriba.
          </span>
          <button
            onClick={handleRetry}
            className="shrink-0 px-3 py-1.5 rounded-full bg-mint-glow text-forest-depths text-xs font-medium hover:shadow-[0_0_10px_rgba(151,252,215,0.4)] transition-all"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="shrink-0">
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
