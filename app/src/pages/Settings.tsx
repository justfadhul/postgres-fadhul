import { useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { SIZES, type SizeName } from '@content/datasets/clinic'
import { ENGINE_DOWNLOAD_BYTES, formatMB } from '../db/engineSize'
import { applyTheme, readTheme, type Theme } from '../lib/theme'
import { useWide } from '../lib/useWide'
import { useRecord } from '../storage/hooks'
import { exportAll, importAll, put } from '../storage/store'
import { useEngine } from '../workbench/EngineContext'

function fileName() {
  const d = new Date()
  return `dsm-progress-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
}

export function Settings() {
  const wide = useWide()
  const lastExport = useRecord<string>('settings', 'lastExportAt')
  const [message, setMessage] = useState('')
  const [theme, setTheme] = useState<Theme>(readTheme)
  const fileInput = useRef<HTMLInputElement>(null)

  async function doExport(share: boolean) {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const file = new File([blob], fileName(), { type: 'application/json' })
    if (share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Data Systems Mastery progress' })
      } catch {
        return // the learner closed the share sheet
      }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    await put('settings', 'lastExportAt', new Date().toISOString())
    setMessage(`Exported ${file.name}. Keep it somewhere safe, such as iCloud Drive.`)
  }

  async function doImport(f: File) {
    try {
      const data = JSON.parse(await f.text())
      if (!window.confirm('Replace the progress on this device with the file? This cannot be undone.')) return
      const counts = await importAll(data)
      setMessage(`Imported: ${counts.progress} lesson records, ${counts.answers} quick-check answers, ${counts.attempts} challenge attempts.`)
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`)
    }
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className={wide ? 'page-wide' : 'page'} style={wide ? { maxWidth: 900 } : undefined}>
      <h1 className="display" style={{ fontSize: wide ? 96 : 48, marginBottom: 24 }}>Settings</h1>

      <Section title="Back up your progress" id="backup">
        <p>
          Your progress lives only in this browser. Safari can clear it if the site goes unused for a while, so export a
          backup after each module. Adding the site to your Home Screen also protects it.
        </p>
        <p className="muted" style={{ fontSize: 14 }}>{lastExport ? `Last export: ${new Date(lastExport).toLocaleString('en-GB')}` : 'Not exported yet.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {canShare && <button type="button" className="btn btn-primary" onClick={() => void doExport(true)}>Export and share…</button>}
          <button type="button" className={`btn${canShare ? '' : ' btn-primary'}`} onClick={() => void doExport(false)}>Download export file</button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Import from file…</button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" aria-label="Choose an export file to import" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
        </div>
        {message && <p role="status" className="notice" style={{ marginTop: 14 }}>{message}</p>}
      </Section>

      <Section title="Appearance">
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 10 }}>
          <legend className="visually-hidden">Theme</legend>
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} className={`btn${theme === t ? ' btn-primary' : ''}`} onClick={() => { applyTheme(t); setTheme(t) }}>
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </fieldset>
      </Section>

      <EngineSection />
      <StorageSection />

      <Section title="More">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li><Link href="/resources" className="link">Free resources</Link></li>
          <li><Link href="/spikes" className="link">Engine check (technical tests for this browser)</Link></li>
        </ul>
      </Section>
    </div>
  )
}

function EngineSection() {
  const { dataset } = useEngine()
  return <EngineSectionInner key={dataset} />
}

function EngineSectionInner() {
  const { status, version, dataset, reset, request } = useEngine()
  const [size, setSize] = useState<SizeName>(dataset)
  return (
    <Section title="Database">
      <p>
        The workbench runs PostgreSQL in this browser (a {formatMB(ENGINE_DOWNLOAD_BYTES)} download, kept for offline use)
        on a synthetic clinic dataset. No real patient data is used anywhere.
      </p>
      <p className="muted" style={{ fontSize: 14 }}>
        {status === 'ready' ? `Running ${version}, ${dataset} dataset.` : status === 'off' ? 'Not started yet.' : `Status: ${status}.`}
      </p>
      {status === 'ready' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            Dataset
            <select value={size} onChange={(e) => setSize(e.target.value as SizeName)} style={{ minHeight: 44, borderRadius: 4, border: '1px solid var(--hair)', background: 'var(--surface)', padding: '0 10px' }}>
              {(Object.keys(SIZES) as SizeName[]).filter((s) => s !== 'tiny').map((s) => (
                <option key={s} value={s}>{s[0]?.toUpperCase()}{s.slice(1)} · {SIZES[s].visits.toLocaleString('en-GB')} visits</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => { if (window.confirm('Rebuild the clinic dataset? Any tables you created in the clinic schema are removed.')) void reset(size) }}>
            Rebuild dataset
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={request}>Start the database</button>
      )}
    </Section>
  )
}

function StorageSection() {
  const [info, setInfo] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setInfo(`About ${Math.round((e.usage ?? 0) / 1e6)} MB used by this site.`))
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])
  return (
    <Section title="Storage">
      <p className="muted" style={{ fontSize: 14 }}>{info} {persisted === true ? 'The browser has agreed to keep this data.' : persisted === false ? 'The browser may clear this data under storage pressure.' : ''}</p>
      {persisted === false && (
        <button type="button" className="btn" onClick={() => void navigator.storage.persist().then(setPersisted)}>Ask the browser to keep my data</button>
      )}
    </Section>
  )
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ padding: '22px 0 26px', borderTop: '2px solid var(--ink)' }}>
      <h2 className="eyebrow" style={{ marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  )
}
