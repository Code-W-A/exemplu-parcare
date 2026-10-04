import { getLprPresenceState } from './lpr-presence'

// Local data API. No Firebase SDK, credentials, server or network requests.
export class Timestamp {
  constructor(public seconds: number, public nanoseconds = 0) {}
  static fromDate(date: Date) { return Timestamp.fromMillis(date.getTime()) }
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6) }
  static now() { return Timestamp.fromDate(new Date()) }
  toDate() { return new Date(this.toMillis()) }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6 }
  toJSON() { return { __demoTimestamp: this.toMillis() } }
}
export type DocumentData = Record<string, any>
export type DocumentReference = { kind: 'document'; path: string; id: string }
export type QueryConstraint = { kind: string; field?: string; op?: string; value?: any }
export type Query = { kind: 'collection'; path: string; constraints: QueryConstraint[] }
export type QueryDocumentSnapshot = DocumentSnapshot
export type DocumentSnapshot = { id: string; ref: DocumentReference; exists: () => boolean; data: () => any }
export type QuerySnapshot = { docs: DocumentSnapshot[]; size: number; empty: boolean; forEach: (fn: (doc: DocumentSnapshot) => void) => void }
export const db = { kind: 'database' as const, path: '' }
export const DEMO_STORAGE_KEY = 'white-label-parking-demo-v1'
const VERSION = 1
export type DemoState = { version: number; initializedAt: string; documents: Record<string, DocumentData> }
let state: DemoState | undefined
let persistent = true
const listeners = new Set<() => void>()
let attached = false
let transactionQueue: Promise<any> = Promise.resolve()
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value), (_key, v) => v && typeof v.__demoTimestamp === 'number' ? Timestamp.fromMillis(v.__demoTimestamp) : v)

export function createDemoState(now = new Date()): DemoState {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const base = new Date(today + 'T12:00:00Z').getTime()
  const day = (n: number) => new Date(base + n * 86400000).toISOString().slice(0, 10)
  const documents: Record<string, DocumentData> = {}
  const names = ['Andrei Ionescu', 'Maria Popescu', 'Elena Dumitrescu', 'Mihai Stan', 'Ioana Radu', 'Alexandru Marin', 'Ana Pavel', 'Cristian Dobre', 'Raluca Matei', 'Vlad Petrescu']
  const models = ['Dacia Logan', 'Renault Clio', 'Toyota Corolla', 'Volkswagen Golf', 'Ford Focus', 'Skoda Octavia', 'Hyundai Tucson', 'Kia Ceed', 'BMW Seria 3', 'Opel Astra']
  for (let i = 0; i < 100; i++) {
    let start: number, end: number, inside = false, departed = false, source = 'webhook', status = 'confirmed_paid'
    if (i < 45) { start = -5 - i * 4; end = start + 2; departed = true }
    else if (i < 60) { start = -3; end = 3; inside = true }
    else if (i < 70) { start = 0; end = 4; inside = i < 65 }
    else if (i < 80) { start = -4; end = 0; inside = i < 75; departed = !inside }
    else if (i < 84) { start = -5; end = -1; inside = true; source = 'pay_on_site'; status = 'confirmed_pay_on_site' }
    else if (i < 90) { start = 2 + i % 5; end = start + 3 }
    else if (i < 94) { start = 3; end = 6; status = 'cancelled_by_admin' }
    else if (i < 98) { start = 1; end = 4; status = 'api_error' }
    else { start = -10; end = -7; status = 'expired'; departed = true }
    if (i >= 48 && i <= 52) source = 'manual'
    if (i === 54 || i === 55) { source = 'lpr'; status = 'unmatched_lpr' }
    const days = end - start
    const time = i >= 65 && i < 70 ? '16:00' : i >= 70 && i < 80 ? '18:00' : '09:00'
    const arrivedAt = day(start) + 'T06:30:00Z'
    const lpr: any = { isInside: inside, lastEventType: inside ? 'entry' : departed ? 'exit' : 'none' }
    if (inside || departed) lpr.arrivedAt = arrivedAt
    if (inside) lpr.lastSeenAt = arrivedAt
    if (departed) lpr.departedAt = day(end) + 'T07:00:00Z'
    documents[`bookings/demo-booking-${String(i + 1).padStart(3, '0')}`] = {
      demoSeed: true, licensePlate: `B${100 + i}TST`, clientName: names[i % names.length],
      clientEmail: `client${i + 1}@example.com`, clientPhone: `TEST-${String(i + 1).padStart(4, '0')}`,
      carMake: models[i % models.length].split(' ')[0], carModel: models[i % models.length],
      startDate: day(start), startTime: time, endDate: day(end), endTime: time, days,
      durationMinutes: days * 1440, multiparkDurationMinutes: days * 1440, amount: days * 35,
      numberOfPersons: 1 + i % 4, status, source, paymentStatus: source === 'pay_on_site' || source === 'lpr' ? 'pending' : 'paid',
      ...(i >= 20 && i <= 25 || i >= 84 && i <= 87 ? { bookingOrigin: 'mobile-app', channel: 'mobile' } : {}),
      apiBookingNumber: `${700000 + i}`, apiSuccess: status !== 'api_error', apiMessage: 'Mediu de test — API simulat',
      apiErrorCode: status === 'api_error' ? '0' : '1', termsAccepted: true,
      createdAt: Timestamp.fromDate(new Date(day(Math.min(start - 2, 0)) + 'T09:00:00Z')),
      lastUpdated: Timestamp.fromDate(now), lpr, occupancyIncremented: inside,
      ...(i === 60 ? { cancellationRequested: true, cancellationReason: 'Cerere fictivă de anulare' } : {}),
    }
  }
  const booking = documents['bookings/demo-booking-086']
  const request = { id: 'demo-modification-001', bookingId: 'demo-booking-086', status: 'pending_admin_review', currentAmount: booking.amount, newAmount: booking.amount, amountToPay: 0, creditAmount: 0, difference: 0, paymentPolicy: 'no_difference', finalValues: { startDate: booking.startDate, startTime: '10:00', endDate: booking.endDate, endTime: '10:00', licensePlate: booking.licensePlate }, createdAt: Timestamp.fromDate(now) }
  booking.modificationRequested = true
  booking.activeModificationRequestId = request.id
  booking.activeModificationRequest = request
  documents['bookingModificationRequests/' + request.id] = request
  for (let i = 1; i <= 30; i++) documents[`prices/demo-price-${i}`] = { days: i, standardPrice: i * 35, discountedPrice: i * 28, reducereAplicata: i * 7, discountPercentage: 20 }
  for (let i = 1; i <= 4; i++) documents[`lpr_whitelist/B${900 + i}TST`] = { plate: `B${900 + i}TST`, createdAt: Timestamp.fromDate(now) }
  documents['config/reservationSettings'] = { maxTotalReservations: 150, reservationsEnabled: true }
  documents['config/parkingLive'] = { occupiedCount: 0, lastUpdated: Timestamp.fromDate(now) }
  documents['config/reservationStats'] = { activeBookingsCount: 0, lastUpdated: Timestamp.fromDate(now) }
  documents['config/pricingSettings'] = { mobileOnlineDiscountPercent: 20 }
  documents['config/mobileAppSettings'] = { paymentProvider: 'stripe', payOnSiteEnabled: true, testPaymentEnabled: true, loyaltyProgram: { enabled: true, reservationsPerFreeDay: 4, freeDayHours: 24 } }
  documents['ops_alerts/oblio'] = { status: 'ok', message: 'Facturare simulată' }
  for (let i = 1; i <= 2; i++) documents[`demo_users/employee-${i}`] = { uid: `employee-${i}`, name: i === 1 ? 'Ana Operator' : 'Mihai Operator', email: `operator${i}@example.com`, active: true, createdAt: now.toISOString(), createdByEmail: 'admin@example.com' }
  const result = { version: VERSION, initializedAt: now.toISOString(), documents }
  deriveCounters(result)
  return result
}

function deriveCounters(target: DemoState) {
  const bookings = Object.entries(target.documents).filter(([p]) => /^bookings\/[^/]+$/.test(p)).map(([, d]) => d)
  const live = target.documents['config/parkingLive'] ||= {}
  live.occupiedCount = bookings.filter(getEffectiveInside).length
  const stats = target.documents['config/reservationStats'] ||= {}
  stats.activeBookingsCount = bookings.filter(b => !['expired', 'cancelled_by_admin', 'cancelled_by_api', 'api_error'].includes(b.status)).length
}
export function getEffectiveInside(booking: DocumentData) { return getLprPresenceState(booking).isEffectivelyInside }
function validState(value: any): value is DemoState {
  return value?.version === VERSION && typeof value.initializedAt === 'string' && !isNaN(Date.parse(value.initializedAt)) &&
    value.documents && typeof value.documents === 'object' && !Array.isArray(value.documents) &&
    ['config/reservationSettings', 'config/parkingLive', 'config/reservationStats', 'config/pricingSettings', 'config/mobileAppSettings'].every(p => value.documents[p] && typeof value.documents[p] === 'object') &&
    Object.entries(value.documents).every(([p, d]) => {
      if (!p.includes('/') || !d || typeof d !== 'object' || Array.isArray(d)) return false
      const record = d as DocumentData
      if (/^bookings\/[^/]+$/.test(p)) return typeof record.licensePlate === 'string' &&
        typeof record.status === 'string' && Number.isFinite(record.amount) && record.amount >= 0 &&
        ['startDate', 'endDate'].every(k => typeof record[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record[k]) && !isNaN(Date.parse(record[k]))) &&
        record.createdAt instanceof Timestamp && Number.isFinite(record.createdAt.toMillis())
      if (p.startsWith('prices/')) return Number.isInteger(record.days) && record.days > 0 && Number.isFinite(record.standardPrice) && record.standardPrice >= 0
      return true
    })
}
function parseState(raw: string | null) {
  if (!raw) return null
  try { const value = clone(JSON.parse(raw)); return validState(value) ? value : null } catch { return null }
}
function notify() { for (const listener of listeners) listener() }
function save() {
  if (typeof window === 'undefined' || !state) return
  try { window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); persistent = true }
  catch { persistent = false }
}
export function getDemoState(): DemoState {
  if (!state) {
    if (typeof window !== 'undefined') {
      try { state = parseState(window.localStorage.getItem(DEMO_STORAGE_KEY)) || undefined } catch { persistent = false }
    }
    state ||= createDemoState()
    deriveCounters(state)
    save()
  }
  if (typeof window !== 'undefined' && !attached) {
    attached = true
    window.addEventListener('storage', (event) => {
      if (event.key !== DEMO_STORAGE_KEY || event.newValue === null) return
      const incoming = parseState(event.newValue)
      if (incoming) { state = incoming; deriveCounters(state); notify() }
    })
  }
  return state
}
export function isDemoPersistent() { getDemoState(); return persistent }
export function subscribeDemo(listener: () => void) { getDemoState(); listeners.add(listener); return () => { listeners.delete(listener) } }
export function resetDemo() { state = createDemoState(); save(); notify() }
function commit(next: DemoState) { deriveCounters(next); state = next; save(); notify() }
const field = (data: any, path: string) => path.split('.').reduce((v, key) => v?.[key], data)
const scalar = (v: any): any => v instanceof Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : v
function equal(a: any, b: any) { return JSON.stringify(a) === JSON.stringify(b) }
export function collection(parent: { path: string }, ...segments: string[]): Query { return { kind: 'collection', path: [parent.path, ...segments].filter(Boolean).join('/'), constraints: [] } }
export function doc(parent: { path: string }, ...segments: string[]): DocumentReference {
  const path = [parent.path, ...segments, ...(segments.length ? [] : [newId()])].filter(Boolean).join('/')
  return { kind: 'document', path, id: path.split('/').pop()! }
}
function newId() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}` }
export const documentId = () => '__name__'
export const where = (field: string, op: string, value: any): QueryConstraint => ({ kind: 'where', field, op, value })
export const orderBy = (field: string, direction = 'asc'): QueryConstraint => ({ kind: 'orderBy', field, value: direction })
export const limit = (value: number): QueryConstraint => ({ kind: 'limit', value })
export const startAfter = (...value: any[]): QueryConstraint => ({ kind: 'startAfter', value })
export const query = (base: Query, ...constraints: QueryConstraint[]): Query => ({ ...base, constraints: [...base.constraints, ...constraints] })
function snapshot(ref: DocumentReference, target: DemoState): DocumentSnapshot {
  const data = target.documents[ref.path]
  return { id: ref.id, ref, exists: () => data !== undefined, data: () => data === undefined ? undefined : clone(data) }
}
function querySnapshot(ref: Query, target: DemoState): QuerySnapshot {
  let docs = Object.keys(target.documents).filter(p => p.startsWith(ref.path + '/') && !p.slice(ref.path.length + 1).includes('/')).map(p => snapshot(doc(db, p), target))
  const valueOf = (d: DocumentSnapshot, key: string) => key === '__name__' ? d.id : field(d.data(), key)
  for (const c of ref.constraints.filter(c => c.kind === 'where')) {
    docs = docs.filter(d => {
      const a = valueOf(d, c.field!), b = c.value
      switch (c.op) {
        case '==': return equal(a, b)
        case '!=': return a !== undefined && !equal(a, b)
        case '<': return scalar(a) < scalar(b)
        case '<=': return scalar(a) <= scalar(b)
        case '>': return scalar(a) > scalar(b)
        case '>=': return scalar(a) >= scalar(b)
        case 'in': return b.some((v: any) => equal(a, v))
        case 'not-in': return a !== undefined && !b.some((v: any) => equal(a, v))
        case 'array-contains': return Array.isArray(a) && a.some(v => equal(v, b))
        default: throw new Error('Operator local nesuportat: ' + c.op)
      }
    })
  }
  const orders = ref.constraints.filter(c => c.kind === 'orderBy')
  docs = docs.filter(d => orders.every(c => valueOf(d, c.field!) !== undefined))
  docs.sort((a, b) => {
    for (const c of orders) {
      const x = scalar(valueOf(a, c.field!)), y = scalar(valueOf(b, c.field!))
      if (x !== y) return (x < y ? -1 : 1) * (c.value === 'desc' ? -1 : 1)
    }
    return a.id.localeCompare(b.id)
  })
  const after = ref.constraints.find(c => c.kind === 'startAfter')
  if (after) {
    const cursor = after.value[0]
    if (cursor && typeof cursor === 'object' && 'id' in cursor) {
      const index = docs.findIndex(d => d.id === cursor.id)
      if (index >= 0) docs = docs.slice(index + 1)
    } else {
      docs = docs.filter(d => {
        for (let i = 0; i < orders.length; i++) {
          const a = scalar(valueOf(d, orders[i].field!)), b = scalar(after.value[i])
          if (a !== b) return orders[i].value === 'desc' ? a < b : a > b
        }
        return false
      })
    }
  }
  const max = ref.constraints.find(c => c.kind === 'limit')
  if (max) docs = docs.slice(0, max.value)
  return { docs, size: docs.length, empty: docs.length === 0, forEach: fn => docs.forEach(fn) }
}
export async function getDoc(ref: DocumentReference) { return snapshot(ref, getDemoState()) }
export async function getDocs(ref: Query) { return querySnapshot(ref, getDemoState()) }
export async function getCountFromServer(ref: Query) { const snap = await getDocs(ref); return { data: () => ({ count: snap.size }) } }
export function onSnapshot(ref: DocumentReference, next: (snapshot: DocumentSnapshot) => void, error?: (error: any) => void): () => void
export function onSnapshot(ref: Query, next: (snapshot: QuerySnapshot) => void, error?: (error: any) => void): () => void
export function onSnapshot(ref: DocumentReference | Query, next: (snapshot: any) => void, error?: (error: any) => void) {
  let previous = ''
  const emit = () => {
    try {
      const snap = ref.kind === 'document' ? snapshot(ref, getDemoState()) : querySnapshot(ref, getDemoState())
      const signature = JSON.stringify(ref.kind === 'document' ? (snap as DocumentSnapshot).data() : (snap as QuerySnapshot).docs.map(d => [d.id, d.data()]))
      if (signature !== previous) { previous = signature; next(snap) }
    } catch (e) { error?.(e) }
  }
  const off = subscribeDemo(emit)
  queueMicrotask(emit)
  return off
}
export const serverTimestamp = () => Timestamp.now()
export const increment = (value: number) => ({ __demoOperation: 'increment', value })
export const deleteField = () => ({ __demoOperation: 'delete' })
function assign(target: any, key: string, value: any) {
  const parts = key.split('.'); const last = parts.pop()!
  const parent = parts.reduce((v, k) => v[k] ||= {}, target)
  if (value?.__demoOperation === 'increment') parent[last] = Number(parent[last] || 0) + value.value
  else if (value?.__demoOperation === 'delete') delete parent[last]
  else if (value !== undefined) parent[last] = clone(value)
}
function mergeData(target: any, values: any) {
  for (const [key, value] of Object.entries(values)) {
    if (!key.includes('.') && value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp) && !(value instanceof Date) && !(value as any).__demoOperation) {
      target[key] ||= {}; mergeData(target[key], value)
    } else assign(target, key, value)
  }
}
type Write = { type: 'set' | 'update' | 'delete'; ref: DocumentReference; data?: any; merge?: boolean }
function apply(target: DemoState, write: Write) {
  if (write.type === 'delete') { delete target.documents[write.ref.path]; return }
  if (write.type === 'update' && !target.documents[write.ref.path]) throw new Error('Document inexistent: ' + write.ref.path)
  if (write.type === 'set' && !write.merge) target.documents[write.ref.path] = {}
  const data = target.documents[write.ref.path] ||= {}
  if (write.type === 'set') mergeData(data, write.data)
  else for (const [key, value] of Object.entries(write.data)) assign(data, key, value)
}
function writeAll(writes: Write[]) {
  getDemoState()
  // Another tab may have saved before its storage event reached this tab.
  // Apply this operation to the latest persisted state instead of overwriting it.
  if (typeof window !== 'undefined') {
    try { state = parseState(window.localStorage.getItem(DEMO_STORAGE_KEY)) || state } catch { persistent = false }
  }
  const next = clone(state!)
  for (const write of writes) apply(next, write)
  commit(next)
}
export async function setDoc(ref: DocumentReference, data: any, options?: { merge?: boolean }) { writeAll([{ type: 'set', ref, data, merge: options?.merge }]) }
export async function updateDoc(ref: DocumentReference, data: any) { writeAll([{ type: 'update', ref, data }]) }
export async function deleteDoc(ref: DocumentReference) { writeAll([{ type: 'delete', ref }]) }
export async function addDoc(ref: Query, data: any) { const result = doc(ref); await setDoc(result, data); return result }
export function writeBatch(_db: unknown) {
  const writes: Write[] = []
  const batch = {
    set(ref: DocumentReference, data: any, options?: { merge?: boolean }) { writes.push({ type: 'set', ref, data, merge: options?.merge }); return batch },
    update(ref: DocumentReference, data: any) { writes.push({ type: 'update', ref, data }); return batch },
    delete(ref: DocumentReference) { writes.push({ type: 'delete', ref }); return batch },
    async commit() { writeAll(writes) },
  }
  return batch
}
export async function runTransaction<T>(_db: unknown, fn: (transaction: { get: (ref: DocumentReference) => Promise<DocumentSnapshot>; set: (ref: DocumentReference, data: any, options?: { merge?: boolean }) => void; update: (ref: DocumentReference, data: any) => void; delete: (ref: DocumentReference) => void }) => Promise<T>): Promise<T> {
  const execute = async () => {
    const batch = writeBatch(db)
    const result = await fn({ get: getDoc, set: batch.set, update: batch.update, delete: batch.delete })
    await batch.commit()
    return result
  }
  const result = transactionQueue.then(execute, execute)
  transactionQueue = result.catch(() => undefined)
  return result
}
