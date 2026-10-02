'use client'

import { useCallback, useId, useState } from 'react'
import WhosePhoneSheet from '@/components/onboarding/WhosePhoneSheet'
import { rememberDeviceViewer } from '@/components/onboarding/deviceViewer'
import { Avatar, Button, Card, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ROLE_LABEL } from '@/lib/initial'
import {
  NAME_MAX,
  ROLES,
  birthYearBounds,
  emojiChoices,
  isValidBirthYear,
  membersViewerFirst,
  updateMember,
} from '@/lib/logic/settings'
import { canHandOverCycle, handOverCycle } from '@/lib/logic/partnerTrack'
import { useApp } from '@/lib/store'
import type { Member, MemberId, Role } from '@/lib/types'
import { ConfirmActions, Pill, RadioCard, Segmented, SettingsSection } from './bits'

export default function MembersSection() {
  const { state, viewer, cycleOwner, me, setViewer } = useApp()
  const toast = useToast()
  const [editing, setEditing] = useState<MemberId | null>(null)
  const [ownerTo, setOwnerTo] = useState<MemberId | null>(null)
  const [askingPhone, setAskingPhone] = useState(false)
  // Stable callbacks: Sheet re-runs its focus effect whenever onClose changes,
  // which would pull focus out of the form each time the other tab syncs.
  const closeEdit = useCallback(() => setEditing(null), [])
  const closeOwner = useCallback(() => setOwnerTo(null), [])
  const closePhone = useCallback(() => setAskingPhone(false), [])
  // "이 폰은 누구 거예요?" — remembered on this device (onboarding/deviceViewer), not just this tab.
  const pickPhone = (id: MemberId) => {
    setAskingPhone(false)
    setViewer(id)
    rememberDeviceViewer(id)
    const name = state.couple.members.find((m) => m.id === id)?.name ?? ''
    toast.show(`이 폰은 ${name}님 폰으로 기억할게요`)
  }
  const ownerLabelId = useId()
  const ownerGroup = useId()
  const members = membersViewerFirst(state, viewer)
  const editingMember = state.couple.members.find((m) => m.id === editing)
  const ownerCandidate = state.couple.members.find((m) => m.id === ownerTo)
  // Once there are cycle records, only the person whose cycle it is hands it over.
  const canChangeOwner = canHandOverCycle(state, viewer)

  return (
    <SettingsSection id="members" title="우리 둘" sub="이름과 역할은 두 사람 화면에 똑같이 보여요">
      <Card>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0">
              <Avatar member={m} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-ink">{m.name}</span>
                  {m.id === viewer ? <Pill tone="brand">나</Pill> : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {ROLE_LABEL[m.role]} · {m.birthYear ? `${m.birthYear}년생` : '출생 연도 없음'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setEditing(m.id)} ariaLabel={`${m.name} 정보 수정`}>
                수정
              </Button>
            </li>
          ))}
        </ul>

        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-relaxed text-ink-2">
            <Icon name="phone" className="h-4 w-4 text-ink-3" />
            <span>
              이 폰은 <span className="font-semibold text-ink">{me.name}</span>님 폰이에요
            </span>
          </p>
          <Button variant="ghost" size="sm" className="min-h-[44px] shrink-0 text-brand-ink" onClick={() => setAskingPhone(true)}>
            바꾸기
          </Button>
        </div>

        <div className="mt-1 rounded-xl bg-surface-2 p-3">
          <p id={ownerLabelId} className="text-xs font-semibold text-ink-2">
            주기를 기록하는 사람
          </p>
          <div role="radiogroup" aria-labelledby={ownerLabelId} className="mt-2 grid grid-cols-2 gap-2">
            {members.map((m) => {
              const on = m.id === cycleOwner.id
              return (
                <RadioCard
                  key={m.id}
                  name={ownerGroup}
                  checked={on}
                  onSelect={() => setOwnerTo(m.id)}
                  disabled={!canChangeOwner}
                  className="min-w-0 justify-center gap-1.5 px-2 text-sm font-medium"
                  selectedClassName="border-her bg-her-soft text-ink"
                  idleClassName={cx('border-line bg-surface text-ink-3', canChangeOwner && 'hover:bg-bg')}
                >
                  <span aria-hidden>{m.emoji}</span>
                  <span className="truncate">{m.name}</span>
                  {on ? <Icon name="check" className="h-4 w-4 text-her" strokeWidth={2.6} /> : null}
                </RadioCard>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            생리·배테기·임테기 기록과 주기 예상, 주기 알림이 이 사람을 기준으로 해요. 기록도 이 사람만 남겨요.
            {canChangeOwner ? '' : ` 기록이 있어서 ${cycleOwner.name}님만 바꿀 수 있어요.`}
          </p>
        </div>
      </Card>

      <Sheet open={!!editingMember} onClose={closeEdit} title="정보 수정">
        {editingMember ? <MemberForm key={editingMember.id} member={editingMember} onDone={closeEdit} /> : null}
      </Sheet>

      <Sheet open={!!ownerCandidate} onClose={closeOwner} title="주기 기록하는 사람 바꾸기">
        {ownerCandidate ? <OwnerConfirm member={ownerCandidate} onDone={closeOwner} /> : null}
      </Sheet>

      <WhosePhoneSheet open={askingPhone} onClose={closePhone} members={state.couple.members} current={viewer} onPick={pickPhone} />
    </SettingsSection>
  )
}

export function MemberForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { update, today, viewer } = useApp()
  const toast = useToast()
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState<Role>(member.role)
  const [emoji, setEmoji] = useState(member.emoji)
  const [year, setYear] = useState(member.birthYear ? String(member.birthYear) : '')
  const bounds = birthYearBounds(today)
  const yearNum = Number(year)
  const yearError = year.trim() && !isValidBirthYear(yearNum, today) ? `${bounds.min}~${bounds.max} 사이로 입력해 주세요.` : null
  const choices = emojiChoices(member.emoji)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (yearError) return
    update((s) => updateMember(s, member.id, { name, role, emoji, birthYear: year.trim() ? yearNum : undefined }))
    toast.show('저장했어요')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {member.id !== viewer ? (
        <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
          {member.name}님의 정보예요. 바꾸면 {member.name}님 화면에도 똑같이 보여요.
        </p>
      ) : null}
      <Field label="이름 (앱에서 부를 이름)">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ROLE_LABEL[role]}
          maxLength={NAME_MAX}
          autoComplete="off"
        />
      </Field>

      <Segmented
        legend="역할"
        options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        value={role}
        onChange={setRole}
      />

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-ink-2">프로필 이모지</legend>
        <div className="grid grid-cols-6 gap-2">
          {choices.map((e) => {
            const on = e === emoji
            return (
              <button
                key={e}
                type="button"
                aria-pressed={on}
                aria-label={`${e} 고르기`}
                onClick={() => setEmoji(e)}
                className={cx(
                  'flex h-11 items-center justify-center rounded-xl border text-xl transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
                )}
              >
                {e}
              </button>
            )
          })}
        </div>
      </fieldset>

      <Field
        label="출생 연도 (선택)"
        hint={yearError ?? '나이에 맞춰 전문의 상담 시기를 안내할 때만 써요. 비워 둬도 괜찮아요.'}
      >
        <input
          className={inputClass}
          type="number"
          inputMode="numeric"
          min={bounds.min}
          max={bounds.max}
          value={year}
          onChange={(e) => setYear(e.target.value.slice(0, 4))}
          placeholder="예: 1993"
          aria-invalid={!!yearError}
        />
      </Field>

      <Button type="submit" full size="lg" disabled={!!yearError}>
        저장하기
      </Button>
    </form>
  )
}

/** Hand the cycle over to `member` (sharing starts private again — partnerTrack.handOverCycle). */
export function OwnerConfirm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { state, update, viewer } = useApp()
  const toast = useToast()
  const confirm = () => {
    if (!canHandOverCycle(state, viewer)) return onDone()
    update((s) => handOverCycle(s, member.id, viewer))
    toast.show(`이제 ${member.name}님 주기를 기록해요`)
    onDone()
  }
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink">
        {member.name}님의 주기를 기록하도록 바꿀까요? 주기 예상과 주기 알림이 {member.name}님 기준으로 바뀌어요.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        지금까지 기록한 생리 날짜는 그대로 남아요. 다른 사람의 기록이라면 주기 탭에서 정리해 주세요. 각자 고른 알림 방식은 바뀌지
        않아요. 공유 범위는 ‘우리의 주간만’으로 돌아가고, {member.name}님이 다시 정해요.
      </p>
      <ConfirmActions confirmLabel={`${member.name}님으로 바꾸기`} onConfirm={confirm} onCancel={onDone} />
    </div>
  )
}
