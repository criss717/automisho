"use client";

import { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MessageBubble from "./MessageBubble";
import NutSpinner from "../icons/NutSpinner";
import CarResultCard from "./CarResultCard";
import DGTGuideCard from "../dgt/DGTGuideCard";
import CarVerticalCard from "../dgt/CarVerticalCard";
import CarfaxCard from "../dgt/CarfaxCard";
import type { UIMessage } from "ai";
import type { CarResult } from "@/types";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 rounded-full bg-mint-glow/10 border border-mint-glow/20 flex items-center justify-center mb-5">
              <img src="/assets/hero_logo.svg" alt="AutoMisho" className="w-9 h-9 object-contain" />
            </div>
            <h2 className="text-xl text-pure-light font-light mb-2">
              Hola, soy AutoMisho
            </h2>
            <p className="text-sm text-mist-gray/60 max-w-xs mb-8">
              Tu copiloto IA para comprar coches de segunda mano. Cuéntame qué buscas.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "SUV familiar menos de 15.000€",
                "Eléctrico para ciudad",
                "Fiable para 20.000km/año",
              ].map((suggestion) => (
                <span
                  key={suggestion}
                  className="text-xs px-4 py-2 rounded-full border border-midnight-tide text-mist-gray/60 hover:text-mint-glow hover:border-mint-glow/30 cursor-pointer transition-all"
                >
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {/* Render text bubble if any text */}
              {getMessageText(msg) && (
                <MessageBubble role={msg.role as "user" | "assistant"} content={getMessageText(msg)} />
              )}

              {/* Render data/tool parts for assistant messages */}
              {msg.parts.map((part: unknown, idx: number) => {
                const p = part as Record<string, unknown>;
                // data block with cars
                if (p.type === "data" && (p.data as Record<string, unknown>)?.cars) {
                  const cars = (p.data as { cars: CarResult[] }).cars;
                  return (
                    <motion.div
                      key={`${msg.id}-cars-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-3"
                    >
                      {cars.map((c) => (
                        <CarResultCard key={c.url || c.title} car={c} />
                      ))}
                    </motion.div>
                  );
                }
                // dgt-guide or dgtOptions
                if (
                  p.type === "dgt-guide" ||
                  (p.type === "data" && (p.data as Record<string, unknown>)?.dgtOptions)
                ) {
                  const opts = (p.type === "dgt-guide"
                    ? { plate: (p as Record<string, unknown>).plate as string, vin: (p as Record<string, unknown>).vin as string }
                    : (p.data as { dgtOptions: { plate: string | null; vin: string | null } }).dgtOptions) || { plate: null, vin: null };
                  return (
                    <motion.div
                      key={`${msg.id}-dgt-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-3 md:grid-cols-1"
                    >
                      <DGTGuideCard plate={opts.plate ?? undefined} />
                      <CarVerticalCard vin={opts.vin ?? undefined} />
                      <CarfaxCard vin={opts.vin ?? undefined} />
                    </motion.div>
                  );
                }
                // tool invocation
                if (p.type === "tool-invocation" && (p as Record<string, unknown>).toolName === "searchCars") {
                  const result = (p as Record<string, unknown>).result as CarResult | undefined;
                  if (result) {
                    return <CarResultCard key={`${msg.id}-tool-${idx}`} car={result} />;
                  }
                }
                return null;
              })}
            </div>
          ))}
        </AnimatePresence>

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex justify-start">
            <div className="bg-shadow-teal/60 rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-2">
              <NutSpinner size={16} />
              <span className="text-sm text-mist-gray/60">Pensando...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
