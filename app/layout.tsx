import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOLARIS | Mantenimiento fotovoltaico",
  description: "Portal de mantenimiento y expediente fotovoltaico",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="bg-[#F5F7FA]"><body className="bg-[#F5F7FA] font-sans antialiased">{children}</body></html>;
}
