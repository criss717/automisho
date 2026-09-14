/**
 * Cliente oficial para la API de Informes Completos DGT de InfoCoche (Entornos PRE y PROD).
 *
 * Flujo:
 * 1. GET /user/v2/whoami/ -> Comprobar créditos y estado de la cuenta.
 * 2. GET /reports_api/v2/reports-system-status/COMPLETE_REPORT/ -> Validar que el sistema DGT está 'UP'.
 * 3. POST /reports_api/v2/request-complete-report/{matricula}/ -> Solicitar informe síncrono (PDF en Base64).
 */

const INFOCOCHE_BASE_URL =
  process.env.INFOCOCHE_BASE_URL ||
  process.env.DGT_PROVIDER_URL ||
  "https://pre-mes.infocoche.net";

const INFOCOCHE_API_KEY =
  process.env.INFOCOCHE_API_KEY ||
  process.env.DGT_PROVIDER_API_KEY ||
  "";

export interface InfoCocheAccountStatus {
  email?: string;
  crLeft: number;
  status: "READY" | "NO_CREDITS" | "BUSY" | "ERROR";
  error?: string;
}

export interface DgtSystemStatus {
  status: "UP" | "AUTO_STOPPED" | "DOWN" | "UNKNOWN";
  canRequest: boolean;
  message: string;
}

export interface CompleteReportResponse {
  success: boolean;
  plate: string;
  pdfBase64?: string;
  pdfFilename?: string;
  icCode: string;
  icDescription?: string;
  creditsLeft?: number;
  extractedText?: string;
  error?: string;
}

function getHeaders(): Record<string, string> {
  const key = INFOCOCHE_API_KEY.trim();
  return {
    "X-IC-API-KEY": key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Consulta la información de la cuenta y créditos disponibles en InfoCoche.
 */
export async function getInfoCocheAccount(): Promise<InfoCocheAccountStatus> {
  if (!INFOCOCHE_API_KEY) {
    return { crLeft: 0, status: "ERROR", error: "INFOCOCHE_API_KEY no configurada en .env.local" };
  }

  try {
    const url = `${INFOCOCHE_BASE_URL.replace(/\/+$/, "")}/user/v2/whoami/`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        crLeft: 0,
        status: "ERROR",
        error: errData.reason || `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      email: data.email,
      crLeft: typeof data.crLeft === "number" ? data.crLeft : 0,
      status: data.status || "READY",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { crLeft: 0, status: "ERROR", error: message };
  }
}

/**
 * Comprueba el estado del sistema DGT en InfoCoche antes de emitir solicitudes.
 */
export async function checkDgtSystemStatus(): Promise<DgtSystemStatus> {
  if (!INFOCOCHE_API_KEY) {
    return { status: "UNKNOWN", canRequest: false, message: "API key no configurada." };
  }

  try {
    const url = `${INFOCOCHE_BASE_URL.replace(/\/+$/, "")}/reports_api/v2/reports-system-status/COMPLETE_REPORT/`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { status: "DOWN", canRequest: false, message: "No se pudo contactar con la pasarela DGT de InfoCoche." };
    }

    const data = await res.json();
    const status = data.status as "UP" | "AUTO_STOPPED" | "DOWN";

    if (status === "UP") {
      return { status: "UP", canRequest: true, message: "Sistema DGT operativo para emisión de informes." };
    } else if (status === "AUTO_STOPPED") {
      return { status: "AUTO_STOPPED", canRequest: false, message: "DGT temporalmente detenida por mantenimiento. Reintenta en unos minutos." };
    } else {
      return { status: "DOWN", canRequest: false, message: "Sistema DGT fuera de servicio actualmente." };
    }
  } catch (err) {
    return { status: "DOWN", canRequest: false, message: `Error al comprobar estado DGT: ${err}` };
  }
}

/**
 * Solicita un Informe Completo Oficial de la DGT para una matrícula dada.
 * Nota: Es una llamada síncrona que bloquea entre 10s y 60s mientras la DGT genera el PDF oficial.
 * Timeout configurado a 210s.
 */
export async function requestCompleteDgtReport(
  plate: string,
  options?: { allowAlreadyAsked?: boolean; internalId?: string }
): Promise<CompleteReportResponse> {
  const cleanPlate = plate.trim().toUpperCase().replace(/[\s\-_]/g, "");

  if (!INFOCOCHE_API_KEY) {
    return {
      success: false,
      plate: cleanPlate,
      icCode: "NO_API_KEY",
      error: "No se ha configurado INFOCOCHE_API_KEY en las variables de entorno.",
    };
  }

  // 1. Validar estado del sistema DGT
  const dgtStatus = await checkDgtSystemStatus();
  if (!dgtStatus.canRequest) {
    return {
      success: false,
      plate: cleanPlate,
      icCode: "DGT_UNAVAILABLE",
      error: dgtStatus.message,
    };
  }

  // 2. Ejecutar petición de informe completo
  try {
    const url = `${INFOCOCHE_BASE_URL.replace(/\/+$/, "")}/reports_api/v2/request-complete-report/${encodeURIComponent(cleanPlate)}/`;
    const payload: Record<string, unknown> = {
      allow_already_asked: Boolean(options?.allowAlreadyAsked),
    };
    if (options?.internalId) {
      payload.echo = { internal_id: options.internalId };
    }

    // Timeout de 210s requerido por la DGT
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(210000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.IC_CODE !== "IC_000") {
      return {
        success: false,
        plate: cleanPlate,
        icCode: data.IC_CODE || `HTTP_${res.status}`,
        icDescription: data.IC_DESCRIPTION || data.reason || "Error al solicitar el informe",
        error: data.IC_DESCRIPTION || data.reason || `Error HTTP ${res.status}`,
      };
    }

    // Extraer texto plano básico del PDF en base64 para que el LLM lo audite de inmediato
    let extractedText = "";
    if (data.report_base_64) {
      try {
        const buffer = Buffer.from(data.report_base_64, "base64");
        const raw = buffer.toString("latin1");
        const cleanStrings = raw.match(/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s:.,\/\-]{4,}/g) || [];
        extractedText = cleanStrings.join(" ").slice(0, 5000);
      } catch {
        // Fallback silencioso si falla el parseo de strings
      }
    }

    return {
      success: true,
      plate: cleanPlate,
      pdfBase64: data.report_base_64,
      pdfFilename: `informe_dgt_${cleanPlate.toLowerCase()}.pdf`,
      icCode: data.IC_CODE,
      icDescription: "Informe generado correctamente",
      extractedText: extractedText || undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      plate: cleanPlate,
      icCode: "REQUEST_FAILED",
      error: `Fallo en la comunicación con InfoCoche/DGT: ${message}`,
    };
  }
}
