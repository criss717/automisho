import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: body.query,
        source: body.source || "auto",
        max_results: body.max_results || 10,
        min_price: body.min_price,
        max_price: body.max_price,
        min_year: body.min_year,
        max_km: body.max_km,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: "backend_error", message: error.detail || "Error en la búsqueda." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[search] Error:", message);

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
