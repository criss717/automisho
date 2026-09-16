jest.mock("ai", () => ({
  streamText: jest.fn(),
  convertToModelMessages: jest.fn(),
  createUIMessageStream: jest.fn(),
  createUIMessageStreamResponse: jest.fn(),
  toUIMessageStream: jest.fn(),
}));
jest.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: jest.fn(() => jest.fn()) }));
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    conversation: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
    message: { create: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("@/lib/ai", () => ({ opencode: jest.fn(), CHAT_MODEL: "qwen3.7-plus", AUTOMISHO_SYSTEM_PROMPT: "test" }));

import {
  detectCarSearch,
  detectPlate,
  detectVIN,
  isCarMatchingDoors,
  isCarMatchingColor,
  filterRealCarImages,
  ensureCarGallery,
} from "@/lib/chat-helpers";

describe("detectCarSearch", () => {
  const fixtures: Array<{ query: string; isSearch: boolean; maxPrice?: number; minPrice?: number }> = [
    { query: "menos de 3000", isSearch: true, maxPrice: 3000 },
    { query: "hasta 5000", isSearch: true, maxPrice: 5000 },
    { query: "máximo 7000", isSearch: true, maxPrice: 7000 },
    { query: "máx. 4500", isSearch: true, maxPrice: 4500 },
    { query: "entre 3000 y 6000", isSearch: true, maxPrice: 6000, minPrice: 3000 },
    { query: "15k", isSearch: true, maxPrice: 15000 },
    { query: "15.5k €", isSearch: true, maxPrice: 15500 },
    { query: "presupuesto 4000", isSearch: true, maxPrice: 4000 },
    { query: "3000€", isSearch: true, maxPrice: 3000 },
    { query: "busco suv diésel barato", isSearch: true },
    { query: "SUV familiar menos de 15.000€", isSearch: true, maxPrice: 15000 },
    { query: "coche por 2000", isSearch: true, maxPrice: 2000 },
    { query: "quiero un seat león 2020", isSearch: true },
    { query: "bmw serie 3 hasta 20000", isSearch: true, maxPrice: 20000 },
    { query: "hay coches eléctricos baratos", isSearch: true },
    { query: "budget 5000", isSearch: true, maxPrice: 5000 },
    { query: "entre 10k y 15k", isSearch: true, maxPrice: 15000, minPrice: 10000 },
    { query: "por 3500 euros", isSearch: true, maxPrice: 3500 },
    { query: "menos de 10.000 euros diesel", isSearch: true, maxPrice: 10000 },
    { query: "en 2024 me casé", isSearch: false },
  ];

  fixtures.forEach(({ query, isSearch, maxPrice, minPrice }) => {
    it(`"${query}" -> isSearch=${isSearch} maxPrice=${maxPrice}`, () => {
      const result = detectCarSearch(query);
      expect(result.isSearch).toBe(isSearch);
      if (maxPrice !== undefined) expect(result.maxPrice).toBe(maxPrice);
      if (minPrice !== undefined) expect(result.minPrice).toBe(minPrice);
    });
  });

  it("menos de 3000 without coche triggers isSearch true (bug fix)", () => {
    expect(detectCarSearch("menos de 3000").isSearch).toBe(true);
    expect(detectCarSearch("menos de 3000").maxPrice).toBe(3000);
  });

  it("k suffix handling", () => {
    expect(detectCarSearch("15k").maxPrice).toBe(15000);
    expect(detectCarSearch("15.5k").maxPrice).toBe(15500);
  });

  it("OR logic: 3000€ alone triggers", () => {
    expect(detectCarSearch("3000€").isSearch).toBe(true);
  });

  it("doors detection: 3 puertas, 5p", () => {
    const res3 = detectCarSearch("a ver 3 puertas de 4000 €");
    expect(res3.isSearch).toBe(true);
    expect(res3.doors).toBe(3);
    expect(res3.maxPrice).toBe(4000);

    const res5 = detectCarSearch("coche familiar 5p barato");
    expect(res5.isSearch).toBe(true);
    expect(res5.doors).toBe(5);
  });
});

describe("detectPlate", () => {
  it("formats 1234BCD to 1234-BCD", () => {
    expect(detectPlate("1234BCD")).toBe("1234-BCD");
  });
  it("formats 1234 bcd lower", () => {
    expect(detectPlate("1234 bcd")).toBe("1234-BCD");
  });
  it("rejects A,E,I,O,U,Q,Ñ", () => {
    expect(detectPlate("1234ABC")).toBeNull();
    expect(detectPlate("1234AEI")).toBeNull();
    expect(detectPlate("1234-IOQ")).toBeNull();
  });
  it("accepts valid 5678FGH", () => {
    expect(detectPlate("5678FGH")).toBe("5678-FGH");
  });
});

describe("detectVIN", () => {
  it("detects 17 char VIN", () => {
    expect(detectVIN("WVWZZZ1JZ3W386752")).toBe("WVWZZZ1JZ3W386752");
  });
  it("rejects VIN with I,O,Q", () => {
    expect(detectVIN("WVWZZZ1QZ3W386752")).toBeNull();
    expect(detectVIN("WVWZZZ1IZ3W386752")).toBeNull();
    expect(detectVIN("WVWZZZ1OZ3W386752")).toBeNull();
  });
  it("case insensitive", () => {
    expect(detectVIN("wvwzzz1jz3w386752")).toBe("WVWZZZ1JZ3W386752");
  });
});

describe("isCarMatchingDoors", () => {
  it("allows 3-door cars when 3 doors requested", () => {
    expect(isCarMatchingDoors("Seat Ibiza 1.9 TDI Sport 3p", "", 3)).toBe(true);
    expect(isCarMatchingDoors("Renault Clio 1.2 16V 3 puertas", "", 3)).toBe(true);
    expect(isCarMatchingDoors("Citroën C4 Coupé 1.6 HDi", "", 3)).toBe(true);
    expect(isCarMatchingDoors("Peugeot 206 1.4 HDi XS 3p", "", 3)).toBe(true);
    expect(isCarMatchingDoors("Ford Fiesta 1.4 TDCi 3p", "", 3)).toBe(true);
  });

  it("strictly rejects 4/5-door cars when 3 doors requested", () => {
    expect(isCarMatchingDoors("Volvo S60 2.4D 4p", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Chevrolet Cruze 4p", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Audi A6 2.5 TDI Berlina", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Volvo V40 1.9D Familiar", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Mercedes-Benz E 300", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Skoda Fabia 1.2", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Citroen C3 1.4 HDi", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Volkswagen Passat 2.0 TDI", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Ford Mondeo 2.0 TDCi", "", 3)).toBe(false);
    expect(isCarMatchingDoors("Seat Leon 1.9 TDI 5 puertas", "", 3)).toBe(false);
  });

  it("allows 5-door cars when 5 doors requested and rejects 3-door coupes", () => {
    expect(isCarMatchingDoors("Ford Focus 1.6 TDCi 5p", "", 5)).toBe(true);
    expect(isCarMatchingDoors("Seat Ibiza 1.9 TDI 3p", "", 5)).toBe(false);
    expect(isCarMatchingDoors("Renault Megane Coupé", "", 5)).toBe(false);
  });
});

describe("isCarMatchingColor & color detection", () => {
  it("detects requested colors in user search queries", () => {
    const res = detectCarSearch("coches de 3 puertas negros o grises de menos de 3000 euros");
    expect(res.isSearch).toBe(true);
    expect(res.doors).toBe(3);
    expect(res.maxPrice).toBe(3000);
    expect(res.colors).toEqual(expect.arrayContaining(["negro", "gris"]));
  });

  it("matches car with requested color in title or visual audit", () => {
    expect(isCarMatchingColor("Seat Ibiza 1.9 TDI Sport Negro", ["negro", "gris"])).toBe(true);
    expect(isCarMatchingColor("Fiat Punto 1.2", ["negro", "gris"], "Gris metalizado")).toBe(true);
  });

  it("rejects car with conflicting visual color or title", () => {
    expect(isCarMatchingColor("Seat Ibiza Blanco", ["negro", "gris"])).toBe(false);
    expect(isCarMatchingColor("Fiat Punto", ["negro", "gris"], "Blanco polar")).toBe(false);
  });
});

describe("filterRealCarImages & ensureCarGallery", () => {
  it("filters out dealer logos, banners, watermarks, and unsplash URLs", () => {
    const mixedImages = [
      "https://images.coches.net/dealers/ladonnaemobile/logo.jpg",
      "https://images.coches.net/dealers/multimarca-banner.png",
      "https://images.unsplash.com/photo-12345?auto=format",
      "https://fotos.coches.net/anuncios/2026/09/car-front-authentic.jpg",
      "https://fotos.coches.net/anuncios/2026/09/car-interior.jpg",
      "https://static.wallapop.com/images/icons/badge.svg",
    ];

    const filtered = filterRealCarImages(mixedImages);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toBe("https://fotos.coches.net/anuncios/2026/09/car-front-authentic.jpg");
    expect(filtered[1]).toBe("https://fotos.coches.net/anuncios/2026/09/car-interior.jpg");
  });

  it("never pads with generic/stock images if only 1 authentic image exists", () => {
    const car = {
      title: "Renault Clio 1.2 3p",
      image_url: "https://fotos.coches.net/clio-real.jpg",
      images: ["https://fotos.coches.net/clio-real.jpg"],
    };

    const gallery = ensureCarGallery(car);
    expect(gallery).toHaveLength(1);
    expect(gallery[0]).toBe("https://fotos.coches.net/clio-real.jpg");
    expect(gallery.some((u) => u.includes("unsplash"))).toBe(false);
  });

  it("returns empty array when no real images exist without injecting stock photos", () => {
    const car = {
      title: "Citroen C4 Coupé",
      image_url: null,
      images: [],
    };

    const gallery = ensureCarGallery(car);
    expect(gallery).toEqual([]);
  });
});
