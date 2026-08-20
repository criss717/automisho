import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { PlateBody } from "@/lib/validators";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Spanish plate format: 0000-LLL without A,E,I,O,U,Q,Ñ
const PLATE_REGEX = /^\d{4}[ -]?[BCDFGHJKLMNPRSTVWXYZ]{3}$/i;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkRateLimit(req, (session.user as unknown as { plan?: string }).plan)) {
    return rateLimitResponse();
  }

  try {
    const body = await req.json();
    // Validate via zod but also keep legacy PLATE_REGEX check for backward compat
    const zodParsed = PlateBody.safeParse(body);
    if (!zodParsed.success) {
      return NextResponse.json({ error: zodParsed.error.flatten().fieldErrors, message: "Formato de matrícula no válido. Usa 0000-LLL." }, { status: 400 });
    }
    const { plate } = zodParsed.data;

    if (!plate || typeof plate !== "string") {
      return NextResponse.json(
        { error: "missing_plate", message: "Debes proporcionar una matrícula." },
        { status: 400 }
      );
    }

    const rawPlate = plate.trim().toUpperCase();
    if (!PLATE_REGEX.test(rawPlate.replace(/[ -]/g, ""))) {
      return NextResponse.json(
        { error: "invalid_format", message: "Formato de matrícula no válido. Usa 0000-LLL." },
        { status: 400 }
      );
    }

    // Call Python backend
    const res = await fetch(`${BACKEND_URL}/dgt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: rawPlate }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: "backend_error", message: error.detail || "Error consultando DGT." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dgt] Error:", message);

    // If backend is down, return helpful error
    if (message.includes("ECONNREFUSED") || message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "backend_offline",
          message: "El servidor backend no está disponible. Ejecuta: cd server && python main.py",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "internal", message }, { status: 500 });
  }
}
