'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Loader2, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (isSignUp) {
        if (!email.endsWith('@smtexas.org')) {
          throw new Error('You must use an @smtexas.org email address to sign up.')
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSignUpSuccess(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (signUpSuccess) {
    return (
      <div className="min-h-screen bg-[#f4f0e6] flex flex-col justify-center items-center p-6 font-mono text-black">
        <Link href="/" className="mb-8 flex items-center gap-3 group">
          <div className="w-12 h-12 bg-[#bbf7d0] border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
            <BarChart3 className="w-6 h-6 text-black" />
          </div>
          <span className="font-bold text-3xl tracking-tight uppercase">SMalshi</span>
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center"
        >
          <div className="w-16 h-16 bg-[#bbf7d0] border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto mb-6">
            <Mail className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-bold uppercase border-b-4 border-black pb-2 mb-4 inline-block">Check Your Email</h2>
          <p className="text-gray-800 font-bold mt-4 mb-6">
            We sent a confirmation link to <span className="bg-[#fef08a] px-1 border border-black">{email}</span>. Click it to activate your account and start trading.
          </p>
          <button
            onClick={() => { setSignUpSuccess(false); setIsSignUp(false); setPassword('') }}
            className="w-full py-3 bg-[#fef08a] text-black font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Back to Sign In
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f0e6] flex flex-col justify-center items-center p-6 selection:bg-[#fef08a] font-mono text-black">
      <Link href="/" className="mb-8 flex items-center gap-3 group">
        <div className="w-12 h-12 bg-[#bbf7d0] border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
          <BarChart3 className="w-6 h-6 text-black" />
        </div>
        <span className="font-bold text-3xl tracking-tight uppercase">SMalshi</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <h2 className="text-3xl font-bold text-black mb-2 uppercase border-b-4 border-black pb-2 inline-block">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-gray-800 font-bold mb-8 mt-4">
          {isSignUp ? 'Sign up with your @smtexas.org email to get 1,000 free credits.' : 'Sign in to manage your portfolio.'}
        </p>

        {error && (
          <div className="mb-6 p-4 border-2 border-black bg-[#fecdd3] text-black font-bold text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-black mb-2 uppercase">School Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="id@smtexas.org"
              className="w-full px-4 py-3 neo-input text-lg font-bold placeholder:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-2 uppercase">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 neo-input text-lg font-bold placeholder:text-gray-400"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-[#fef08a] text-black font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-center items-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t-2 border-black text-center text-sm font-bold text-black uppercase">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-black bg-[#bbf7d0] px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all ml-2"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
