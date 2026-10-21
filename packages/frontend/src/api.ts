import { Restaurant, Table, MenuItem, Order, WaitEstimate, OrderItem, PaymentMethod, SekkiInfo, Analytics } from './types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** Raw fetch helper for callers that pass a full path (e.g. already including `/api`). */
export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function patch<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  getRestaurants: () => get<Restaurant[]>('/restaurants'),
  getRestaurant: (slug: string) => get<Restaurant>(`/restaurants/${slug}`),
  getTables: (slug: string) => get<Table[]>(`/restaurants/${slug}/tables`),
  getMenu: (slug: string) => get<MenuItem[]>(`/restaurants/${slug}/menu`),
  getAnalytics: (slug: string) => get<Analytics>(`/restaurants/${slug}/analytics`),

  getSekki: () => get<SekkiInfo>(`/sekki/current`),

  getOrders: (slug: string) => get<Order[]>(`/restaurants/${slug}/orders`),
  getWait: (slug: string, partySize = 2) => get<WaitEstimate>(`/restaurants/${slug}/wait?partySize=${partySize}`),
  getAlternatives: (slug: string, partySize = 2) =>
    get<{ restaurant: Restaurant; waitEstimate: WaitEstimate }[]>(`/restaurants/${slug}/alternatives?partySize=${partySize}`),

  placeOrder: (slug: string, tableId: string, items: OrderItem[], paymentMethod?: PaymentMethod, notes?: string) =>
    post<{ order: Order; table: Table }>(`/restaurants/${slug}/orders`, { tableId, items, paymentMethod, notes }),

  payOrder: (slug: string, orderId: string, paymentMethod: PaymentMethod) =>
    post<{ order: Order; table: Table }>(`/restaurants/${slug}/orders/${orderId}/pay`, { paymentMethod }),

  confirmCashPayment: (slug: string, orderId: string) =>
    post<{ order: Order }>(`/restaurants/${slug}/orders/${orderId}/confirm-payment`, {}),

  resetTable: (slug: string, tableId: string) =>
    post<Table>(`/restaurants/${slug}/tables/${tableId}/reset`, {}),

  makeReservation: (slug: string, data: {
    customerName: string; partySize: number; phone?: string; email?: string; requestedTime: string; notes?: string
  }) => post(`/restaurants/${slug}/reservations`, data),

  getReservations: (slug: string) => get<Array<{
    id: string; restaurantId: string; customerName: string; partySize: number;
    phone?: string; requestedTime: string; status: string; tableId?: string; createdAt: string
  }>>(`/restaurants/${slug}/reservations`),

  confirmReservation: (slug: string, id: string, tableId?: string) =>
    patch(`/restaurants/${slug}/reservations/${id}/confirm`, { tableId }),

  seatReservation: (slug: string, id: string) =>
    patch(`/restaurants/${slug}/reservations/${id}/seat`),

  cancelReservation: (slug: string, id: string) =>
    patch(`/restaurants/${slug}/reservations/${id}/cancel`),

  fillRestaurant: (slug: string) =>
    post<{ filled: number; totalTables: number }>(`/restaurants/${slug}/demo/fill`, {}),

  resetDemo: (slug: string) =>
    post<{ tablesReset: number; ordersCleared: number; reservationsCleared: number }>(`/restaurants/${slug}/demo/reset`, {}),
}
