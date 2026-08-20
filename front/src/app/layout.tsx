import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AutoMisho — Tu copiloto IA para comprar coches",
  description:
    "Encuentra el coche de segunda mano perfecto con asesoría inteligente por IA. Compara precios, historial y fiabilidad en un solo lugar.",
  keywords: [
    "coches segunda mano",
    "IA asesora",
    "comprar coche",
    "AutoMisho",
    "comparador coches",
    "historial vehículos",
  ],
  openGraph: {
    title: "AutoMisho — Tu copiloto IA para comprar coches",
    description:
      "Encuentra el coche de segunda mano perfecto con asesoría inteligente por IA.",
    type: "website",
    locale: "es_ES",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
