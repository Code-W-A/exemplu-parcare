import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { adminDb } from "@/lib/firebase-admin"
import { authorizeAdminRequest } from "@/lib/admin-api-auth"

type Body = {
  bookingId?: string
  reason?: string
}

function createEmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function generateCancelConfirmationHtml(input: {
  clientName: string
  licensePlate: string
  bookingNumber: string
  startLabel: string
  endLabel: string
  reason?: string
}) {
  const reasonHtml = input.reason ? `<p><strong>Motiv:</strong> ${escapeHtml(input.reason)}</p>` : ""
  return `
<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirmare anulare rezervare</title>
    <style>
      body { font-family: Arial, sans-serif; background:#f5f5f5; padding: 20px; }
      .card { max-width: 640px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.08); }
      .header { background: #dc3545; color: white; padding: 18px 22px; }
      .content { padding: 22px; color: #111827; }
      .muted { color: #6b7280; }
      .row { padding: 10px 0; border-bottom: 1px solid #eee; }
      .row:last-child { border-bottom: 0; }
      .label { font-weight: 700; color: #374151; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h2 style="margin:0;">🚫 Rezervare anulată</h2>
        <p style="margin:6px 0 0 0;">Confirmare anulare rezervare OTP Parking</p>
      </div>
      <div class="content">
        <p>Bună, <strong>${escapeHtml(input.clientName || "client")}</strong>,</p>
        <p>Rezervarea ta a fost <strong>ANULATĂ</strong>.</p>
        ${reasonHtml}
        <div style="margin-top: 14px;">
          <div class="row"><span class="label">Număr rezervare:</span> ${escapeHtml(input.bookingNumber)}</div>
          <div class="row"><span class="label">Număr înmatriculare:</span> ${escapeHtml(input.licensePlate)}</div>
          <div class="row"><span class="label">Intrare:</span> ${escapeHtml(input.startLabel)}</div>
          <div class="row"><span class="label">Ieșire:</span> ${escapeHtml(input.endLabel)}</div>
        </div>
        <p class="muted" style="margin-top: 18px;">
          Dacă ai întrebări, răspunde la acest email sau contactează-ne la ${escapeHtml(process.env.GMAIL_USER || "admin@parcari-demo.example.com")}.
        </p>
      </div>
    </div>
  </body>
</html>
`
}

export async function POST(req: NextRequest) {
const auth = await authorizeAdminRequest(req, ["admin", "employee"])
if (!auth.ok) return auth.response
const body = await req.json().catch(() => null)
const bookingId = String(body?.bookingId || "").trim()
if (!bookingId || bookingId.includes("/")) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 })
const ref = adminDb.collection("bookings").doc(bookingId)
if (!(await ref.get()).exists) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
await ref.set({ cancellationEmailSimulated: true }, { merge: true })
return NextResponse.json({ ok: true, simulated: true, messageId: "demo-cancellation", message: "Email simulat — nu s-a trimis" })
}

