import { NextRequest, NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { isAdminRole } from "@/lib/admin-roles"

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
    const decoded = await adminAuth.verifyIdToken(token, true)
    if (!isAdminRole(decoded.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const response = NextResponse.json({ ok: true })
    response.cookies.set("demo-admin-token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: Math.max(0, decoded.exp - Math.floor(Date.now()/1000)) })
    return response
  } catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }) }
}
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set("demo-admin-token", "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 })
  return response
}
