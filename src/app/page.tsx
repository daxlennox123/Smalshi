'use client'

import { motion } from 'framer-motion'
import { MarketCard } from '@/components/MarketCard'
import Link from 'next/link'
import { ArrowRight, BarChart3, ShieldCheck, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f4f0e6] text-black font-mono selection:bg-[#fef08a]">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b-4 border-black bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#bbf7d0] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <BarChart3 className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight uppercase">SMalshi</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-gray-700 hover:text-black hover:underline transition-colors uppercase">
              Sign In
            </Link>
            <Link href="/login" className="text-sm font-bold bg-[#fef08a] text-black border-2 border-black px-4 py-2 hover:translate-x-[2px] hover:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-40 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#fecdd3] border-2 border-black text-black text-sm font-bold mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase">
              <span className="w-2 h-2 rounded-none bg-black" />
              Exclusively for St. Marks Students
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1] uppercase">
              Trade on what <br />
              <span className="bg-[#bbf7d0] border-2 border-black px-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-2 inline-block">
                you know.
              </span>
            </h1>
            <p className="text-lg text-gray-800 mb-8 max-w-xl leading-relaxed font-bold">
              The premier prediction market for the SM campus. Sign up using your @smtexas.org email, get 10 free credits, and start betting on events that matter to you.
            </p>
            
            <div className="flex items-center gap-6">
              <Link href="/login" className="group flex items-center gap-2 bg-[#bbf7d0] text-black border-2 border-black px-6 py-3 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase">
                Start Trading
                <ArrowRight className="w-5 h-5 border-l-2 border-black pl-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/dashboard" className="px-6 py-3 font-bold text-black border-b-4 border-black hover:bg-[#fef08a] transition-all uppercase">
                View Markets
              </Link>
            </div>

            <div className="mt-12 flex items-center gap-8 text-sm font-bold text-black uppercase">
              <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <ShieldCheck className="w-5 h-5" />
                Verified Community
              </div>
              <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Zap className="w-5 h-5" />
                Instant Settlement
              </div>
            </div>
          </motion.div>

          {/* Demo Graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="space-y-6">
              <MarketCard 
                id="demo-1"
                question="Will there be a snow day tomorrow?"
                description="If the school officially announces a closure due to inclement weather before 8:00 AM CST, this market resolves to YES."
                yesPrice={82}
                noPrice={18}
              />
              <MarketCard 
                id="demo-2"
                question="Will the upcoming PEP assembly be cancelled?"
                yesPrice={31}
                noPrice={69}
              />
            </div>
            
            <div className="mt-8 p-6 bg-[#fef08a] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-default">
              <div className="w-12 h-12 bg-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-xl font-bold text-black">10</span>
              </div>
              <div>
                <h4 className="font-bold text-black uppercase text-lg">Free Sign-up Bonus</h4>
                <p className="text-sm text-gray-800 font-bold mt-1">Get 10 credits instantly when you verify your @smtexas.org email.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
