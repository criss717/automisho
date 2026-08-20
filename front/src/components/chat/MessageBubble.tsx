"use client";

import { motion } from "framer-motion";
import CarResultCard from "./CarResultCard";
import type { CarResult } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant" | "data" | "system";
  content: string;
  car?: CarResult;
  isStreaming?: boolean;
}

export default function MessageBubble({ role, content, car, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[80%]">
        {car ? (
          <CarResultCard car={car} />
        ) : (
          <div
            className={`px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-mint-glow text-forest-depths rounded-2xl rounded-br-sm"
                : "bg-shadow-teal/60 text-mist-gray rounded-2xl rounded-bl-sm"
            }`}
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-mint-glow/50 animate-pulse rounded-sm" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
