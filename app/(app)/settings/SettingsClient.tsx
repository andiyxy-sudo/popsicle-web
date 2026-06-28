'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'

interface SettingsClientProps {
  user: { email: string; id: string }
}

export function SettingsClient({ user }: SettingsClientProps) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwStatus, setPwStatus] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [changing, setChanging] = useState(false)
  const supabase = createClient()

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      setPwStatus({ type: 'error', msg: 'Passwords do not match.' })
      return
    }
    if (newPw.length < 8) {
      setPwStatus({ type: 'error', msg: 'Password must be at least 8 characters.' })
      return
    }
    setChanging(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwStatus({ type: 'error', msg: error.message })
    } else {
      setPwStatus({ type: 'ok', msg: 'Password updated.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setChanging(false)
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r)',
      boxShadow: 'var(--sh-sm)', border: '1px solid var(--border-soft)',
      overflow: 'hidden', marginBottom: 20,
    }}>
      <div style={{
        padding: '16px 22px', borderBottom: '1px solid var(--border-soft)',
        fontSize: 13, fontWeight: 700, color: 'var(--t1)',
      }}>
        {title}
      </div>
      <div style={{ padding: '22px' }}>{children}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.8px', marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>Manage your account preferences.</p>
      </div>

      <Section title="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(140deg,#FFB347,#FF6B35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
          }}>
            {getInitials(user.email.split('@')[0])}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
              {user.email.split('@')[0]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{user.email}</div>
          </div>
        </div>
      </Section>

      <Section title="Change password">
        <form onSubmit={handleChangePassword}>
          {pwStatus && (
            <div style={{
              background: pwStatus.type === 'ok' ? 'var(--ok-bg)' : 'var(--danger-bg)',
              border: `1px solid ${pwStatus.type === 'ok' ? 'var(--ok-bd)' : 'var(--danger-bd)'}`,
              borderRadius: 'var(--r-sm)', padding: '10px 14px',
              marginBottom: 16, fontSize: 13,
              color: pwStatus.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
            }}>
              {pwStatus.msg}
            </div>
          )}

          {[
            { label: 'New password', value: newPw, setter: setNewPw },
            { label: 'Confirm password', value: confirmPw, setter: setConfirmPw },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>
                {field.label}
              </label>
              <input
                type="password"
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 13px',
                  background: 'var(--inset)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--t1)',
                  outline: 'none', fontFamily: "'Outfit', sans-serif",
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--o)'; e.target.style.boxShadow = '0 0 0 3px var(--o-bg)'; e.target.style.background = 'var(--surface)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--inset)' }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={changing}
            style={{
              marginTop: 4, padding: '10px 20px',
              background: 'var(--o)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
              cursor: changing ? 'not-allowed' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              opacity: changing ? 0.7 : 1,
            }}
          >
            {changing ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </Section>

      <Section title="Workspace">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Supabase project</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', fontFamily: "'DM Mono', monospace" }}>
              jvxfcvkxaqwcnkrxexso
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>User ID</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', fontFamily: "'DM Mono', monospace", maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.id}
            </span>
          </div>
        </div>
      </Section>
    </div>
  )
}
