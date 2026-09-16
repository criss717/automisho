"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ConversationSidebarProps {
  currentId?: string;
}

export default function ConversationSidebar({ currentId }: ConversationSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        setConversations(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const handleUpdate = () => {
      fetchConversations();
    };
    window.addEventListener("automisho:conversation_updated", handleUpdate);
    return () => window.removeEventListener("automisho:conversation_updated", handleUpdate);
  }, [currentId]);

  const handleNew = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const conv = await res.json();
        router.push(`/chat/${conv.id}`);
      } else if (res.status === 403) {
        const data = await res.json();
        alert(data.message || "Límite de conversaciones alcanzado");
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta conversación?")) return;

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentId === id) {
          router.push("/chat");
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <div className="w-64 shrink-0 border-r border-mist bg-linen flex flex-col h-full text-charcoal">
      {/* Header */}
      <div className="p-3 border-b border-mist">
        <button
          onClick={handleNew}
          className="btn-secondary w-full text-xs py-2 px-3 justify-center flex items-center gap-1.5 font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Nueva conversación
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="text-xs text-ash text-center py-4 font-medium">Cargando...</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-xs text-ash text-center py-4 font-medium">
            No hay conversaciones
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => router.push(`/chat/${conv.id}`)}
            className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
              currentId === conv.id
                ? "bg-paper border border-mist text-graphite shadow-subtle font-medium"
                : "text-charcoal hover:bg-paper/70 hover:text-graphite border border-transparent"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate">{conv.title}</p>
              <p className="text-[11px] text-ash mt-0.5">
                {formatDate(conv.updatedAt)} · {conv._count.messages} msgs
              </p>
            </div>
            <button
              onClick={(e) => handleDelete(conv.id, e)}
              className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-ash hover:text-red-600 transition-all"
              title="Eliminar"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
