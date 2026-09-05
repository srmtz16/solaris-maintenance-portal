import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOLARIS | Mantenimiento fotovoltaico",
  description: "Portal de mantenimiento y expediente fotovoltaico",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="bg-[#faf9f6]"><body className="bg-[#faf9f6] font-sans antialiased">{children}</body></html>;
}
