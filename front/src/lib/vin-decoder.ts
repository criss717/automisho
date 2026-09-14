/**
 * Decodificador de Número de Bastidor (VIN / Chassis Number) según estándar ISO 3779.
 *
 * Estructura de 17 caracteres alfanuméricos (excluye I, O, Q para evitar confusión con 1 y 0):
 * - WMI (World Manufacturer Identifier, dígitos 1-3): País y Fabricante.
 * - VDS (Vehicle Descriptor Section, dígitos 4-9): Tipo de vehículo, modelo, motorización y dígito de control.
 * - VIS (Vehicle Identifier Section, dígitos 10-17): Año modelo (dígito 10) y número secuencial de producción.
 */

export interface VinDecodedInfo {
  vin: string;
  isValid: boolean;
  country?: string;
  manufacturer?: string;
  modelYear?: number;
  wmi?: string;
  serialNumber?: string;
  reports: {
    autoDnaUrl: string;
    carVerticalUrl: string;
    carfaxUrl: string;
    vinAuditUrl: string;
  };
}

// Mapa de WMI principales (País + Marca)
const WMI_MAP: Record<string, { country: string; manufacturer: string }> = {
  // España
  VSS: { country: "España", manufacturer: "SEAT / Cupra" },
  VS6: { country: "España", manufacturer: "Ford España" },
  VSE: { country: "España", manufacturer: "Santana Motor" },
  VSK: { country: "España", manufacturer: "Nissan Motor Ibérica" },
  VS9: { country: "España", manufacturer: "Iveco Pegaso" },
  VR3: { country: "Francia", manufacturer: "Peugeot" },
  VF1: { country: "Francia", manufacturer: "Renault" },
  VF3: { country: "Francia", manufacturer: "Peugeot" },
  VF7: { country: "Francia", manufacturer: "Citroën / DS" },
  // Alemania
  WAU: { country: "Alemania", manufacturer: "Audi" },
  WBA: { country: "Alemania", manufacturer: "BMW" },
  WBY: { country: "Alemania", manufacturer: "BMW i" },
  WBS: { country: "Alemania", manufacturer: "BMW M" },
  WDB: { country: "Alemania", manufacturer: "Mercedes-Benz" },
  WDC: { country: "Alemania", manufacturer: "Mercedes-Benz SUV" },
  WDD: { country: "Alemania", manufacturer: "Mercedes-Benz" },
  WMX: { country: "Alemania", manufacturer: "Mercedes-AMG" },
  WOL: { country: "Alemania", manufacturer: "Opel" },
  W0L: { country: "Alemania", manufacturer: "Opel" },
  WP0: { country: "Alemania", manufacturer: "Porsche" },
  WVW: { country: "Alemania", manufacturer: "Volkswagen" },
  WV1: { country: "Alemania", manufacturer: "Volkswagen Comerciales" },
  WV2: { country: "Alemania", manufacturer: "Volkswagen Furgonetas" },
  // Italia
  ZAR: { country: "Italia", manufacturer: "Alfa Romeo" },
  ZFA: { country: "Italia", manufacturer: "Fiat" },
  ZFF: { country: "Italia", manufacturer: "Ferrari" },
  ZHW: { country: "Italia", manufacturer: "Lamborghini" },
  ZLA: { country: "Italia", manufacturer: "Lancia" },
  // Reino Unido
  SAJ: { country: "Reino Unido", manufacturer: "Jaguar" },
  SAL: { country: "Reino Unido", manufacturer: "Land Rover" },
  SCC: { country: "Reino Unido", manufacturer: "Lotus" },
  SHS: { country: "Reino Unido", manufacturer: "Honda UK" },
  // Japón
  JHM: { country: "Japón", manufacturer: "Honda" },
  JM1: { country: "Japón", manufacturer: "Mazda" },
  JN1: { country: "Japón", manufacturer: "Nissan" },
  JT1: { country: "Japón", manufacturer: "Toyota" },
  JTD: { country: "Japón", manufacturer: "Toyota" },
  JTE: { country: "Japón", manufacturer: "Toyota SUV" },
  JTM: { country: "Japón", manufacturer: "Toyota" },
  JS1: { country: "Japón", manufacturer: "Suzuki" },
  // Corea del Sur
  KL1: { country: "Corea del Sur", manufacturer: "Chevrolet / Daewoo" },
  KMH: { country: "Corea del Sur", manufacturer: "Hyundai" },
  KNA: { country: "Corea del Sur", manufacturer: "Kia" },
  KNE: { country: "Corea del Sur", manufacturer: "Kia" },
  // Suecia / Rep. Checa / Rumanía
  YV1: { country: "Suecia", manufacturer: "Volvo" },
  TMB: { country: "República Checa", manufacturer: "Škoda" },
  UU1: { country: "Rumanía", manufacturer: "Dacia" },
  // EE.UU.
  "1FA": { country: "Estados Unidos", manufacturer: "Ford" },
  "1G1": { country: "Estados Unidos", manufacturer: "Chevrolet" },
  "1HG": { country: "Estados Unidos", manufacturer: "Honda USA" },
  "1J4": { country: "Estados Unidos", manufacturer: "Jeep" },
  "5YJ": { country: "Estados Unidos", manufacturer: "Tesla" },
  "7SA": { country: "Estados Unidos", manufacturer: "Tesla Model Y" },
};

// Dígito 10 del VIN -> Año modelo (Estándar ISO 3779)
const YEAR_CODES: Record<string, number> = {
  Y: 2000,
  1: 2001,
  2: 2002,
  3: 2003,
  4: 2004,
  5: 2005,
  6: 2006,
  7: 2007,
  8: 2008,
  9: 2009,
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
};

/**
 * Decodifica un número de bastidor (VIN) de 17 caracteres.
 */
export function decodeVin(vinInput: string): VinDecodedInfo {
  const clean = vinInput.trim().toUpperCase().replace(/[\s\-_]/g, "");

  // Formato oficial VIN: 17 caracteres alfanuméricos (sin I, O, Q)
  const isValid = /^[A-HJ-NPR-Z0-9]{17}$/.test(clean);

  const autoDnaUrl = `https://www.autodna.com/vin/${encodeURIComponent(clean)}`;
  const carVerticalUrl = `https://www.carvertical.com/es/informe-historial-vehiculo?vin=${encodeURIComponent(clean)}`;
  const carfaxUrl = `https://www.carfax.eu/es/informe-vehiculo?vin=${encodeURIComponent(clean)}`;
  const vinAuditUrl = `https://www.vinaudit.com/report?vin=${encodeURIComponent(clean)}`;

  if (!isValid) {
    return {
      vin: vinInput,
      isValid: false,
      reports: { autoDnaUrl, carVerticalUrl, carfaxUrl, vinAuditUrl },
    };
  }

  const wmi = clean.substring(0, 3);
  const yearCode = clean.charAt(9);
  const serialNumber = clean.substring(11);

  const wmiInfo = WMI_MAP[wmi] || {
    country: "Internacional / Fabricante Europeo",
    manufacturer: `Fabricante (${wmi})`,
  };

  const modelYear = YEAR_CODES[yearCode];

  return {
    vin: clean,
    isValid: true,
    country: wmiInfo.country,
    manufacturer: wmiInfo.manufacturer,
    modelYear,
    wmi,
    serialNumber,
    reports: {
      autoDnaUrl,
      carVerticalUrl,
      carfaxUrl,
      vinAuditUrl,
    },
  };
}
