interface Props {
  name: string
  size?: number
}

export default function CategoryIcon({ name, size = 16 }: Props) {
  const p = {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'spark':
      return <svg {...p}><path d="M8 1.5 L9.3 6 L13.8 7.5 L9.3 9 L8 13.5 L6.7 9 L2.2 7.5 L6.7 6 Z" fill="currentColor" stroke="none" /></svg>
    case 'calendar':
      return <svg {...p}><rect x="2.5" y="3.2" width="11" height="10.3" rx="2" /><path d="M2.5 6.3 H13.5 M5.5 1.8 V4 M10.5 1.8 V4" /></svg>
    case 'train':
      return <svg {...p}><rect x="4" y="2.3" width="8" height="9" rx="2.2" /><path d="M4 7 H12 M6.4 13.5 L5 11.3 M9.6 13.5 L11 11.3" /><circle cx="6.3" cy="9.2" r="0.5" fill="currentColor" stroke="none" /><circle cx="9.7" cy="9.2" r="0.5" fill="currentColor" stroke="none" /></svg>
    case 'food':
      return <svg {...p}><path d="M2.6 7 a5.4 5.4 0 0 0 10.8 0 Z" /><path d="M2.6 7 H13.4 M5 2.2 V4.6 M5 7 V2.2 M11 2.2 C9.8 2.2 9.8 5 11 5 V7" /></svg>
    case 'leaf':
      return <svg {...p}><path d="M13 3 C6 3 3 6.5 3 13 C9.5 13 13 9.5 13 3 Z" /><path d="M3 13 L9 7" /></svg>
    case 'wave':
      return <svg {...p}><path d="M1.8 6.5 Q4 4 6.2 6.5 T10.6 6.5 T15 6.5 M1.8 10 Q4 7.5 6.2 10 T10.6 10 T15 10" /></svg>
    case 'mountain':
      return <svg {...p}><path d="M1.8 13 L6 4.5 L9 9.5 L10.8 6.5 L14.2 13 Z" /></svg>
    case 'landmark':
      return <svg {...p}><path d="M2.5 6 L8 2.5 L13.5 6 M3.5 6 V11.5 M6.2 6 V11.5 M9.8 6 V11.5 M12.5 6 V11.5 M2.2 13.5 H13.8" /></svg>
    case 'people':
      return <svg {...p}><circle cx="6" cy="6" r="2.3" /><circle cx="11" cy="6.5" r="1.8" /><path d="M2.5 13 C2.5 9.8 9.5 9.8 9.5 13 M10 11.2 C10.5 9.8 13.5 9.9 13.5 12.5" /></svg>
    default:
      return null
  }
}
