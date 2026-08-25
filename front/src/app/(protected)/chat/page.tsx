"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NutSpinner from "@/components/icons/NutSpinner";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    const initAndRedirect = async () => {
      try {
        // First check if there is an existing conversation to avoid creating duplicate empty ones
        const listRes = await fetch("/api/conversations");
        if (listRes.ok) {
          const list = await listRes.json();
          if (Array.isArray(list) && list.length > 0) {
            router.replace(`/chat/${list[0].id}`);
            return;
          }
        }

        // Only create new if none exist
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const conv = await res.json();
          router.replace(`/chat/${conv.id}`);
        } else if (res.status === 403) {
          const data = await res.json();
          alert(data.message);
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error("Failed to initialize conversation:", err);
      }
    };
    initAndRedirect();
  }, [router]);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 bg-forest-depths">
      <NutSpinner size={36} className="text-mint-glow" />
      <div className="text-xs text-mist-gray/60 font-medium">Iniciando Copilot Workspace...</div>
    </div>
  );
}
