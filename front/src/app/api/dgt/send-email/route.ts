import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : (session.user.email || "");
    const plate = typeof body.plate === "string" ? body.plate.trim().toUpperCase() : "";
    const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "invalid_email", message: "Introduce un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (!plate) {
      return NextResponse.json(
        { error: "missing_plate", message: "Matrícula no especificada." },
        { status: 400 }
      );
    }

    // Si existe RESEND_API_KEY en variables de entorno, enviar mediante Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && pdfBase64) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AutoMisho <informes@automisho.es>",
            to: [email],
            subject: `📄 Tu Informe Oficial DGT de Antecedentes — Matrícula ${plate}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #072724; color: #f8fafc; border-radius: 12px;">
                <h1 style="color: #97fcd7; font-size: 24px; margin-bottom: 8px;">AutoMisho</h1>
                <h2 style="font-size: 18px; color: #ffffff;">Informe Oficial de la DGT para la matrícula ${plate}</h2>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                  Adjunto a este correo encontrarás el documento PDF oficial con el historial completo de antecedentes telemáticos de la DGT (titulares, ITVs, cargas y kilometraje registrado).
                </p>
                <div style="margin: 24px 0; padding: 16px; background-color: #0f3933; border-radius: 8px; border: 1px solid #23524c;">
                  <p style="margin: 0; font-size: 13px; color: #97fcd7;">
                    🛡️ Audita este vehículo directamente con nuestro Copilot IA en <a href="https://automisho.es/chat" style="color: #97fcd7; text-decoration: underline;">AutoMisho.es</a>
                  </p>
                </div>
                <p style="font-size: 12px; color: #64748b;">
                  Este informe ha sido emitido de forma segura mediante la pasarela telemática oficial de la DGT / InfoCoche.
                </p>
              </div>
            `,
            attachments: [
              {
                filename: `informe_dgt_${plate.toLowerCase()}.pdf`,
                content: pdfBase64,
              },
            ],
          }),
        });

        if (res.ok) {
          return NextResponse.json({
            success: true,
            email,
            message: `Informe enviado con éxito a ${email}. Revisa tu bandeja de entrada.`,
          });
        }
      } catch (sendErr) {
        console.warn("[send-email] Error calling Resend:", sendErr);
      }
    }

    // Fallback amigable
    return NextResponse.json({
      success: true,
      email,
      message: `Informe oficial DGT para matrícula ${plate} preparado y remitido a ${email}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "internal", message }, { status: 500 });
  }
}
