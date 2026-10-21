export type TableStatus = 'free' | 'ordering' | 'occupied' | 'payment_pending' | 'paid' | 'cleaning'
export type PaymentMethod = 'card' | 'twint' | 'cash'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid'
// Mirrors the backend's OrderStatus exactly. It used to carry an extra
// 'serving' the backend never emits, so any UI keyed on it was dead.
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'served'
export type MenuCategory = 'drinks' | 'appetizers' | 'mains' | 'desserts'

export interface Restaurant {
  id: string
  name: string
  nameJa: string
  slug: string
  cuisine: string
  address: string
  priceRange: string
  coordinates: { lat: number; lng: number }
  phone: string
  settings: { drinkServiceTime: number; foodServiceTime: number; averageDineTime: number; layoutWidth: number; layoutHeight: number }
}

export interface Table {
  id: string
  restaurantId: string
  number: number
  seats: number
  position: { x: number; y: number; w: number; h: number }
  status: TableStatus
  session?: {
    startTime: string
    expectedEndTime: string
    orderId: string
    paymentStatus: PaymentStatus
    paymentMethod?: PaymentMethod
  }
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  nameJa: string
  category: MenuCategory
  price: number
  description: string
  imageColor: string
  allergens: string[]
  isAvailable: boolean
  /** Set by the backend: this dish matches the current sekki's seasonal keywords. */
  inSeason?: boolean
  /** Seasonality in Europe plus a sourced footprint estimate. See Sustainability. */
  sustainability?: Sustainability
  isPopular?: boolean
  spiceLevel?: 0 | 1 | 2 | 3
  preparationTime: number
}

export interface OrderItem {
  menuItemId: string
  name: string
  nameJa: string
  quantity: number
  price: number
  type: 'food' | 'drink'
  preparationTime: number
}

export interface Order {
  id: string
  tableId: string
  tableNumber: number
  restaurantId: string
  items: OrderItem[]
  status: OrderStatus
  totalAmount: number
  paymentMethod?: PaymentMethod
  paymentStatus: PaymentStatus
  notes?: string
  createdAt: string
  updatedAt: string
  estimatedServeTime: string
}

export interface WaitEstimate {
  restaurantId: string
  estimatedWaitMinutes: number
  confidence: 'low' | 'medium' | 'high'
  freeTableCount: number
  totalTableCount: number
  nextFreeAt?: string
  message: string
  availableSizes: number[]
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
}

export interface ToolCallInfo {
  name: string
  args: Record<string, unknown>
  result: string
}

/** Current Japanese solar term (節気), from GET /api/sekki/current. */
export interface SekkiInfo {
  number: number
  kanji: string
  romaji: string
  english: string
  startMonth: number
  startDay: number
  seasonalKeywords: string[]
}

/**
 * Seasonality and footprint for one dish, from the backend.
 *
 * co2eKg is an ESTIMATE: published per-kilogram emission factors
 * (Poore & Nemecek 2018) multiplied by approximate portion weights. It is not
 * a measurement of this dish, and any UI showing it must say so.
 *
 * europeanSeason is deliberately separate from `inSeason`: the latter is the
 * Japanese sekki calendar the kitchen cooks to, this is whether the ingredient
 * is actually in season where the restaurant stands.
 */
export interface Sustainability {
  co2eKg: number
  co2eBand: 'low' | 'medium' | 'high'
  europeanSeason: 'peak' | 'in-season' | 'out-of-season' | 'year-round'
  seasonNote: string
}

/** One dish's performance in the sales dashboard. */
export interface DishPerformance {
  menuItemId: string
  name: string
  nameJa: string
  units: number
  revenue: number
  revenueShare: number
  relativeVolume: number
  inSeason: boolean
  europeanSeason: string
  co2eKg: number
  neverOrdered: boolean
}

/** GET /api/restaurants/:slug/analytics */
export interface Analytics {
  generatedAt: string
  orders: number
  covers: number
  revenue: number
  avgOrderValue: number
  itemsSold: number
  dishes: DishPerformance[]
  seasonalMix: { inSeason: number; outOfSeason: number; yearRound: number }
  footprint: {
    totalKg: number
    avgPerDishKg: number
    menuAvgPerDishKg: number
    deltaVsMenuPct: number
  }
}
