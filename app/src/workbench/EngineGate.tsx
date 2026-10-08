// Shows what the engine needs before it can run: consent to download, progress, or an error.
import type { ReactNode } from 'react'
import { ENGINE_DOWNLOAD_BYTES, formatMB } from '../db/engineSize'
import { useEngine } from './EngineContext'

export function EngineGate({ children, dark, compact }: { children: ReactNode; dark?: boolean; compact?: boolean }) {
  const { status, error, consent, request } = useEngine()
  if (status === 'ready') return <>{children}</>
  const box = { padding: compact ? '14px 16px' : '20px', borderRadius: 6, background: dark ? '#1f1f1f' : 'var(--surface)', border: `1px solid ${dark ? 'var(--ed-line)' : 'var(--hair)'}`, margin: dark ? '0 12px' : 0 }
  if (status === 'needs-consent' || status === 'off') {
    return (
      <div style={box}>
        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Run SQL here with a real PostgreSQL engine</p>
        <p style={{ margin: '0 0 14px', fontSize: 14, color: dark ? 'var(--ed-muted)' : 'var(--muted)' }}>
          The first time, this downloads the engine: about <b>{formatMB(ENGINE_DOWNLOAD_BYTES)}</b>. It is kept for offline use. Use Wi-Fi if your data is metered.
        </p>
        <button type="button" className={dark ? 'btn' : 'btn btn-primary'} style={dark ? { background: '#efefec', color: '#151515', borderColor: '#efefec' } : undefined} onClick={status === 'off' ? request : consent}>
          {status === 'off' ? 'Start PostgreSQL' : `Download ${formatMB(ENGINE_DOWNLOAD_BYTES)} and start`}
        </button>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div role="alert" style={box}>
        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>PostgreSQL could not start</p>
        <p className="mono" style={{ margin: '0 0 14px', fontSize: 13 }}>{error}</p>
        <button type="button" className="btn" onClick={consent}>Try again</button>
      </div>
    )
  }
  return (
    <div role="status" aria-live="polite" style={box}>
      <p style={{ margin: 0, fontWeight: 600 }}>{status === 'seeding' ? 'Building the clinic dataset…' : 'Starting PostgreSQL…'}</p>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: dark ? 'var(--ed-muted)' : 'var(--muted)' }}>
        {status === 'seeding' ? 'About 5 to 10 seconds, once. The data is synthetic.' : 'A few seconds; longer the very first time while it downloads.'}
      </p>
    </div>
  )
}
