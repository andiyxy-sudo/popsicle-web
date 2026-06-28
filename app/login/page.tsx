'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('Check your email to confirm your account, then sign in.')
        setMode('login')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Background texture */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(ellipse at 60% 20%, rgba(255,107,53,.07) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(255,107,53,.04) 0%, transparent 50%)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#FF6B35"/>
              <rect x="10" y="8" width="6" height="24" rx="3" fill="white"/>
              <rect x="20" y="14" width="6" height="18" rx="3" fill="rgba(255,255,255,0.7)"/>
              <rect x="30" y="18" width="0" height="0" rx="3" fill="rgba(255,255,255,0.5)"/>
              <circle cx="30" cy="20" r="4" fill="rgba(255,255,255,0.9)"/>
            </svg>
            <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1px' }}>
              Popsicle
            </span>
          </div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--o)', letterSpacing: '0.4em', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>
            Revenue Intelligence
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          padding: '36px',
          boxShadow: 'var(--sh-lg)',
          border: '1px solid var(--border-soft)',
        }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px', letterSpacing: '-0.5px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '28px' }}>
            {mode === 'login' ? 'Sign in to your workspace' : 'Get started with Popsicle'}
          </p>

          {error && (
            <div style={{
              background: error.includes('Check your email') ? 'var(--ok-bg)' : 'var(--danger-bg)',
              border: `1px solid ${error.includes('Check your email') ? 'var(--ok-bd)' : 'var(--danger-bd)'}`,
              borderRadius: 'var(--r-sm)',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '13px',
              color: error.includes('Check your email') ? 'var(--ok)' : 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--t2)', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'var(--inset)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', fontSize: '14px',
                  color: 'var(--t1)', outline: 'none',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--o)'
                  e.target.style.boxShadow = '0 0 0 3px var(--o-bg)'
                  e.target.style.background = 'var(--surface)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = 'var(--inset)'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--t2)', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'var(--inset)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', fontSize: '14px',
                  color: 'var(--t1)', outline: 'none',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--o)'
                  e.target.style.boxShadow = '0 0 0 3px var(--o-bg)'
                  e.target.style.background = 'var(--surface)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = 'var(--inset)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? 'var(--t4)' : 'var(--o)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', fontSize: '14px',
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif",
                transition: 'all .15s',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(255,107,53,.3)',
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: 'var(--t3)',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span style={{ color: 'var(--o)', fontWeight: 600 }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'var(--t4)' }}>
          Popsicle Labs &copy; 2026
        </p>
      </div>
    </div>
  )
}
