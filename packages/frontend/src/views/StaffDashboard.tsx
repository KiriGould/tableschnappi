import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, Clock, CheckCircle, RefreshCw, DollarSign, AlertTriangle, QrCode, Wifi, Calendar, UserCheck, XCircle, RotateCcw, BarChart3, TrendingDown } from 'lucide-react'
import { api } from '../api'
import { useSocket } from '../hooks/useSocket'
import { Restaurant, Table, Order, TableStatus, Analytics } from '../types'

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string; border: string }> = {
  free:            { label: 'Free',           color: '#22c55e', bg: '#22c55e22', border: '#22c55e44' },
  ordering:        { label: 'Ordering…',      color: '#f59e0b', bg: '#f59e0b22', border: '#f59e0b44' },
  occupied:        { label: 'Occupied',        color: '#ef4444', bg: '#ef444422', border: '#ef444444' },
  payment_pending: { label: 'Paying',          color: '#3b82f6', bg: '#3b82f622', border: '#3b82f644' },
  paid:            { label: 'Paid ✓',          color: '#6b7280', bg: '#6b728022', border: '#6b728044' },
  cleaning:        { label: 'Cleaning',        color: '#94a3b8', bg: '#94a3b822', border: '#94a3b844' },
}

function formatTime(ms: number): string {
  if (ms <= 0) return 'Overdue'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function urgencyColor(pct: number): string {
  if (pct < 50) return '#22c55e'
  if (pct < 75) return '#f59e0b'
  if (pct < 95) return '#ef4444'
  return '#ff0000'
}

function TableCard({ table, orders, reservationName, onReset, onConfirmPay, onClick, selected }: {
  table: Table
  orders: Order[]
  reservationName?: string
  onReset: () => void
  onConfirmPay: () => void
  onClick: () => void
  selected: boolean
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const cfg = STATUS_CONFIG[table.status]
  const remainingMs = table.session ? new Date(table.session.expectedEndTime).getTime() - now : 0
  const elapsedMs = table.session ? now - new Date(table.session.startTime).getTime() : 0
  const totalMs = table.session ? new Date(table.session.expectedEndTime).getTime() - new Date(table.session.startTime).getTime() : 1
  const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
  const tableOrder = orders.find(o => o.tableId === table.id)
  const isUrgent = table.status === 'occupied' && pct > 90

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border cursor-pointer transition-all p-3 ${isUrgent ? 'urgent-pulse' : ''}`}
      style={{
        backgroundColor: selected ? cfg.color + '22' : cfg.bg,
        borderColor: selected ? cfg.color : cfg.border,
        borderWidth: selected ? 2 : 1,
      }}>

      {/* Table number + seats */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-jp-text font-bold text-lg">T{table.number}</span>
          <span className="ml-2 text-jp-muted text-xs">{table.seats}人</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ color: cfg.color, backgroundColor: cfg.color + '22' }}>
          {cfg.label}
        </span>
      </div>

      {reservationName && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-blue-400">
          <Users size={11} />
          <span className="font-medium truncate">{reservationName}</span>
        </div>
      )}

      {/* Timer bar */}
      {table.session && (
        <div className="mb-2">
          <div className="h-1.5 bg-jp-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, backgroundColor: urgencyColor(pct) }} />
          </div>
          <p className="text-xs mt-1" style={{ color: urgencyColor(pct) }}>
            {remainingMs > 0 ? `${formatTime(remainingMs)} left` : 'Time expired'}
          </p>
        </div>
      )}

      {/* Bill amount */}
      {tableOrder && (
        <p className="text-jp-amber text-sm font-bold">
          CHF {tableOrder.totalAmount.toFixed(2)}
        </p>
      )}

      {/* Action buttons */}
      {table.status !== 'free' && (
        <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
          {table.status === 'payment_pending' && tableOrder?.paymentMethod === 'cash' && (
            <button onClick={onConfirmPay}
              className="flex-1 text-xs bg-jp-amber/20 hover:bg-jp-amber/40 text-jp-amber rounded-lg px-2 py-1 transition-colors flex items-center justify-center gap-1">
              <CheckCircle size={12} /> Confirm Cash
            </button>
          )}
          {(table.status === 'paid' || table.status === 'cleaning') && (
            <button onClick={onReset}
              className="flex-1 text-xs bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg px-2 py-1 transition-colors flex items-center justify-center gap-1">
              <RefreshCw size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {/* QR URL hint */}
      {table.status === 'free' && (
        <div className="mt-1 flex items-center gap-1 text-jp-muted text-xs">
          <QrCode size={10} />
          <span className="truncate">/menu/sakura/{table.number}</span>
        </div>
      )}
    </div>
  )
}

function OrderRow({ order, onConfirm }: { order: Order; onConfirm: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const age = Math.floor((now - new Date(order.createdAt).getTime()) / 60000)
  const isOld = age > 20

  return (
    <div className={`bg-jp-card rounded-xl border p-3 mb-2 fade-in ${isOld ? 'border-orange-500/40' : 'border-jp-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-jp-text">Table {order.tableNumber}</span>
        <div className="flex items-center gap-2">
          {isOld && <AlertTriangle size={14} className="text-orange-400" />}
          <span className="text-jp-muted text-xs flex items-center gap-1">
            <Clock size={10} /> {age}m ago
          </span>
        </div>
      </div>

      <div className="space-y-1 mb-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-jp-muted">{item.quantity}× {item.name}</span>
            <span className="text-jp-text">CHF {(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-jp-amber font-bold text-sm">CHF {order.totalAmount.toFixed(2)}</span>
        <div className="flex items-center gap-2">
          {order.paymentStatus === 'unpaid' && (
            <span className="text-xs text-orange-400 flex items-center gap-1">
              <DollarSign size={10} /> Unpaid
            </span>
          )}
          {order.paymentStatus === 'pending' && order.paymentMethod === 'cash' && (
            <button onClick={onConfirm}
              className="text-xs bg-jp-amber/20 hover:bg-jp-amber/40 text-jp-amber px-3 py-1 rounded-full transition-colors font-semibold">
              Confirm Cash ✓
            </button>
          )}
          {order.paymentStatus === 'paid' && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle size={10} /> Paid
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Compact sales headline, linking through to the full analytics page. */
function SalesSummaryCard({ slug }: { slug: string }) {
  const [a, setA] = useState<Analytics | null>(null)
  useEffect(() => {
    const load = () => api.getAnalytics(slug).then(setA).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [slug])
  if (!a) return null

  const top = a.dishes.find(d => d.units > 0)
  const unsold = a.dishes.filter(d => d.neverOrdered).length

  return (
    <Link to={`/dashboard/${slug}`}
      className="flex items-center gap-5 bg-jp-card rounded-xl px-5 py-3 mb-4 transition-all hover:brightness-110"
      style={{ border: '1px solid rgba(255,45,117,0.25)' }}>
      <BarChart3 size={18} style={{ color: '#ff2d75' }} className="flex-shrink-0" />
      <div>
        <p className="text-[10px] font-mono text-jp-muted uppercase tracking-wider">Revenue</p>
        <p className="font-bold" style={{ color: '#ffd700' }}>CHF {a.revenue.toFixed(0)}</p>
      </div>
      {top && (
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-jp-muted uppercase tracking-wider">Best seller</p>
          <p className="text-sm text-jp-text truncate">{top.name} <span className="text-jp-muted font-mono">×{top.units}</span></p>
        </div>
      )}
      {unsold > 0 && (
        <div className="flex items-center gap-1.5">
          <TrendingDown size={13} style={{ color: '#ff8a4c' }} />
          <div>
            <p className="text-[10px] font-mono text-jp-muted uppercase tracking-wider">Not selling</p>
            <p className="text-sm" style={{ color: '#ff8a4c' }}>{unsold} dishes</p>
          </div>
        </div>
      )}
      <span className="ml-auto text-[10px] font-mono flex-shrink-0" style={{ color: '#ff2d75' }}>full report →</span>
    </Link>
  )
}

export default function StaffDashboard() {
  const { slug = 'sakura' } = useParams<{ slug: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [reservations, setReservations] = useState<Array<{
    id: string; customerName: string; partySize: number; requestedTime: string;
    status: string; tableId?: string; createdAt: string
  }>>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const refreshData = useCallback(async () => {
    try {
      const [rest, tbls, ords, resvs] = await Promise.all([
        api.getRestaurant(slug), api.getTables(slug), api.getOrders(slug), api.getReservations(slug)
      ])
      setRestaurant(rest)
      setTables(tbls)
      setOrders(ords)
      setReservations(resvs)
    } catch { /* silently retry */ }
  }, [slug])

  useSocket(slug, {
    'restaurant:state': (data: unknown) => {
      const d = data as { restaurant: Restaurant; tables: Table[]; orders: Order[] }
      setRestaurant(d.restaurant)
      setTables(d.tables)
      setOrders(d.orders)
      setConnected(true)
    },
    'table:updated': (t: unknown) => {
      const table = t as Table
      setTables(prev => prev.map(x => x.id === table.id ? table : x))
    },
    'order:new': (o: unknown) => {
      setOrders(prev => [...prev, o as Order])
    },
    'order:updated': (o: unknown) => {
      const order = o as Order
      setOrders(prev => prev.map(x => x.id === order.id ? order : x).filter(x => x.paymentStatus !== 'paid'))
    },
    'reservation:new': (r: unknown) => {
      setReservations(prev => [...prev, r as typeof prev[0]])
    },
    'reservation:updated': (r: unknown) => {
      const resv = r as { id: string; status: string; [k: string]: unknown }
      setReservations(prev => prev.map(x => x.id === resv.id ? { ...x, ...resv } as typeof x : x))
    },
  })

  useEffect(() => { refreshData() }, [refreshData])

  const handleReset = async (tableId: string) => {
    await api.resetTable(slug, tableId)
    refreshData()
  }

  const handleConfirmPay = async (orderId: string) => {
    await api.confirmCashPayment(slug, orderId)
    refreshData()
  }

  const tableOrders = (tableId: string) => orders.filter(o => o.tableId === tableId)

  const stats = {
    free: tables.filter(t => t.status === 'free').length,
    occupied: tables.filter(t => ['occupied', 'ordering', 'payment_pending'].includes(t.status)).length,
    totalRevenue: orders.reduce((s, o) => s + (o.paymentStatus === 'paid' ? o.totalAmount : 0), 0),
  }

  if (!restaurant) return (
    <div className="min-h-screen bg-jp-bg flex items-center justify-center">
      <div className="text-jp-muted animate-pulse">Loading dashboard…</div>
    </div>
  )

  const layoutW = restaurant.settings.layoutWidth
  const layoutH = restaurant.settings.layoutHeight

  return (
    <div className="min-h-screen bg-jp-bg flex flex-col">
      {/* Header */}
      <header className="bg-jp-surface border-b border-jp-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-jp-text">{restaurant.name} <span className="text-jp-muted text-sm">{restaurant.nameJa}</span></h1>
          <p className="text-jp-muted text-xs">{restaurant.address}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={async () => { await api.fillRestaurant(slug); refreshData() }}
            className="flex items-center gap-1.5 text-xs bg-jp-amber/20 hover:bg-jp-amber/30 text-jp-amber rounded-lg px-3 py-1.5 transition-colors font-medium">
            <Users size={12} /> Fill Restaurant
          </button>
          <button onClick={async () => { await api.resetDemo(slug); refreshData() }}
            className="flex items-center gap-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg px-3 py-1.5 transition-colors font-medium">
            <RotateCcw size={12} /> Reset Demo
          </button>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-jp-muted"><Wifi size={12} className="inline mr-1" />{connected ? 'Live' : 'Offline'}</span>
          </div>
          <button onClick={refreshData} className="text-jp-muted hover:text-jp-text transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-jp-surface border-b border-jp-border px-6 py-3 flex gap-6">
        {[
          { label: 'Free', value: stats.free, color: '#22c55e' },
          { label: 'Occupied', value: stats.occupied, color: '#ef4444' },
          { label: 'Revenue today', value: `CHF ${stats.totalRevenue.toFixed(2)}`, color: '#D4A017' },
        ].map(s => (
          <div key={s.label}>
            <p className="text-jp-muted text-xs">{s.label}</p>
            <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Active orders panel */}
        <aside className="w-72 border-r border-jp-border bg-jp-surface flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-jp-border flex items-center justify-between">
            <h2 className="font-bold text-jp-text">Active Orders</h2>
            <span className="bg-jp-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {orders.filter(o => o.paymentStatus !== 'paid').length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {orders.length === 0 ? (
              <p className="text-jp-muted text-sm text-center py-8">No active orders</p>
            ) : orders.map(order => (
              <OrderRow key={order.id} order={order}
                onConfirm={() => handleConfirmPay(order.id)} />
            ))}
          </div>

          {/* Reservations */}
          <div className="border-t border-jp-border">
            <div className="px-4 py-3 border-b border-jp-border flex items-center justify-between">
              <h2 className="font-bold text-jp-text flex items-center gap-1.5"><Calendar size={14} /> Reservations</h2>
              <span className="bg-jp-amber text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {reservations.filter(r => r.status !== 'cancelled' && r.status !== 'seated').length}
              </span>
            </div>
            <div className="overflow-y-auto p-3 max-h-60">
              {reservations.filter(r => r.status !== 'cancelled').length === 0 ? (
                <p className="text-jp-muted text-sm text-center py-4">No reservations</p>
              ) : reservations.filter(r => r.status !== 'cancelled').map(r => {
                const statusColor = r.status === 'pending' ? '#f59e0b' : r.status === 'confirmed' ? '#3b82f6' : '#22c55e'
                const freeTables = tables.filter(t => t.status === 'free')
                return (
                  <div key={r.id} className="bg-jp-card border border-jp-border rounded-xl p-3 mb-2 fade-in">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-jp-text text-sm">{r.customerName}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44` }}>
                        {r.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-jp-muted mb-2">
                      <span className="flex items-center gap-1"><Users size={10} />{r.partySize}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{r.requestedTime ? new Date(r.requestedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {r.status === 'pending' && (
                        <button onClick={async () => {
                          const tableId = freeTables.length > 0 ? freeTables[0].id : undefined
                          await api.confirmReservation(slug, r.id, tableId)
                          refreshData()
                        }} className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg px-2 py-1 transition-colors">
                          <CheckCircle size={10} /> Confirm
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <button onClick={async () => {
                          await api.seatReservation(slug, r.id)
                          refreshData()
                        }} className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg px-2 py-1 transition-colors">
                          <UserCheck size={10} /> Seat
                        </button>
                      )}
                      {r.status !== 'seated' && (
                        <button onClick={async () => {
                          await api.cancelReservation(slug, r.id)
                          refreshData()
                        }} className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg px-2 py-1 transition-colors">
                          <XCircle size={10} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Right: Table grid */}
        <main className="flex-1 overflow-auto p-6">
          {slug && <SalesSummaryCard slug={slug} />}

          <div className="mb-4">
            <h2 className="font-bold text-jp-text text-lg">Floor Plan</h2>
            <p className="text-jp-muted text-xs mt-0.5">Click a table for details · QR: /menu/{slug}/[number]</p>
          </div>

          {/* Color legend */}
          <div className="flex flex-wrap gap-3 mb-5">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-jp-muted">{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Table grid */}
          <div className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${layoutW}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layoutH}, 100px)`,
              gap: '12px',
              maxWidth: layoutW * 150 + 'px',
            }}>
            {tables.map(table => {
              const pos = table.position
              return (
                <div key={table.id}
                  style={{
                    gridColumn: `${pos.x + 1} / span ${pos.w}`,
                    gridRow: `${pos.y + 1} / span ${pos.h}`,
                  }}>
                  <TableCard
                    table={table}
                    orders={tableOrders(table.id)}
                    reservationName={reservations.find(r => r.tableId === table.id && r.status !== 'cancelled')?.customerName}
                    selected={selectedTable === table.id}
                    onClick={() => setSelectedTable(prev => prev === table.id ? null : table.id)}
                    onReset={() => handleReset(table.id)}
                    onConfirmPay={() => {
                      const o = tableOrders(table.id).find(o => o.paymentStatus === 'pending')
                      if (o) handleConfirmPay(o.id)
                    }}
                  />
                </div>
              )
            })}

            {/* Aisle label */}
            <div style={{ gridColumn: '1 / -1', gridRow: '2 / 3' }}
              className="flex items-center justify-center">
              <div className="h-px bg-jp-border flex-1 opacity-30" />
              <span className="px-4 text-jp-muted text-xs">— Aisle —</span>
              <div className="h-px bg-jp-border flex-1 opacity-30" />
            </div>
          </div>

          {/* Selected table detail */}
          {selectedTable && (() => {
            const t = tables.find(x => x.id === selectedTable)
            const ords = tableOrders(selectedTable)
            if (!t) return null
            const cfg = STATUS_CONFIG[t.status]
            return (
              <div className="mt-6 bg-jp-surface rounded-xl border border-jp-border p-4 max-w-md fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-jp-text text-lg">Table {t.number} Detail</h3>
                  <span className="text-xs px-3 py-1 rounded-full font-semibold"
                    style={{ color: cfg.color, backgroundColor: cfg.color + '22' }}>{cfg.label}</span>
                </div>
                <div className="flex gap-4 text-sm mb-3">
                  <div className="flex items-center gap-1.5 text-jp-muted">
                    <Users size={14} /> {t.seats} seats
                  </div>
                  {t.session && (
                    <div className="flex items-center gap-1.5 text-jp-muted">
                      <Clock size={14} /> Since {new Date(t.session.startTime).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                {ords.length > 0 && (
                  <div className="space-y-1">
                    {ords[0].items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-jp-muted">{item.quantity}× {item.name} ({item.nameJa})</span>
                        <span className="text-jp-text">CHF {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-jp-border flex justify-between font-bold">
                      <span className="text-jp-muted">Total</span>
                      <span className="text-jp-amber">CHF {ords[0].totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <a href={`/menu/${slug}/${t.number}`} target="_blank" rel="noreferrer"
                    className="flex-1 text-center text-xs bg-jp-card border border-jp-border rounded-lg py-2 text-jp-muted hover:text-jp-text transition-colors flex items-center justify-center gap-1">
                    <QrCode size={12} /> Open Menu
                  </a>
                  {(t.status === 'paid' || t.status !== 'free') && (
                    <button onClick={() => handleReset(t.id)}
                      className="flex-1 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg py-2 transition-colors flex items-center justify-center gap-1">
                      <RefreshCw size={12} /> Reset Table
                    </button>
                  )}
                </div>
              </div>
            )
          })()}
        </main>
      </div>
    </div>
  )
}
