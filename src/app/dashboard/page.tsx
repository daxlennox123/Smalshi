'use client'

import { useEffect, useState } from 'react'
import { MarketCard } from '@/components/MarketCard'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

interface Market {
  id: string
  question: string
  description: string
  yes_price: number
  no_price: number
  resolved: boolean
  end_date: string
}

export default function DashboardPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMarkets() {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (data) setMarkets(data)
      setLoading(false)
    }

    fetchMarkets()

    // Live updates: refresh list when market prices/bets change
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
        fetchMarkets()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        fetchMarkets()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="space-y-8 p-6 lg:p-10 font-mono text-black">
      <div className="border-l-8 border-black pl-6 mb-12">
        <h1 className="text-5xl font-bold tracking-tight mb-2 uppercase text-black">Active Markets</h1>
        <p className="text-gray-800 font-bold text-lg">Trade on school events, announcements, and more.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-black">
          <Loader2 className="w-12 h-12 animate-spin" />
        </div>
      ) : markets.length === 0 ? (
        <div className="p-12 text-center neo-box bg-white">
          <h3 className="text-2xl font-bold mb-4 uppercase">No markets active</h3>
          <p className="text-gray-800 font-bold">Be the first to submit a new prediction market.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {markets.map(market => (
            <MarketCard 
              key={market.id}
              id={market.id}
              question={market.question}
              description={market.description}
              yesPrice={market.yes_price}
              noPrice={market.no_price}
              resolved={market.resolved}
              endDate={market.end_date}
            />
          ))}
        </div>
      )}
    </div>
  )
}
