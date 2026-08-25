import { decodeSpanishPlate } from "../lib/dgt-decoder";

describe("DGT Official Plate Decoder", () => {
  it("correctly decodes modern license plate 1805 HFZ to 2011", () => {
    const result = decodeSpanishPlate("1805 HFZ", "gasolina");
    expect(result.isValid).toBe(true);
    expect(result.registrationYear).toBe(2011);
    expect(result.environmentalBadge).toBe("C");
    expect(result.normalizedPlate).toBe("1805 HFZ");
  });

  it("assigns badge B to 2004 gasolina", () => {
    const result = decodeSpanishPlate("1234 CXP", "gasolina"); // 2004
    expect(result.isValid).toBe(true);
    expect(result.registrationYear).toBe(2004);
    expect(result.environmentalBadge).toBe("B");
  });

  it("assigns badge 0 to electric vehicle", () => {
    const result = decodeSpanishPlate("5678 LNT", "eléctrico");
    expect(result.isValid).toBe(true);
    expect(result.environmentalBadge).toBe("0");
  });

  it("assigns badge ECO to hybrid vehicle", () => {
    const result = decodeSpanishPlate("9012 MYL", "híbrido");
    expect(result.isValid).toBe(true);
    expect(result.environmentalBadge).toBe("ECO");
  });

  it("handles historical provincial plates", () => {
    const result = decodeSpanishPlate("M1234AB", "gasolina");
    expect(result.isValid).toBe(true);
    expect(result.isHistoricalFormat).toBe(true);
    expect(result.environmentalBadge).toBe("Sin Distintivo");
  });

  it("flags invalid license plates gracefully", () => {
    const result = decodeSpanishPlate("XYZ-INVALID");
    expect(result.isValid).toBe(false);
  });
});
