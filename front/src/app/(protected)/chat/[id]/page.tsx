"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ChatWindow from "@/components/chat/ChatWindow";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import type { UIMessage } from "ai";

interface ConversationData {
  id: string;
  title: string;
  messages: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }[];
}

export default function ChatConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversation = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const data: ConversationData = await res.json();
          const uiMessages: UIMessage[] = data.messages.map((msg) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: msg.content }],
          }));
          setInitialMessages(uiMessages);
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
      } finally {
        setLoading(false);
      }
    };
    loadConversation();
  }, [conversationId]);

  if (loading) {
    return (
      <div className="h-full flex">
        <ConversationSidebar currentId={conversationId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-mist-gray/40">Cargando conversación...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <ConversationSidebar currentId={conversationId} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-3xl flex flex-col px-6">
            <ChatWindow conversationId={conversationId} initialMessages={initialMessages} />
          </div>
        </div>
      </div>
    </div>
  );
}
