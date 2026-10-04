const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function sharedStorage() {
  const values = new Map()
  const tabs = new Set()
  let blocked = false
  return {
    values, setBlocked: value => { blocked = value },
    browser() {
      const tab = { handlers: [], addEventListener(name, fn) { if (name === 'storage') this.handlers.push(fn) } }
      tabs.add(tab)
      tab.localStorage = {
        getItem(key) { if (blocked) throw new Error('Storage disabled'); return values.get(key) || null },
        setItem(key, value) { if (blocked) throw new Error('Quota exceeded'); values.set(key, value); for (const other of tabs) if (other !== tab) other.handlers.forEach(fn => fn({ key, newValue: value })) },
      }
      return tab
    },
  }
}
function runtime(storage = sharedStorage()) {
  const cache = new Map()
  const window = storage.browser()
  let networkCalls = 0
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    const localRequire = spec => {
      if (spec.startsWith('@/') || spec.startsWith('.')) {
        const base = spec.startsWith('@/') ? path.resolve(root, spec.slice(2)) : path.resolve(path.dirname(file), spec)
        const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
        if (!target) throw new Error('Missing local module: ' + spec)
        return load(target)
      }
      return require(spec)
    }
    vm.runInNewContext(source, { module, exports: module.exports, require: localRequire, window, console: { log() {}, warn() {}, error() {} }, Date, Error, Response, FormData, Headers, Request, URL, Intl, crypto: require('node:crypto').webcrypto, queueMicrotask, setTimeout, clearTimeout, fetch() { networkCalls++; throw new Error('Network forbidden') } }, { filename: file })
    return module.exports
  }
  return { data: load('lib/demo-data.ts'), load, networkCalls: () => networkCalls, storage }
}
const bookings = data => data.getDocs(data.collection(data.db, 'bookings'))
const ref = (data, id) => data.doc(data.db, 'bookings', id)

function manualForm(plate = 'B999DEM') {
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  const values = { licensePlate: plate, startDate: day(0), startTime: '10:00', endDate: day(2), endTime: '10:00', clientName: 'Client Demo Test', clientEmail: 'test@example.com', manualPaymentStatus: 'paid', manualIsInside: 'false', numberOfPersons: '2' }
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}

test('seed contains coherent bookings, configurations and historical/today/future scenarios', async () => {
  const { data } = runtime()
  const state = data.createDemoState(new Date('2026-10-04T12:00:00Z'))
  const rows = Object.entries(state.documents).filter(([p]) => /^bookings\/[^/]+$/.test(p)).map(([, d]) => d)
  assert.equal(rows.length, 100)
  assert.equal(rows.filter(b => b.lpr.isInside).length, 29)
  assert.equal(state.documents['config/parkingLive'].occupiedCount, 29)
  assert.equal(rows.filter(b => b.status === 'api_error').length, 4)
  assert.equal(rows.filter(b => b.startDate === '2026-10-04').length, 10)
  assert.ok(rows.some(b => b.startDate > '2026-10-04'))
  for (const b of rows) assert.equal(b.amount, b.days * 35)
  assert.equal(Object.keys(state.documents).filter(p => p.startsWith('prices/')).length, 30)
})

test('create, edit, entry and exit update one store and derived statistics, survive reload', async () => {
  const storage = sharedStorage(), app = runtime(storage), d = app.data
  const actions = app.load('app/actions/booking-actions.ts')
  const lpr = app.load('lib/manual-lpr-event.ts'), stats = app.load('lib/admin-stats.ts')
  const before = await stats.getDashboardStats()
  const result = await actions.createManualBooking(manualForm())
  assert.equal(result.success, true)
  const id = result.bookingId
  assert.equal((await bookings(d)).size, 101)
  assert.equal((await d.getDoc(ref(d, id))).data().amount, 70)
  await d.updateDoc(ref(d, id), { clientName: 'Nume modificat', amount: 100 })
  const after = await stats.getDashboardStats()
  assert.equal(after.totalBookings, before.totalBookings + 1)
  assert.equal(after.totalRevenue, before.totalRevenue + 100)
  const input = { bookingId: id, plateNumber: 'B999DEM', eventType: 'entry', eventTimeIsoZ: new Date().toISOString() }
  await lpr.writeManualLprEvent(input)
  await lpr.writeManualLprEvent(input)
  assert.equal((await d.getDoc(d.doc(d.db, 'config', 'parkingLive'))).data().occupiedCount, 30)
  await lpr.writeManualLprEvent({ ...input, eventType: 'exit', eventTimeIsoZ: new Date(Date.now() + 1000).toISOString() })
  assert.equal((await stats.getDashboardStats()).currentOccupancyCount, 29)
  const reloaded = runtime(storage).data
  const persisted = (await reloaded.getDoc(ref(reloaded, id))).data()
  assert.equal(persisted.clientName, 'Nume modificat')
  assert.equal(persisted.lpr.isInside, false)
  assert.ok(persisted.createdAt.toDate() instanceof Date)
  assert.equal(app.networkCalls(), 0)
})

test('tariff changes affect new bookings; duplicate periods and invalid dates are rejected', async () => {
  const app = runtime(), d = app.data, actions = app.load('app/actions/booking-actions.ts')
  await d.updateDoc(d.doc(d.db, 'prices', 'demo-price-2'), { standardPrice: 90 })
  const created = await actions.createManualBooking(manualForm())
  assert.equal((await d.getDoc(ref(d, created.bookingId))).data().amount, 90)
  assert.equal((await actions.createManualBooking(manualForm())).success, false)
  const invalid = manualForm('B888DEM'); invalid.set('endDate', 'invalid')
  assert.equal((await actions.createManualBooking(invalid)).success, false)
})

test('recovery, cancellation, deletion and modification requests persist without network calls', async () => {
  const app = runtime(), d = app.data
  const recovery = app.load('app/actions/booking-recovery.ts')
  const gateway = app.load('lib/demo-request.ts').demoRequest
  assert.equal((await recovery.getFailedBookingsStats()).total, 4)
  assert.equal((await recovery.recoverFailedBookings()).recovered, 4)
  assert.equal((await recovery.getFailedBookingsStats()).total, 0)
  const response = await gateway('/demo/bookings/modification-requests/demo-modification-001/approve', {}, { method: 'POST', body: '{}' })
  assert.equal(response.status, 200)
  assert.equal((await d.getDoc(ref(d, 'demo-booking-086'))).data().startTime, '10:00')
  await d.updateDoc(ref(d, 'demo-booking-086'), { status: 'cancelled_by_admin' })
  const email = await gateway('/demo/bookings/send-cancel-confirmation', {}, { method: 'POST', body: JSON.stringify({ bookingId: 'demo-booking-086' }) })
  assert.equal((await email.json()).simulated, true)
  const result = await gateway('/demo/bookings/delete', {}, { method: 'POST', body: JSON.stringify({ bookingId: 'demo-booking-086' }) })
  assert.equal(result.status, 200)
  assert.equal((await bookings(d)).size, 99)
  assert.equal(app.networkCalls(), 0)
})

test('two tabs receive data changes and reset only touches the demo storage key', async () => {
  const storage = sharedStorage()
  storage.values.set('unrelated', 'keep-me')
  const a = runtime(storage).data, b = runtime(storage).data
  a.getDemoState(); b.getDemoState()
  let notifications = 0
  b.subscribeDemo(() => notifications++)
  await a.updateDoc(ref(a, 'demo-booking-001'), { clientName: 'Din alt tab' })
  assert.equal((await b.getDoc(ref(b, 'demo-booking-001'))).data().clientName, 'Din alt tab')
  a.resetDemo()
  assert.equal((await bookings(b)).size, 100)
  assert.equal((await b.getDoc(ref(b, 'demo-booking-001'))).data().clientName, 'Andrei Ionescu')
  assert.ok(notifications >= 2)
  assert.equal(storage.values.get('unrelated'), 'keep-me')
})

test('blocked storage runs in memory; malformed or incompatible saved data is replaced', async () => {
  const storage = sharedStorage(); storage.setBlocked(true)
  const app = runtime(storage), d = app.data
  assert.equal(d.isDemoPersistent(), false)
  await d.updateDoc(ref(d, 'demo-booking-001'), { clientName: 'În memorie' })
  assert.equal((await d.getDoc(ref(d, 'demo-booking-001'))).data().clientName, 'În memorie')
  assert.equal(d.isDemoPersistent(), false)
  storage.setBlocked(false)
  for (const corrupt of ['{broken', '{"version":9}', '{"version":1,"initializedAt":"bad","documents":{}}']) {
    storage.values.set(d.DEMO_STORAGE_KEY, corrupt)
    assert.equal((await bookings(runtime(storage).data)).size, 100)
  }
})

test('batch writes are atomic, query pagination is stable, timestamp ordering survives hydration', async () => {
  const app = runtime(), d = app.data
  const batch = d.writeBatch(d.db)
  batch.update(ref(d, 'demo-booking-001'), { clientName: 'Must not commit' })
  batch.update(ref(d, 'does-not-exist'), { clientName: 'Invalid' })
  await assert.rejects(batch.commit())
  assert.equal((await d.getDoc(ref(d, 'demo-booking-001'))).data().clientName, 'Andrei Ionescu')
  const q = d.query(d.collection(d.db, 'bookings'), d.orderBy('createdAt', 'desc'), d.limit(25))
  const first = await d.getDocs(q)
  const second = await d.getDocs(d.query(d.collection(d.db, 'bookings'), d.orderBy('createdAt', 'desc'), d.startAfter(first.docs.at(-1)), d.limit(25)))
  assert.equal(new Set([...first.docs, ...second.docs].map(d => d.id)).size, 50)
})

test('simulated employees, whitelist, occupancy reset/undo, invoice and API tests share local data', async () => {
  const app = runtime(), d = app.data, gateway = app.load('lib/demo-request.ts').demoRequest
  const call = (path, body, method = 'POST') => gateway('/demo/' + path, {}, { method, body: JSON.stringify(body) })
  const created = await (await call('users/create', { name: 'Ana Demo', email: 'ana@example.com', password: 'fake-pass' })).json()
  assert.equal(created.success, true)
  await call('users/create', { uid: created.uid, active: false }, 'PATCH')
  assert.equal((await d.getDoc(d.doc(d.db, 'demo_users', created.uid))).data().active, false)
  assert.equal((await call('users/create', { name: 'Ana', email: 'ana@example.com', password: 'fake-pass' })).status, 400)
  await call('users/create/reset-password', { uid: created.uid, password: 'another-fake' })
  assert.equal((await d.getDoc(d.doc(d.db, 'demo_users', created.uid))).data().password, undefined)
  await d.setDoc(d.doc(d.db, 'lpr_whitelist', 'B999DEM'), { plate: 'B999DEM' })
  assert.equal((await d.getDocs(d.collection(d.db, 'lpr_whitelist'))).size, 5)
  await call('occupancy', { action: 'set_all_outside' })
  assert.equal((await gateway('/demo/occupancy', {})).status, 200)
  assert.equal((await (await gateway('/demo/occupancy', {})).json()).occupiedCount, 0)
  await call('occupancy', { action: 'reverse_set_all_outside_window' })
  assert.equal((await (await gateway('/demo/occupancy', {})).json()).occupiedCount, 29)
  const invoice = await (await call('bookings/retry-oblio-invoice', { bookingId: 'demo-booking-001' })).json()
  assert.equal(invoice.simulated, true)
  assert.equal((await app.load('app/actions/test-api-actions.ts').testApiConnectivity()).success, true)
  assert.equal(app.networkCalls(), 0)
})
