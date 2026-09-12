/**
 * Tests for CarResultCard component and Visual Audit badges.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import CarResultCard from "@/components/chat/CarResultCard";
import type { CarResult } from "@/types";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
    img: ({ ...props }: React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown>) => {
      const { initial, animate, exit, transition, ...domProps } = props;
      return <img {...domProps} />;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<unknown>) => <>{children}</>,
}));

describe("CarResultCard", () => {
  const baseCar: CarResult = {
    title: "FIAT Punto 1.3 Multijet Classic",
    price: 2999,
    year: 2008,
    km: 235000,
    fuel: "Diésel",
    location: "Sevilla",
    source: "coches.net",
    doors: 3,
    url: "https://www.coches.net/fiat-punto-13-multijet-16v-classic-3p-diesel-2005-en-sevilla-71420055-covo.aspx",
    score: 88,
    visualAudit: {
      doorsDetected: 3,
      verified3p: true,
      bodyCondition: "Pintura exterior bien conservada, faros transparentes sin opacidad visible",
    },
  };

  it("renders full variant with visual audit badge and condition report", () => {
    render(<CarResultCard car={baseCar} variant="full" />);

    // Title and source
    expect(screen.getByText("FIAT Punto 1.3 Multijet Classic")).toBeInTheDocument();
    expect(screen.getByText("coches.net")).toBeInTheDocument();

    // Doors chip
    expect(screen.getByText(/🚪/)).toHaveTextContent("3p");

    // Visual Audit badge & details
    expect(screen.getByText(/3p Verificado/)).toBeInTheDocument();
    expect(screen.getByText(/Auditoría Visual IA:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pintura exterior bien conservada, faros transparentes/),
    ).toBeInTheDocument();
  });

  it("renders compact variant with visual verification badge", () => {
    render(<CarResultCard car={baseCar} variant="compact" />);

    expect(screen.getByText("FIAT Punto 1.3 Multijet Classic")).toBeInTheDocument();
    expect(screen.getByText(/3p foto/)).toBeInTheDocument();
  });

  it("renders correctly without visualAudit present", () => {
    const carWithoutVisual: CarResult = {
      title: "SEAT Ibiza 1.4 TDI",
      price: 2500,
      source: "autoscout24",
    };

    render(<CarResultCard car={carWithoutVisual} variant="full" />);
    expect(screen.getByText("SEAT Ibiza 1.4 TDI")).toBeInTheDocument();
    expect(screen.queryByText(/3p Verificado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Auditoría Visual IA:/)).not.toBeInTheDocument();
  });

  it("navigates images with left and right gallery arrows", () => {
    const multiImageCar: CarResult = {
      title: "Peugeot 206 CC Rojo Descapotable",
      price: 2750,
      source: "coches.net",
      images: [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
        "https://example.com/photo3.jpg",
      ],
      visualAudit: {
        colorDetected: "rojo",
        bodyTypeDetected: "descapotable",
        flipOpportunity: {
          flipPotential: "Alto",
          damageSummary: "Sin daños estructurales",
          estimatedRepairCost: "0€",
        },
      },
    };

    render(<CarResultCard car={multiImageCar} variant="full" />);

    // Counter badge initially 1/3
    expect(screen.getByText("1/3")).toBeInTheDocument();

    // Badges for color and body type
    expect(screen.getByText(/🎨 rojo/)).toBeInTheDocument();
    expect(screen.getByText(/🏎️ descapotable/)).toBeInTheDocument();
    expect(screen.getByText(/Reventa: Alto/)).toBeInTheDocument();

    // Click next photo button
    const nextBtn = screen.getByRole("button", { name: /Siguiente foto/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText("2/3")).toBeInTheDocument();

    // Click next photo button again
    fireEvent.click(nextBtn);
    expect(screen.getByText("3/3")).toBeInTheDocument();

    // Click prev photo button to go back to 2/3
    const prevBtn = screen.getByRole("button", { name: /Foto anterior/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });
});
