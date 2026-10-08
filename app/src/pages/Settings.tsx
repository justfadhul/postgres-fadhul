import { useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { SIZES, type SizeName } from '@content/datasets/clinic'
import { ENGINE_DOWNLOAD_BYTES, formatMB } from '../db/engineSize'
import { applyTheme, readTheme, type Theme } from '../lib/theme'
import { useWide } from '../lib/useWide'
import { useRecord } from '../storage/hooks'
import { exportAll, importAll, mergeImport, put } from '../storage/store'
import { saveFile } from '../lib/saveFile'
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
  const mergeInput = useRef<HTMLInputElement>(null)

  async function doExport(share: boolean) {
    const data = await exportAll()
    if (!(await saveFile(fileName(), JSON.stringify(data, null, 2), 'application/json', share))) return // share sheet closed
    await put('settings', 'lastExportAt', new Date().toISOString())
    setMessage(`Exported ${fileName()}. Keep it somewhere safe, such as iCloud Drive.`)
  }

  async function doMerge(f: File) {
    try {
      const c = await mergeImport(JSON.parse(await f.text()))
      const parts = [
        [c.progress, 'lesson'], [c.answers, 'quick-check answer'], [c.attempts, 'challenge'], [c.annotations, 'highlight'], [c.drafts, 'draft'], [c.activity, 'day of study time'],
      ].filter(([n]) => (n as number) > 0).map(([n, w]) => `${n} ${w}${n === 1 ? '' : w === 'day of study time' ? '' : 's'}`)
      setMessage(parts.length
        ? `Added from the file: ${parts.join(', ')}. Nothing on this device was lost.`
        : 'This device already had everything in that file.')
    } catch (e) {
      setMessage(`Could not add that file: ${(e as Error).message}`)
    }
  }

  async function doImport(f: File) {
    try {
      const data = JSON.parse(await f.text())
      if (!window.confirm('Replace the progress on this device with the file? This cannot be undone.')) return
      const counts = await importAll(data)
      setMessage(`Imported: ${counts.progress} lesson records, ${counts.answers} quick-check answers, ${counts.attempts} challenge attempts, ${counts.annotations} highlights.`)
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`)
    }
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className={wide ? 'page-wide' : 'page'} style={wide ? { maxWidth: 900 } : undefined}>
      <h1 className="display" style={{ fontSize: wide ? 96 : 48, marginBottom: 24 }}>Settings</h1>

      <Section title="Your phone and your computer" id="backup">
        <p>
          Your progress lives in this browser only: there is no account and nothing is sent to a server. To carry on
          from another device, send it a progress file. Opening the file there <b>adds</b> this device's work to it:
          lessons done stay done, passed challenges stay passed, and the newer answer or highlight wins. Nothing on
          either side is lost.
        </p>
        <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 15 }}>
          <li>Here, tap <b>Send to my other device</b> (AirDrop, Messages or iCloud Drive on an iPhone; a download on a computer).</li>
          <li>There, open this site, go to Settings, and tap <b>Add progress from a file</b>.</li>
          <li>To have the same on both, do it once in each direction.</li>
        </ol>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={() => void doExport(canShare)}>{canShare ? 'Send to my other device…' : 'Save a progress file'}</button>
          <button type="button" className="btn" onClick={() => mergeInput.current?.click()}>Add progress from a file…</button>
          <input ref={mergeInput} type="file" accept="application/json,.json" className="visually-hidden" aria-label="Choose a progress file to add" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doMerge(f); e.target.value = '' }} />
        </div>
        {message && <p role="status" className="notice" style={{ marginTop: 14 }}>{message}</p>}
        <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
          The same file is your backup: Safari can clear a site's data if it goes unused for weeks, so keep a recent one
          somewhere safe, such as iCloud Drive. {lastExport ? `Last saved ${new Date(lastExport).toLocaleString('en-GB')}.` : 'Not saved yet.'}
        </p>
        <details className="disclosure">
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Replace everything with a file</summary>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>Wipes this device's progress and uses the file's instead, for restoring a backup exactly.</p>
          {canShare && <button type="button" className="btn" style={{ marginRight: 10 }} onClick={() => void doExport(false)}>Download a progress file</button>}
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Replace from file…</button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" aria-label="Choose an export file to replace this device's progress" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
        </details>
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
