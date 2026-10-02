// The line icon for each record kind (review D-5: one icon set for the UI).
// lib keeps its emoji maps (KIND_EMOJI, APPOINTMENT_KIND_EMOJI) for text
// surfaces such as browser-notification titles; screens draw these instead.

import type { IconName } from '@/components/ui/icons'
import type { RoadmapKind } from '@/lib/logic/roadmap'
import type { AppointmentKind, CheckKind } from '@/lib/types'

/** 오늘 체크 kinds (영양제 · 약 · 생활습관). */
export const CHECK_KIND_ICON: Record<CheckKind, IconName> = {
  supplement: 'pill',
  medication: 'syringe',
  habit: 'sprout',
}

/** 병원·검사 일정 kinds. */
export const APPOINTMENT_KIND_ICON: Record<AppointmentKind, IconName> = {
  hospital: 'hospital',
  test: 'flask',
  vaccine: 'syringe',
  admin: 'pen',
  other: 'pin',
  injection: 'syringe',
  medication: 'pill',
}

/** 로드맵 (챙길 것) kinds. */
export const ROADMAP_KIND_ICON: Record<RoadmapKind, IconName> = {
  hospital: 'hospital',
  test: 'flask',
  vaccine: 'syringe',
  admin: 'pen',
  work: 'bag',
  prep: 'box',
  habit: 'sprout',
}
