/**
 * Tests for MessageBubble component.
 */
import { render, screen } from "@testing-library/react";
import MessageBubble from "@/components/chat/MessageBubble";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      // Filter out framer-motion specific props
      const { initial, animate, transition, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
}));

describe("MessageBubble", () => {
  it("renders user message with correct text", () => {
    render(<MessageBubble role="user" content="Hola, busco un coche" />);
    expect(screen.getByText("Hola, busco un coche")).toBeInTheDocument();
  });

  it("renders assistant message with correct text", () => {
    render(<MessageBubble role="assistant" content="¿Qué tipo de coche buscas?" />);
    expect(screen.getByText("¿Qué tipo de coche buscas?")).toBeInTheDocument();
  });

  it("applies user styling (mint background)", () => {
    const { container } = render(<MessageBubble role="user" content="Test" />);
    const bubble = container.querySelector(".bg-mint-glow");
    expect(bubble).toBeInTheDocument();
  });

  it("applies assistant styling (teal background)", () => {
    const { container } = render(<MessageBubble role="assistant" content="Test" />);
    const bubble = container.querySelector("[class*='bg-shadow-teal']");
    expect(bubble).toBeInTheDocument();
  });

  it("renders CarResultCard when car prop is provided", () => {
    const car = {
      title: "SEAT León 2019",
      price: 15000,
      year: 2019,
      km: 45000,
      fuel: "Diésel",
      location: "Madrid",
      source: "autoscout24",
    };

    render(<MessageBubble role="assistant" content="" car={car} />);
    expect(screen.getByText("SEAT León 2019")).toBeInTheDocument();
  });

  it("shows streaming cursor when isStreaming is true", () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Pensando..." isStreaming />
    );
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("does not show streaming cursor when isStreaming is false", () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Respuesta completa" />
    );
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).not.toBeInTheDocument();
  });
});
