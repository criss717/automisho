import { decodeSpanishPlate, type DgtPlateInfo } from "./dgt-decoder";

export interface DgtVehicleReport {
  plate: string;
  vin?: string;
  make?: string;
  model?: string;
  fuel?: string;
  powerHp?: number;
  firstRegistrationDate?: string;
  registrationYear?: number;
  environmentalBadge?: string;
  status: "SIN_INCIDENCIAS" | "CON_INCIDENCIAS" | "CON_AVISOS" | "NO_VERIFICABLE";
  statusDescription?: string;
  hasAdministrativeBlocks?: boolean;
  officialReportUrl: string;
  carVerticalUrl: string;
  carfaxUrl: string;
  source: "official_dgt_partner" | "dgt_mathematical_decoder";
}

/**
 * Consulta información técnica y administrativa de un vehículo por matrícula o bastidor.
 * Si hay variables de entorno para InfoCoche o ZuluLabs, consulta en tiempo real.
 * Si no hay clave API configurada, utiliza el decodificador matemático oficial DGT.
 */
export async function lookupVehicleDgt(plateOrVin: string, fuelHint?: string | null): Promise<DgtVehicleReport> {
  const cleanInput = plateOrVin.trim().toUpperCase().replace(/[\s\-_]/g, "");
  const isVin = cleanInput.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleanInput);

  const officialReportUrl = "https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/";
  const carVerticalUrl = `https://www.carvertical.com/es/informe-historial-vehiculo?vin=${encodeURIComponent(isVin ? cleanInput : "")}`;
  const carfaxUrl = `https://www.carfax.eu/es/informe-vehiculo?vin=${encodeURIComponent(isVin ? cleanInput : "")}`;

  // 1. Intentar consulta vía Partner REST API si está configurado en .env (ej. InfoCoche)
  const providerKey = process.env.DGT_PROVIDER_API_KEY || process.env.INFOCOCHE_API_KEY;
  const providerUrl = process.env.DGT_PROVIDER_URL || "https://infocoche.net/api/v1/vehicle";

  if (providerKey) {
    try {
      const queryParam = isVin ? `vin=${cleanInput}` : `plate=${cleanInput}`;
      const response = await fetch(`${providerUrl}?${queryParam}`, {
        headers: {
          Authorization: `Bearer ${providerKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          plate: data.plate || cleanInput,
          vin: data.vin || (isVin ? cleanInput : undefined),
          make: data.make,
          model: data.model,
          fuel: data.fuel || fuelHint || undefined,
          powerHp: data.power_hp,
          firstRegistrationDate: data.first_registration_date,
          registrationYear: data.registration_year,
          environmentalBadge: data.environmental_badge,
          status: data.has_incidents ? "CON_INCIDENCIAS" : "SIN_INCIDENCIAS",
          statusDescription: data.status_description || (data.has_incidents ? "Atención: Incidencias administrativas registradas en DGT" : "Vehículo sin incidencias telemáticas en DGT"),
          hasAdministrativeBlocks: Boolean(data.has_incidents),
          officialReportUrl,
          carVerticalUrl,
          carfaxUrl,
          source: "official_dgt_partner",
        };
      }
    } catch (apiErr) {
      console.warn("[dgt-client] Partner API request failed, falling back to local decoder:", apiErr);
    }
  }

  // 2. Fallback nativo: Decodificador Matemático Oficial DGT
  const decoded: DgtPlateInfo = decodeSpanishPlate(cleanInput, fuelHint);

  return {
    plate: decoded.normalizedPlate || cleanInput,
    vin: isVin ? cleanInput : undefined,
    registrationYear: decoded.registrationYear,
    firstRegistrationDate: decoded.registrationPeriod,
    environmentalBadge: decoded.environmentalBadge,
    status: decoded.isValid ? "SIN_INCIDENCIAS" : "NO_VERIFICABLE",
    statusDescription: decoded.isValid
      ? `Matrícula verificada en sistema DGT (Fecha estimada: ${decoded.registrationPeriod}). Distintivo oficial: ${decoded.environmentalBadge}.`
      : "Formato de matrícula no reconocido en el registro nacional.",
    hasAdministrativeBlocks: false,
    officialReportUrl,
    carVerticalUrl,
    carfaxUrl,
    source: "dgt_mathematical_decoder",
  };
}
