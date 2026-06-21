'use client'

import { CATEGORIES, type CategoryId } from '@/data/destinations-meta'
import CategoryIcon from '@/components/shared/CategoryIcon'

const ACCENT = '#FF6A3D'

interface Props {
  active: CategoryId
  onChange: (id: CategoryId) => void
}

export default function CategoryRail({ active, onChange }: Props) {
  return (
    <div style={{
      background: 'rgba(20,22,28,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      position: 'sticky', top: 56, zIndex: 30,
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center',
        gap: 7, overflowX: 'auto',
      }}>
        {CATEGORIES.map((cat) => {
          const on = active === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 15px', height: 38,
                borderRadius: 10,
                border: on ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)',
                background: on ? ACCENT : 'rgba(255,255,255,0.04)',
                color: on ? '#fff' : 'rgba(255,255,255,0.78)',
                fontSize: 13.5, fontWeight: on ? 700 : 500,
                letterSpacing: '-0.01em',
                cursor: 'pointer', whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 130ms',
                boxShadow: on ? '0 4px 14px rgba(255,106,61,0.35)' : 'none',
              }}
            >
              <span style={{ display: 'flex', opacity: on ? 1 : 0.72 }}>
                <CategoryIcon name={cat.icon} size={16} />
              </span>
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
