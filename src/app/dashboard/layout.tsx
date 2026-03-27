'use client'

import { useState, useEffect } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Home, PlusCircle, Trophy, LogOut, User } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()

  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    let sub: any;
    async function loadCredits() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from('profiles').select('credits').eq('id', user.id).single()
      if (data) setCredits(data.credits)

      sub = supabase.channel('profile-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
          setCredits(payload.new.credits)
        })
        .subscribe()
    }
    loadCredits()
    return () => {
      if (sub) supabase.removeChannel(sub)
    }
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f4f0e6] text-black flex">
      {/* Sidebar */}
      <aside className="w-64 border-r-4 border-black bg-white flex flex-col fixed h-full z-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[#fef08a] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <BarChart3 className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight text-black uppercase">SMalshi</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-3 px-4 py-3 border-2 border-black bg-[#fef08a] text-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <Home className="w-5 h-5" />
            Markets
          </Link>
          <Link 
            href="/dashboard/account" 
            className="flex items-center gap-3 px-4 py-3 border-2 border-black bg-white text-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fcf9f2] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <User className="w-5 h-5" />
            Account
          </Link>
          <Link 
            href="/submit" 
            className="flex items-center gap-3 px-4 py-3 border-2 border-black bg-white text-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#bbf7d0] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            Submit Market
          </Link>
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-3 px-4 py-3 border-2 border-black bg-white text-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fecdd3] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <Trophy className="w-5 h-5" />
            Leaderboard
          </Link>
        </nav>

        <div className="p-4 border-t-4 border-black">
          <div className="neo-box p-4 flex items-center justify-between mb-4 bg-[#fcf9f2]">
            <span className="text-sm text-gray-700 font-bold uppercase">Credits</span>
            <span className="text-black font-mono font-bold">{credits !== null ? credits : '...'} ¢</span>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 border-2 border-black bg-white text-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-rose-300 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
