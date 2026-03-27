'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PlusCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SubmitMarketPage() {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [optionA, setOptionA] = useState('Yes')
  const [optionB, setOptionB] = useState('No')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to submit a market.')

      if (question.length < 10) throw new Error('Question must be at least 10 characters long.')
      if (!optionA || !optionB) throw new Error('Both options must have titles.')
      if (!endDate) throw new Error('You must set a betting deadline.')
      
      const parsedDate = new Date(endDate)
      if (parsedDate <= new Date()) throw new Error('Deadline must be in the future.')

      const { error: insertError } = await supabase.from('markets').insert({
        creator_id: user.id,
        question,
        description,
        yes_price: 50,
        no_price: 50,
        option_a: optionA,
        option_b: optionB,
        p_initial: 0.5,
        i_initial: 10,
        end_date: parsedDate.toISOString()
      })

      if (insertError) throw insertError

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-6 lg:p-10 font-mono text-black"
    >
      <div className="mb-12 p-8 neo-box bg-[#fef08a]">
        <div className="flex items-center gap-4 mb-4">
          <PlusCircle className="w-8 h-8 text-black" />
          <h1 className="text-4xl font-bold text-black uppercase">Submit a Market</h1>
        </div>
        <p className="text-gray-800 font-bold text-lg">
          Propose a new prediction market for the SM community. Markets currently default to an initial 50¢/50¢ probability.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 neo-box bg-[#fecdd3] text-black font-bold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 neo-box">
        <div>
          <label className="block text-sm font-bold text-black mb-3 uppercase">
            Market Question
          </label>
          <input
            type="text"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Will the upcoming PEP assembly be cancelled?"
            className="w-full neo-input text-lg font-bold placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-3 uppercase">
            Description & Resolution Criteria
          </label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain exactly how and when this market will be resolved. Be specific!"
            rows={4}
            className="w-full neo-input text-lg font-bold placeholder:text-gray-400 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-black mb-3 uppercase">
              Option A (Default: Yes)
            </label>
            <input
              type="text"
              required
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              className="w-full neo-input text-lg font-bold placeholder:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-3 uppercase">
              Option B (Default: No)
            </label>
            <input
              type="text"
              required
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              className="w-full neo-input text-lg font-bold placeholder:text-gray-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-black mb-3 uppercase">
            Betting Deadline
          </label>
          <input
            type="datetime-local"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full neo-input text-lg font-bold placeholder:text-gray-400"
          />
        </div>

        <button 
          type="submit"
          disabled={loading || !question || !description}
          className="w-full py-5 mt-4 neo-box bg-[#bbf7d0] text-black font-bold uppercase text-xl hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:bg-[#a7f3d0] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3"
        >
          {loading && <Loader2 className="w-6 h-6 animate-spin" />}
          Submit for Trading
        </button>
      </form>
    </motion.div>
  )
}
