import { useState, useEffect, useRef } from 'react'
import ContextCard from './components/ContextCard'
import AffectedAreaCard from './components/AffectedAreaCard'
import RiskGauge from './components/RiskGauge'
import IngestPanel from './components/IngestPanel'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CHANGE_TYPE_LABELS = {
  'behavior-change': { label: 'Behavior Change', color: '#d29922' },
  'contract-change': { label: 'Contract Change', color: '#f85149' },
  'refactor-only': { label: 'Refactor Only', color: '#3fb950' },
  'bug-fix': { label: 'Bug Fix', color: '#58a6ff' },
  'feature-addition': { label: 'Feature Addition', color: '#58a6ff' },
  'config-change': { label: 'Config Change', color: '#d29922' },
}

export default function App() {
  const [prUrl, setPrUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [contextItems, setContextItems] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const [showIngest, setShowIngest] = useState(false)

  useEffect(() => {
    fetch(`${BASE_URL}/health`).catch(() => { })
  }, [])

  async function handleAnalyze() {
    if (!prUrl.trim()) return

    abortRef.current = new AbortController()
    setStatus('running')
    setStatusMessage('Starting analysis...')
    setContextItems([])
    setReport(null)
    setError('')

    try {
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Server error')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const event = JSON.parse(line.replace('data: ', ''))

          if (event.event === 'status') setStatusMessage(event.message)
          if (event.event === 'context_found') setContextItems(event.items)
          if (event.event === 'complete') { setReport(event); setStatus('done') }
          if (event.event === 'error') throw new Error(event.message)
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('idle')
        setContextItems([])
      } else {
        setError(err.message)
        setStatus('error')
      }
    }
  }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort()
  }

  const changeType = report ? CHANGE_TYPE_LABELS[report.analysis.change_type] : null

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>
            Blast Radius Analyzer
          </h1>
          <p style={{ color: '#8b949e', fontSize: '14px' }}>
            Understand the real-world impact of a PR before it merges — grounded in your repo's history
          </p>
        </div>
        <button onClick={() => setShowIngest(!showIngest)} style={{
          padding: '8px 16px', fontSize: '13px', fontWeight: 500,
          background: 'transparent', border: '1px solid #30363d',
          borderRadius: '6px', color: '#8b949e', cursor: 'pointer', whiteSpace: 'nowrap'
        }}>
          {showIngest ? 'Hide' : '+ Add repo context'}
        </button>
      </div>

      {showIngest && <IngestPanel onClose={() => setShowIngest(false)} />}

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
        <input
          value={prUrl}
          onChange={e => setPrUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          placeholder="https://github.com/owner/repo/pull/123"
          style={{
            flex: 1, padding: '12px 16px', fontSize: '14px',
            background: '#161b22', border: '1px solid #30363d',
            borderRadius: '8px', color: '#e6edf3', outline: 'none',
          }}
        />
        <button
          onClick={handleAnalyze}
          disabled={status === 'running' || !prUrl.trim()}
          style={{
            padding: '12px 24px', fontSize: '14px', fontWeight: 600,
            background: status === 'running' ? '#21262d' : '#238636',
            color: status === 'running' ? '#8b949e' : '#fff',
            border: '1px solid #2ea043', borderRadius: '8px',
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'running' ? 'Analyzing…' : 'Analyze PR'}
        </button>
        {status === 'running' && (
          <button onClick={handleStop} style={{
            padding: '12px 20px', fontSize: '14px', fontWeight: 600,
            background: '#3d1a1a', color: '#f85149',
            border: '1px solid #f85149', borderRadius: '8px', cursor: 'pointer'
          }}>
            Stop
          </button>
        )}
      </div>

      {/* Running state */}
      {status === 'running' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: '#d29922', marginBottom: contextItems.length ? '16px' : 0 }}>
            ◌ {statusMessage}
          </p>
          {contextItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Found {contextItems.length} related items
              </p>
              {contextItems.map((item, i) => <ContextCard key={i} item={item} />)}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ background: '#3d1a1a', border: '1px solid #f85149', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ color: '#f85149', fontSize: '14px' }}>⚠ {error}</p>
        </div>
      )}

      {/* Report */}
      {report && (
        <div>

          {/* PR header */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>
              {report.pr.owner}/{report.pr.repo} #{report.pr.pullNumber} · by {report.pr.author}
            </p>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e6edf3' }}>{report.pr.title}</h2>
          </div>

          {/* Risk gauge + change type */}
          <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: '10px',
            padding: '24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: '20px'
          }}>
            <RiskGauge score={report.analysis.blast_radius_score} />
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '12px', fontWeight: 600, padding: '4px 12px',
                borderRadius: '20px', border: `1px solid ${changeType.color}`,
                color: changeType.color, display: 'inline-block', marginBottom: '10px'
              }}>
                {changeType.label}
              </span>
              <p style={{ fontSize: '13px', fontWeight: 600, color: report.analysis.safe_to_merge_alone ? '#3fb950' : '#f85149' }}>
                {report.analysis.safe_to_merge_alone ? '✓ Safe to merge alone' : '⚠ Needs broader review'}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#e6edf3' }}>{report.analysis.plain_summary}</p>
          </div>

          {/* Affected areas */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              ⚠ Affected areas
            </p>
            {report.analysis.affected_areas.map((area, i) => <AffectedAreaCard key={i} area={area} />)}
          </div>

          {/* Related history */}
          {report.analysis.related_history.length > 0 && (
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
                🔗 Why this matters — related history
              </p>
              {report.analysis.related_history.map((h, i) => (
                <div key={i} style={{ borderLeft: '2px solid #58a6ff', paddingLeft: '12px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3', marginBottom: '4px' }}>{h.reference}</p>
                  <p style={{ fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>{h.relevance}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommended actions */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px' }}>
            <p style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
              ✅ Recommended actions
            </p>
            {report.analysis.recommended_actions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#3fb950', fontSize: '14px', marginTop: '1px' }}>→</span>
                <p style={{ fontSize: '14px', color: '#c9d1d9', lineHeight: 1.6 }}>{action}</p>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}