import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { store } from './store'
import { getWaitEstimate, calculateOrderTimes } from './services'
import { Order, OrderItem, PaymentMethod, PaymentStatus, TableStatus, Table } from './types'
import { getCurrentSekki, tagMenuItems } from './sekki'
import { estimateCo2e, bandFor, europeanSeasonFor } from './sustainability'
import { buildAnalytics } from './analytics'

// Window in which an identical reservation request is treated as a retry of
// the same booking rather than a new one.
const RESERVATION_DEDUPE_MS = 5 * 60 * 1000

export function createRouter(emit: (event: string, data: unknown) => void) {
  const router = Router()

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (_req, res) => res.json({ ok: true }))

  // ── Restaurants ─────────────────────────────────────────────────────────
  router.get('/restaurants', (_req, res) => {
    res.json(Array.from(store.restaurants.values()))
  })

  router.get('/restaurants/:slug', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    res.json(r)
  })

  router.get('/restaurants/:slug/tables', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    res.json(store.getRestaurantTables(r.id))
  })

  router.get('/restaurants/:slug/menu', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    const items  = store.getRestaurantMenu(r.id)
    const sekki  = getCurrentSekki()
    const month  = new Date().getMonth() + 1

    // Two independent seasonality signals, plus a sourced footprint estimate.
    // inSeason (from tagMenuItems) is the Japanese sekki story; europeanSeason
    // is the one with environmental meaning for a kitchen in Zürich.
    res.json(tagMenuItems(items, sekki).map(item => {
      const ing = item.ingredients ?? []
      const co2eKg = estimateCo2e(ing)
      const season = europeanSeasonFor(ing, month)
      return {
        ...item,
        sustainability: {
          co2eKg,
          co2eBand: bandFor(co2eKg),
          europeanSeason: season.verdict,
          seasonNote: season.note,
        },
      }
    }))
  })

  // ── Analytics ────────────────────────────────────────────────────────────
  router.get('/restaurants/:slug/analytics', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const menu = tagMenuItems(store.getRestaurantMenu(r.id), getCurrentSekki())
    const orders = store.getAllOrders(r.id)
    res.json(buildAnalytics(menu, orders, new Date().getMonth() + 1))
  })

  // ── Sekki ────────────────────────────────────────────────────────────────
  router.get('/sekki/current', (_req, res) => {
    res.json(getCurrentSekki())
  })

  router.get('/restaurants/:slug/orders', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    res.json(store.getActiveOrders(r.id))
  })

  router.get('/restaurants/:slug/wait', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    const partySize = parseInt(req.query.partySize as string) || 2
    res.json(getWaitEstimate(r.id, partySize))
  })

  // ── Orders ──────────────────────────────────────────────────────────────
  router.post('/restaurants/:slug/orders', (req: Request, res: Response) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const { tableId, items, paymentMethod, notes } = req.body as {
      tableId: string
      items: OrderItem[]
      paymentMethod?: PaymentMethod
      notes?: string
    }

    const table = store.tables.get(tableId)
    if (!table) return res.status(404).json({ error: 'Table not found' })
    if (table.restaurantId !== r.id) return res.status(400).json({ error: 'Table not in this restaurant' })

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const times = calculateOrderTimes(items, r.settings)
    const orderId = uuid()
    const now = new Date().toISOString()

    const order: Order = {
      id: orderId,
      tableId, tableNumber: table.number, restaurantId: r.id,
      items, status: 'confirmed', totalAmount,
      paymentMethod, paymentStatus: 'unpaid',
      notes, createdAt: now, updatedAt: now,
      estimatedServeTime: times.estimatedServeTime,
    }

    store.orders.set(orderId, order)

    const updatedTable = {
      ...table, status: 'occupied' as const,
      session: {
        startTime: now,
        expectedEndTime: times.expectedEndTime,
        orderId, paymentStatus: 'unpaid' as const,
        paymentMethod,
      }
    }
    store.tables.set(tableId, updatedTable)

    emit('table:updated', updatedTable)
    emit('order:new', order)

    res.status(201).json({ order, table: updatedTable })
  })

  // ── Payment ─────────────────────────────────────────────────────────────
  router.post('/restaurants/:slug/orders/:orderId/pay', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const order = store.orders.get(req.params.orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const { paymentMethod } = req.body as { paymentMethod: PaymentMethod }

    const table = store.tables.get(order.tableId)
    if (!table) return res.status(404).json({ error: 'Table not found' })

    // For cash: set to pending (staff must confirm). Card/TWINT: instant
    const paymentStatus: PaymentStatus = paymentMethod === 'cash' ? 'pending' : 'paid'
    const tableStatus: TableStatus = paymentMethod === 'cash' ? 'payment_pending' : 'paid'

    const updatedOrder: Order = { ...order, paymentMethod, paymentStatus, updatedAt: new Date().toISOString() }
    store.orders.set(order.id, updatedOrder)

    const updatedTable: Table = {
      ...table, status: tableStatus,
      session: table.session ? { ...table.session, paymentStatus, paymentMethod } : undefined
    }
    store.tables.set(table.id, updatedTable)

    emit('order:updated', updatedOrder)
    emit('table:updated', updatedTable)

    res.json({ order: updatedOrder, table: updatedTable })
  })

  // Staff confirms cash payment
  router.post('/restaurants/:slug/orders/:orderId/confirm-payment', (req, res) => {
    const order = store.orders.get(req.params.orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const updatedOrder = { ...order, paymentStatus: 'paid' as const, updatedAt: new Date().toISOString() }
    store.orders.set(order.id, updatedOrder)

    const table = store.tables.get(order.tableId)
    if (table) {
      const updatedTable = {
        ...table, status: 'paid' as const,
        session: table.session ? { ...table.session, paymentStatus: 'paid' as const } : undefined
      }
      store.tables.set(table.id, updatedTable)
      emit('table:updated', updatedTable)
    }

    emit('order:updated', updatedOrder)
    res.json({ order: updatedOrder })
  })

  // ── Table Management (Staff) ─────────────────────────────────────────────
  router.post('/restaurants/:slug/tables/:tableId/reset', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const table = store.tables.get(req.params.tableId)
    if (!table) return res.status(404).json({ error: 'Table not found' })

    const updatedTable = { ...table, status: 'free' as const, session: undefined }
    store.tables.set(table.id, updatedTable)

    emit('table:updated', updatedTable)
    res.json(updatedTable)
  })

  // ── Reservations ─────────────────────────────────────────────────────────
  router.get('/restaurants/:slug/reservations', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })
    const reservations = Array.from(store.reservations.values())
      .filter(rv => rv.restaurantId === r.id)
    res.json(reservations)
  })

  router.post('/restaurants/:slug/reservations', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const { customerName, partySize, phone, email, requestedTime, notes } = req.body

    // Idempotency: a retry or a replayed request must not create a second
    // booking. An identical active reservation made inside this window is
    // treated as the same booking and returned as-is.
    const duplicate = [...store.reservations.values()].find(
      existing =>
        existing.restaurantId === r.id &&
        existing.status !== 'cancelled' &&
        existing.customerName === customerName &&
        existing.requestedTime === requestedTime &&
        existing.partySize === partySize &&
        Date.now() - new Date(existing.createdAt).getTime() < RESERVATION_DEDUPE_MS
    )
    if (duplicate) return res.status(200).json(duplicate)

    const reservation = {
      id: uuid(),
      restaurantId: r.id,
      customerName, partySize, phone, email, requestedTime,
      status: 'pending' as const,
      notes,
      createdAt: new Date().toISOString(),
    }
    store.reservations.set(reservation.id, reservation)

    emit('reservation:new', reservation)
    res.status(201).json(reservation)
  })

  router.patch('/restaurants/:slug/reservations/:id', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const reservation = store.reservations.get(req.params.id)
    // Check ownership, not just existence — a reservation at another
    // restaurant must not be reachable through this restaurant's route.
    if (!reservation || reservation.restaurantId !== r.id) {
      return res.status(404).json({ error: 'Reservation not found' })
    }

    // customerName is deliberately not editable here: renaming a booking
    // would turn a known name into a way to take over someone else's record.
    const { partySize, requestedTime, phone, email, notes } = req.body
    const updated = {
      ...reservation,
      ...(partySize !== undefined && { partySize }),
      ...(requestedTime !== undefined && { requestedTime }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(notes !== undefined && { notes }),
    }
    store.reservations.set(reservation.id, updated)

    emit('reservation:updated', updated)
    res.json(updated)
  })

  // ── Reservation Management (Staff) ──────────────────────────────────────
  router.patch('/restaurants/:slug/reservations/:id/confirm', (req, res) => {
    const reservation = store.reservations.get(req.params.id)
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' })

    const { tableId } = req.body as { tableId?: string }
    const updated = { ...reservation, status: 'confirmed' as const, tableId, confirmedTime: new Date().toISOString() }
    store.reservations.set(reservation.id, updated)

    emit('reservation:updated', updated)
    res.json(updated)
  })

  router.patch('/restaurants/:slug/reservations/:id/seat', (req, res) => {
    const reservation = store.reservations.get(req.params.id)
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' })

    const updated = { ...reservation, status: 'seated' as const }
    store.reservations.set(reservation.id, updated)

    if (reservation.tableId) {
      const table = store.tables.get(reservation.tableId)
      if (table) {
        const now = new Date()
        const end = new Date(now.getTime() + 90 * 60000)
        const updatedTable = {
          ...table,
          status: 'occupied' as const,
          session: { startTime: now.toISOString(), expectedEndTime: end.toISOString(), orderId: '', paymentStatus: 'unpaid' as const },
        }
        store.tables.set(table.id, updatedTable)
        emit('table:updated', updatedTable)
      }
    }

    emit('reservation:updated', updated)
    res.json(updated)
  })

  router.patch('/restaurants/:slug/reservations/:id/cancel', (req, res) => {
    const reservation = store.reservations.get(req.params.id)
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' })

    const updated = { ...reservation, status: 'cancelled' as const }
    store.reservations.set(reservation.id, updated)

    emit('reservation:updated', updated)
    res.json(updated)
  })

  // ── Demo Controls ───────────────────────────────────────────────────────
  router.post('/restaurants/:slug/demo/fill', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const tables = store.getRestaurantTables(r.id)
    let filled = 0
    const now = new Date()
    const end = new Date(now.getTime() + 90 * 60000)

    for (const table of tables) {
      if (table.status !== 'free') continue
      const updated = {
        ...table,
        status: 'occupied' as const,
        session: { startTime: now.toISOString(), expectedEndTime: end.toISOString(), orderId: '', paymentStatus: 'unpaid' as const },
      }
      store.tables.set(table.id, updated)
      emit('table:updated', updated)
      filled++
    }

    res.json({ filled, totalTables: tables.length })
  })

  router.post('/restaurants/:slug/demo/reset', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const tables = store.getRestaurantTables(r.id)
    let tablesReset = 0
    for (const table of tables) {
      if (table.status === 'free') continue
      const updated = { ...table, status: 'free' as const, session: undefined }
      store.tables.set(table.id, updated)
      emit('table:updated', updated)
      tablesReset++
    }

    let ordersCleared = 0
    for (const [id, order] of store.orders) {
      if (order.restaurantId === r.id) { store.orders.delete(id); ordersCleared++ }
    }

    let reservationsCleared = 0
    for (const [id, resv] of store.reservations) {
      if (resv.restaurantId === r.id) { store.reservations.delete(id); reservationsCleared++ }
    }

    res.json({ tablesReset, ordersCleared, reservationsCleared })
  })

  // ── Alternative Restaurants ──────────────────────────────────────────────
  router.get('/restaurants/:slug/alternatives', (req, res) => {
    const r = store.getBySlug(req.params.slug)
    if (!r) return res.status(404).json({ error: 'Not found' })

    const partySize = parseInt(req.query.partySize as string) || 2
    const alternatives = Array.from(store.restaurants.values())
      .filter(alt => alt.id !== r.id)
      .map(alt => {
        const wait = getWaitEstimate(alt.id, partySize)
        return { restaurant: alt, waitEstimate: wait }
      })
      .filter(a => a.waitEstimate.estimatedWaitMinutes < 30)

    res.json(alternatives)
  })

  return router
}
