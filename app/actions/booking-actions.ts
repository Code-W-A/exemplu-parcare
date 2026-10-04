import { addDoc, collection, db, doc, getDoc, getDocs, query, where, serverTimestamp, updateDoc } from '@/lib/demo-data'
import { normalizeLicensePlate } from '@/lib/utils'
import { checkExistingReservationByLicensePlate } from '@/lib/booking-utils'

export async function createBooking(formData: FormData) {
  const bookingNumber = `DEMO-${Date.now().toString(36).toUpperCase()}`
  if (!formData.get('licensePlate')) return { success: false, message: 'Numărul de înmatriculare este obligatoriu', bookingNumber }
  return { success: true, message: 'Operație parcare simulată', bookingNumber, apiResponse: '<DemoResponse>Simulat</DemoResponse>', apiPayload: 'Simulare locală' }
}

export async function createManualBooking(formData: FormData) {
  const text = (key: string) => String(formData.get(key) || '')
  const licensePlate = normalizeLicensePlate(text('licensePlate'))
  const startDate = text('startDate'), endDate = text('endDate'), startTime = text('startTime'), endTime = text('endTime')
  const durationMinutes = Math.round((new Date(`${endDate}T${endTime}:00`).getTime() - new Date(`${startDate}T${startTime}:00`).getTime()) / 60000)
  if (!licensePlate || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return { success: false, message: 'Completează numărul de înmatriculare și o perioadă validă.' }
  const duplicate = await checkExistingReservationByLicensePlate(licensePlate, startDate, endDate, startTime, endTime)
  if (duplicate.exists) return { success: false, message: 'Există deja o rezervare pentru această mașină în perioada selectată.' }
  const days = Math.ceil(durationMinutes / 1440)
  const prices = (await getDocs(collection(db, 'prices'))).docs.map(d => d.data()).sort((a, b) => a.days - b.days)
  const tier = prices.find(p => p.days === days)
  const last = prices[prices.length - 1]
  const amount = tier ? Number(tier.standardPrice) : last ? Math.round(Number(last.standardPrice) / Number(last.days) * days * 100) / 100 : days * 35
  const inside = text('manualIsInside') !== 'false'
  const apiBookingNumber = `DEMO-${Date.now().toString(36).toUpperCase()}`
  const booking = await addDoc(collection(db, 'bookings'), {
    licensePlate, startDate, startTime, endDate, endTime, days, durationMinutes, multiparkDurationMinutes: days * 1440, amount,
    clientName: text('clientName'), clientEmail: text('clientEmail'), clientPhone: text('clientPhone'),
    numberOfPersons: Number(text('numberOfPersons')) || 1, status: 'confirmed_paid', source: 'manual',
    paymentStatus: text('manualPaymentStatus') === 'paid' ? 'paid' : 'n/a', manualPaymentStatus: text('manualPaymentStatus') || 'not_paid',
    apiSuccess: true, apiBookingNumber, apiMessage: 'Parcare simulată', createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
    lpr: { isInside: inside, lastEventType: inside ? 'entry' : 'none', ...(inside ? { arrivedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() } : {}) },
    occupancyIncremented: inside,
  })
  return { success: true, bookingId: booking.id, apiBookingNumber, message: 'Rezervarea a fost salvată în demo. Parcarea este simulată.' }
}

export async function cancelBooking(_bookingNumber: string) { return { success: true, message: 'Anulare parcare simulată' } }
export async function cleanupExpiredBookings() {
  const now = Date.now()
  let cleanedCount = 0
  for (const row of (await getDocs(collection(db, 'bookings'))).docs) {
    const b = row.data()
    if (!['expired', 'cancelled_by_admin', 'cancelled_by_api', 'api_error'].includes(b.status) && !b.lpr?.isInside && new Date(`${b.endDate}T${b.endTime || '23:59'}:00`).getTime() < now) {
      await updateDoc(row.ref, { status: 'expired', lastUpdated: serverTimestamp() }); cleanedCount++
    }
  }
  return { cleanedCount, errors: [] as string[] }
}
export async function sendManualBookingEmail(bookingId: string) {
  const ref = doc(db, 'bookings', bookingId)
  if (!(await getDoc(ref)).exists()) return { success: false, message: 'Rezervare inexistentă.' }
  await updateDoc(ref, { emailSent: true, emailSimulated: true, emailSentAt: serverTimestamp() })
  return { success: true, message: 'Email simulat — nu s-a trimis niciun mesaj.' }
}
