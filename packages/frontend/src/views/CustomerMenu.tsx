import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Minus, Plus, X, CreditCard, Smartphone, Banknote, CheckCircle, ChefHat, Clock, Sparkles, MessageSquare } from 'lucide-react'
import { api } from '../api'
import { MenuItem, CartItem, Restaurant, Table, MenuCategory, PaymentMethod, Order, OrderStatus, Sustainability } from '../types'
import { SekkiWidget, ShunBadge } from '../components/SekkiWidget'
import { ChatWidget } from '../components/ChatWidget'
import { useSocket } from '../hooks/useSocket'

// The backend already emits order:updated on every status change and the staff
// dashboard consumes it, but the guest saw a frozen "preparing..." forever.
// These are the stages an order actually moves through, in order.
const ORDER_STAGES: { key: OrderStatus; label: string; hint: string }[] = [
  { key: 'pending',   label: 'Received',  hint: 'The kitchen has your order' },
  { key: 'confirmed', label: 'Confirmed', hint: 'Accepted by the kitchen' },
  { key: 'preparing', label: 'Preparing', hint: 'Being cooked now' },
  { key: 'served',    label: 'Served',    hint: 'Enjoy your meal' },
]

// Same watermark the homepage hero uses, so the two screens read as one world.
const KANJI_WATERMARK: Record<string, string> = { sakura: '桜', koi: '鯉' }
const VIBE: Record<string, { accent: string; glow: string }> = {
  sakura: { accent: '#ff2d75', glow: 'rgba(255,45,117,0.5)' },
  koi:    { accent: '#00c6ff', glow: 'rgba(0,198,255,0.5)' },
}

const CATEGORIES: { key: MenuCategory; label: string; ja: string }[] = [
  { key: 'drinks',     label: 'Drinks',     ja: '飲み物' },
  { key: 'appetizers', label: 'Appetizers', ja: '前菜' },
  { key: 'mains',      label: 'Mains',      ja: 'メイン' },
  { key: 'desserts',   label: 'Desserts',   ja: 'デザート' },
]

const FOOD_EMOJI: Record<string, string> = {
  'Tonkotsu Ramen': '🍜', 'Chicken Katsu Curry': '🍛', 'Salmon Teriyaki': '🐟',
  'Vegetable Udon': '🍜', 'Chirashi Bowl': '🍣', 'Edamame': '🫛',
  'Gyoza (6 pcs)': '🥟', 'Takoyaki (6 pcs)': '🐙', 'Miso Soup': '🥣',
  'Mochi Ice Cream (3 pcs)': '🍡', 'Matcha Tiramisu': '🍰', 'Matcha Latte': '🍵',
  'Yuzu Lemonade': '🍋', 'Sapporo Beer': '🍺', 'Jasmine Tea': '🍵',
  'Sake Selection': '🍶', 'Shoyu Ramen': '🍜', 'Spicy Miso Ramen': '🌶️',
  'Green Tea': '🍵',
}

function SpiceIndicator({ level }: { level?: number }) {
  if (!level) return null
  return <span className="ml-1 text-xs">{'🌶'.repeat(level)}</span>
}

function PopularBadge() {
  return (
    <span className="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: '#ff2d75', boxShadow: '0 0 8px rgba(255,45,117,0.4)' }}>
      人気
    </span>
  )
}

const SEASON_STYLE: Record<Sustainability['europeanSeason'], { label: string; color: string; bg: string }> = {
  'peak':          { label: 'at its peak',   color: '#7ddf7d', bg: 'rgba(125,223,125,0.12)' },
  'in-season':     { label: 'in season',     color: '#7ddf7d', bg: 'rgba(125,223,125,0.12)' },
  'out-of-season': { label: 'out of season', color: '#ffb74d', bg: 'rgba(255,183,77,0.12)' },
  'year-round':    { label: 'year-round',    color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' },
}

const BAND_COLOR = { low: '#7ddf7d', medium: '#ffb74d', high: '#ff2d75' } as const

function SustainabilityLine({ s }: { s: Sustainability }) {
  const season = SEASON_STYLE[s.europeanSeason]
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
        style={{ background: season.bg, color: season.color }} title={s.seasonNote}>
        {season.label}
      </span>
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.05)', color: BAND_COLOR[s.co2eBand] }}
        title={`Estimated ${s.co2eKg} kg CO2e per portion. Published emission factors (Poore & Nemecek 2018) applied to approximate portion weights — an estimate, not a measurement of this dish.`}>
        ~{s.co2eKg} kg CO₂e
      </span>
    </div>
  )
}

function MenuItemCard({ item, qty, onAdd, onRemove }: {
  item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void
}) {
  const emoji = FOOD_EMOJI[item.name] || (item.category === 'drinks' ? '🍵' : '🍽️')

  return (
    <div className="bg-jp-card rounded-xl overflow-hidden flex gap-3 p-3 fade-in transition-all"
      style={{ border: `1px solid ${item.inSeason ? 'rgba(255,183,77,0.35)' : '#2a2a3e'}` }}
      onMouseEnter={e => {
        // Amber for a dish at its seasonal peak, the house pink otherwise.
        const glow = item.inSeason ? '255,183,77' : '255,45,117'
        e.currentTarget.style.border = `1px solid rgba(${glow},0.55)`
        e.currentTarget.style.boxShadow = `0 0 22px rgba(${glow},0.18)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = `1px solid ${item.inSeason ? 'rgba(255,183,77,0.35)' : '#2a2a3e'}`
        e.currentTarget.style.boxShadow = 'none'
      }}>
      <div className="relative w-24 h-24 rounded-lg flex-shrink-0 flex items-center justify-center text-3xl"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, ${item.imageColor}25 0%, transparent 70%),
            linear-gradient(180deg, #1a1a2a 0%, #0d0818 100%)
          `,
          border: `1px solid ${item.imageColor}22`,
        }}>
        <div className="absolute inset-0 retro-grid opacity-40 pointer-events-none" />
        <span className="relative text-4xl drop-shadow-lg hero-float">{emoji}</span>
        {item.isPopular && <PopularBadge />}
        {item.inSeason && (
          <span className="absolute top-2 right-2"><ShunBadge /></span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-jp-text leading-tight">{item.name}</p>
            <p className="text-jp-muted text-xs mb-1">{item.nameJa}<SpiceIndicator level={item.spiceLevel} /></p>
            <p className="text-jp-muted text-xs leading-snug line-clamp-2">{item.description}</p>
          </div>
          <p className="font-bold text-sm whitespace-nowrap" style={{ color: '#ffd700' }}>
            CHF {item.price.toFixed(2)}
          </p>
        </div>

        {/* Two different claims, kept visibly apart: where the ingredient
            stands in the European growing year, and a sourced estimate of
            this portion's footprint. Neither is a measurement of this dish. */}
        {item.sustainability && <SustainabilityLine s={item.sustainability} />}

        <div className="flex items-center justify-between mt-2">
          <span className="flex items-center gap-1 text-jp-muted text-xs font-mono">
            <Clock size={10} /> {item.preparationTime}min
          </span>
          {qty === 0 ? (
            <button onClick={onAdd} disabled={!item.isAvailable}
              className="text-white rounded-full px-4 py-1 text-sm font-semibold transition-all disabled:opacity-40"
              style={item.isAvailable
                ? { background: 'linear-gradient(135deg, #ff2d75, #9d4edd)', boxShadow: '0 0 10px rgba(255,45,117,0.3)' }
                : { background: '#2a2a3e' }
              }>
              {item.isAvailable ? 'Add' : 'Sold out'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={onRemove} className="w-7 h-7 rounded-full bg-jp-border hover:bg-neon-pink flex items-center justify-center transition-colors">
                <Minus size={14} />
              </button>
              <span className="w-5 text-center font-bold font-mono" style={{ color: '#00f0ff' }}>{qty}</span>
              <button onClick={onAdd} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: '#ff2d75' }}>
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type Stage = 'menu' | 'review' | 'payment' | 'twint' | 'waiting' | 'confirmed'

function PaymentModal({ cart, onClose, onPay, table }: {
  cart: CartItem[]; onClose: () => void; onPay: (method: PaymentMethod) => void; table: Table
}) {
  const [stage, setStage] = useState<Stage>('review')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const total = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)

  const handlePay = () => {
    if (!selectedMethod) return
    if (selectedMethod === 'twint') { setStage('twint'); return }
    if (selectedMethod === 'cash') { setStage('waiting'); onPay('cash'); return }
    setStage('confirmed')
    onPay('card')
  }

  const handleTwintConfirm = () => {
    setStage('confirmed')
    onPay('twint')
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-jp-surface w-full max-w-md rounded-2xl animate-slide-up"
        style={{ border: '1px solid rgba(255,45,117,0.3)', boxShadow: '0 0 40px rgba(255,45,117,0.1)' }}>

        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,45,117,0.15)' }}>
          <h2 className="font-bold text-lg gradient-text">
            {stage === 'review'    && 'Order Summary'}
            {stage === 'payment'   && 'Choose Payment'}
            {stage === 'twint'     && 'TWINT Payment'}
            {stage === 'waiting'   && 'Calling Waiter…'}
            {stage === 'confirmed' && 'Payment Confirmed!'}
          </h2>
          {(stage === 'review' || stage === 'payment') && (
            <button onClick={onClose} className="text-jp-muted hover:text-neon-pink transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-4">
          {stage === 'review' && (
            <>
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {cart.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex justify-between text-sm">
                    <span className="text-jp-muted">{quantity}× {menuItem.name}</span>
                    <span className="text-jp-text font-mono">CHF {(menuItem.price * quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 flex justify-between font-bold text-lg mb-4" style={{ borderTop: '1px solid rgba(255,45,117,0.15)' }}>
                <span>Total</span>
                <span style={{ color: '#ffd700' }}>CHF {total.toFixed(2)}</span>
              </div>
              <button onClick={() => setStage('payment')}
                className="w-full text-white rounded-xl py-3 font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #ff2d75, #ff8a4c)', boxShadow: '0 0 15px rgba(255,45,117,0.3)' }}>
                Proceed to Payment &rarr;
              </button>
            </>
          )}

          {stage === 'payment' && (
            <>
              <p className="text-jp-muted text-sm mb-4 font-mono">table_{table.number} // CHF {total.toFixed(2)}</p>
              <div className="space-y-3 mb-4">
                {[
                  { method: 'card' as PaymentMethod, icon: <CreditCard size={22} />, label: 'Pay by Card', sub: 'Visa, Mastercard, AMEX' },
                  { method: 'twint' as PaymentMethod, icon: <Smartphone size={22} />, label: 'TWINT', sub: 'Swiss mobile payment' },
                  { method: 'cash' as PaymentMethod, icon: <Banknote size={22} />, label: 'Cash – Call Waiter', sub: 'Pay at the table' },
                ].map(({ method, icon, label, sub }) => (
                  <button key={method} onClick={() => setSelectedMethod(method)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl transition-all"
                    style={{
                      background: selectedMethod === method ? 'rgba(255,45,117,0.08)' : '#1a1a2a',
                      border: selectedMethod === method ? '1px solid rgba(255,45,117,0.4)' : '1px solid #2a2a3e',
                      boxShadow: selectedMethod === method ? '0 0 15px rgba(255,45,117,0.1)' : 'none',
                    }}>
                    <div style={{ color: selectedMethod === method ? '#ff2d75' : '#9090a0' }}>{icon}</div>
                    <div className="text-left">
                      <p className="font-semibold text-jp-text">{label}</p>
                      <p className="text-jp-muted text-xs">{sub}</p>
                    </div>
                    {selectedMethod === method && (
                      <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ff2d75', boxShadow: '0 0 8px rgba(255,45,117,0.4)' }}>
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={handlePay} disabled={!selectedMethod}
                className="w-full disabled:opacity-40 text-white rounded-xl py-3 font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #ff2d75, #9d4edd)', boxShadow: '0 0 15px rgba(255,45,117,0.3)' }}>
                Confirm Payment
              </button>
            </>
          )}

          {stage === 'twint' && (
            <div className="text-center py-4">
              <div className="w-40 h-40 mx-auto bg-white rounded-xl flex items-center justify-center mb-4 relative">
                <div className="grid grid-cols-8 gap-0.5 w-28 h-28">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className="rounded-sm"
                      style={{ backgroundColor: (i * 7 + i * i) % 3 === 0 ? '#000' : '#fff', aspectRatio: '1' }} />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-[#00B4F0] text-white text-xs font-bold px-2 py-1 rounded">TWINT</div>
                </div>
              </div>
              <p className="text-jp-text font-bold text-xl mb-1 font-mono" style={{ color: '#ffd700' }}>CHF {total.toFixed(2)}</p>
              <p className="text-jp-muted text-sm mb-6">Scan with your TWINT app</p>
              <button onClick={handleTwintConfirm}
                className="w-full bg-[#00B4F0] hover:bg-[#0090c0] text-white rounded-xl py-3 font-bold transition-colors">
                I've paid with TWINT
              </button>
            </div>
          )}

          {stage === 'waiting' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,138,76,0.15)' }}>
                <ChefHat size={32} style={{ color: '#ff8a4c' }} />
              </div>
              <p className="font-bold text-xl mb-2 gradient-text">Waiter on the way!</p>
              <p className="text-jp-muted text-sm">Your waiter will come to collect payment shortly.</p>
              <p className="font-bold text-lg mt-4" style={{ color: '#ffd700' }}>Total: CHF {total.toFixed(2)}</p>
              <button onClick={onClose} className="mt-6 text-jp-muted text-sm underline hover:text-neon-pink transition-colors">Close</button>
            </div>
          )}

          {stage === 'confirmed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,240,255,0.15)' }}>
                <CheckCircle size={32} style={{ color: '#00f0ff' }} />
              </div>
              <p className="font-bold text-xl mb-2 neon-text-cyan" style={{ color: '#00f0ff' }}>Payment Confirmed!</p>
              <p className="text-jp-muted text-sm">Thank you for dining with us.</p>
              <p className="text-jp-muted text-sm mt-1">またお越しください</p>
              <button onClick={onClose} className="mt-6 w-full bg-jp-card rounded-xl py-3 text-jp-muted hover:text-jp-text transition-colors"
                style={{ border: '1px solid #2a2a3e' }}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CustomerMenu() {
  const { slug, tableNumber } = useParams<{ slug: string; tableNumber: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [table, setTable] = useState<Table | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [placedCart, setPlacedCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('mains')
  const [showModal, setShowModal] = useState(false)
  // A table places several orders across a sitting — another round of
  // drinks is a new order, not an edit of the first one.
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [orderConfirmed, setOrderConfirmed] = useState(false)
  const [notes, setNotes] = useState('')
  // Live status, driven by order:updated over Socket.IO.
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('pending')
  // Per-item requests ("no coriander"), keyed by menu item id.
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [seasonOnly, setSeasonOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug || !tableNumber) return
    Promise.all([api.getRestaurant(slug), api.getMenu(slug), api.getTables(slug)])
      .then(([rest, menuItems, tables]) => {
        setRestaurant(rest)
        setMenu(menuItems)
        const t = tables.find(t => t.number === parseInt(tableNumber))
        setTable(t || null)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [slug, tableNumber])

  // Only react to our own order. The socket is restaurant-wide, so every
  // table's updates arrive here.
  useSocket(slug ?? null, {
    'order:updated': (data: unknown) => {
      const o = data as Order
      if (o?.id && orderIds.includes(o.id) && o.status) setOrderStatus(o.status)
    },
  })

  const cartQty = (itemId: string) => cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)
  const totalPrice = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)
  // What has actually been ordered and is owed. Pay Now used to show
  // totalPrice, which is the *cart* — emptied on placing an order, so the
  // button read CHF 0.00, and after adding a drink it showed only the drink.
  const placedTotal = placedCart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id)
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItem: item, quantity: 1 }]
    })
  }

  const removeFromCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id)
      if (!existing || existing.quantity === 1) return prev.filter(c => c.menuItem.id !== item.id)
      return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const handlePay = async (method: PaymentMethod) => {
    if (orderIds.length === 0 || !slug) return
    // Pay every round placed at this table, not only the most recent —
    // the bill is for the sitting.
    await Promise.all(orderIds.map(id =>
      api.payOrder(slug, id, method).catch(() => { /* optimistic */ })
    ))
  }

  const placeOrder = async () => {
    if (!slug || !table || cart.length === 0) return
    const items = cart.map(c => ({
      menuItemId: c.menuItem.id,
      name: c.menuItem.name, nameJa: c.menuItem.nameJa,
      quantity: c.quantity, price: c.menuItem.price,
      type: c.menuItem.category === 'drinks' ? 'drink' as const : 'food' as const,
      preparationTime: c.menuItem.preparationTime,
    }))
    try {
      // Per-item requests are folded into the order note, which is what the
      // kitchen view already displays — no backend change needed.
      const perItem = cart
        .filter(c => itemNotes[c.menuItem.id]?.trim())
        .map(c => `${c.menuItem.name}: ${itemNotes[c.menuItem.id].trim()}`)
      const combined = [notes.trim(), ...perItem].filter(Boolean).join(' · ')

      const res = await api.placeOrder(slug, table.id, items, undefined, combined || undefined)
      setOrderIds(prev => [...prev, res.order.id])
      setPlacedCart(prev => [...prev, ...cart])
      setOrderConfirmed(true)
      setOrderStatus('pending')
      setCart([])
      setItemNotes({})
      setNoteFor(null)
      setShowModal(true)
    } catch (e: unknown) {
      alert('Failed to place order: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const vibe = VIBE[slug ?? ''] ?? VIBE.sakura
  const [sekkiLabel, setSekkiLabel] = useState('SEASONAL')
  useEffect(() => {
    api.getSekki().then(sk => setSekkiLabel(`${sk.kanji} ${sk.romaji.toUpperCase()}`)).catch(() => {})
  }, [])

  const filteredMenu = useMemo(
    () => menu.filter(m => m.category === activeCategory && (!seasonOnly || m.inSeason)),
    [menu, activeCategory, seasonOnly]
  )
  // The backend tags each dish with inSeason against the current sekki's
  // keywords; this surfaces that as something you can actually filter on.
  const seasonCount = useMemo(() => menu.filter(m => m.inSeason).length, [menu])

  if (loading) return (
    <div className="min-h-screen bg-jp-bg flex items-center justify-center">
      <div className="neon-text animate-pulse text-lg" style={{ color: '#ff2d75' }}>Loading menu...</div>
    </div>
  )

  if (error || !restaurant) return (
    <div className="min-h-screen bg-jp-bg flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl">🍜</div>
      <p className="text-jp-text font-bold text-xl gradient-text">Restaurant not found</p>
      <p className="text-jp-muted text-sm">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-jp-bg flex flex-col max-w-lg mx-auto crt-flicker">
      {/* Scanline overlay */}
      <div className="fixed inset-0 z-[60] scanlines pointer-events-none" />

      {/* Header */}
      {/* Status ticker, echoing the homepage's LIVE_DEMO strip. */}
      <div className="px-4 py-1.5 text-[10px] font-mono"
        style={{ background: '#0d0d18', borderBottom: `1px solid ${vibe.accent}22` }}>
        <span className="neon-text font-bold" style={{ color: vibe.accent }}>TABLE_{tableNumber}</span>
        {' // '}
        <span style={{ color: '#00f0ff' }}>ORDERING</span>
        {' · '}
        <span style={{ color: '#9d4edd' }}>{sekkiLabel}</span>
        {orderConfirmed && <><span> · </span><span style={{ color: '#ffd700' }}>ORDER_PLACED</span></>}
      </div>

      <header className="relative px-4 pt-safe-top sticky top-0 z-10 washi-texture overflow-hidden"
        style={{
          borderBottom: `1px solid ${vibe.accent}33`,
          background: `radial-gradient(ellipse at 20% 0%, ${vibe.accent}22 0%, transparent 55%), radial-gradient(ellipse at 85% 10%, ${vibe.accent}14 0%, transparent 45%), var(--color-jp-surface)`,
        }}>
        {/* Perspective grid floor and giant kanji, straight from the hero. */}
        <div className="absolute bottom-0 left-0 right-0 h-24 retro-grid pointer-events-none"
          style={{ perspective: '300px', transform: 'rotateX(45deg)', transformOrigin: 'bottom' }} />
        <span className="absolute -right-2 -top-6 text-[9rem] font-bold leading-none select-none pointer-events-none"
          style={{ color: vibe.accent, opacity: 0.07, textShadow: `0 0 60px ${vibe.glow}` }}>
          {KANJI_WATERMARK[slug ?? ''] || '食'}
        </span>

        <div className="relative pt-6 pb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-black leading-none gradient-text neon-text truncate">{restaurant.name}</h1>
            <p className="text-lg font-light neon-text-cyan mt-1" style={{ color: '#00f0ff' }}>{restaurant.nameJa}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold hero-float neon-border-cyan"
              style={{ background: 'rgba(0,240,255,0.1)', color: '#00f0ff' }}>
              TABLE {tableNumber}
            </span>
            <p className="text-xs font-semibold font-mono mt-1" style={{ color: '#ffd700' }}>{restaurant.priceRange}</p>
          </div>
        </div>

        <div className="mb-2"><SekkiWidget /></div>

        {/* Category tabs */}
        {/* The strip scrolls; without a fade the last tab just looks cut
            off mid-word rather than continuing. */}
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-10 z-10"
            style={{ background: 'linear-gradient(90deg, transparent, #12121e)' }} />
        <div className="flex gap-1 pb-3 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeCategory === cat.key ? 'neon-pulse' : ''}`}
              style={activeCategory === cat.key
                ? { background: 'linear-gradient(135deg, #ff2d75, #9d4edd)', color: 'white', boxShadow: '0 0 18px rgba(255,45,117,0.45)' }
                : { background: '#1a1a2a', color: '#9090a0', border: '1px solid #2a2a3e' }
              }>
              <span className="mr-1 text-xs">{cat.ja}</span>
              {cat.label}
            </button>
          ))}
        </div>
        </div>
      </header>

      {/* Order confirmed banner */}
      {orderConfirmed && !showModal && (() => {
        const idx = Math.max(ORDER_STAGES.findIndex(st => st.key === orderStatus), 0)
        const stage = ORDER_STAGES[idx]
        const done = orderStatus === 'served'
        return (
          <div className="px-4 py-3"
            style={{ background: 'rgba(0,240,255,0.05)', borderBottom: '1px solid rgba(0,240,255,0.2)' }}>
            <div className="flex items-center gap-3 mb-2">
              {done
                ? <CheckCircle size={18} style={{ color: '#00f0ff' }} className="flex-shrink-0" />
                : <ChefHat size={18} style={{ color: '#00f0ff' }} className="flex-shrink-0 neon-pulse" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#00f0ff' }}>{stage.label}</p>
                <p className="text-jp-muted text-xs font-mono truncate">{stage.hint}</p>
              </div>
              <button onClick={() => setShowModal(true)}
                className="ml-auto text-xs underline flex-shrink-0" style={{ color: '#00f0ff' }}>Pay now</button>
            </div>

            {/* Live progress. Updates arrive over Socket.IO as staff move the
                order along, so the guest is not left staring at "preparing". */}
            <div className="flex items-center gap-1">
              {ORDER_STAGES.map((st, i) => (
                <div key={st.key} className="flex-1 flex items-center gap-1">
                  <div className="flex-1 h-1 rounded-full transition-all duration-700" style={{
                    background: i <= idx ? '#00f0ff' : 'rgba(255,255,255,0.12)',
                    boxShadow: i === idx && !done ? '0 0 8px rgba(0,240,255,0.6)' : 'none',
                  }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {ORDER_STAGES.map((st, i) => (
                <span key={st.key} className="text-[9px] font-mono"
                  style={{ color: i <= idx ? '#00f0ff' : 'rgba(255,255,255,0.3)' }}>{st.label}</span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Menu list */}
      <main className="flex-1 p-4 space-y-3 pb-36">
        <p className="text-[10px] font-mono tracking-widest text-jp-muted">
          MENU // {CATEGORIES.find(c => c.key === activeCategory)?.label.toUpperCase()}
        </p>

        {seasonCount > 0 && (
          <button onClick={() => setSeasonOnly(v => !v)}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
            style={{
              background: seasonOnly ? 'rgba(255,183,77,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${seasonOnly ? 'rgba(255,183,77,0.45)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            <Sparkles size={13} style={{ color: '#ffb74d' }} />
            <span className="text-xs font-mono" style={{ color: seasonOnly ? '#ffb74d' : undefined }}>
              {seasonOnly ? 'Showing seasonal only' : `${seasonCount} dish${seasonCount === 1 ? '' : 'es'} at their peak right now`}
            </span>
            <span className="ml-auto text-[10px] font-mono text-jp-muted">{seasonOnly ? 'show all' : 'filter'}</span>
          </button>
        )}

        {filteredMenu.length === 0 ? (
          <p className="text-jp-muted text-center py-12 font-mono">
            {seasonOnly ? '// nothing seasonal in this category' : '// empty category'}
          </p>
        ) : filteredMenu.map(item => (
          <div key={item.id}>
            <MenuItemCard item={item}
              qty={cartQty(item.id)} onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item)} />

            {/* Special requests, only once the dish is actually in the cart. */}
            {cartQty(item.id) > 0 && (
              noteFor === item.id ? (
                <input
                  autoFocus
                  value={itemNotes[item.id] ?? ''}
                  onChange={e => setItemNotes(n => ({ ...n, [item.id]: e.target.value }))}
                  onBlur={() => setNoteFor(null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setNoteFor(null) }}
                  placeholder="no coriander, extra spicy, allergy…"
                  maxLength={120}
                  className="w-full mt-1 bg-jp-bg rounded-lg px-3 py-2 text-xs font-mono outline-none"
                  style={{ border: '1px solid rgba(255,45,117,0.35)' }} />
              ) : (
                <button onClick={() => setNoteFor(item.id)}
                  className="mt-1 ml-1 text-[10px] font-mono flex items-center gap-1 transition-colors"
                  style={{ color: itemNotes[item.id]?.trim() ? '#ffb74d' : 'rgba(255,255,255,0.35)' }}>
                  <MessageSquare size={10} />
                  {itemNotes[item.id]?.trim() ? itemNotes[item.id] : 'add a note'}
                </button>
              )
            )}
          </div>
        ))}

        {cart.length > 0 && (
          <div className="bg-jp-card rounded-xl p-3" style={{ border: '1px solid rgba(157,78,221,0.2)' }}>
            <p className="text-jp-muted text-xs mb-2 font-mono">special_requests</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. No peanuts, extra spicy..."
              className="w-full bg-jp-bg text-jp-text text-sm rounded-lg p-2 resize-none focus:outline-none h-16"
              style={{ border: '1px solid #2a2a3e' }}
              onFocus={e => e.target.style.border = '1px solid rgba(255,45,117,0.4)'}
              onBlur={e => e.target.style.border = '1px solid #2a2a3e'}
            />
          </div>
        )}
      </main>

      {/* Order tray */}
      {/* One bar, both jobs. Previously "Place Order" was hidden once an order
          existed, so a second round of drinks went into a cart with no way to
          submit it — and Pay Now showed the cart total, which was zero. */}
      {!showModal && (cart.length > 0 || orderConfirmed) && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-jp-bg/95 backdrop-blur space-y-2"
          style={{ borderTop: '1px solid rgba(255,45,117,0.2)' }}>

          {cart.length > 0 && (
            <button onClick={placeOrder}
              className="w-full text-white rounded-2xl py-4 flex items-center justify-between px-6 transition-all"
              style={{ background: 'linear-gradient(135deg, #ff2d75, #9d4edd)', boxShadow: '0 0 25px rgba(255,45,117,0.3)' }}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                  <ShoppingCart size={16} />
                </div>
                <span className="font-bold text-base font-mono">
                  {orderConfirmed ? `Add to Order (${totalItems})` : `Place Order (${totalItems})`}
                </span>
              </div>
              <span className="font-bold text-lg">CHF {totalPrice.toFixed(2)}</span>
            </button>
          )}

          {orderConfirmed && (
            <button onClick={() => setShowModal(true)}
              className="w-full text-white rounded-2xl py-3 flex items-center justify-center gap-3 transition-all font-bold"
              style={{ background: 'linear-gradient(135deg, #00f0ff, #9d4edd)', boxShadow: '0 0 20px rgba(0,240,255,0.3)' }}>
              <CreditCard size={18} />
              Pay Now · CHF {placedTotal.toFixed(2)}
              {cart.length > 0 && (
                <span className="text-[10px] font-mono font-normal opacity-80">(excl. the {totalItems} above)</span>
              )}
            </button>
          )}
        </div>
      )}

      {showModal && table && (
        <PaymentModal
          cart={orderConfirmed ? placedCart : cart}  /* the full bill, every round */
          table={table}
          onClose={() => setShowModal(false)}
          onPay={handlePay}
        />
      )}

      {/* The assistant, with table context. Passing `table` means every MLflow
          trace from this conversation is tagged with where it happened, so you
          can tell a question asked at table 7 from one asked on the booking
          page. */}
      {slug && <ChatWidget slug={slug} table={table?.number} />}
    </div>
  )
}
