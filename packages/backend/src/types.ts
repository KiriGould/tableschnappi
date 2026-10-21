import type { DishIngredient } from './sustainability'
export type TableStatus = 'free' | 'ordering' | 'occupied' | 'payment_pending' | 'paid' | 'cleaning'
export type PaymentMethod = 'card' | 'twint' | 'cash'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'served'
export type MenuCategory = 'drinks' | 'appetizers' | 'mains' | 'desserts'

export interface Restaurant {
  id: string
  name: string
  nameJa: string
  slug: string
  cuisine: string
  address: string
  priceRange: '$' | '$$' | '$$$'
  coordinates: { lat: number; lng: number }
  phone: string
  settings: RestaurantSettings
}

export interface RestaurantSettings {
  drinkServiceTime: number   // minutes
  foodServiceTime: number    // minutes
  averageDineTime: number    // minutes
  layoutWidth: number        // grid columns
  layoutHeight: number       // grid rows
}

export interface TablePosition {
  x: number
  y: number
  w: number
  h: number
}

export interface TableSession {
  startTime: string
  expectedEndTime: string
  orderId: string
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
}

export interface Table {
  id: string
  restaurantId: string
  number: number
  seats: number
  position: TablePosition
  status: TableStatus
  session?: TableSession
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  nameJa: string
  category: MenuCategory
  price: number       // in CHF (e.g. 19.50)
  description: string
  imageColor: string  // placeholder bg color
  allergens: string[]
  isAvailable: boolean
  isPopular?: boolean
  spiceLevel?: 0 | 1 | 2 | 3
  preparationTime: number  // minutes
  /** Composition, used for seasonality and the footprint estimate. */
  ingredients?: DishIngredient[]
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

export interface Reservation {
  id: string
  restaurantId: string
  tableId?: string
  customerName: string
  partySize: number
  phone?: string
  email?: string
  requestedTime: string
  confirmedTime?: string
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled'
  notes?: string
  createdAt: string
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
