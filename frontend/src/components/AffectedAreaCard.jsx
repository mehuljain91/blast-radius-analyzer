const SEVERITY_COLORS = {
    critical: { bg: '#3d1a1a', border: '#f85149', text: '#f85149' },
    warning: { bg: '#2d2a14', border: '#d29922', text: '#d29922' },
    info: { bg: '#1a2a3a', border: '#58a6ff', text: '#58a6ff' },
}

export default function AffectedAreaCard({ area }) {
    const colors = SEVERITY_COLORS[area.severity] || SEVERITY_COLORS.info

    return (
        <div style={{
            background: colors.bg, border: `1px solid ${colors.border}`,
            borderRadius: '8px', padding: '14px 16px', marginBottom: '10px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3' }}>{area.area}</p>
                <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '20px', border: `1px solid ${colors.text}`,
                    color: colors.text, textTransform: 'uppercase', flexShrink: 0
                }}>
                    {area.severity}
                </span>
            </div>
            <p style={{ fontSize: '13px', color: '#c9d1d9', lineHeight: 1.6 }}>{area.reasoning}</p>
        </div>
    )
}