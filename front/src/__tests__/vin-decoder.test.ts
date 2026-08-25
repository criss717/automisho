import { decodeVin } from "../lib/vin-decoder";

describe("ISO 3779 VIN Decoder", () => {
  it("decodes SEAT Spanish VIN accurately", () => {
    const res = decodeVin("VSSZZZ6JZLR123456");
    expect(res.isValid).toBe(true);
    expect(res.country).toBe("España");
    expect(res.manufacturer).toBe("SEAT / Cupra");
    expect(res.modelYear).toBe(2020);
    expect(res.reports.carVerticalUrl).toContain("VSSZZZ6JZLR123456");
    expect(res.reports.autoDnaUrl).toContain("VSSZZZ6JZLR123456");
  });

  it("decodes German BMW VIN accurately", () => {
    const res = decodeVin("WBA3A5C55FP123456");
    expect(res.isValid).toBe(true);
    expect(res.country).toBe("Alemania");
    expect(res.manufacturer).toBe("BMW");
    expect(res.modelYear).toBe(2015);
  });

  it("decodes Volkswagen VIN accurately", () => {
    const res = decodeVin("WVWZZZ1KZBP123456");
    expect(res.isValid).toBe(true);
    expect(res.manufacturer).toBe("Volkswagen");
    expect(res.modelYear).toBe(2011);
  });

  it("rejects invalid length or characters", () => {
    const res = decodeVin("INVALID-VIN-123");
    expect(res.isValid).toBe(false);
  });
});
