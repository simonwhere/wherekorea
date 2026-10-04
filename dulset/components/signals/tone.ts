// The chip look for one signal, shared by the app (SignalsCard, SignalChips) and
// the link (LinkSignals): a 'rest' signal reads quieter, his 'offer' signals
// (N30 — '오늘 저녁은 내가 할게요', '병원 같이 갈게요') carry his colour so the
// two he can send first stand apart from the rest. Theme tokens only.

import type { SignalTone } from '@/lib/logic/signals'

export function SIGNAL_TONE_CLASS(tone: SignalTone | undefined): string {
  if (tone === 'rest') return 'border-line bg-surface-2 text-ink-2 hover:bg-line/50'
  if (tone === 'offer') return 'border-him/35 bg-him-soft text-ink hover:bg-him-soft/70'
  return 'border-line bg-surface text-ink hover:bg-surface-2'
}
