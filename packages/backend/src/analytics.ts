/**
 * Sales analytics for the dashboard.
 *
 * Everything here is computed from orders that actually happened. There is
 * deliberately no "CO2 saved" figure: seasonality and the footprint estimate
 * are independent in the model (salmon has the same emission factor whether
 * or not it is in season), and the counterfactual — what a guest would have
 * ordered instead — is unknowable. What can be stated honestly is the
 * footprint of the mix that was actually sold, compared against the menu
 * average, which is a real comparison between two computed numbers.
 *
 * See sustainability.ts for the provenance of the per-dish estimates.
 */
import type { MenuItem, Order } from './types'
import { estimateCo2e, europeanSeasonFor } from './sustainability'

export interface DishPerformance {
  menuItemId: string
  name: string
  nameJa: string
  units: number
  revenue: number
  /** Share of total revenue, 0-1. */
  revenueShare: number
  /** Share of units against the best-selling dish, 0-1 — for bar scaling. */
  relativeVolume: number
  inSeason: boolean
  europeanSeason: string
  co2eKg: number
  /** Dishes on the menu that sold nothing at all in the period. */
  neverOrdered: boolean
}

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
    /** Unweighted mean across the whole menu, the comparison baseline. */
    menuAvgPerDishKg: number
    /** Negative means the sold mix is lighter than the menu average. */
    deltaVsMenuPct: number
  }
}

export function buildAnalytics(menu: MenuItem[], orders: Order[], month: number): Analytics {
  const byId = new Map(menu.map(m => [m.id, m]))

  const units = new Map<string, number>()
  const revenue = new Map<string, number>()
  let totalRevenue = 0
  let itemsSold = 0

  for (const order of orders) {
    for (const line of order.items) {
      const qty = line.quantity ?? 0
      const value = qty * (line.price ?? 0)
      units.set(line.menuItemId, (units.get(line.menuItemId) ?? 0) + qty)
      revenue.set(line.menuItemId, (revenue.get(line.menuItemId) ?? 0) + value)
      totalRevenue += value
      itemsSold += qty
    }
  }

  const topUnits = Math.max(1, ...units.values())

  // Every dish on the menu appears, including the ones that sold nothing —
  // a CEO view that silently omits the failures is the wrong view.
  const dishes: DishPerformance[] = menu.map(m => {
    const u = units.get(m.id) ?? 0
    const r = revenue.get(m.id) ?? 0
    const ing = m.ingredients ?? []
    return {
      menuItemId: m.id,
      name: m.name,
      nameJa: m.nameJa,
      units: u,
      revenue: Math.round(r * 100) / 100,
      revenueShare: totalRevenue > 0 ? r / totalRevenue : 0,
      relativeVolume: u / topUnits,
      inSeason: Boolean((m as MenuItem & { inSeason?: boolean }).inSeason),
      europeanSeason: europeanSeasonFor(ing, month).verdict,
      co2eKg: estimateCo2e(ing),
      neverOrdered: u === 0,
    }
  }).sort((a, b) => b.units - a.units || b.revenue - a.revenue)

  // Seasonal mix is by units sold, not by dish count — what guests actually
  // chose, rather than what the menu happens to offer.
  const seasonalMix = { inSeason: 0, outOfSeason: 0, yearRound: 0 }
  for (const d of dishes) {
    if (d.europeanSeason === 'in-season' || d.europeanSeason === 'peak') seasonalMix.inSeason += d.units
    else if (d.europeanSeason === 'out-of-season') seasonalMix.outOfSeason += d.units
    else seasonalMix.yearRound += d.units
  }

  const totalKg = dishes.reduce((sum, d) => sum + d.co2eKg * d.units, 0)
  const avgPerDishKg = itemsSold > 0 ? totalKg / itemsSold : 0
  const menuAvgPerDishKg = menu.length > 0
    ? menu.reduce((sum, m) => sum + estimateCo2e(m.ingredients ?? []), 0) / menu.length
    : 0

  return {
    generatedAt: new Date().toISOString(),
    orders: orders.length,
    covers: new Set(orders.map(o => o.tableNumber)).size,
    revenue: Math.round(totalRevenue * 100) / 100,
    avgOrderValue: orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
    itemsSold,
    dishes,
    seasonalMix,
    footprint: {
      totalKg: Math.round(totalKg * 10) / 10,
      avgPerDishKg: Math.round(avgPerDishKg * 100) / 100,
      menuAvgPerDishKg: Math.round(menuAvgPerDishKg * 100) / 100,
      deltaVsMenuPct: menuAvgPerDishKg > 0
        ? Math.round(((avgPerDishKg - menuAvgPerDishKg) / menuAvgPerDishKg) * 100)
        : 0,
    },
  }
}
