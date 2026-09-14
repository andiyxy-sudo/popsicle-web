'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function pendingNext(): string {
  if (typeof window === 'undefined') return '/pulse'
  const next = new URLSearchParams(window.location.search).get('next') || ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/pulse'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) throw error
        // If email confirmation is on, there is no session yet.
        if (!data.session) {
          setNotice('Account created. Check your email to confirm, then sign in.')
          setMode('signin')
          return
        }
        router.push(pendingNext())
        router.refresh()
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(pendingNext())
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(pendingNext())}` },
      })
      if (error) throw error
      // On success the browser is redirected to Google; nothing else to do here.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in is unavailable.'
      setError(
        /provider is not enabled/i.test(msg)
          ? 'Google sign-in is not enabled yet. Enable the Google provider in Supabase Auth settings.'
          : msg,
      )
      setLoading(false)
    }
  }

  async function handleDemo() {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@popsicle-labs.app',
        password: 'demo1234',
      })
      if (error) throw error
      router.push('/pulse')
      router.refresh()
    } catch {
      setError('Demo account unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: '#FBF8F3', overflowY: 'auto', fontFamily: "'Outfit', sans-serif", color: '#0E0D0B' }}>
      {/* warm corner wash */}
      <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 'min(900px,100%)', height: 900, pointerEvents: 'none', background: 'radial-gradient(120% 90% at 90% -10%, rgba(255,138,80,.22), rgba(255,138,80,0) 70%)' }} />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        .lg-in { width:100%; padding:14px 16px; border:0; background:#F0EDE7; font:inherit; font-size:14px; color:#0E0D0B; outline:none; }
        .lg-in::placeholder { color:#A09C97; }
        .lg-in:focus { box-shadow: inset 0 0 0 1.5px #0E0D0B; }
        .lg-rule { display:flex; align-items:center; gap:14px; font-family:'DM Mono',monospace; font-size:9.5px; letter-spacing:1.8px; text-transform:uppercase; color:#A09C97; margin:22px 0; }
        .lg-rule::before, .lg-rule::after { content:''; flex:1; height:1px; background:#EFEAE1; }
        .lg-alt { flex:1; padding:12px 0; background:#FFFDFA; border:1px solid #E5DFD4; font:inherit; font-size:13px; font-weight:500; color:#0E0D0B; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; transition:border-color .2s; }
        .lg-alt:hover { border-color:#0E0D0B; }
      `}</style>

      <div style={{ position: 'relative', width: 'min(340px, calc(100vw - 40px))', margin: '0 auto', padding: '72px 0 64px', animation: 'fadeUp .6s both' }}>
        {/* brand */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-vertical.svg" alt="Popsicle Labs" style={{ height: 92, width: 'auto' }} />
        </div>

        {/* demo banner */}
        <button onClick={handleDemo} disabled={loading} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '16px 18px', border: 0, cursor: 'pointer',
          background: 'linear-gradient(135deg, #FF8A50, #FF6B35)', color: '#fff', fontFamily: 'inherit',
          boxShadow: '0 10px 26px -12px rgba(255,107,53,.7)', opacity: loading ? .7 : 1,
        }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <svg width="9" height="10" viewBox="0 0 9 10" fill="#fff"><path d="M0 0l9 5-9 5z"/></svg>
          </span>
          <span style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Try the demo account</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,.85)', marginTop: 1 }}>Full access · no signup · instant</span>
          </span>
        </button>

        <div className="lg-rule">{mode === 'signup' ? 'create your account' : 'or sign in with email'}</div>

        {error && <div style={{ fontSize: 12.5, color: '#c43d2b', marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}
        {notice && <div style={{ fontSize: 12.5, color: '#2f8f5b', marginBottom: 12, lineHeight: 1.5 }}>{notice}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input className="lg-in" style={{ marginBottom: 8 }} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input className="lg-in" style={{ marginBottom: 8 }} type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="lg-in" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#5C5855' }}>
              <span style={{ width: 34, height: 19, borderRadius: 999, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', position: 'relative', flex: 'none' }}>
                <span style={{ position: 'absolute', top: 2.5, right: 2.5, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
              </span>
              Keep me signed in
            </span>
            <span style={{ fontSize: 13, color: '#5C5855' }}>Forgot password?</span>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px 0', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            background: email && password ? '#0E0D0B' : '#E9E4DA', color: email && password ? '#FBF8F3' : '#8A857F',
            fontSize: 14, fontWeight: 600, transition: 'background .2s',
          }}>{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#5C5855', marginTop: 16 }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <span onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null) }} style={{ color: '#E85A25', fontWeight: 600, cursor: 'pointer' }}>
            {mode === 'signup' ? 'Sign in' : 'Request access'}
          </span>
        </div>

        <div className="lg-rule">or continue with</div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="lg-alt" onClick={handleGoogle} disabled={loading}>
            <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 010-4.22V7.05H2.18a11 11 0 000 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38z"/></svg>
            Google
          </button>
          <button className="lg-alt" onClick={() => setError('SSO is not enabled on this workspace yet.')}>SSO / SAML</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 34, fontSize: 12, color: '#8A857F' }}>
          <span>Security</span><span>·</span><span>Privacy</span><span>·</span><span>Terms</span>
        </div>
      </div>
    </div>
  )
}
