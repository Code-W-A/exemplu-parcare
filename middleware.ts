import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
export function middleware(request: NextRequest) {
  const p = request.nextUrl.pathname
  if (p.startsWith("/api/") || p.startsWith("/lpr/") || p.startsWith("/NotificationInfo/")) {
    return NextResponse.json({ error: "Integrare externă dezactivată în mediul demo", demo: true }, { status: 403 })
  }
  if (p === "/admin" || p.startsWith("/admin/") || p.startsWith("/_next/") || /\.(png|jpg|jpeg|svg|ico|webp|woff2?|css|js|mp4)$/.test(p)) return NextResponse.next()
  return NextResponse.redirect(new URL("/admin/dashboard", request.url))
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
