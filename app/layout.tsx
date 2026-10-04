import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const viewport: Viewport = { themeColor: "#ee7f1a", width: "device-width", initialScale: 1 }
export const metadata: Metadata = {
  title: "Parcări Admin — Demo",
  description: "Panou de administrare demonstrativ cu date fictive.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body className="font-sans">{children}<Toaster /></body></html>
}
