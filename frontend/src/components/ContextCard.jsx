export default function ContextCard({ item }) {
    const relevancePercent = Math.round(item.score * 100)
    const color = relevancePercent >= 70 ? '#3fb950' : relevancePercent >= 50 ? '#d29922' : '#8b949e'

    return (
        <div style={{
            background: '#0d1117', border: '1px solid #30363d',
            borderRadius: '8px', padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '14px' }}>{item.type === 'readme' ? '📄' : '🔗'}</span>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 500 }}>
                        {item.type === 'readme' ? 'Service README' : `Commit ${item.sha}`}
                    </p>
                    {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer"
                            style={{ fontSize: '11px', color: '#58a6ff', textDecoration: 'none' }}>
                            View on GitHub →
                        </a>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div style={{ width: '50px', height: '4px', background: '#21262d', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${relevancePercent}%`, height: '100%', background: color }} />
                </div>
                <span style={{ fontSize: '12px', color, fontWeight: 600, minWidth: '32px' }}>{relevancePercent}%</span>
            </div>
        </div>
    )
}