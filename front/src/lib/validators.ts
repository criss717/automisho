import { z } from "zod";

export const ChatBody = z.object({
  messages: z.array(z.any()).min(1),
  conversationId: z.string().uuid().optional(),
});

export const CheckoutBody = z.object({
  plan: z.enum(["premium", "pro"]),
});

export const PlateBody = z.object({
  plate: z.string().regex(/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i, "Formato de matrícula no válido. Usa 0000-LLL sin A,E,I,O,U,Q,Ñ"),
});

export const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export const ConversationBody = z.object({
  title: z.string().min(1).max(100).optional(),
});

export const ScrapeProxyBody = z.object({
  query: z.string().min(1),
  source: z.enum(["auto", "autoscout24", "cochesnet", "wallapop", "milanuncios"]).optional(),
  max_results: z.number().int().min(1).max(12).optional(),
  max_price: z.number().int().min(500).max(100000).optional(),
  min_price: z.number().int().min(0).optional(),
});

export const SearchBody = z.object({
  query: z.string().min(1),
});
