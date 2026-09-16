"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import ChatWindow from "@/components/chat/ChatWindow";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import CopilotLiveDashboard from "@/components/chat/CopilotLiveDashboard";
import { extractCarsFromMessageContent } from "@/lib/chat-helpers";
import NutSpinner from "@/components/icons/NutSpinner";
import type { UIMessage } from "ai";
import type { CarResult } from "@/types";

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
  const [discoveredCars, setDiscoveredCars] = useState<CarResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const [externalQuery, setExternalQuery] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "dashboard">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load conversation & extract previously saved cars
  useEffect(() => {
    const loadConversation = async () => {
      try {
        setLoadingConv(true);
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const data: ConversationData = await res.json();
          const uiMessages: UIMessage[] = data.messages.map((msg) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: msg.content }],
          }));
          setInitialMessages(uiMessages);

          // Extract cars from message history
          const restoredCars: CarResult[] = [];
          const seen = new Set<string>();
          for (const msg of data.messages) {
            if (msg.role === "assistant" && msg.content) {
              const cars = extractCarsFromMessageContent(msg.content);
              for (const c of cars) {
                const key = c.url || c.title;
                if (!seen.has(key)) {
                  seen.add(key);
                  restoredCars.push(c);
                }
              }
            }
          }
          if (restoredCars.length > 0) {
            setDiscoveredCars(restoredCars);
          }
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
      } finally {
        setLoadingConv(false);
      }
    };
    loadConversation();
  }, [conversationId]);

  const handleCarsDiscovered = useCallback((cars: CarResult[]) => {
    setDiscoveredCars((prev) => {
      const merged = [...cars];
      const seen = new Set(cars.map((c) => c.url || c.title));
      for (const old of prev) {
        const key = old.url || old.title;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(old);
        }
      }
      return merged;
    });
  }, []);

  const handleAskCopilot = useCallback((question: string) => {
    setExternalQuery(question);
    setActiveMobileTab("chat");
  }, []);

  if (loadingConv) {
    return (
      <div className="h-full flex bg-parchment">
        <ConversationSidebar currentId={conversationId} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ash">
          <NutSpinner size={32} className="text-signal-blue" />
          <div className="text-xs font-medium">Cargando copiloto AutoMisho...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex min-h-0 overflow-hidden bg-parchment relative text-charcoal">
      {/* Collapsible Sidebar */}
      {sidebarOpen && (
        <div className="hidden md:block shrink-0 h-full transition-all">
          <ConversationSidebar currentId={conversationId} />
        </div>
      )}

      {/* Main Workspace (Split Screen on lg, Tabbed on mobile) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {/* Mobile Tab Switcher (< lg) & Sidebar Toggle */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-mist bg-paper lg:hidden">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-charcoal hover:text-ink-black hover:bg-linen text-xs flex items-center gap-1 font-medium border border-mist"
          >
            <span>☰</span>
            <span className="hidden sm:inline">Historial</span>
          </button>

          <div className="flex items-center p-0.5 rounded-lg bg-linen border border-mist">
            <button
              onClick={() => setActiveMobileTab("chat")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeMobileTab === "chat"
                  ? "bg-paper text-graphite shadow-sm border border-mist"
                  : "text-ash hover:text-charcoal"
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveMobileTab("dashboard")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                activeMobileTab === "dashboard"
                  ? "bg-paper text-graphite shadow-sm border border-mist"
                  : "text-ash hover:text-charcoal"
              }`}
            >
              🚗 Coches
              {discoveredCars.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-linen border border-signal-blue text-signal-blue text-[10px] font-bold">
                  {discoveredCars.length}
                </span>
              )}
            </button>
          </div>

          <div className="w-6" />
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
          {/* Left Column: Chat Window (45% width on desktop, 100% on mobile when active) */}
          <div
            className={`flex-1 lg:max-w-[45%] xl:max-w-[42%] flex flex-col min-h-0 h-full border-r border-mist ${
              activeMobileTab === "chat" ? "flex" : "hidden lg:flex"
            }`}
          >
            <ChatWindow
              conversationId={conversationId}
              initialMessages={initialMessages}
              onCarsDiscovered={handleCarsDiscovered}
              onLoadingChange={setIsLoading}
              externalQuery={externalQuery}
              onClearExternalQuery={() => setExternalQuery(null)}
            />
          </div>

          {/* Right Column: Copilot Live Dashboard (55% width on desktop, 100% on mobile when active) */}
          <div
            className={`flex-1 flex flex-col min-h-0 h-full ${
              activeMobileTab === "dashboard" ? "flex" : "hidden lg:flex"
            }`}
          >
            <CopilotLiveDashboard
              cars={discoveredCars}
              isLoading={isLoading}
              onAskCopilot={handleAskCopilot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
