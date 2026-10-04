// All results are generated locally. These functions never contact a parking API.
function simulated(formData?: FormData, operation = 'N') {
  const bookingNumber = String(formData?.get('bookingNumber') || `DEMO-${Date.now().toString(36).toUpperCase()}`)
  const requestPayload = `<DemoRequest><Operation>${operation}</Operation><BookingNumber>${bookingNumber}</BookingNumber></DemoRequest>`
  const rawResponse = `<WSResponseBookingSubmitV1><ErrorCode>1</ErrorCode><Message>Operație simulată — fără conexiune externă</Message><BookingNumber>${bookingNumber}</BookingNumber></WSResponseBookingSubmitV1>`
  return { success: true, status: 200, statusCode: 200, statusText: 'Simulat', errorCode: '1', bookingNumber, message: 'Operație simulată — fără conexiune externă', details: 'Răspuns local fictiv. Nu s-a efectuat nicio cerere.', requestPayload, rawResponse }
}
export async function testApiConnectivity() { return simulated() }
export async function testCreateBooking(formData: FormData) { return simulated(formData) }
export async function testUpdateBooking(formData: FormData) { return simulated(formData, 'U') }
export async function testCancelBooking(formData: FormData) { return simulated(formData, 'D') }
