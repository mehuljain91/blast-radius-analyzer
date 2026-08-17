import { useState } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function IngestPanel({ onClose }) {
    const [owner, setOwner] = useState('')
    const [repo, setRepo] = useState('')
    const [commitCount, setCommitCount] = useState(20)
    const [status, setStatus] = useState('idle') // idle | running | done | error
    const [progressMessage, setProgressMessage] = useState('')
    const [completedItems, setCompletedItems] = useState([])
    const [failedItems, setFailedItems] = useState([])
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    async function handleIngest() {
        if (!owner.trim() || !repo.trim()) return

        setStatus('running')
        setError('')
        setResult(null)
        setCompletedItems([])
        setFailedItems([])
        setProgress({ current: 0, total: 0 })
        setProgressMessage('Starting...')

        try {
            const response = await fetch(`${BASE_URL}/ingest/repo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: owner.trim(), repo: repo.trim(), commitCount }),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Ingestion failed')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
                for (const line of lines) {
                    const event = JSON.parse(line.replace('data: ', ''))

                    if (event.event === 'progress') {
                        setProgressMessage(event.message)
                        if (event.total) setProgress({ current: 0, total: event.total })
                    }
                    if (event.event === 'item_done') {
                        setCompletedItems(prev => [...prev, event])
                        if (event.total) setProgress({ current: event.current, total: event.total })
                    }
                    if (event.event === 'item_failed') {
                        setFailedItems(prev => [...prev, event])
                        if (event.total) setProgress({ current: event.current, total: event.total })
                    }
                    if (event.event === 'item_skipped') {
                        setProgressMessage(`Skipped: ${event.reason}`)
                    }
                    if (event.event === 'complete') {
                        setResult(event)
                        setStatus('done')
                    }
                    if (event.event === 'error') {
                        throw new Error(event.message)
                    }
                }
            }
        } catch (err) {
            setError(err.message)
            setStatus('error')
        }
    }

    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

    return (
        <div style={{
            background: '#161b22', border: '1px solid #30363d',
            borderRadius: '10px', padding: '20px', marginBottom: '24px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '4px' }}>
                        Add repository context
                    </p>
                    <p style={{ fontSize: '12px', color: '#8b949e' }}>
                        Ingest commits + README so the analyzer has history to reason against
                    </p>
                </div>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#8b949e',
                    fontSize: '18px', cursor: 'pointer', lineHeight: 1
                }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    disabled={status === 'running'}
                    placeholder="owner (e.g. expressjs)"
                    style={{
                        flex: 1, padding: '10px 12px', fontSize: '13px',
                        background: '#0d1117', border: '1px solid #30363d',
                        borderRadius: '6px', color: '#e6edf3', outline: 'none',
                    }}
                />
                <input
                    value={repo}
                    onChange={e => setRepo(e.target.value)}
                    disabled={status === 'running'}
                    placeholder="repo (e.g. express)"
                    style={{
                        flex: 1, padding: '10px 12px', fontSize: '13px',
                        background: '#0d1117', border: '1px solid #30363d',
                        borderRadius: '6px', color: '#e6edf3', outline: 'none',
                    }}
                />
                <input
                    type="number"
                    value={commitCount}
                    disabled={status === 'running'}
                    onChange={e => setCommitCount(Math.min(50, Math.max(5, Number(e.target.value))))}
                    style={{
                        width: '70px', padding: '10px 12px', fontSize: '13px',
                        background: '#0d1117', border: '1px solid #30363d',
                        borderRadius: '6px', color: '#e6edf3', outline: 'none',
                    }}
                />
            </div>

            <button
                onClick={handleIngest}
                disabled={status === 'running' || !owner.trim() || !repo.trim()}
                style={{
                    width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600,
                    background: status === 'running' ? '#21262d' : '#1f6feb',
                    color: status === 'running' ? '#8b949e' : '#fff',
                    border: '1px solid #388bfd', borderRadius: '6px',
                    cursor: status === 'running' || !owner.trim() || !repo.trim() ? 'not-allowed' : 'pointer',
                }}
            >
                {status === 'running' ? 'Ingesting…' : 'Ingest repository'}
            </button>

            {/* Live progress */}
            {status === 'running' && (
                <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#d29922', marginBottom: '10px' }}>◌ {progressMessage}</p>

                    {progress.total > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#8b949e' }}>
                                    {progress.current} / {progress.total} commits
                                </span>
                                <span style={{ fontSize: '11px', color: '#8b949e' }}>{percent}%</span>
                            </div>
                            <div style={{ height: '6px', background: '#0d1117', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${percent}%`, height: '100%', background: '#1f6feb',
                                    borderRadius: '3px', transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Scrollable live log */}
                    <div style={{
                        maxHeight: '140px', overflowY: 'auto', background: '#0d1117',
                        border: '1px solid #30363d', borderRadius: '6px', padding: '10px',
                        display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                        {completedItems.map((item, i) => (
                            <p key={`done-${i}`} style={{ fontSize: '11px', color: '#3fb950', fontFamily: 'monospace' }}>
                                ✓ {item.type === 'readme' ? 'README' : `${item.sha}`} {item.label ? `— ${item.label}` : ''}
                            </p>
                        ))}
                        {failedItems.map((item, i) => (
                            <p key={`fail-${i}`} style={{ fontSize: '11px', color: '#f85149', fontFamily: 'monospace' }}>
                                ✕ {item.sha} — failed: {item.error}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Final result */}
            {status === 'done' && result && (
                <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#3fb950' }}>
                        ✓ Ingested {result.ingested} items from {result.repo}
                    </p>
                    {failedItems.length > 0 && (
                        <p style={{ fontSize: '12px', color: '#d29922', marginTop: '4px' }}>
                            ⚠ {failedItems.length} commit(s) failed and were skipped
                        </p>
                    )}
                </div>
            )}

            {status === 'error' && (
                <p style={{ fontSize: '12px', color: '#f85149', marginTop: '12px' }}>
                    ⚠ {error}
                </p>
            )}

            <p style={{ fontSize: '11px', color: '#6e7681', marginTop: '12px' }}>
                Commit count: {commitCount} (5-50). Larger repos take longer to embed.
            </p>
        </div>
    )
}