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
  onAskCopilot?: (question: string) => void;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function MessageList({ messages, isLoading, onAskCopilot }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-mint-glow/10 border border-mint-glow/20 flex items-center justify-center mb-4">
              <img src="/assets/hero_logo.svg" alt="AutoMisho" className="w-9 h-9 object-contain" />
            </div>
            <h2 className="text-xl text-pure-light font-light mb-2">
              Hola, soy AutoMisho
            </h2>
            <p className="text-xs md:text-sm text-mist-gray/70 max-w-sm mb-6">
              Tu copiloto IA para comprar coches de segunda mano en España. Busca en múltiples portales y consulta informes oficiales.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "5 coches de menos de 3000 euros",
                "SUV familiar menos de 15.000€",
                "Eléctrico o híbrido para ciudad",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onAskCopilot?.(suggestion)}
                  className="text-xs px-3.5 py-1.5 rounded-full border border-midnight-tide text-mist-gray/80 hover:text-mint-glow hover:border-mint-glow/30 hover:bg-white/5 cursor-pointer transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {/* Render text bubble if any text */}
              {getMessageText(msg) && (
                <MessageBubble
                  role={msg.role as "user" | "assistant"}
                  content={getMessageText(msg)}
                  onAskCopilot={onAskCopilot}
                />
              )}

              {/* Render data/tool parts for assistant messages */}
              {msg.parts.map((part: unknown, idx: number) => {
                const p = part as Record<string, unknown>;
                // data block with cars (rendered in compact preview in chat)
                if (p.type === "data" && (p.data as Record<string, unknown>)?.cars) {
                  const cars = (p.data as { cars: CarResult[] }).cars;
                  return (
                    <motion.div
                      key={`${msg.id}-cars-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-2 max-w-md"
                    >
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] uppercase tracking-wider text-mint-glow font-medium">
                          🚗 {cars.length} opciones encontradas
                        </span>
                        <span className="text-[11px] text-mist-gray/50">
                          (Ver panel derecho para comparativa completa)
                        </span>
                      </div>
                      {cars.slice(0, 3).map((c, cIdx) => (
                        <CarResultCard
                          key={c.url || `${c.title}-${cIdx}`}
                          car={c}
                          variant="compact"
                          onAskCopilot={onAskCopilot}
                        />
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
                      className="grid gap-3 max-w-lg"
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
                    return (
                      <CarResultCard
                        key={`${msg.id}-tool-${idx}`}
                        car={result}
                        variant="compact"
                        onAskCopilot={onAskCopilot}
                      />
                    );
                  }
                }
                return null;
              })}
            </div>
          ))}
        </AnimatePresence>

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex justify-start">
            <div className="bg-shadow-teal/40 border border-white/5 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 shadow-sm">
              <NutSpinner size={16} className="text-mint-glow" />
              <span className="text-xs text-mist-gray/80">AutoMisho está analizando...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
