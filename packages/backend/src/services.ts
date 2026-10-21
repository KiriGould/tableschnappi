import { store } from './store'
import { WaitEstimate, Order, Table } from './types'

export function getWaitEstimate(restaurantId: string, partySize = 2): WaitEstimate {
  const restaurant = store.restaurants.get(restaurantId)
  if (!restaurant) throw new Error('Restaurant not found')

  const tables = store.getRestaurantTables(restaurantId)
  const freeTables = tables.filter(t => t.status === 'free')
  const freeForParty = freeTables.filter(t => t.seats >= partySize)
  const totalCount = tables.length

  if (freeForParty.length > 0) {
    return {
      restaurantId, estimatedWaitMinutes: 0, confidence: 'high',
      freeTableCount: freeTables.length, totalTableCount: totalCount,
      message: `${freeForParty.length} table(s) available now`,
      availableSizes: freeForParty.map(t => t.seats),
    }
  }

  // Estimate based on occupied tables' remaining time
  const occupiedTimes = tables
    .filter(t => t.session?.expectedEndTime)
    .map(t => Math.max(0, (new Date(t.session!.expectedEndTime).getTime() - Date.now()) / 60000))
    .filter(mins => mins > 0)
    .sort((a, b) => a - b)

  if (occupiedTimes.length === 0) {
    return {
      restaurantId, estimatedWaitMinutes: restaurant.settings.averageDineTime,
      confidence: 'low', freeTableCount: 0, totalTableCount: totalCount,
      message: 'Estimated wait based on average dine time',
      availableSizes: [],
    }
  }

  const nextFreeMinutes = Math.ceil(occupiedTimes[0])
  const nextFreeAt = new Date(Date.now() + nextFreeMinutes * 60000).toISOString()

  return {
    restaurantId, estimatedWaitMinutes: nextFreeMinutes, confidence: 'medium',
    freeTableCount: 0, totalTableCount: totalCount,
    nextFreeAt, message: `Next table available in ~${nextFreeMinutes} min`,
    availableSizes: [],
  }
}

export function calculateOrderTimes(items: Order['items'], settings: { drinkServiceTime: number; foodServiceTime: number }) {
  const hasFoodItems = items.some(i => i.type === 'food')
  const hasDrinkItems = items.some(i => i.type === 'drink')
  const addedMinutes = hasFoodItems ? settings.foodServiceTime : hasDrinkItems ? settings.drinkServiceTime : 30
  return {
    estimatedServeTime: new Date(Date.now() + addedMinutes * 60000).toISOString(),
    expectedEndTime: new Date(Date.now() + (addedMinutes + 30) * 60000).toISOString(),
    addedMinutes,
  }
}

export function getUrgencyScore(table: Table): number {
  if (!table.session) return 0
  const start = new Date(table.session.startTime).getTime()
  const end = new Date(table.session.expectedEndTime).getTime()
  const now = Date.now()
  if (end <= start) return 0
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}
