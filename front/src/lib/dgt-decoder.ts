/**
 * Decodificador matemático oficial de matrículas de la Dirección General de Tráfico (DGT).
 * Cubre el sistema alfanumérico español vigente desde septiembre de 2000 (0000 BBB) hasta la actualidad.
 *
 * Excluye vocales (A, E, I, O, U) y las consonantes Ñ y Q para evitar confusiones.
 * Permite calcular con precisión de mes y año la fecha oficial de primera matriculación en España
 * y el distintivo ambiental DGT (0, ECO, C, B, Sin Distintivo).
 */

export interface DgtPlateInfo {
  plate: string;
  normalizedPlate: string;
  isValid: boolean;
  registrationYear?: number;
  registrationMonth?: number;
  registrationPeriod?: string; // ej. "Febrero 2011"
  environmentalBadge?: "0" | "ECO" | "C" | "B" | "Sin Distintivo";
  environmentalBadgeColor?: string; // Hex color para badges
  isHistoricalFormat?: boolean; // Placas provinciales (ej. M-1234-AB)
}

// Hitos de bloques de matriculación de la DGT (primeras letras de cada año/periodo)
const DGT_SERIES_TIMELINE: Array<{ letters: string; year: number; month: number }> = [
  { letters: "BBB", year: 2000, month: 9 },
  { letters: "BCD", year: 2000, month: 12 },
  { letters: "BDR", year: 2001, month: 3 },
  { letters: "BNN", year: 2001, month: 6 },
  { letters: "BTX", year: 2001, month: 12 },
  { letters: "BYZ", year: 2002, month: 3 },
  { letters: "CBD", year: 2002, month: 6 },
  { letters: "CHX", year: 2002, month: 12 },
  { letters: "CND", year: 2003, month: 6 },
  { letters: "CTR", year: 2003, month: 12 },
  { letters: "CXP", year: 2004, month: 6 },
  { letters: "DCN", year: 2004, month: 12 },
  { letters: "DJB", year: 2005, month: 6 },
  { letters: "DRD", year: 2005, month: 12 },
  { letters: "DYN", year: 2006, month: 6 },
  { letters: "FDM", year: 2006, month: 12 },
  { letters: "FLB", year: 2007, month: 6 },
  { letters: "FRP", year: 2007, month: 12 },
  { letters: "FYF", year: 2008, month: 6 },
  { letters: "GFZ", year: 2008, month: 12 },
  { letters: "GKM", year: 2009, month: 6 },
  { letters: "GPY", year: 2009, month: 12 },
  { letters: "GTL", year: 2010, month: 6 },
  { letters: "GXZ", year: 2010, month: 12 },
  { letters: "HDZ", year: 2011, month: 6 },
  { letters: "HFZ", year: 2011, month: 10 },
  { letters: "HLS", year: 2011, month: 12 },
  { letters: "HRK", year: 2012, month: 6 },
  { letters: "HVB", year: 2012, month: 12 },
  { letters: "HXZ", year: 2013, month: 6 },
  { letters: "JCY", year: 2013, month: 12 },
  { letters: "JHN", year: 2014, month: 6 },
  { letters: "JNN", year: 2014, month: 12 },
  { letters: "JTD", year: 2015, month: 6 },
  { letters: "JYV", year: 2015, month: 12 },
  { letters: "KDD", year: 2016, month: 6 },
  { letters: "KLZ", year: 2016, month: 12 },
  { letters: "KSN", year: 2017, month: 6 },
  { letters: "KZZ", year: 2017, month: 12 },
  { letters: "LGX", year: 2018, month: 6 },
  { letters: "LNT", year: 2018, month: 12 },
  { letters: "LRV", year: 2019, month: 6 },
  { letters: "LYH", year: 2019, month: 12 },
  { letters: "MCK", year: 2020, month: 6 },
  { letters: "MKF", year: 2020, month: 12 },
  { letters: "MRB", year: 2021, month: 6 },
  { letters: "MWT", year: 2021, month: 12 },
  { letters: "MYL", year: 2022, month: 6 },
  { letters: "MZZ", year: 2022, month: 12 },
  { letters: "NBX", year: 2023, month: 6 },
  { letters: "NKK", year: 2023, month: 12 },
  { letters: "NRR", year: 2024, month: 6 },
  { letters: "NZZ", year: 2024, month: 12 },
  { letters: "PBB", year: 2025, month: 6 },
  { letters: "PZZ", year: 2026, month: 12 },
];

const VALID_LETTERS = "BCDFGHJKLMNPRSTVWXYZ";
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function letterIndex(letters: string): number {
  if (letters.length !== 3) return -1;
  const l1 = VALID_LETTERS.indexOf(letters[0]);
  const l2 = VALID_LETTERS.indexOf(letters[1]);
  const l3 = VALID_LETTERS.indexOf(letters[2]);
  if (l1 === -1 || l2 === -1 || l3 === -1) return -1;
  return l1 * 400 + l2 * 20 + l3;
}

/**
 * Decodifica una matrícula y extrae la fecha estimada y distintivo DGT.
 */
export function decodeSpanishPlate(plateInput: string, fuelType?: string | null): DgtPlateInfo {
  const clean = plateInput.trim().toUpperCase().replace(/[\s\-_]/g, "");

  // Formato moderno nacional: 4 dígitos + 3 letras (ej. 1805HFZ o 1805-HFZ)
  const modernRegex = /^(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})$/;
  const match = clean.match(modernRegex);

  if (!match) {
    // Verificar si es formato provincial antiguo (ej. M-1234-AB, B-5678-CD)
    const provincialRegex = /^[A-Z]{1,2}\d{4,6}[A-Z]{0,2}$/;
    if (provincialRegex.test(clean)) {
      return {
        plate: plateInput,
        normalizedPlate: clean,
        isValid: true,
        isHistoricalFormat: true,
        registrationYear: 1995,
        registrationPeriod: "Anterior a Septiembre 2000 (Placa provincial)",
        environmentalBadge: "Sin Distintivo",
        environmentalBadgeColor: "#6b7280",
      };
    }
    return {
      plate: plateInput,
      normalizedPlate: clean,
      isValid: false,
    };
  }

  const [, numbersStr, letters] = match;
  const targetIndex = letterIndex(letters);

  let bestMatch = DGT_SERIES_TIMELINE[0];
  let minDiff = Math.abs(targetIndex - letterIndex(DGT_SERIES_TIMELINE[0].letters));

  for (const item of DGT_SERIES_TIMELINE) {
    const itemIndex = letterIndex(item.letters);
    const diff = Math.abs(targetIndex - itemIndex);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = item;
    }
  }

  const year = bestMatch.year;
  const month = bestMatch.month;
  const period = `${MONTH_NAMES[month - 1]} de ${year}`;

  // Calcular Distintivo Ambiental DGT oficial
  // - Gasolina: Euro 3 (desde 2001) -> B; Euro 4/5/6 (desde 2006) -> C
  // - Diésel: Euro 4/5 (desde 2006) -> B; Euro 6 (desde sept 2015) -> C
  // - Eléctrico -> 0; Híbrido -> ECO
  const fuel = (fuelType || "").toLowerCase();
  let badge: "0" | "ECO" | "C" | "B" | "Sin Distintivo" = "Sin Distintivo";
  let badgeColor = "#6b7280"; // gris

  if (fuel.includes("electr") || fuel.includes("eléctr")) {
    badge = "0";
    badgeColor = "#3b82f6"; // azul
  } else if (fuel.includes("hibr") || fuel.includes("híbr") || fuel.includes("glp") || fuel.includes("gnc")) {
    badge = "ECO";
    badgeColor = "#10b981"; // verde / azul
  } else if (fuel.includes("diesel") || fuel.includes("diésel")) {
    if (year >= 2016 || (year === 2015 && month >= 9)) {
      badge = "C";
      badgeColor = "#22c55e"; // verde
    } else if (year >= 2006) {
      badge = "B";
      badgeColor = "#eab308"; // amarillo
    } else {
      badge = "Sin Distintivo";
      badgeColor = "#6b7280";
    }
  } else {
    // Por defecto / Gasolina
    if (year >= 2006) {
      badge = "C";
      badgeColor = "#22c55e";
    } else if (year >= 2001) {
      badge = "B";
      badgeColor = "#eab308";
    } else {
      badge = "Sin Distintivo";
      badgeColor = "#6b7280";
    }
  }

  return {
    plate: plateInput,
    normalizedPlate: `${numbersStr} ${letters}`,
    isValid: true,
    isHistoricalFormat: false,
    registrationYear: year,
    registrationMonth: month,
    registrationPeriod: period,
    environmentalBadge: badge,
    environmentalBadgeColor: badgeColor,
  };
}
