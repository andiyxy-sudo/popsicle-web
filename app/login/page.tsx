'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
        router.push('/pulse')
        router.refresh()
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/pulse')
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
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/pulse` },
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10050,
      background: '#F8F5F0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes loginIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .login-card {
          width: 420px;
          background: #FFFFFF;
          border: 1px solid #F0EDE8;
          border-radius: 18px;
          padding: 40px;
          box-shadow: 0 16px 48px rgba(15,12,9,.12), 0 6px 16px rgba(15,12,9,.08);
          animation: loginIn .5s cubic-bezier(0,.6,.4,1);
        }

        .login-input {
          width: 100%; padding: 11px 14px;
          background: #F0EDE7;
          border: 1px solid #E4DDD3;
          border-radius: 9px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px; color: #4A3C32;
          outline: none; margin-bottom: 10px; display: block;
          box-shadow: inset 0 1px 3px rgba(15,12,9,.05);
          transition: all .15s;
        }
        .login-input:focus {
          border-color: #FF6B35;
          box-shadow: inset 0 1px 3px rgba(15,12,9,.05), 0 0 0 3px rgba(255,107,53,.06);
          background: #FFFFFF;
        }
        .login-input::placeholder { color: #B0A89C; }

        .login-btn {
          width: 100%; padding: 12px;
          background-color: #FF8040;
          background-image: radial-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(140deg,#FFB347 0%,#FF8C42 40%,#FF6B35 100%);
          background-size: 18px 18px, 100% 100%;
          color: #fff; border: none; border-radius: 9px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 4px;
          box-shadow: 0 3px 14px rgba(255,107,53,.22);
          transition: all .15s;
        }
        .login-btn:hover { background: #E55A22; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,107,53,.22); }
        .login-btn:active { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .login-divider {
          text-align: center; font-size: 11px; color: #B0A89C;
          margin: 18px 0 12px; position: relative;
        }
        .login-divider::before, .login-divider::after {
          content: ''; position: absolute; top: 50%; width: 38%; height: 1px; background: #E4DDD3;
        }
        .login-divider::before { left: 0; }
        .login-divider::after  { right: 0; }

        .login-social { display: flex; gap: 8px; }
        .login-social button {
          flex: 1; padding: 9px;
          background: #F0EDE7; border: 1px solid #E4DDD3; border-radius: 9px;
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 600; color: #6B5C50;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
          box-shadow: 0 1px 3px rgba(15,12,9,.06), 0 1px 2px rgba(15,12,9,.04);
          transition: all .15s;
        }
        .login-social button:hover { border-color: #FF6B35; color: #FF6B35; transform: translateY(-1px); }

        .login-demo-btn {
          width: 100%; padding: 14px 18px;
          font-family: 'Outfit', sans-serif;
          background: linear-gradient(145deg,#FF7028,#E8520A,#D44208);
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 13px;
          cursor: pointer;
          margin-bottom: 6px;
          box-shadow: 0 4px 20px rgba(232,88,10,.45), 0 1px 3px rgba(232,88,10,.25), inset 0 1px 0 rgba(255,255,255,.12);
          transition: all .18s;
          position: relative; overflow: hidden;
        }
        .login-demo-btn::before {
          content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.06));
          pointer-events: none;
        }
        .login-demo-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(232,88,10,.55), 0 2px 6px rgba(232,88,10,.3), inset 0 1px 0 rgba(255,255,255,.12);
        }
        .login-demo-btn:active { transform: translateY(0); }
        .login-demo-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>

      <div className="login-card">

        {/* Logo — vertical: icon centered, wordmark below */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          <svg width="44" height="80" viewBox="4 0 40 80" fill="none">
            <defs>
              <linearGradient id="lg-lo" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF6B35"/>
                <stop offset="100%" stopColor="#FFD166"/>
              </linearGradient>
            </defs>
            <path d="M4 22C4 10.954 12.954 2 24 2h0c11.046 0 20 8.954 20 20v28c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V22z" fill="url(#lg-lo)"/>
            <path d="M17 54h14v20a4 4 0 01-4 4h-6a4 4 0 01-4-4V54z" fill="#E85A25"/>
            <path d="M25 16L17 34h6l-4 14 12-18h-6l4-14z" fill="white" fillOpacity=".95"/>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.8px', color: '#4A3C32', lineHeight: 1 }}>popsicle</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: '.4em', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>labs</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.18)',
            borderRadius: 9, padding: '10px 14px', marginBottom: 12,
            fontSize: 13, color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        {/* Notice */}
        {notice && (
          <div style={{
            background: 'rgba(22,163,74,.07)', border: '1px solid rgba(22,163,74,.18)',
            borderRadius: 9, padding: '10px 14px', marginBottom: 12,
            fontSize: 13, color: '#16A34A',
          }}>
            {notice}
          </div>
        )}

        {/* Demo button */}
        <button className="login-demo-btn" onClick={handleDemo} disabled={loading}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left', fontFamily: "'Outfit', sans-serif" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>Try demo account</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 1, fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>Full access · No signup · Instant</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 18, color: 'rgba(255,255,255,.7)' }}>→</div>
          </div>
        </button>

        {/* Divider */}
        <div className="login-divider">{mode === 'signup' ? 'create your account' : 'or sign in with email'}</div>

        {/* Email + Password */}
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              className="login-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}
          <input
            className="login-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder={mode === 'signup' ? 'Choose a password' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="login-btn" type="submit" disabled={loading}>
            {loading
              ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
              : (mode === 'signup' ? 'Create Account →' : 'Sign In →')}
          </button>
        </form>

        {/* Mode toggle */}
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#6B5C50' }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <span
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null) }}
            style={{ color: '#FF6B35', fontWeight: 700, cursor: 'pointer' }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </span>
        </div>

        {/* Social */}
        <div className="login-divider" style={{ marginTop: 16 }}>or continue with</div>
        <div className="login-social">
          <button type="button" onClick={handleGoogle} disabled={loading}>
            <svg width="15" height="15" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.58-13.46-8.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z"/>
            </svg>
            Google
          </button>
          <button type="button" title="Coming soon" disabled>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <polyline points="22 7 12 13 2 7"/>
            </svg>
            SSO
          </button>
        </div>

        {/* Revenue loop pipeline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '22px 0 0', borderTop: '1px solid #F0EDE8', marginTop: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4A3C32', letterSpacing: '-.1px' }}>Signals</span>
          <span style={{ color: '#B0A89C', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>›</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4A3C32', letterSpacing: '-.1px' }}>Cases</span>
          <span style={{ color: '#B0A89C', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>›</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4A3C32', letterSpacing: '-.1px' }}>Actions</span>
          <span style={{ color: '#B0A89C', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>›</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4A3C32', letterSpacing: '-.1px' }}>Impact</span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 11, color: '#B0A89C' }}>
            {['Security', 'Privacy', 'Terms'].map((t, i) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ cursor: 'pointer', transition: 'color .15s' }}
                  onMouseOver={e => (e.currentTarget.style.color = '#6B5C50')}
                  onMouseOut={e => (e.currentTarget.style.color = '#B0A89C')}
                >
                  {t}
                </span>
                {i < 2 && <span style={{ opacity: .4 }}>·</span>}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
