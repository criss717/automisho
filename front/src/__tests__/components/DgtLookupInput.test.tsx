/**
 * Tests for DgtLookupInput component.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DgtLookupInput from "@/components/dashboard/DgtLookupInput";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("DgtLookupInput", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders input and button", () => {
    render(<DgtLookupInput />);
    expect(screen.getByPlaceholderText("0000-BCD")).toBeInTheDocument();
    expect(screen.getByText("Buscar")).toBeInTheDocument();
  });

  it("renders section title", () => {
    render(<DgtLookupInput />);
    expect(screen.getByText("Consulta DGT")).toBeInTheDocument();
  });

  it("disables button when input is empty", () => {
    render(<DgtLookupInput />);
    const button = screen.getByText("Buscar");
    expect(button).toBeDisabled();
  });

  it("enables button when input has value", () => {
    render(<DgtLookupInput />);
    const input = screen.getByPlaceholderText("0000-BCD");
    fireEvent.change(input, { target: { value: "1234-BCD" } });
    const button = screen.getByText("Buscar");
    expect(button).not.toBeDisabled();
  });

  it("calls API on button click", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plate: "1234BCD",
        make: "SEAT",
        model: "León",
        year: 2019,
        fuel: "Diésel",
        power: "115 CV",
        enrollmentDate: "2019-03-15",
        itvStatus: "Vigente",
        source: "mock",
      }),
    });

    render(<DgtLookupInput />);
    const input = screen.getByPlaceholderText("0000-BCD");
    const button = screen.getByText("Buscar");

    fireEvent.change(input, { target: { value: "1234-BCD" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/dgt/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: "1234-BCD" }),
      });
    });
  });

  it("displays result after successful lookup", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plate: "1234BCD",
        make: "SEAT",
        model: "León",
        year: 2019,
        fuel: "Diésel",
        power: "115 CV",
        enrollmentDate: "2019-03-15",
        itvStatus: "Vigente",
        source: "mock",
      }),
    });

    render(<DgtLookupInput />);
    const input = screen.getByPlaceholderText("0000-BCD");
    fireEvent.change(input, { target: { value: "1234-BCD" } });
    fireEvent.click(screen.getByText("Buscar"));

    await waitFor(() => {
      expect(screen.getByText("SEAT León")).toBeInTheDocument();
      expect(screen.getByText("2019")).toBeInTheDocument();
      expect(screen.getByText("Vigente")).toBeInTheDocument();
    });
  });

  it("displays error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: "Formato de matrícula no válido.",
      }),
    });

    render(<DgtLookupInput />);
    const input = screen.getByPlaceholderText("0000-BCD");
    fireEvent.change(input, { target: { value: "INVALID" } });
    fireEvent.click(screen.getByText("Buscar"));

    await waitFor(() => {
      expect(screen.getByText("Formato de matrícula no válido.")).toBeInTheDocument();
    });
  });

  it("converts input to uppercase", () => {
    render(<DgtLookupInput />);
    const input = screen.getByPlaceholderText("0000-BCD") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234bcd" } });
    expect(input.value).toBe("1234BCD");
  });
});
