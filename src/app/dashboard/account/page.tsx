'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { calculateProbability } from '@/lib/amm'

type MarketLite = {
  id: string
  creator_id: string
  question: string
  resolved: boolean
  resolution?: string | null
  option_a: string
  option_b: string
  p_initial: number
  i_initial: number
  end_date?: string | null
}

type BetRow = {
  id: string
  created_at: string
  user_id: string
  market_id: string
  amount: number
  outcome: 'YES' | 'NO' | 'Yes' | 'No'
  prob_at_time: number
  is_exited: boolean
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function cashoutAtPrice(betAmount: number, outcome: string, pEntry: number, pNow: number) {
  const pe = clamp01(pEntry)
  const pn = clamp01(pNow)
  const isYes = outcome.toUpperCase() === 'YES'

  if (isYes) {
    if (pe <= 0) return betAmount
    return Math.max(0, Math.round((betAmount * pn) / pe))
  }

  if (pe >= 1) return betAmount
  return Math.max(0, Math.round((betAmount * (1 - pn)) / (1 - pe)))
}

export default function AccountPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [activeBets, setActiveBets] = useState<BetRow[]>([])
  const [marketsById, setMarketsById] = useState<Record<string, MarketLite>>({})
  const [pNowByMarketId, setPNowByMarketId] = useState<Record<string, number>>({})
  const [yourOpenMarkets, setYourOpenMarkets] = useState<MarketLite[]>([])
  const [resolveLoadingId, setResolveLoadingId] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)

    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? null
    setUserId(uid)
    if (!uid) {
      setActiveBets([])
      setMarketsById({})
      setPNowByMarketId({})
      setYourOpenMarkets([])
      setLoading(false)
      return
    }

    const { data: betData } = await supabase
      .from('bets')
      .select('id, created_at, user_id, market_id, amount, outcome, prob_at_time, is_exited')
      .eq('user_id', uid)
      .eq('is_exited', false)
      .order('created_at', { ascending: false })

    const bets = (betData ?? []) as BetRow[]
    setActiveBets(bets)

    const marketIds = Array.from(new Set(bets.map((b) => b.market_id)))

    // Markets you created and can resolve
    const { data: openMarketData } = await supabase
      .from('markets')
      .select('id, creator_id, question, resolved, resolution, option_a, option_b, p_initial, i_initial, end_date')
      .eq('creator_id', uid)
      .eq('resolved', false)
      .order('created_at', { ascending: false })

    setYourOpenMarkets((openMarketData ?? []) as MarketLite[])

    if (marketIds.length === 0) {
      setMarketsById({})
      setPNowByMarketId({})
      setLoading(false)
      return
    }

    const { data: marketData } = await supabase
      .from('markets')
      .select('id, creator_id, question, resolved, resolution, option_a, option_b, p_initial, i_initial, end_date')
      .in('id', marketIds)

    const markets = (marketData ?? []) as MarketLite[]
    const mById: Record<string, MarketLite> = {}
    for (const m of markets) mById[m.id] = m
    setMarketsById(mById)

    // Compute current probability per market from all active (non-exited) bets
    const { data: allBetData } = await supabase
      .from('bets')
      .select('market_id, amount, outcome, is_exited')
      .in('market_id', marketIds)

    const allBets = (allBetData ?? []) as Array<Pick<BetRow, 'market_id' | 'amount' | 'outcome' | 'is_exited'>>

    const sums: Record<string, { yes: number; no: number }> = {}
    for (const b of allBets) {
      if (b.is_exited) continue
      const key = b.market_id
      if (!sums[key]) sums[key] = { yes: 0, no: 0 }
      if ((b.outcome ?? '').toUpperCase() === 'YES') sums[key].yes += b.amount
      else sums[key].no += b.amount
    }

    const pMap: Record<string, number> = {}
    for (const id of marketIds) {
      const m = mById[id]
      if (!m) continue
      const s = sums[id] ?? { yes: 0, no: 0 }
      pMap[id] = calculateProbability({
        p_initial: m.p_initial,
        i_initial: m.i_initial,
        pool_yes: s.yes,
        pool_no: s.no,
      })
    }
    setPNowByMarketId(pMap)

    setLoading(false)
  }

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel('account-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        loadAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
        loadAll()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const rows = useMemo(() => {
    return activeBets.map((bet) => {
      const m = marketsById[bet.market_id]
      const pNow = pNowByMarketId[bet.market_id] ?? 0.5
      const pEntry = typeof bet.prob_at_time === 'number' ? bet.prob_at_time : pNow
      const cashout = cashoutAtPrice(bet.amount, bet.outcome, pEntry, pNow)
      const pnl = cashout - bet.amount
      return { bet, market: m, pNow, pEntry, cashout, pnl }
    })
  }, [activeBets, marketsById, pNowByMarketId])

  const totalPnl = rows.reduce((sum, r) => sum + r.pnl, 0)

  const resolveMarket = async (marketId: string, outcome: 'YES' | 'NO') => {
    if (!confirm(`Resolve this market as ${outcome}? This permanently closes it and distributes payouts.`)) return
    setResolveLoadingId(marketId)
    try {
      const { error } = await supabase.rpc('resolve_market', {
        p_market_id: marketId,
        p_resolution: outcome,
      })
      if (error) throw new Error(error.message)
      await loadAll()
      alert('Market resolved.')
    } catch (e: any) {
      alert(e?.message ?? 'Failed to resolve market.')
    } finally {
      setResolveLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-black">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="neo-box bg-white p-8">
        <h1 className="text-3xl font-bold uppercase mb-2">Account</h1>
        <p className="font-bold text-gray-800">Log in to see your active trades and markets.</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 p-6 lg:p-10 font-mono text-black">
      <div className="border-l-8 border-black pl-6">
        <h1 className="text-5xl font-bold tracking-tight mb-2 uppercase">Account</h1>
        <p className="text-gray-800 font-bold text-lg">Your active trades, P&amp;L, and markets you created.</p>
      </div>

      {/* Active P&L */}
      <div className="neo-box bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase text-gray-700">Active P&amp;L</div>
          <div className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl}¢
          </div>
        </div>
        <button
          onClick={() => loadAll()}
          className="px-5 py-3 bg-[#fef08a] border-2 border-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Active Trades */}
      <div className="neo-box bg-white p-6">
        <h2 className="text-2xl font-bold uppercase mb-4 border-b-4 border-black pb-2">Your Active Trades</h2>
        {rows.length === 0 ? (
          <p className="font-bold text-gray-800">No active trades.</p>
        ) : (
          <div className="space-y-4">
            {rows.map(({ bet, market, pNow, cashout, pnl }) => {
              const yesPrice = Math.round(clamp01(pNow) * 100)
              const noPrice = 100 - yesPrice
              return (
                <div key={bet.id} className="border-2 border-black bg-[#fcf9f2] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="font-bold uppercase text-lg">
                        {market?.question ?? 'Market'}
                      </div>
                      <div className="font-mono font-bold text-gray-700">
                        Price: YES {yesPrice}% / NO {noPrice}%
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="font-bold">
                        Outcome: <span className="uppercase">{bet.outcome}</span> · Amount: {bet.amount}¢
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase text-gray-700">Cashout (est.)</div>
                        <div className={`font-mono font-bold text-xl ${pnl >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                          {cashout}¢ ({pnl >= 0 ? '+' : ''}{pnl}¢)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Your Markets to Resolve */}
      <div className="neo-box bg-white p-6">
        <h2 className="text-2xl font-bold uppercase mb-4 border-b-4 border-black pb-2">Markets You Created</h2>
        {yourOpenMarkets.length === 0 ? (
          <p className="font-bold text-gray-800">No active markets you created.</p>
        ) : (
          <div className="space-y-4">
            {yourOpenMarkets.map((m) => (
              <div key={m.id} className="border-2 border-black bg-[#fef08a]/30 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="font-bold uppercase text-lg mb-3">{m.question}</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => resolveMarket(m.id, 'YES')}
                    disabled={resolveLoadingId === m.id}
                    className="flex-1 py-3 bg-[#bbf7d0] border-2 border-black font-bold uppercase text-black hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    Resolve YES
                  </button>
                  <button
                    onClick={() => resolveMarket(m.id, 'NO')}
                    disabled={resolveLoadingId === m.id}
                    className="flex-1 py-3 bg-[#fecdd3] border-2 border-black font-bold uppercase text-black hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    Resolve NO
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

