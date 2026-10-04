import "server-only"
import { cookies } from "next/headers"
import { adminAuth } from "@/lib/firebase-admin"
import { DEMO_MESSAGE } from "@/lib/demo-config"
import type { AdminRole } from "@/lib/admin-roles"

export async function requireDemoRole(allowed: AdminRole[] = ["admin", "employee", "entriesOperator"]) {
  const token = (await cookies()).get("demo-admin-token")?.value
  if (!token) throw new Error("Autentificarea este obligatorie.")
  const user = await adminAuth.verifyIdToken(token, true)
  if (!allowed.includes(user.role)) throw new Error("Acces interzis.")
  return user
}

// This adapter never performs network I/O. Existing booking persistence still runs.
export async function simulatedParkingFetch(_input: unknown, init?: RequestInit): Promise<Response> {
  if (String(_input).endsWith("/api/send-confirmation-email")) return Response.json({ success: true, message: "Email simulat — nu s-a trimis", simulated: true })
  const payload = String(init?.body || "")
  const number = payload.match(/<BookingNumber>([^<]+)<\/BookingNumber>/)?.[1] || "DEMO"
  const body = `<WSResponseBookingSubmitV1><ErrorCode>1</ErrorCode><Message>${DEMO_MESSAGE}</Message><BookingNumber>${number}</BookingNumber></WSResponseBookingSubmitV1>`
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } })
}
