import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getInfoCocheAccount, checkDgtSystemStatus, requestCompleteDgtReport } from "@/lib/infocoche";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Validador de matrícula española (incluye placas de prueba 0000BBB-0009BBB y provinciales)
const PLATE_REGEX = /^(\d{4}[ -]?[BCDFGHJKLMNPRSTVWXYZ]{3}|[A-Z]{1,2}\d{4,6}[A-Z]{0,2})$/i;

/**
 * GET /api/dgt/report: Comprueba el estado de la cuenta InfoCoche y del sistema DGT.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [account, dgtStatus] = await Promise.all([
    getInfoCocheAccount(),
    checkDgtSystemStatus(),
  ]);

  return NextResponse.json({
    account,
    dgtStatus,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/dgt/report: Solicita un informe oficial completo de la DGT vía InfoCoche.
 */
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
    const plate = typeof body.plate === "string" ? body.plate.trim().toUpperCase() : "";
    const allowAlreadyAsked = Boolean(body.allowAlreadyAsked);

    if (!plate) {
      return NextResponse.json(
        { error: "missing_plate", message: "Debes proporcionar una matrícula para solicitar el informe oficial." },
        { status: 400 }
      );
    }

    const cleanPlate = plate.replace(/[ -]/g, "");
    if (!PLATE_REGEX.test(cleanPlate)) {
      return NextResponse.json(
        { error: "invalid_format", message: "Formato de matrícula no válido. Usa 0000-LLL (ej. 1234-BCD o 0000BBB en pruebas)." },
        { status: 400 }
      );
    }

    const report = await requestCompleteDgtReport(cleanPlate, {
      allowAlreadyAsked,
      internalId: `user-${session.user.id}-${Date.now()}`,
    });

    if (!report.success) {
      return NextResponse.json(
        {
          error: report.icCode,
          message: report.error || "No se pudo generar el informe DGT.",
          icDescription: report.icDescription,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      plate: report.plate,
      pdfFilename: report.pdfFilename,
      pdfBase64: report.pdfBase64,
      extractedText: report.extractedText,
      icCode: report.icCode,
      message: "Informe oficial DGT generado exitosamente.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dgt/report] Error:", message);
    return NextResponse.json({ error: "internal", message }, { status: 500 });
  }
}
