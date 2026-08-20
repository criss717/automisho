"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Create a new conversation and redirect
    const createAndRedirect = async () => {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const conv = await res.json();
          router.replace(`/chat/${conv.id}`);
        } else if (res.status === 403) {
          // Limit reached — show message
          const data = await res.json();
          alert(data.message);
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
      }
    };
    createAndRedirect();
  }, [router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-sm text-mist-gray/40">Creando conversación...</div>
    </div>
  );
}
