/**
 * Seasonality and footprint estimates for menu items.
 *
 * Two separate questions are answered here, deliberately kept apart:
 *
 *   1. Is this dish at its culinary peak in the Japanese solar calendar?
 *      That is the sekki story the kitchen cooks to (see sekki.ts).
 *   2. Is the ingredient actually in season in Europe right now?
 *      That is the one with an environmental meaning for a Zürich kitchen —
 *      out-of-season produce here means greenhouse heating, cold storage or
 *      air freight.
 *
 * They genuinely differ, and conflating them would let the restaurant claim
 * an ecological benefit it has not earned.
 *
 * ── On the CO2e numbers ──────────────────────────────────────────────────
 * These are ESTIMATES composed from published per-kilogram emission factors
 * (Poore & Nemecek, "Reducing food's environmental impacts through producers
 * and consumers", Science 360 (2018), as tabulated by Our World in Data)
 * multiplied by approximate portion weights.
 *
 * They are not measurements of these dishes. The factors are global medians
 * covering farm through retail, so real figures vary widely with supplier,
 * method and transport. Every surface that shows a number must label it an
 * estimate and name the source. Do not present these as measured values.
 */

/** kg CO2e per kg of ingredient, from Poore & Nemecek (2018) global medians. */
const EMISSION_FACTORS: Record<string, number> = {
  beef: 60.0,
  lamb: 24.5,
  cheese: 21.2,
  prawn: 11.8,
  pork: 7.2,
  poultry: 6.1,
  egg: 4.5,
  fish: 5.1,       // farmed; wild-caught varies far more
  rice: 4.0,
  tofu: 3.0,
  soy: 1.9,
  milk: 3.2,
  wheat: 1.4,      // noodles, gyoza wrappers
  vegetable: 0.5,
  rootVegetable: 0.4,
  mushroom: 0.3,
  seaweed: 0.2,
  tea: 1.4,
  beer: 1.1,
  sake: 1.4,
  citrus: 0.3,
  sugar: 1.8,
}

export type IngredientKey = keyof typeof EMISSION_FACTORS

export interface DishIngredient {
  /** Which emission factor applies. */
  key: string
  /** What to call it to a guest. */
  label: string
  /** Approximate grams in one portion. */
  grams: number
  /**
   * Months (1-12) this ingredient is in season in Europe. Empty means it is
   * a pantry staple with no meaningful season — rice, noodles, soy. Those are
   * neither "in season" nor "out of season" and must not be marked as either.
   */
  europeanSeason?: number[]
}

export type SeasonVerdict = 'peak' | 'in-season' | 'out-of-season' | 'year-round'

export interface Sustainability {
  /** Estimated kg CO2e for one portion. Rounded — precision here is false. */
  co2eKg: number
  /** Banding, so the UI does not imply more precision than exists. */
  co2eBand: 'low' | 'medium' | 'high'
  /** European seasonality of this dish's seasonal ingredients. */
  europeanSeason: SeasonVerdict
  /** Which ingredients drove that verdict, for an honest explanation. */
  seasonNote: string
}

/**
 * Compose a portion estimate from ingredient weights and published factors.
 * Unknown ingredient keys contribute nothing rather than a guessed value.
 */
export function estimateCo2e(ingredients: DishIngredient[]): number {
  const kg = ingredients.reduce((sum, ing) => {
    const factor = EMISSION_FACTORS[ing.key]
    return factor === undefined ? sum : sum + (factor * ing.grams) / 1000
  }, 0)
  // One decimal. The inputs do not support more.
  return Math.round(kg * 10) / 10
}

export function bandFor(co2eKg: number): Sustainability['co2eBand'] {
  if (co2eKg < 0.5) return 'low'
  if (co2eKg < 2.0) return 'medium'
  return 'high'
}

/**
 * European seasonality for the dish, from its seasonal ingredients.
 *
 * A dish of pantry staples is 'year-round' — calling ramen "out of season"
 * would be nonsense. Only ingredients with a declared europeanSeason count.
 */
export function europeanSeasonFor(
  ingredients: DishIngredient[],
  month: number,
): { verdict: SeasonVerdict; note: string } {
  const seasonal = ingredients.filter(i => i.europeanSeason?.length)
  if (seasonal.length === 0) {
    return { verdict: 'year-round', note: 'Pantry staples — no meaningful season.' }
  }

  const inNow = seasonal.filter(i => i.europeanSeason!.includes(month))
  if (inNow.length > 0) {
    const names = inNow.map(i => i.label).join(', ')
    return {
      verdict: 'in-season',
      note: `${names} ${inNow.length === 1 ? 'is' : 'are'} in season in Europe this month.`,
    }
  }

  const names = seasonal.map(i => i.label).join(', ')
  return {
    verdict: 'out-of-season',
    note: `${names} ${seasonal.length === 1 ? 'is' : 'are'} out of season in Europe now — likely stored, forced or imported.`,
  }
}
