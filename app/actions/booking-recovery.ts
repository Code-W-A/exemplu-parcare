import { db, collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp } from '@/lib/demo-data'

export async function recoverSpecificBooking(bookingId: string) {
  const ref = doc(db, 'bookings', bookingId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { success: false, message: 'Rezervarea nu a fost găsită' }
  const b = snap.data()
  if (b.status !== 'api_error' || b.paymentStatus !== 'paid') return { success: false, message: 'Rezervarea nu este eligibilă pentru recuperare.' }
  const bookingNumber = b.apiBookingNumber || `DEMO-${Date.now().toString(36).toUpperCase()}`
  await updateDoc(ref, { status: 'confirmed_paid', apiSuccess: true, apiBookingNumber: bookingNumber, apiMessage: 'Recuperare simulată', recoveredAt: serverTimestamp(), lastUpdated: serverTimestamp() })
  return { success: true, message: 'Rezervarea a fost recuperată în demo.', bookingNumber }
}
export async function recoverFailedBookings() {
  const rows = await getDocs(query(collection(db, 'bookings'), where('status', '==', 'api_error'), where('paymentStatus', '==', 'paid')))
  let recovered = 0
  const details: string[] = []
  for (const row of rows.docs) {
    const result = await recoverSpecificBooking(row.id)
    if (result.success) recovered++
    details.push(`${row.data().licensePlate}: ${result.message}`)
  }
  return { success: true, recovered, failed: rows.size - recovered, details }
}
export async function getFailedBookingsStats() {
  const docs = (await getDocs(query(collection(db, 'bookings'), where('status', '==', 'api_error')))).docs
  const paid = docs.filter(d => d.data().paymentStatus === 'paid')
  const times = docs.map(d => d.data().createdAt?.toDate?.()).filter(Boolean) as Date[]
  return { total: docs.length, paidFailures: paid.length, unpaidFailures: docs.length - paid.length, totalAmount: paid.reduce((s, d) => s + Number(d.data().amount || 0), 0), oldestFailure: times.length ? new Date(Math.min(...times.map(d => d.getTime()))) : undefined }
}
