import { Restaurant, Table, MenuItem, Order, Reservation } from './types'

class DataStore {
  restaurants = new Map<string, Restaurant>()
  tables = new Map<string, Table>()
  menuItems = new Map<string, MenuItem>()
  orders = new Map<string, Order>()
  reservations = new Map<string, Reservation>()

  getBySlug(slug: string): Restaurant | undefined {
    return Array.from(this.restaurants.values()).find(r => r.slug === slug)
  }

  getRestaurantTables(restaurantId: string): Table[] {
    return Array.from(this.tables.values())
      .filter(t => t.restaurantId === restaurantId)
      .sort((a, b) => a.number - b.number)
  }

  getRestaurantMenu(restaurantId: string): MenuItem[] {
    return Array.from(this.menuItems.values())
      .filter(m => m.restaurantId === restaurantId)
  }

  getActiveOrders(restaurantId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.restaurantId === restaurantId && o.paymentStatus !== 'paid')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  /** Every order for a restaurant, newest first — including paid ones, which
   *  getActiveOrders deliberately excludes. Analytics needs the full history. */
  getAllOrders(restaurantId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  getTableOrders(tableId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.tableId === tableId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

export const store = new DataStore()
