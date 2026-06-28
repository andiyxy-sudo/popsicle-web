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

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
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
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Demo account unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F0EB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #B8AFA8; }
        input:focus { outline: none; }
        .input-field {
          width: 100%;
          padding: 14px 16px;
          background: #EDEAE5;
          border: 1.5px solid transparent;
          border-radius: 12px;
          font-size: 14px;
          color: #3D2F25;
          font-family: 'Outfit', sans-serif;
          transition: all .18s;
        }
        .input-field:focus {
          border-color: #FF6B35;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(255,107,53,.1);
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E0D9D2;
        }
        .divider span {
          font-size: 12px;
          color: #A09086;
          white-space: nowrap;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 4px 24px rgba(255,107,53,.35); }
          50% { box-shadow: 0 4px 36px rgba(255,107,53,.55); }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Ice cream popsicle SVG icon */}
          <div style={{ marginBottom: 10 }}>
            <svg width="72" height="80" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Stick */}
              <rect x="31" y="54" width="10" height="22" rx="5" fill="#D4845A"/>
              {/* Body */}
              <rect x="8" y="8" width="56" height="52" rx="28" fill="url(#popgrad)"/>
              {/* Lightning bolt */}
              <path d="M42 18L28 38H36L30 54L46 30H38L42 18Z" fill="white" fillOpacity="0.9"/>
              <defs>
                <linearGradient id="popgrad" x1="8" y1="8" x2="64" y2="60" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFB347"/>
                  <stop offset="100%" stopColor="#FF6B35"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#2D1F14', letterSpacing: '-1px', lineHeight: 1 }}>
            popsicle
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#FF6B35', letterSpacing: '0.35em', marginTop: 3 }}>
            LABS
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 24,
          padding: '28px 28px 24px',
          boxShadow: '0 8px 40px rgba(45,31,20,.1), 0 2px 8px rgba(45,31,20,.06)',
        }}>

          {/* Demo banner */}
          <button
            onClick={handleDemo}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 60%, #E85520 100%)',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              marginBottom: 20,
              animation: 'pulse-glow 2.5s ease-in-out infinite',
              transition: 'transform .15s',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {/* shimmer */}
            <div style={{
              position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent)',
              animation: 'shimmer 2s ease-in-out infinite',
            }}/>
            <style>{`@keyframes shimmer { 0%{left:-100%} 100%{left:200%} }`}</style>

            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                Try demo account
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
                Full access · No signup · Instant
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>

          {/* Divider */}
          <div className="divider"><span>or sign in with email</span></div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.18)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="andy@popsicle-labs.app"
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#F0A882' : 'linear-gradient(135deg, #FF8C42, #FF6B35)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif",
                boxShadow: loading ? 'none' : '0 4px 16px rgba(255,107,53,.35)',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {loading ? 'Signing in...' : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="divider" style={{ margin: '18px 0' }}><span>or continue with</span></div>

          {/* Social buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              style={{
                flex: 1, padding: '11px', borderRadius: 12,
                background: '#F5F1ED', border: '1.5px solid #E8E2DA',
                cursor: 'not-allowed', opacity: 0.6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13, fontWeight: 600, color: '#5C4A3A',
                fontFamily: "'Outfit', sans-serif",
              }}
              title="Coming soon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              style={{
                flex: 1, padding: '11px', borderRadius: 12,
                background: '#F5F1ED', border: '1.5px solid #E8E2DA',
                cursor: 'not-allowed', opacity: 0.6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13, fontWeight: 600, color: '#5C4A3A',
                fontFamily: "'Outfit', sans-serif",
              }}
              title="Coming soon"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              SSO
            </button>
          </div>
        </div>

        {/* Footer nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, marginTop: 24, flexWrap: 'wrap',
        }}>
          {[
            { icon: '↗', label: 'Signals' },
            { icon: '⊡', label: 'Cases' },
            { icon: '⚡', label: 'Actions' },
            { icon: '↗', label: 'Impact' },
          ].map((item, i) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, color: '#FF6B35',
              }}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                {item.label}
              </span>
              {i < 3 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4BAB2" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
          {['Security', 'Privacy', 'Terms'].map((t, i) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontSize: 11, color: '#A09086', cursor: 'pointer' }}>{t}</span>
              {i < 2 && <span style={{ color: '#D4CCC6', fontSize: 11 }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
