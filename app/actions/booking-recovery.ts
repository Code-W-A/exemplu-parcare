"use server"

import { requireDemoRole, simulatedParkingFetch } from "@/lib/demo-server"

import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  increment
} from "@/lib/server-firestore"
import { db } from "@/lib/server-firestore"
import { createBooking } from "./booking-actions"

interface FailedBooking {
  id: string
  licensePlate: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  clientName?: string
  clientEmail?: string
  paymentIntentId?: string
  amount?: number
  paymentStatus: string
  status: string
  apiMessage: string
  createdAt: any
}

/**
 * Recuperează rezervările cu plata procesată dar API eșuat
 */
export async function recoverFailedBookings(): Promise<{
  success: boolean
  recovered: number
  failed: number
  details: string[]
}> {
  await requireDemoRole(["admin"])
  const details: string[] = []
  let recovered = 0
  let failed = 0

  try {
    details.push("🔍 Căutare rezervări cu API eșuat și plată procesată...")

    // Găsește rezervările cu status "api_error" și payment status "paid"
    const bookingsRef = collection(db, "bookings")
    const q = query(
      bookingsRef,
      where("status", "==", "api_error"),
      where("paymentStatus", "==", "paid"),
      orderBy("createdAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    details.push(`📊 Găsite ${querySnapshot.size} rezervări de recuperat`)

    if (querySnapshot.empty) {
      return { success: true, recovered: 0, failed: 0, details }
    }

    for (const docSnapshot of querySnapshot.docs) {
      const bookingData = docSnapshot.data() as FailedBooking
      const bookingId = docSnapshot.id

      details.push(`\n🔄 Încercare recovery pentru: ${bookingData.licensePlate} (${bookingId})`)

      try {
        // Pregătește FormData pentru retry API call
        const formData = new FormData()
        formData.append("licensePlate", bookingData.licensePlate)
        formData.append("startDate", bookingData.startDate)
        formData.append("startTime", bookingData.startTime)
        formData.append("endDate", bookingData.endDate)
        formData.append("endTime", bookingData.endTime)
        
        if (bookingData.clientName) {
          formData.append("clientName", bookingData.clientName)
        }

        // Încearcă din nou API call-ul
        const apiResult = await createBooking(formData)

        if (apiResult.success) {
          // API a reușit! Actualizează rezervarea în Firestore
          await updateDoc(doc(db, "bookings", bookingId), {
            status: "confirmed_paid",
            apiSuccess: true,
            apiBookingNumber: (apiResult as any).bookingNumber,
            apiMessage: apiResult.message,
            apiResponseRaw: (apiResult as any).apiResponse || "",
            apiRequestPayload: (apiResult as any).apiPayload || "",
            recoveredAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
          })

          // Incrementează contorul de rezervări active
          const statsDocRef = doc(db, "config", "reservationStats")
          await updateDoc(statsDocRef, { 
            activeBookingsCount: increment(1),
            lastUpdated: serverTimestamp()
          })

          details.push(`✅ SUCCESS: ${bookingData.licensePlate} → Booking #${(apiResult as any).bookingNumber}`)
          recovered++

        } else {
          // API încă eșuează, actualizează doar încercarea
          await updateDoc(doc(db, "bookings", bookingId), {
            apiRetryCount: increment(1),
            lastApiRetryAt: serverTimestamp(),
            lastApiError: apiResult.message,
            lastUpdated: serverTimestamp()
          })

          details.push(`❌ FAILED: ${bookingData.licensePlate} → ${apiResult.message}`)
          failed++
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Salvează eroarea de retry în Firestore
        await updateDoc(doc(db, "bookings", bookingId), {
          apiRetryCount: increment(1),
          lastApiRetryAt: serverTimestamp(),
          lastApiError: errorMessage,
          lastUpdated: serverTimestamp()
        })

        details.push(`💥 ERROR: ${bookingData.licensePlate} → ${errorMessage}`)
        failed++
      }

      // Așteaptă 2 secunde între încercări pentru a nu suprasolicita API-ul
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    details.push(`\n📈 Recovery complet: ${recovered} recuperate, ${failed} încă eșuate`)

    return {
      success: true,
      recovered,
      failed,
      details
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    details.push(`💥 Eroare fatală în recovery: ${errorMessage}`)
    
    return {
      success: false,
      recovered,
      failed,
      details
    }
  }
}

/**
 * Recuperează o rezervare specifică prin ID-ul Firestore
 */
export async function recoverSpecificBooking(bookingId: string): Promise<{
  success: boolean
  message: string
  bookingNumber?: string
}> {
  await requireDemoRole(["admin"])
  try {
    const bookingRef = doc(db, "bookings", bookingId)
    const bookingDoc = await getDocs(query(collection(db, "bookings"), where("__name__", "==", bookingId)))
    
    if (bookingDoc.empty) {
      return { success: false, message: "Rezervarea nu a fost găsită" }
    }

    const bookingData = bookingDoc.docs[0].data() as FailedBooking

    if (bookingData.paymentStatus !== "paid") {
      return { success: false, message: "Rezervarea nu are plata procesată" }
    }

    if (bookingData.status !== "api_error") {
      return { success: false, message: "Rezervarea nu are nevoie de recovery" }
    }

    // Pregătește FormData pentru retry
    const formData = new FormData()
    formData.append("licensePlate", bookingData.licensePlate)
    formData.append("startDate", bookingData.startDate)
    formData.append("startTime", bookingData.startTime)
    formData.append("endDate", bookingData.endDate)
    formData.append("endTime", bookingData.endTime)
    
    if (bookingData.clientName) {
      formData.append("clientName", bookingData.clientName)
    }

    // Încearcă API call-ul
    const apiResult = await createBooking(formData)

    if (apiResult.success) {
      // Actualizează rezervarea
      await updateDoc(bookingRef, {
        status: "confirmed_paid",
        apiSuccess: true,
        apiBookingNumber: (apiResult as any).bookingNumber,
        apiMessage: apiResult.message,
        apiResponseRaw: (apiResult as any).apiResponse || "",
        apiRequestPayload: (apiResult as any).apiPayload || "",
        recoveredAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      })

      // Incrementează contorul
      const statsDocRef = doc(db, "config", "reservationStats")
      await updateDoc(statsDocRef, { 
        activeBookingsCount: increment(1),
        lastUpdated: serverTimestamp()
      })

      return {
        success: true,
        message: "Rezervarea a fost recuperată cu succes!",
        bookingNumber: (apiResult as any).bookingNumber
      }

    } else {
      // Actualizează încercarea
      await updateDoc(bookingRef, {
        apiRetryCount: increment(1),
        lastApiRetryAt: serverTimestamp(),
        lastApiError: apiResult.message,
        lastUpdated: serverTimestamp()
      })

      return {
        success: false,
        message: `API încă eșuează: ${apiResult.message}`
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: `Eroare la recovery: ${errorMessage}`
    }
  }
}

/**
 * Obține statistici despre rezervările eșuate
 */
export async function getFailedBookingsStats(): Promise<{
  total: number
  paidFailures: number
  unpaidFailures: number
  totalAmount: number
  oldestFailure?: Date
}> {
  await requireDemoRole(["admin"])
  try {
    const bookingsRef = collection(db, "bookings")
    const q = query(bookingsRef, where("status", "==", "api_error"))
    
    const querySnapshot = await getDocs(q)
    
    let paidFailures = 0
    let unpaidFailures = 0
    let totalAmount = 0
    let oldestFailure: Date | undefined

    querySnapshot.forEach(doc => {
      const data = doc.data()
      
      if (data.paymentStatus === "paid") {
        paidFailures++
        if (data.amount) {
          totalAmount += data.amount
        }
      } else {
        unpaidFailures++
      }

      // Track oldest failure
      if (data.createdAt) {
        const createdDate = data.createdAt.toDate()
        if (!oldestFailure || createdDate < oldestFailure) {
          oldestFailure = createdDate
        }
      }
    })

    return {
      total: querySnapshot.size,
      paidFailures,
      unpaidFailures,
      totalAmount,
      oldestFailure
    }

  } catch (error) {
    console.error("Error getting failed bookings stats:", error)
    return {
      total: 0,
      paidFailures: 0,
      unpaidFailures: 0,
      totalAmount: 0
    }
  }
} 