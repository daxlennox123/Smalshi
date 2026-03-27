'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ProbabilityMiniChart = dynamic(
  () => import('@/components/ProbabilityCharts').then((m) => m.ProbabilityMiniChart),
  { ssr: false }
)

interface MarketCardProps {
  id: string
  question: string
  description?: string
  yesPrice: number
  noPrice: number
  resolved?: boolean
  endDate?: string
}

export function MarketCard({ id, question, description, yesPrice, noPrice, resolved, endDate }: MarketCardProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [betAmount, setBetAmount] = useState(10)
  const [graphData, setGraphData] = useState<{ t: number, prob: number }[]>([])

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadHistory() {
      const { data: bData } = await supabase.from('bets').select('*').eq('market_id', id).order('created_at', { ascending: true })
      const validBets = bData || []
      const history: { t: number, prob: number }[] = []
      const now = Date.now()
      const startTs =
        (validBets[0]?.created_at ? Date.parse(validBets[0].created_at) : NaN) ||
        now

      history.push({ t: startTs, prob: validBets.length ? (Math.round((validBets[0].prob_at_time ?? 0.5) * 100) || 50) : yesPrice })
      
      for (const b of validBets) {
        history.push({ 
          t: Date.parse(b.created_at) || now, 
          prob: Math.round(b.prob_at_time * 100) || 50 
        })
      }
      
      history.push({ t: now, prob: yesPrice })
      
      setGraphData(history)
    }
    
    if (id && !id.startsWith('demo-')) {
       loadHistory()
    } else {
       const now = Date.now()
       setGraphData([{ t: now - 60_000, prob: yesPrice }, { t: now, prob: yesPrice }])
    }
  }, [id, supabase, yesPrice])

  const isClosed = Boolean(resolved || (endDate && new Date() > new Date(endDate)))

  const placeBet = async (outcome: 'YES' | 'NO') => {
    if (isClosed || !betAmount || betAmount <= 0) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Please log in to bet.")
        return
      }

      // Call secure RPC to place bet atomically
      const { error: betError } = await supabase.rpc('place_bet', {
        p_market_id: id,
        p_outcome: outcome,
        p_amount: betAmount
      })

      if (betError) throw new Error(betError.message)
      
      alert(`Successfully placed a ${betAmount}¢ bet on ${outcome}!`)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Failed to place bet.")
    } finally {
      setLoading(false)
      setBetAmount(10) // reset after bet
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => router.push(`/dashboard/market/${id}`)}
      className="neo-box flex flex-col p-6 cursor-pointer bg-white"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-black border-b-2 border-transparent hover:border-black transition-all">
          {question}
        </h3>
        <div className="flex flex-col items-end gap-1">
          {resolved && (
            <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider border-2 border-black whitespace-nowrap">
              Resolved
            </span>
          )}
          {endDate && !resolved && (
            <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border-2 border-black whitespace-nowrap ${new Date() > new Date(endDate) ? 'bg-gray-300 text-gray-700' : 'bg-white text-black'}`}>
              {new Date() > new Date(endDate) ? 'Closed' : `Ends ${new Date(endDate).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>
      
      {description && (
        <p className="text-sm text-gray-700 mb-4 line-clamp-2 flex-grow font-mono">{description}</p>
      )}

      {/* Mini Graph */}
      <div className="w-full mb-6 opacity-60">
        <ProbabilityMiniChart data={graphData} />
      </div>

      <div className="flex gap-4 mt-auto">
        <button 
          onClick={(e) => { e.stopPropagation(); placeBet('YES') }}
          disabled={isClosed || loading}
          onMouseEnter={() => setHovered('yes')}
          onMouseLeave={() => setHovered(null)}
          className={`flex-1 flex justify-between items-center px-4 py-3 border-2 border-black font-bold transition-all disabled:opacity-50 ${
            hovered === 'yes' && !isClosed ? 'bg-[#bbf7d0] translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          <span className="text-black">Yes</span>
          <span className="text-black font-mono">{yesPrice}%</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); placeBet('NO') }}
          disabled={isClosed || loading}
          onMouseEnter={() => setHovered('no')}
          onMouseLeave={() => setHovered(null)}
          className={`flex-1 flex justify-between items-center px-4 py-3 border-2 border-black font-bold transition-all disabled:opacity-50 ${
            hovered === 'no' && !isClosed ? 'bg-[#fecdd3] translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          <span className="text-black">No</span>
          <span className="text-black font-mono">{noPrice}%</span>
        </button>
      </div>

      {!isClosed && (
        <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-gray-300 pt-4" onClick={(e) => e.stopPropagation()}>
          <label className="text-sm font-bold uppercase text-gray-700">Bet Amount (¢)</label>
          <input 
            type="number" 
            min="1" 
            value={betAmount || ''} 
            onChange={e => setBetAmount(parseInt(e.target.value) || 0)} 
            className="w-24 bg-gray-50 text-right font-bold text-lg p-2 border-2 border-black focus:outline-none focus:bg-[#fef08a]" 
          />
        </div>
      )}
    </motion.div>
  )
}
