import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, writeBatch, getEffectiveInside, runTransaction } from './demo-data'

// Compatibility boundary for existing forms: returns Response objects, but never fetches.
export async function demoRequest(input: RequestInfo | URL, _user: unknown, init: RequestInit = {}): Promise<Response> {
  const path = String(input)
  const method = init.method || 'GET'
  try {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
    if (path === '/demo/occupancy') {
      const rows = (await getDocs(collection(db, 'bookings'))).docs
      if (method !== 'GET') {
        const action = body.action || 'reset'
        const undoRef = doc(db, 'config', 'demoOutsideUndo')
        if (action === 'set_all_outside' || action === 'reset') {
          const inside = rows.filter(d => getEffectiveInside(d.data()))
          const batch = writeBatch(db)
          batch.set(undoRef, { rows: inside.map(d => ({ id: d.id, lpr: d.data().lpr })), createdAt: serverTimestamp() })
          for (const row of inside) batch.update(row.ref, { 'lpr.isInside': false, 'lpr.lastEventType': 'exit', 'lpr.departedAt': new Date().toISOString(), occupancyDecremented: true, lastUpdated: serverTimestamp() })
          await batch.commit()
        } else if (action.startsWith('reverse_set_all_outside')) {
          const undo = (await getDoc(undoRef)).data()?.rows || []
          if (action.endsWith('_preview')) return Response.json({ success: true, candidates: undo.length, willReverse: undo.length, skippedNotTimestamp: 0, skippedNotMatch: 0 })
          const batch = writeBatch(db)
          let reversed = 0
          for (const row of undo) {
            const existing = await getDoc(doc(db, 'bookings', row.id))
            if (existing.exists()) { batch.update(existing.ref, { lpr: row.lpr, occupancyDecremented: false, lastUpdated: serverTimestamp() }); reversed++ }
          }
          batch.set(undoRef, { rows: [] })
          await batch.commit()
          return Response.json({ success: true, reversed })
        } else if (action !== 'recalculate') return Response.json({ error: 'Acțiune demo necunoscută' }, { status: 400 })
      }
      const plates = (await getDocs(collection(db, 'bookings'))).docs.filter(d => getEffectiveInside(d.data())).map(d => ({ id: d.id, ...d.data() }))
      const settings = (await getDoc(doc(db, 'config', 'reservationSettings'))).data()
      return Response.json({ success: true, occupiedCount: plates.length, maxLimit: Number(settings.maxTotalReservations), plates })
    }
    if (path.startsWith('/demo/users/create')) {
      const usersRef = collection(db, 'demo_users')
      if (method === 'GET') return Response.json({ users: (await getDocs(usersRef)).docs.map(d => d.data()) })
      if (path.endsWith('/reset-password')) {
        if (String(body.password || '').length < 6) throw new Error('Parola fictivă trebuie să aibă minimum 6 caractere.')
        await updateDoc(doc(db, 'demo_users', body.uid), { passwordResetSimulatedAt: new Date().toISOString() })
        return Response.json({ success: true, simulated: true })
      }
      if (method === 'POST') {
        if (!String(body.name || '').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '') || String(body.password || '').length < 6) throw new Error('Completează numele, emailul și o parolă fictivă de minimum 6 caractere.')
        const users = (await getDocs(usersRef)).docs
        if (users.some(d => d.data().email.toLowerCase() === body.email.toLowerCase())) throw new Error('Acest email există deja în demo.')
        const ref = doc(usersRef)
        const user = { uid: ref.id, name: body.name.trim(), email: body.email.trim(), active: true, createdAt: new Date().toISOString(), createdByEmail: 'admin@example.com' }
        await setDoc(ref, user)
        return Response.json({ success: true, uid: ref.id, user, simulated: true })
      }
      const ref = doc(db, 'demo_users', body.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Angajat inexistent.')
      if (method === 'PATCH') await updateDoc(ref, { active: Boolean(body.active) })
      else if (method === 'DELETE') { const batch = writeBatch(db); batch.delete(ref); await batch.commit() }
      else throw new Error('Operație necunoscută.')
      return Response.json({ success: true, simulated: true })
    }
    const modification = path.match(/^\/demo\/bookings\/modification-requests\/([^/]+)\/(approve|reject|retry)$/)
    if (modification) {
      const [, id, action] = modification
      const status = action === 'reject' ? 'rejected' : 'completed'
      await runTransaction(db, async transaction => {
        const ref = doc(db, 'bookingModificationRequests', id)
        const request = (await transaction.get(ref)).data()
        if (!request) throw new Error('Cerere inexistentă.')
        if (['completed', 'rejected'].includes(request.status)) throw new Error('Cererea a fost deja finalizată.')
        const bookingRef = doc(db, 'bookings', request.bookingId)
        const booking = (await transaction.get(bookingRef)).data()
        if (!booking) throw new Error('Rezervare inexistentă.')
        transaction.update(ref, { status, adminReason: body.reason || '', updatedAt: serverTimestamp() })
        transaction.update(bookingRef, { ...(action !== 'reject' ? { ...request.finalValues, amount: request.newAmount } : {}), modificationRequested: false, activeModificationRequest: { ...request, status }, lastUpdated: serverTimestamp() })
      })
      return Response.json({ success: true, status, simulated: true })
    }
    const ref = doc(db, 'bookings', body.bookingId)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('Rezervare inexistentă.')
    if (path === '/demo/bookings/delete') {
      const batch = writeBatch(db)
      batch.set(doc(db, 'deleted_bookings', body.bookingId), { ...snap.data(), deletedAt: serverTimestamp() })
      batch.delete(ref)
      await batch.commit()
      return Response.json({ success: true })
    }
    if (path === '/demo/bookings/send-cancel-confirmation') {
      await updateDoc(ref, { cancellationEmailSimulated: true, cancellationEmailSentAt: serverTimestamp() })
      return Response.json({ success: true, simulated: true, message: 'Email simulat — nu s-a trimis.' })
    }
    if (path === '/demo/bookings/retry-oblio-invoice') {
      const invoiceNumber = `DEMO-${body.bookingId.slice(-8)}`
      await updateDoc(ref, { oblio: { status: 'success', simulated: true, invoiceNumber, lastSource: 'manual', lastError: null }, lastUpdated: serverTimestamp() })
      return Response.json({ success: true, simulated: true, invoiceNumber })
    }
    return Response.json({ error: 'Operație demo necunoscută.' }, { status: 404 })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
