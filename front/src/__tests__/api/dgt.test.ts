/**
 * Tests for DGT lookup API validation logic.
 *
 * These test the input validation without hitting the actual API.
 */

// Plate format validation regex (same as in the route)
const PLATE_REGEX = /^\d{4}[ -]?[BCDFGHJKLMNPRSTVWXYZ]{3}$/i;

function isValidPlate(plate: string): boolean {
  const clean = plate.trim().toUpperCase();
  return PLATE_REGEX.test(clean.replace(/[ -]/g, "")) || PLATE_REGEX.test(clean);
}

describe("DGT Plate Validation", () => {
  describe("valid plates", () => {
    it("accepts standard format 0000-LLL", () => {
      expect(isValidPlate("1234-BCD")).toBe(true);
    });

    it("accepts format without dash 0000LLL", () => {
      expect(isValidPlate("1234BCD")).toBe(true);
    });

    it("accepts format with space 0000 LLL", () => {
      expect(isValidPlate("1234 BCD")).toBe(true);
    });

    it("accepts lowercase input", () => {
      expect(isValidPlate("1234bcd")).toBe(true);
    });

    it("accepts mixed case", () => {
      expect(isValidPlate("5678-FgH")).toBe(true);
    });
  });

  describe("invalid plates", () => {
    it("rejects empty string", () => {
      expect(isValidPlate("")).toBe(false);
    });

    it("rejects too short", () => {
      expect(isValidPlate("12-BC")).toBe(false);
    });

    it("rejects too long", () => {
      expect(isValidPlate("12345-BCD")).toBe(false);
    });

    it("rejects letters in number part", () => {
      expect(isValidPlate("ABCD-BCD")).toBe(false);
    });

    it("rejects numbers in letter part", () => {
      expect(isValidPlate("1234-123")).toBe(false);
    });

    it("rejects invalid letters (A, I, O, Q, U)", () => {
      // These letters are not used in Spanish plates
      // Note: our regex is permissive, real validation would exclude these
      expect(isValidPlate("1234-AIO")).toBe(false);
    });
  });
});

describe("Price parsing", () => {
  // Price parser (same as in scrape.py concept)
  function parsePrice(text: string): number | null {
    if (!text) return null;
    const digits = text.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }

  it("parses euro format '€ 15.750'", () => {
    expect(parsePrice("€ 15.750")).toBe(15750);
  });

  it("parses spanish format '15.900 €'", () => {
    expect(parsePrice("15.900 €")).toBe(15900);
  });

  it("parses plain number '25000'", () => {
    expect(parsePrice("25000")).toBe(25000);
  });

  it("returns null for empty string", () => {
    expect(parsePrice("")).toBeNull();
  });

  it("returns null for no digits", () => {
    expect(parsePrice("Consultar precio")).toBeNull();
  });
});
