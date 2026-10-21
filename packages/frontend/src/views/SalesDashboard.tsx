import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Leaf, Table2, ArrowLeft } from 'lucide-react'
import { api } from '../api'
import { Analytics, DishPerformance } from '../types'

/**
 * Categorical palette, validated for this dark surface (#12121e) with the
 * dataviz six-checks: lightness band, chroma floor, CVD separation (worst
 * adjacent pair ΔE 12.6 protan), normal-vision floor and contrast. The raw
 * neon set used elsewhere in the app FAILS those checks as chart fills — it
 * is fine for text and glows, not for adjacent filled marks.
 *
 * Semantic green/amber is deliberately NOT used for the seasonal segments:
 * green↔amber separates at only ΔE 5.4 for protanopia. Those colours stay on
 * the menu's text badges, where a word carries the meaning.
 */
const CAT = ['#ff2d75', '#0096ad', '#8e44d0'] as const
/**
 * Below this many orders the dashboard reports counts but withholds advice.
 * With a handful of orders most dishes show zero sales purely because few
 * things have been ordered at all, and "de-list these nine" would be a
 * conclusion the data cannot carry.
 */
const MIN_ORDERS_FOR_ADVICE = 20

/** Magnitude is one hue, never the categorical ramp cycled. */
const MAGNITUDE = '#ff2d75'

function StatTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="bg-jp-card rounded-xl p-4" style={{ border: '1px solid #2a2a3e' }}>
      <p className="text-[10px] font-mono text-jp-muted uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: accent ?? '#F0EDE6' }}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-jp-muted mt-0.5">{sub}</p>}
    </div>
  )
}

/** Horizontal magnitude bars. One hue, thin marks, rounded data-ends. */
function DishBars({ dishes, metric }: { dishes: DishPerformance[]; metric: 'units' | 'revenue' }) {
  const max = Math.max(1, ...dishes.map(d => (metric === 'units' ? d.units : d.revenue)))
  return (
    <div className="space-y-2">
      {dishes.map(d => {
        const v = metric === 'units' ? d.units : d.revenue
        const pct = (v / max) * 100
        return (
          <div key={d.menuItemId} className="group" title={`${d.name} — ${d.units} sold, CHF ${d.revenue.toFixed(2)}, ~${d.co2eKg} kg CO₂e each`}>
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-xs text-jp-text truncate">{d.name}</span>
              <span className="text-xs font-mono flex-shrink-0" style={{ color: v > 0 ? '#F0EDE6' : '#6a6a7a' }}>
                {metric === 'units' ? `${d.units}` : `CHF ${d.revenue.toFixed(0)}`}
                <span className="text-jp-muted ml-2">{(d.revenueShare * 100).toFixed(0)}% rev</span>
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden max-w-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full transition-all duration-500 group-hover:brightness-125"
                style={{
                  width: `${Math.max(pct, v > 0 ? 2 : 0)}%`,
                  background: MAGNITUDE,
                  borderRadius: '0 4px 4px 0',
                }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SalesDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [metric, setMetric] = useState<'units' | 'revenue'>('units')

  useEffect(() => {
    if (!slug) return
    const load = () => api.getAnalytics(slug).then(setData).catch(e => setError(e.message))
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [slug])

  if (error) return <div className="min-h-screen bg-jp-bg text-jp-muted p-8 font-mono">// {error}</div>
  if (!data) return <div className="min-h-screen bg-jp-bg text-jp-muted p-8 font-mono">// loading analytics...</div>

  const sold = data.dishes.filter(d => d.units > 0)
  const unsold = data.dishes.filter(d => d.neverOrdered)
  const mixTotal = Math.max(1, data.seasonalMix.inSeason + data.seasonalMix.outOfSeason + data.seasonalMix.yearRound)
  const segments = [
    { label: 'In season', value: data.seasonalMix.inSeason, color: CAT[0] },
    { label: 'Out of season', value: data.seasonalMix.outOfSeason, color: CAT[1] },
    { label: 'Year-round', value: data.seasonalMix.yearRound, color: CAT[2] },
  ]
  const lighter = data.footprint.deltaVsMenuPct < 0
  const enoughData = data.orders >= MIN_ORDERS_FOR_ADVICE

  return (
    <div className="min-h-screen bg-jp-bg crt-flicker">
      <div className="fixed inset-0 z-[60] scanlines pointer-events-none" />

      {/* Same ticker the menu and homepage use. */}
      <div className="px-5 py-1.5 text-[10px] font-mono"
        style={{ background: '#0d0d18', borderBottom: '1px solid rgba(255,45,117,0.15)' }}>
        <div className="max-w-5xl mx-auto">
          <span className="neon-text font-bold" style={{ color: '#ff2d75' }}>ANALYTICS</span>
          {' // '}
          <span style={{ color: '#00f0ff' }}>{slug?.toUpperCase()}</span>
          {' · '}
          <span style={{ color: '#9d4edd' }}>LIVE</span>
          {' · '}
          <span style={{ color: '#ffd700' }}>{data.orders} ORDERS</span>
        </div>
      </div>

      <header className="relative px-5 pt-6 pb-5 washi-texture overflow-hidden"
        style={{
          borderBottom: '1px solid rgba(255,45,117,0.25)',
          background: 'radial-gradient(ellipse at 15% 0%, rgba(255,45,117,0.16) 0%, transparent 55%), radial-gradient(ellipse at 85% 10%, rgba(157,78,221,0.12) 0%, transparent 45%), var(--color-jp-surface)',
        }}>
        <div className="absolute bottom-0 left-0 right-0 h-24 retro-grid pointer-events-none"
          style={{ perspective: '300px', transform: 'rotateX(45deg)', transformOrigin: 'bottom' }} />
        <span className="absolute right-4 -top-8 text-[9rem] font-bold leading-none select-none pointer-events-none"
          style={{ color: '#ff2d75', opacity: 0.06, textShadow: '0 0 60px rgba(255,45,117,0.5)' }}>売</span>

        <div className="relative max-w-5xl mx-auto">
          <Link to={`/staff/${slug}`} className="text-[10px] font-mono text-jp-muted flex items-center gap-1 mb-2">
            <ArrowLeft size={10} /> back to floor
          </Link>
          <h1 className="text-4xl font-black leading-none gradient-text neon-text">Sales Performance</h1>
          <p className="text-lg font-light neon-text-cyan mt-1" style={{ color: '#00f0ff' }}>売上分析</p>
          <p className="text-[10px] font-mono text-jp-muted mt-1">refreshed every 15s</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Revenue" value={`CHF ${data.revenue.toFixed(0)}`} sub={`${data.orders} orders`} accent="#ffd700" />
          <StatTile label="Avg order" value={`CHF ${data.avgOrderValue.toFixed(0)}`} sub={`${data.covers} tables`} />
          <StatTile label="Items sold" value={`${data.itemsSold}`} sub={`${sold.length} of ${data.dishes.length} dishes`} />
          <StatTile label="No orders yet" value={`${unsold.length}`} sub="of the menu"
            accent={unsold.length > 0 && enoughData ? '#ff8a4c' : undefined} />
        </div>

        <section className="bg-jp-card rounded-xl p-5" style={{ border: '1px solid #2a2a3e' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-jp-text">Dish performance</h2>
              <p className="text-[10px] font-mono text-jp-muted">
                {enoughData ? 'what to reorder, and what to cut' : `by units sold · ${data.orders} orders so far`}
              </p>
            </div>
            <div className="flex gap-1">
              {(['units', 'revenue'] as const).map(m => (
                <button key={m} onClick={() => setMetric(m)}
                  className="px-3 py-1 rounded-full text-[10px] font-mono transition-all"
                  style={metric === m
                    ? { background: MAGNITUDE, color: 'white' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#9090a0' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {sold.length > 0 ? <DishBars dishes={sold} metric={metric} /> :
            <p className="text-jp-muted text-xs font-mono">// nothing sold yet</p>}

          {unsold.length > 0 && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <p className="text-[10px] font-mono mb-2 flex items-center gap-1"
                style={{ color: enoughData ? '#ff8a4c' : '#9090a0' }}>
                <TrendingDown size={11} /> NO ORDERS YET — {unsold.length} dishes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unsold.map(d => (
                  <span key={d.menuItemId} className="text-[10px] font-mono px-2 py-1 rounded-full"
                    style={enoughData
                      ? { background: 'rgba(255,138,76,0.1)', color: '#ff8a4c' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#9090a0' }}
                    title={`${d.name} — ~${d.co2eKg} kg CO₂e, ${d.europeanSeason}`}>
                    {d.name}
                  </span>
                ))}
              </div>

              {/* With a handful of orders, most dishes having zero is a
                  sample-size artifact, not a signal about those dishes.
                  Recommending de-listing on that basis would be wrong in a
                  real kitchen, so the recommendation only appears once there
                  is enough trade to support it. */}
              {enoughData ? (
                <p className="text-[10px] text-jp-muted mt-2 leading-relaxed">
                  Candidates for de-listing or a supply review — every one of these ties up stock
                  and prep capacity without earning anything.
                </p>
              ) : (
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: '#9090a0' }}>
                  Not enough trade to read anything into this yet — {data.orders} order
                  {data.orders === 1 ? '' : 's'} so far, and a recommendation needs at least{' '}
                  {MIN_ORDERS_FOR_ADVICE}. With this few, most of the menu having zero sales is
                  expected rather than meaningful.
                </p>
              )}
            </div>
          )}
        </section>

        <div className="grid md:grid-cols-2 gap-5 items-start">
          <section className="bg-jp-card rounded-xl p-5" style={{ border: '1px solid #2a2a3e' }}>
            <h2 className="text-sm font-bold text-jp-text mb-1">Seasonal mix of what sold</h2>
            <p className="text-[10px] font-mono text-jp-muted mb-4">by units, against the European growing year</p>

            {/* Stacked magnitude bar. 2px surface gaps between segments, and
                every segment is directly labelled so identity is never colour
                alone. */}
            <div className="flex h-3 rounded-full overflow-hidden gap-[2px] mb-3">
              {segments.filter(s => s.value > 0).map(s => (
                <div key={s.label} style={{ width: `${(s.value / mixTotal) * 100}%`, background: s.color }}
                  title={`${s.label}: ${s.value} units`} />
              ))}
            </div>
            <div className="space-y-1.5">
              {segments.map(s => (
                <div key={s.label} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-jp-text flex-1">{s.label}</span>
                  <span className="font-mono text-jp-muted">
                    {s.value} · {Math.round((s.value / mixTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-jp-card rounded-xl p-5" style={{ border: '1px solid #2a2a3e' }}>
            <h2 className="text-sm font-bold text-jp-text mb-1 flex items-center gap-1.5">
              <Leaf size={13} style={{ color: '#0096ad' }} /> Footprint of the mix
            </h2>
            <p className="text-[10px] font-mono text-jp-muted mb-4">estimated, not measured — see note</p>

            <p className="text-3xl font-bold" style={{ color: lighter ? '#0096ad' : '#ff8a4c' }}>
              {data.footprint.avgPerDishKg.toFixed(2)} <span className="text-sm font-normal">kg CO₂e</span>
            </p>
            <p className="text-[11px] text-jp-muted">average per dish sold</p>

            <div className="mt-3 flex items-center gap-1.5 text-[11px]">
              {lighter ? <TrendingDown size={12} style={{ color: '#0096ad' }} />
                       : <TrendingUp size={12} style={{ color: '#ff8a4c' }} />}
              <span style={{ color: lighter ? '#0096ad' : '#ff8a4c' }}>
                {Math.abs(data.footprint.deltaVsMenuPct)}% {lighter ? 'below' : 'above'} the menu average
              </span>
              <span className="text-jp-muted font-mono">({data.footprint.menuAvgPerDishKg.toFixed(2)} kg)</span>
            </div>

            <p className="text-[10px] text-jp-muted mt-4 leading-relaxed">
              Estimates: published per-kilogram emission factors (Poore &amp; Nemecek 2018)
              applied to approximate portion weights. Not measurements of these dishes, and
              not a saving — seasonality does not change an ingredient's emission factor, so
              no "CO₂ saved" figure is derivable from this data.
            </p>
          </section>
        </div>

        {/* A table view is required so the charts are never the only way in. */}
        <section className={showTable ? 'bg-jp-card rounded-xl p-5' : ''}
          style={showTable ? { border: '1px solid #2a2a3e' } : undefined}>
          <button onClick={() => setShowTable(v => !v)}
            className="text-[11px] font-mono flex items-center gap-1.5" style={{ color: '#0096ad' }}>
            <Table2 size={12} /> {showTable ? 'hide' : 'show'} the numbers as a table
          </button>
          {showTable && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-jp-muted font-mono text-[10px] text-left">
                    <th className="pb-2">Dish</th><th className="pb-2 text-right">Units</th>
                    <th className="pb-2 text-right">Revenue</th><th className="pb-2 text-right">Share</th>
                    <th className="pb-2 text-right">kg CO₂e</th><th className="pb-2">Season</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dishes.map(d => (
                    <tr key={d.menuItemId} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="py-1.5 text-jp-text">{d.name}</td>
                      <td className="py-1.5 text-right font-mono">{d.units}</td>
                      <td className="py-1.5 text-right font-mono">{d.revenue.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono">{(d.revenueShare * 100).toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-mono">{d.co2eKg.toFixed(1)}</td>
                      <td className="py-1.5 font-mono text-jp-muted">{d.europeanSeason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
