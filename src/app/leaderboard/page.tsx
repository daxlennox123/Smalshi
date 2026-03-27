'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  credits: number
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLeaders() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, credits')
        .order('credits', { ascending: false })
        .limit(20)

      if (data) {
        setLeaders(data)
      }
      setLoading(false)
    }

    fetchLeaders()
  }, [supabase])

  return (
    <div className="space-y-8 max-w-4xl mx-auto text-black">
      <div className="flex items-center gap-4 border-b-4 border-black pb-6">
        <div className="w-12 h-12 bg-[#fef08a] border-3 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Trophy className="w-6 h-6 text-black" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black mb-1 uppercase">Top Traders</h1>
          <p className="text-gray-700 font-bold">The wealthiest prognosticators on campus.</p>
        </div>
      </div>

      <div className="neo-box bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-black text-sm font-bold text-gray-700 uppercase tracking-wider bg-[#fcf9f2]">
          <div className="col-span-2 text-center">Rank</div>
          <div className="col-span-7">Trader</div>
          <div className="col-span-3 text-right">Net Worth</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-700 font-bold animate-pulse">Loading rankings...</div>
        ) : leaders.length === 0 ? (
          <div className="p-8 text-center text-gray-700 font-bold">No traders found.</div>
        ) : (
          <div className="divide-y divide-black/10">
            {leaders.map((profile, i) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={profile.id}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#fef08a]/40 transition-colors group"
              >
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold ${
                    i === 0 ? 'text-black' :
                    i === 1 ? 'text-black' :
                    i === 2 ? 'text-black' : 'text-gray-500'
                  }`}>
                    #{i + 1}
                  </span>
                </div>
                <div className="col-span-7 flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#bbf7d0] border-2 border-black flex items-center justify-center text-xs font-bold shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {profile.email.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold truncate group-hover:underline transition-all">
                    {profile.email.split('@')[0]}
                  </span>
                </div>
                <div className="col-span-3 text-right flex flex-col items-end">
                  <span className="font-mono font-bold text-black text-lg flex items-center gap-1">
                    {profile.credits} ¢
                    <TrendingUp className="w-4 h-4 text-black/40" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
