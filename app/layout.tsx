import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOLARIS | Mantenimiento fotovoltaico",
  description: "Portal de mantenimiento y expediente fotovoltaico",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className="font-sans antialiased">{children}</body></html>;
}
