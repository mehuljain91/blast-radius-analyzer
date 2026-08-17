export default function RiskGauge({ score }) {
    const color = score <= 3 ? '#3fb950' : score <= 6 ? '#d29922' : '#f85149'
    const label = score <= 3 ? 'Low Risk' : score <= 6 ? 'Moderate Risk' : 'High Risk'
    const circumference = 2 * Math.PI * 54
    const offset = circumference - (score / 10) * circumference

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#21262d" strokeWidth="10" />
                    <circle
                        cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="10"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                </svg>
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '28px', fontWeight: 700, color }}>{score}</span>
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>/ 10</span>
                </div>
            </div>
            <div>
                <p style={{ fontSize: '16px', fontWeight: 600, color, marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '13px', color: '#8b949e' }}>Blast radius score</p>
            </div>
        </div>
    )
}