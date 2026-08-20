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

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} />

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-red-400 text-xs text-center">
          Error al conectar con AutoMisho. Intenta de nuevo.
        </div>
      )}

      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
