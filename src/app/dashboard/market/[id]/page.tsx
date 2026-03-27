'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { calculateProbability, MarketState } from '@/lib/amm'

const ProbabilityTimeChart = dynamic(
  () => import('@/components/ProbabilityCharts').then((m) => m.ProbabilityTimeChart),
  { ssr: false }
)

interface Market {
  id: string
  creator_id: string
  created_at?: string
  question: string
  description: string
  yes_price: number
  no_price: number
  resolved: boolean
  resolution?: string
  option_a: string
  option_b: string
  p_initial: number
  i_initial: number
  end_date: string
}

interface BetRecord {
  id: string
  created_at: string
  user_id: string
  amount: number
  outcome: 'Yes' | 'No' | 'YES' | 'NO'
  prob_at_time: number
  is_exited: boolean
}

export default function MarketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params?.id as string

  const [market, setMarket] = useState<Market | null>(null)
  const [bets, setBets] = useState<BetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [betLoading, setBetLoading] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [exitLoading, setExitLoading] = useState(false)
  const [betAmount, setBetAmount] = useState(10)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  
  // derived from bets
  const [poolYes, setPoolYes] = useState(0)
  const [poolNo, setPoolNo] = useState(0)
  const [currentProb, setCurrentProb] = useState(0.5)
  const [graphData, setGraphData] = useState<{ t: number, prob: number }[]>([])

  useEffect(() => {
    if (!id) return
    loadMarketData()
  }, [id])

  useEffect(() => {
    if (!id) return

    // Live updates for this market: any bet insert/update or market updates
    const channel = supabase
      .channel(`market-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `market_id=eq.${id}` }, () => {
        loadMarketData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets', filter: `id=eq.${id}` }, () => {
        loadMarketData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase])

  async function loadMarketData() {
    setLoading(true)
    
    // fetch user
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUser(user.id)

    // fetch market
    const { data: mData } = await supabase.from('markets').select('*').eq('id', id).single()
    if (!mData) { setLoading(false); return }
    setMarket(mData)

    // fetch bets
    const { data: bData } = await supabase.from('bets').select('*').eq('market_id', id).order('created_at', { ascending: true })
    const validBets = bData || []
    setBets(validBets)
    
    // calculate pool totals
    let py = 0, pn = 0
    const history: { t: number, prob: number }[] = []
    const startTs =
      (mData.created_at ? Date.parse(mData.created_at) : NaN) ||
      (validBets[0]?.created_at ? Date.parse(validBets[0].created_at) : NaN) ||
      Date.now()

    // Starting point
    let p = typeof mData.p_initial === 'number' ? mData.p_initial : 0.5
    history.push({ t: startTs, prob: Math.round(p * 100) })

    for (const b of validBets) {
      if (b.is_exited) continue
      if (b.outcome.toUpperCase() === 'YES') py += b.amount
      else pn += b.amount

      p = calculateProbability({
        p_initial: mData.p_initial,
        i_initial: mData.i_initial,
        pool_yes: py,
        pool_no: pn,
      })

      history.push({
        t: Date.parse(b.created_at) || Date.now(),
        prob: Math.round(p * 100),
      })
    }

    // Add an explicit "now" point so the graph always has an end cap
    history.push({ t: Date.now(), prob: Math.round(p * 100) })

    setPoolYes(py)
    setPoolNo(pn)
    setCurrentProb(p)
    setGraphData(history)
    setLoading(false)
  }

  const isClosed = Boolean(market?.resolved || (market?.end_date && new Date() > new Date(market.end_date)))

  const handlePlaceBet = async (outcome: 'YES' | 'NO') => {
    if (!market || isClosed || !betAmount || betAmount <= 0) return
    setBetLoading(true)

    try {
      if (!currentUser) throw new Error("Log in to place a bet.")

      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', currentUser).single()
      if (!profile || profile.credits < betAmount) throw new Error(`Insufficient credits. You need ${betAmount}¢.`)

      // Call secure RPC to place bet atomically
      const { error: betError } = await supabase.rpc('place_bet', {
        p_market_id: id,
        p_outcome: outcome,
        p_amount: betAmount
      })
      
      if (betError) throw new Error(betError.message)

      alert(`Successfully placed bet on ${outcome === 'YES' ? market.option_a || 'YES' : market.option_b || 'NO'}!`)
      
      // Reload the data
      await loadMarketData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBetLoading(false)
      setBetAmount(10)
    }
  }

  const handleResolve = async (outcome: 'YES' | 'NO') => {
    if (!confirm(`Are you sure you want to resolve this market as ${outcome}? This will permanently close the market and distribute payouts.`)) return
    setResolveLoading(true)
    try {
      const { error } = await supabase.rpc('resolve_market', {
        p_market_id: id,
        p_resolution: outcome
      })
      if (error) throw new Error(error.message)
      alert("Market resolved successfully! Payouts distributed.")
      await loadMarketData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setResolveLoading(false)
    }
  }

  const calculateCashoutValue = (bet: BetRecord) => {
    if (bet.is_exited) return 0;

    // Cashout logic: if price hasn't moved, you should be able to get your principal back.
    // We model the bet as buying exposure at entry price (prob_at_time) and marking-to-market at currentProb.
    const pEntry = typeof bet.prob_at_time === 'number' ? bet.prob_at_time : currentProb
    const pNow = currentProb

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
    const pe = clamp01(pEntry)
    const pn = clamp01(pNow)

    const isYes = bet.outcome.toUpperCase() === 'YES'

    // Avoid division by 0 at extremes
    if (isYes) {
      if (pe <= 0) return bet.amount
      return Math.max(0, Math.round((bet.amount * pn) / pe))
    }

    if (pe >= 1) return bet.amount
    return Math.max(0, Math.round((bet.amount * (1 - pn)) / (1 - pe)))
  }

  const handleExitTrade = async (betId: string) => {
    if (!confirm('Are you sure you want to cash out this bet at the current price?')) return;
    setExitLoading(true);
    try {
      const { error, data } = await supabase.rpc('exit_bet', { p_bet_id: betId });
      if (error) throw new Error(error.message);
      alert(`Trade exited successfully! You received ${data}¢.`);
      await loadMarketData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExitLoading(false);
    }
  }

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-black" /></div>
  if (!market) return <div className="min-h-[60vh] flex items-center justify-center text-black font-bold text-2xl">Market not found.</div>

  const aTitle = market.option_a || 'YES'
  const bTitle = market.option_b || 'NO'
  const yesPrice = Math.max(0, Math.min(100, Math.round(currentProb * 100)))
  const noPrice = 100 - yesPrice

  return (
    <div className="font-mono text-black p-6 lg:p-10">
      <button 
        onClick={() => router.push('/dashboard')}
        className="mb-6 flex items-center gap-2 font-bold uppercase hover:underline text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Markets
      </button>

      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Box */}
        <div className="neo-box bg-white p-8">
          <div className="flex justify-between items-start mb-6 border-b-4 border-black pb-4">
            <h1 className="text-3xl lg:text-4xl font-bold uppercase leading-tight">
              {market.question}
            </h1>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {market.resolved && (
                <span className="px-4 py-2 bg-black text-white text-sm font-bold uppercase border-2 border-black ml-4 whitespace-nowrap">
                  Resolved: {market.resolution}
                </span>
              )}
              {!market.resolved && market.end_date && (
                <span className={`px-4 py-2 text-sm font-bold uppercase border-2 border-black ml-4 whitespace-nowrap ${isClosed ? 'bg-gray-300 text-gray-700' : 'bg-white text-black'}`}>
                  {isClosed ? 'Closed' : `Ends ${new Date(market.end_date).toLocaleDateString()}`}
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-800 text-lg font-bold">
            {market.description}
          </p>
        </div>

        {/* Resolve Panel (Visible to Creator Only) */}
        {currentUser === market.creator_id && !market.resolved && (
          <div className="neo-box bg-[#fef08a] p-6 border-dashed border-4 border-black">
            <h3 className="text-xl font-bold uppercase mb-4 text-black">Creator Tools: Resolve Market</h3>
            <p className="text-gray-800 font-bold mb-4">You created this market. When the event is over, select the outcome to distribute payouts.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => handleResolve('YES')}
                disabled={resolveLoading}
                className="flex-1 py-3 bg-[#bbf7d0] border-2 border-black font-bold uppercase text-black hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
              >
                Resolve YES
              </button>
              <button 
                onClick={() => handleResolve('NO')}
                disabled={resolveLoading}
                className="flex-1 py-3 bg-[#fecdd3] border-2 border-black font-bold uppercase text-black hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
              >
                Resolve NO
              </button>
            </div>
          </div>
        )}

        {/* Graph Box */}
        <div className="neo-box bg-white p-8">
          <h2 className="text-2xl font-bold uppercase mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Probability History
          </h2>
          <div className="w-full mb-4" style={{ height: 320, minHeight: 320 }}>
            <ProbabilityTimeChart data={graphData} />
          </div>
        </div>

        {/* Your Active Bets Panel */}
        {currentUser && !isClosed && bets.filter(b => b.user_id === currentUser && !b.is_exited).length > 0 && (
          <div className="neo-box bg-[#bbf7d0] p-6 border-dashed border-4 border-black">
            <h3 className="text-xl font-bold uppercase mb-4 text-black border-b-2 border-black pb-2">Your Active Bets</h3>
            <div className="space-y-4">
              {bets.filter(b => b.user_id === currentUser && !b.is_exited).map(bet => {
                const cashoutValue = calculateCashoutValue(bet)
                const profit = cashoutValue - bet.amount
                return (
                  <div key={bet.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border-2 border-black gap-4">
                    <div>
                      <span className="font-bold text-lg mr-2 uppercase tracking-tight">{bet.outcome}</span>
                      <span className="font-mono text-gray-700">Bet: {bet.amount}¢ at {Math.round(bet.prob_at_time * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="block font-bold text-xs text-gray-500 uppercase">Cashout Value</span>
                        <span className={`font-mono font-bold text-xl ${profit >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                          {cashoutValue}¢ ({profit >= 0 ? '+' : ''}{profit}¢)
                        </span>
                      </div>
                      <button 
                        onClick={() => handleExitTrade(bet.id)}
                        disabled={exitLoading || isClosed}
                        className="px-4 py-2 bg-black text-white font-bold uppercase border-2 border-transparent hover:bg-rose-500 hover:border-black transition-colors disabled:opacity-50"
                      >
                        Exit Trade
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Betting Interface */}
        {!isClosed && (
          <div className="neo-box bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="text-xl font-bold uppercase">Bet Amount (¢)</label>
            <input 
              type="number" 
              min="1" 
              value={betAmount || ''} 
              onChange={e => setBetAmount(parseInt(e.target.value) || 0)} 
              className="w-32 neo-input text-right font-bold text-2xl p-2 border-4 border-black bg-[#fef08a] focus:outline-none" 
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button 
            onClick={() => handlePlaceBet('YES')}
            disabled={isClosed || betLoading}
            className="neo-box bg-[#bbf7d0] p-8 text-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#a7f3d0] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl font-bold uppercase break-words">{aTitle}</span>
            <span className="text-4xl font-bold border-t-2 border-black pt-4 mt-2 w-full">
              {yesPrice}%
            </span>
          </button>

          <button 
            onClick={() => handlePlaceBet('NO')}
            disabled={isClosed || betLoading}
            className="neo-box bg-[#fecdd3] p-8 text-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fda4af] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl font-bold uppercase break-words">{bTitle}</span>
            <span className="text-4xl font-bold border-t-2 border-black pt-4 mt-2 w-full">
              {noPrice}%
            </span>
          </button>
        </div>

      </div>
    </div>
  )
}
