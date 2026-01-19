'use client'

// Dashboard Mockup - illustrating Network Admin Dashboard
export function DashboardMockup({ variant = 'network' }: { variant?: 'platform' | 'network' | 'operator' | 'partner' | 'driver' }) {
  const colors = {
    platform: { primary: '#3B82F6', secondary: '#60A5FA', accent: '#93C5FD' },
    network: { primary: '#10B981', secondary: '#34D399', accent: '#6EE7B7' },
    operator: { primary: '#F97316', secondary: '#FB923C', accent: '#FDBA74' },
    partner: { primary: '#EC4899', secondary: '#F472B6', accent: '#F9A8D4' },
    driver: { primary: '#8B5CF6', secondary: '#A78BFA', accent: '#C4B5FD' },
  }

  const c = colors[variant]

  return (
    <svg viewBox="0 0 800 450" className="w-full h-auto rounded-xl" style={{ background: '#1F2937' }}>
      {/* Header Bar */}
      <rect x="0" y="0" width="800" height="50" fill={c.primary} />
      <rect x="20" y="15" width="120" height="20" rx="4" fill="rgba(255,255,255,0.3)" />
      <circle cx="760" cy="25" r="15" fill="rgba(255,255,255,0.2)" />

      {/* Stat Cards */}
      <g>
        <rect x="20" y="70" width="180" height="90" rx="12" fill="#374151" />
        <rect x="30" y="85" width="60" height="8" rx="2" fill="#6B7280" />
        <text x="30" y="130" fill={c.primary} fontSize="32" fontWeight="bold">247</text>
        <rect x="30" y="140" width="80" height="6" rx="2" fill="#4B5563" />
      </g>
      <g>
        <rect x="215" y="70" width="180" height="90" rx="12" fill="#374151" />
        <rect x="225" y="85" width="70" height="8" rx="2" fill="#6B7280" />
        <text x="225" y="130" fill="#34D399" fontSize="32" fontWeight="bold">1.2M</text>
        <rect x="225" y="140" width="90" height="6" rx="2" fill="#4B5563" />
      </g>
      <g>
        <rect x="410" y="70" width="180" height="90" rx="12" fill="#374151" />
        <rect x="420" y="85" width="50" height="8" rx="2" fill="#6B7280" />
        <text x="420" y="130" fill="#FBBF24" fontSize="32" fontWeight="bold">12</text>
        <rect x="420" y="140" width="100" height="6" rx="2" fill="#4B5563" />
      </g>
      <g>
        <rect x="605" y="70" width="180" height="90" rx="12" fill="#374151" />
        <rect x="615" y="85" width="80" height="8" rx="2" fill="#6B7280" />
        <text x="615" y="130" fill="#F87171" fontSize="32" fontWeight="bold">98%</text>
        <rect x="615" y="140" width="70" height="6" rx="2" fill="#4B5563" />
      </g>

      {/* Chart Area */}
      <rect x="20" y="180" width="480" height="250" rx="12" fill="#374151" />
      <rect x="35" y="195" width="100" height="10" rx="2" fill="#6B7280" />
      {/* Chart bars */}
      <rect x="50" y="370" width="30" height="60" rx="4" fill={c.accent} />
      <rect x="95" y="340" width="30" height="90" rx="4" fill={c.accent} />
      <rect x="140" y="290" width="30" height="140" rx="4" fill={c.secondary} />
      <rect x="185" y="310" width="30" height="120" rx="4" fill={c.accent} />
      <rect x="230" y="280" width="30" height="150" rx="4" fill={c.secondary} />
      <rect x="275" y="250" width="30" height="180" rx="4" fill={c.primary} />
      <rect x="320" y="270" width="30" height="160" rx="4" fill={c.secondary} />
      <rect x="365" y="300" width="30" height="130" rx="4" fill={c.accent} />
      <rect x="410" y="260" width="30" height="170" rx="4" fill={c.secondary} />
      <rect x="455" y="230" width="30" height="200" rx="4" fill={c.primary} />

      {/* Side Panel - Recent Activity */}
      <rect x="520" y="180" width="265" height="250" rx="12" fill="#374151" />
      <rect x="535" y="195" width="120" height="10" rx="2" fill="#6B7280" />
      {/* Activity items */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <circle cx="550" cy={235 + i * 42} r="12" fill={c.primary} opacity={0.3} />
          <rect x="575" y={228 + i * 42} width="140" height="8" rx="2" fill="#9CA3AF" />
          <rect x="575" y={242 + i * 42} width="80" height="6" rx="2" fill="#4B5563" />
        </g>
      ))}
    </svg>
  )
}

// Mobile App Mockup - for Driver App
export function MobileAppMockup() {
  return (
    <svg viewBox="0 0 280 500" className="w-full max-w-xs mx-auto h-auto">
      {/* Phone Frame */}
      <rect x="0" y="0" width="280" height="500" rx="35" fill="#1F2937" stroke="#374151" strokeWidth="3" />
      <rect x="10" y="10" width="260" height="480" rx="28" fill="#111827" />

      {/* Status Bar */}
      <rect x="20" y="20" width="240" height="25" fill="#111827" />
      <text x="130" y="36" fill="#9CA3AF" fontSize="12" textAnchor="middle">9:41</text>

      {/* Header */}
      <rect x="20" y="50" width="240" height="60" fill="#8B5CF6" rx="0" />
      <text x="35" y="85" fill="white" fontSize="16" fontWeight="bold">VSys Wash</text>
      <text x="35" y="100" fill="rgba(255,255,255,0.7)" fontSize="11">Partner Kft.</text>

      {/* QR Scanner Button */}
      <rect x="40" y="130" width="200" height="200" rx="16" fill="#8B5CF6" opacity={0.2} stroke="#8B5CF6" strokeWidth="2" strokeDasharray="8,4" />
      <rect x="80" y="180" width="120" height="100" rx="8" fill="#8B5CF6" opacity={0.3} />
      {/* Camera/Scanner icon */}
      <rect x="115" y="210" width="50" height="40" rx="6" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="140" cy="230" r="12" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="140" cy="230" r="6" fill="white" />
      <text x="140" y="295" fill="#8B5CF6" fontSize="12" fontWeight="bold" textAnchor="middle">QR Beolvasása</text>
      <text x="140" y="315" fill="#9CA3AF" fontSize="10" textAnchor="middle">Szkenneld a mosóhely kódját</text>

      {/* Action Buttons */}
      <g>
        <rect x="30" y="350" width="105" height="60" rx="12" fill="#374151" />
        <circle cx="82" cy="370" r="12" fill="#8B5CF6" opacity={0.3} />
        <rect x="55" y="390" width="55" height="8" rx="2" fill="#9CA3AF" />
      </g>
      <g>
        <rect x="145" y="350" width="105" height="60" rx="12" fill="#374151" />
        <circle cx="197" cy="370" r="12" fill="#10B981" opacity={0.3} />
        <rect x="170" y="390" width="55" height="8" rx="2" fill="#9CA3AF" />
      </g>

      {/* Bottom Nav */}
      <rect x="20" y="430" width="240" height="50" rx="12" fill="#374151" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={55 + i * 60} cy={450} r="12" fill={i === 0 ? '#8B5CF6' : '#6B7280'} opacity={i === 0 ? 1 : 0.3} />
          <rect x={43 + i * 60} y={468} width="25" height="4" rx="1" fill="#6B7280" />
        </g>
      ))}
    </svg>
  )
}

// Operator Queue Mockup
export function OperatorQueueMockup() {
  return (
    <svg viewBox="0 0 800 450" className="w-full h-auto rounded-xl" style={{ background: '#1F2937' }}>
      {/* Header */}
      <rect x="0" y="0" width="800" height="60" fill="#16A34A" />
      <text x="30" y="35" fill="white" fontSize="18" fontWeight="bold">Budapest Mosó #1</text>
      <text x="30" y="50" fill="rgba(255,255,255,0.7)" fontSize="12">BP01 - Személyzetes mosó</text>
      <rect x="650" y="15" width="120" height="30" rx="8" fill="white" />
      <text x="710" y="36" fill="#16A34A" fontSize="12" fontWeight="bold" textAnchor="middle">+ Új Mosás</text>

      {/* Stats Row */}
      {[
        { label: 'Mai', value: '24', color: '#16A34A' },
        { label: 'Befejezett', value: '18', color: '#3B82F6' },
        { label: 'Folyamatban', value: '2', color: '#F59E0B' },
        { label: 'Várakozik', value: '4', color: '#6B7280' },
      ].map((stat, i) => (
        <g key={i}>
          <rect x={20 + i * 195} y="80" width="180" height="70" rx="12" fill="#374151" />
          <text x={40 + i * 195} y="130" fill={stat.color} fontSize="28" fontWeight="bold">{stat.value}</text>
          <rect x={40 + i * 195} y="140" width="60" height="6" rx="2" fill="#4B5563" />
        </g>
      ))}

      {/* In Progress Section */}
      <rect x="20" y="170" width="760" height="100" rx="12" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="45" cy="220" r="8" fill="#F59E0B">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <text x="65" y="195" fill="#92400E" fontSize="14" fontWeight="bold">Folyamatban lévő mosás</text>
      <rect x="65" y="210" width="120" height="20" rx="4" fill="white" />
      <text x="75" y="225" fill="#1F2937" fontSize="14" fontFamily="monospace">ABC-123</text>
      <rect x="200" y="210" width="100" height="20" rx="4" fill="#FEF3C7" />
      <text x="210" y="225" fill="#92400E" fontSize="12">Kovács János</text>
      <rect x="650" y="205" width="100" height="35" rx="8" fill="#16A34A" />
      <text x="700" y="228" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">Befejezés</text>

      {/* Queue Section */}
      <text x="30" y="300" fill="#9CA3AF" fontSize="14" fontWeight="bold">Engedélyezett - Várakozik (2)</text>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x="20" y={315 + i * 60} width="760" height="50" rx="10" fill="#374151" />
          <circle cx="55" cy={340 + i * 60} r="15" fill="#3B82F6" opacity={0.3} />
          <text x="55" y={345 + i * 60} fill="#3B82F6" fontSize="14" fontWeight="bold" textAnchor="middle">{i + 1}</text>
          <rect x="85" y={330 + i * 60} width="80" height="18" rx="3" fill="#1F2937" />
          <rect x="180" y={332 + i * 60} width="100" height="14" rx="2" fill="#4B5563" />
          <rect x="640" y={325 + i * 60} width="60" height="30" rx="6" fill="#3B82F6" />
          <rect x="710" y={325 + i * 60} width="60" height="30" rx="6" fill="#EF4444" opacity={0.3} />
        </g>
      ))}
    </svg>
  )
}

// Partner Portal Mockup
export function PartnerPortalMockup() {
  return (
    <svg viewBox="0 0 800 450" className="w-full h-auto rounded-xl" style={{ background: '#1F2937' }}>
      {/* Header */}
      <rect x="0" y="0" width="800" height="60" fill="#2563EB" />
      <text x="30" y="35" fill="white" fontSize="18" fontWeight="bold">Trans Logistics Kft.</text>
      <text x="30" y="50" fill="rgba(255,255,255,0.7)" fontSize="12">Partner Portál</text>
      <rect x="700" y="15" width="80" height="30" rx="8" fill="rgba(255,255,255,0.2)" />

      {/* Stats */}
      {[
        { label: 'Összes mosás', value: '156', color: '#3B82F6' },
        { label: 'Befejezett', value: '142', color: '#10B981' },
        { label: 'Folyamatban', value: '8', color: '#F59E0B' },
        { label: 'Havi költés', value: '2.4M', color: '#8B5CF6' },
      ].map((stat, i) => (
        <g key={i}>
          <rect x={20 + i * 195} y="80" width="180" height="80" rx="12" fill="#374151" />
          <text x={40 + i * 195} y="130" fill={stat.color} fontSize="28" fontWeight="bold">{stat.value}</text>
          <rect x={40 + i * 195} y="145" width="80" height="6" rx="2" fill="#4B5563" />
        </g>
      ))}

      {/* Filter Bar */}
      <rect x="20" y="180" width="760" height="50" rx="12" fill="#374151" />
      <rect x="35" y="195" width="120" height="20" rx="4" fill="#1F2937" />
      <rect x="170" y="195" width="120" height="20" rx="4" fill="#1F2937" />
      <rect x="305" y="195" width="100" height="20" rx="4" fill="#1F2937" />
      <rect x="420" y="193" width="80" height="25" rx="6" fill="#3B82F6" />
      <rect x="690" y="193" width="80" height="25" rx="6" fill="#10B981" />

      {/* Table */}
      <rect x="20" y="245" width="760" height="40" rx="8" fill="#374151" />
      <text x="40" y="270" fill="#9CA3AF" fontSize="12">Dátum</text>
      <text x="150" y="270" fill="#9CA3AF" fontSize="12">Helyszín</text>
      <text x="300" y="270" fill="#9CA3AF" fontSize="12">Szolgáltatás</text>
      <text x="450" y="270" fill="#9CA3AF" fontSize="12">Rendszám</text>
      <text x="600" y="270" fill="#9CA3AF" fontSize="12">Sofőr</text>
      <text x="720" y="270" fill="#9CA3AF" fontSize="12">Státusz</text>

      {/* Table Rows */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="20" y={290 + i * 40} width="760" height="38" rx="0" fill={i % 2 === 0 ? '#1F2937' : 'transparent'} />
          <rect x="40" y={302 + i * 40} width="80" height="12" rx="2" fill="#6B7280" />
          <rect x="150" y={302 + i * 40} width="100" height="12" rx="2" fill="#6B7280" />
          <rect x="300" y={302 + i * 40} width="80" height="12" rx="2" fill="#6B7280" />
          <rect x="450" y={300 + i * 40} width="70" height="16" rx="3" fill="#1F2937" />
          <rect x="600" y={302 + i * 40} width="90" height="12" rx="2" fill="#6B7280" />
          <rect x="720" y={298 + i * 40} width="50" height="20" rx="10" fill={['#10B981', '#10B981', '#F59E0B', '#10B981'][i]} opacity={0.3} />
        </g>
      ))}
    </svg>
  )
}

// Flow Diagram - showing wash process
export function WashFlowDiagram() {
  return (
    <svg viewBox="0 0 800 200" className="w-full h-auto">
      {/* Step 1 */}
      <g>
        <circle cx="80" cy="100" r="40" fill="#8B5CF6" opacity={0.2} stroke="#8B5CF6" strokeWidth="2" />
        <text x="80" y="90" fill="#8B5CF6" fontSize="24" fontWeight="bold" textAnchor="middle">1</text>
        <text x="80" y="110" fill="#8B5CF6" fontSize="8" textAnchor="middle">SCAN</text>
        <text x="80" y="160" fill="#9CA3AF" fontSize="11" textAnchor="middle">Sofőr</text>
        <text x="80" y="175" fill="#9CA3AF" fontSize="11" textAnchor="middle">bejelentkezik</text>
      </g>

      {/* Arrow 1 */}
      <path d="M130 100 L200 100" stroke="#4B5563" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Step 2 */}
      <g>
        <circle cx="250" cy="100" r="40" fill="#F97316" opacity={0.2} stroke="#F97316" strokeWidth="2" />
        <text x="250" y="90" fill="#F97316" fontSize="24" fontWeight="bold" textAnchor="middle">2</text>
        <text x="250" y="110" fill="#F97316" fontSize="8" textAnchor="middle">JÓVÁHAGY</text>
        <text x="250" y="160" fill="#9CA3AF" fontSize="11" textAnchor="middle">Operátor</text>
        <text x="250" y="175" fill="#9CA3AF" fontSize="11" textAnchor="middle">jóváhagyás</text>
      </g>

      {/* Arrow 2 */}
      <path d="M300 100 L370 100" stroke="#4B5563" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Step 3 */}
      <g>
        <circle cx="420" cy="100" r="40" fill="#F59E0B" opacity={0.2} stroke="#F59E0B" strokeWidth="2" />
        <text x="420" y="90" fill="#F59E0B" fontSize="24" fontWeight="bold" textAnchor="middle">3</text>
        <text x="420" y="110" fill="#F59E0B" fontSize="8" textAnchor="middle">MOSÁS</text>
        <text x="420" y="160" fill="#9CA3AF" fontSize="11" textAnchor="middle">Mosási</text>
        <text x="420" y="175" fill="#9CA3AF" fontSize="11" textAnchor="middle">folyamat</text>
      </g>

      {/* Arrow 3 */}
      <path d="M470 100 L540 100" stroke="#4B5563" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Step 4 */}
      <g>
        <circle cx="590" cy="100" r="40" fill="#10B981" opacity={0.2} stroke="#10B981" strokeWidth="2" />
        <text x="590" y="90" fill="#10B981" fontSize="24" fontWeight="bold" textAnchor="middle">4</text>
        <text x="590" y="110" fill="#10B981" fontSize="8" textAnchor="middle">KÉSZ</text>
        <text x="590" y="160" fill="#9CA3AF" fontSize="11" textAnchor="middle">Befejezés</text>
        <text x="590" y="175" fill="#9CA3AF" fontSize="11" textAnchor="middle">rögzítés</text>
      </g>

      {/* Arrow 4 */}
      <path d="M640 100 L710 100" stroke="#4B5563" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Step 5 */}
      <g>
        <circle cx="760" cy="100" r="40" fill="#3B82F6" opacity={0.2} stroke="#3B82F6" strokeWidth="2" />
        <text x="760" y="90" fill="#3B82F6" fontSize="24" fontWeight="bold" textAnchor="middle">5</text>
        <text x="760" y="110" fill="#3B82F6" fontSize="8" textAnchor="middle">SZÁMLA</text>
        <text x="760" y="160" fill="#9CA3AF" fontSize="11" textAnchor="middle">Számlázás</text>
        <text x="760" y="175" fill="#9CA3AF" fontSize="11" textAnchor="middle">fizetés</text>
      </g>

      {/* Arrow marker definition */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4B5563" />
        </marker>
      </defs>
    </svg>
  )
}

// System Architecture Diagram
export function SystemArchitectureDiagram() {
  return (
    <svg viewBox="0 0 800 400" className="w-full h-auto">
      {/* Platform Level */}
      <rect x="300" y="20" width="200" height="60" rx="12" fill="#3B82F6" opacity={0.2} stroke="#3B82F6" strokeWidth="2" />
      <text x="400" y="55" fill="#3B82F6" fontSize="14" fontWeight="bold" textAnchor="middle">Platform Admin</text>

      {/* Arrow down */}
      <path d="M400 80 L400 120" stroke="#4B5563" strokeWidth="2" strokeDasharray="5,5" />

      {/* Network Level */}
      <rect x="200" y="130" width="400" height="80" rx="12" fill="#10B981" opacity={0.1} stroke="#10B981" strokeWidth="2" />
      <text x="400" y="155" fill="#10B981" fontSize="14" fontWeight="bold" textAnchor="middle">Hálózat Admin</text>
      <text x="400" y="190" fill="#6B7280" fontSize="11" textAnchor="middle">Helyszínek | Sofőrök | Partnerek | Számlázás</text>

      {/* Arrows down */}
      <path d="M300 210 L300 250" stroke="#4B5563" strokeWidth="2" strokeDasharray="5,5" />
      <path d="M500 210 L500 250" stroke="#4B5563" strokeWidth="2" strokeDasharray="5,5" />

      {/* Bottom Level - 3 boxes */}
      <g>
        <rect x="50" y="260" width="150" height="70" rx="10" fill="#F97316" opacity={0.2} stroke="#F97316" strokeWidth="2" />
        <text x="125" y="295" fill="#F97316" fontSize="12" fontWeight="bold" textAnchor="middle">Operátor</text>
        <text x="125" y="315" fill="#6B7280" fontSize="10" textAnchor="middle">Mosás rögzítés</text>
      </g>

      <g>
        <rect x="325" y="260" width="150" height="70" rx="10" fill="#8B5CF6" opacity={0.2} stroke="#8B5CF6" strokeWidth="2" />
        <text x="400" y="295" fill="#8B5CF6" fontSize="12" fontWeight="bold" textAnchor="middle">Sofőr App</text>
        <text x="400" y="315" fill="#6B7280" fontSize="10" textAnchor="middle">QR scan, előzmények</text>
      </g>

      <g>
        <rect x="600" y="260" width="150" height="70" rx="10" fill="#EC4899" opacity={0.2} stroke="#EC4899" strokeWidth="2" />
        <text x="675" y="295" fill="#EC4899" fontSize="12" fontWeight="bold" textAnchor="middle">Partner</text>
        <text x="675" y="315" fill="#6B7280" fontSize="10" textAnchor="middle">Sofőrök, számlák</text>
      </g>

      {/* Connecting arrows */}
      <path d="M200 250 L125 260" stroke="#4B5563" strokeWidth="1" strokeDasharray="3,3" />
      <path d="M600 250 L675 260" stroke="#4B5563" strokeWidth="1" strokeDasharray="3,3" />

      {/* Legend */}
      <g transform="translate(50, 360)">
        <rect x="0" y="0" width="12" height="12" rx="2" fill="#3B82F6" />
        <text x="20" y="10" fill="#9CA3AF" fontSize="10">Platform szint</text>
        <rect x="120" y="0" width="12" height="12" rx="2" fill="#10B981" />
        <text x="140" y="10" fill="#9CA3AF" fontSize="10">Hálózat szint</text>
        <rect x="250" y="0" width="12" height="12" rx="2" fill="#F97316" />
        <text x="270" y="10" fill="#9CA3AF" fontSize="10">Felhasználói szint</text>
      </g>
    </svg>
  )
}
