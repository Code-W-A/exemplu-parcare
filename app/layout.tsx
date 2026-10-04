import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"], display: "swap" })
export const viewport: Viewport = { themeColor: "#ee7f1a", width: "device-width", initialScale: 1 }
export const metadata: Metadata = {
  title: "Parcări Admin — Demo",
  description: "Panou de administrare demonstrativ cu date fictive.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png" },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body className={inter.className}>{children}<Toaster /></body></html>
}
