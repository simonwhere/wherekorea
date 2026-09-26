'use client'

import HospitalBag from '@/components/pregnancy/HospitalBag'
import PartnerCorner from '@/components/pregnancy/PartnerCorner'
import PregnancyHero from '@/components/pregnancy/PregnancyHero'
import PrenatalTimeline from '@/components/pregnancy/PrenatalTimeline'
import StageActions from '@/components/pregnancy/StageActions'
import StartPregnancy from '@/components/pregnancy/StartPregnancy'
import SupportPrograms from '@/components/pregnancy/SupportPrograms'
import WeekCard from '@/components/pregnancy/WeekCard'
import { gestationalAge } from '@/lib/logic/pregnancy'
import { bagProminent, checksSince } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'

/**
 * 임신 tab: where we are (hero), this week, the partner's part, the check
 * schedule, the hospital bag (moves up from 32주), support programs and the
 * switch to parenting. Check ticks are shared, so both phones see them.
 */
export default function PregnancyTab() {
  const { state, today } = useApp()
  const pregnancy = state.pregnancy
  if (!pregnancy) return <StartPregnancy />

  const ga = gestationalAge(pregnancy, today)
  const bagUp = bagProminent(ga.weeks)
  // Ticks from an earlier pregnancy read as open.
  const since = checksSince(pregnancy)

  return (
    <div>
      <PregnancyHero pregnancy={pregnancy} ga={ga} />
      <WeekCard weeks={ga.weeks} />
      {bagUp ? <HospitalBag key="bag-up" weeks={ga.weeks} since={since} /> : null}
      <PartnerCorner trimester={ga.trimester} />
      <PrenatalTimeline weeks={ga.weeks} since={since} />
      {bagUp ? null : <HospitalBag key="bag-down" weeks={ga.weeks} since={since} />}
      <SupportPrograms />
      <StageActions />
    </div>
  )
}
