'use client'

import { useId } from 'react'
import { Button, Field, cx, inputClass } from '@/components/ui'
import {
  COUPLE_DATE_MIN,
  NAME_MAX,
  birthYearOptions,
  coupleDatesNote,
  draftRoles,
  roParticle,
  type OnboardingDraft,
} from '@/lib/demo'
import { ROLE_EMOJI, ROLE_LABEL } from '@/lib/initial'
import type { ISODate, Role } from '@/lib/types'
import { ChoiceGroup, Group, type Option } from './parts'

const ROLES: Role[] = ['wife', 'husband', 'partner']
const NAME_EXAMPLE: Record<Role, string> = { wife: '예: 지은', husband: '예: 민수', partner: '예: 하늘' }
const ROLE_OPTIONS: Option<Role>[] = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], emoji: ROLE_EMOJI[r] }))
const YEARS = birthYearOptions()

function PersonFields({
  legend,
  name,
  onName,
  namePlaceholder,
  role,
  onRole,
  roleLabel,
  roleHint,
  birthYear,
  onBirthYear,
}: {
  legend: string
  name: string
  onName: (v: string) => void
  namePlaceholder: string
  role: Role | undefined
  onRole: (r: Role) => void
  roleLabel: string
  roleHint?: string
  birthYear: number | undefined
  onBirthYear: (y: number | undefined) => void
}) {
  return (
    <fieldset className="space-y-4 rounded-xl2 border border-line bg-surface p-4 shadow-card">
      <legend className="float-left mb-1 w-full text-sm font-bold text-ink">{legend}</legend>
      <Field
        label="이름 또는 애칭"
        hint={!name.trim() && role ? `비워 두면 ‘${ROLE_LABEL[role]}’${roParticle(ROLE_LABEL[role])} 불러요.` : undefined}
      >
        <input
          className={inputClass}
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder={namePlaceholder}
          autoComplete="off"
          enterKeyHint="next"
        />
      </Field>
      <Group title={roleLabel} hint={roleHint}>
        <ChoiceGroup label={roleLabel} options={ROLE_OPTIONS} value={role} onChange={onRole} />
      </Group>
      <Field label="출생연도 (선택)">
        <select
          className={inputClass}
          value={birthYear ?? ''}
          onChange={(e) => onBirthYear(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">선택 안 함</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </Field>
    </fieldset>
  )
}

/** Optional date with a 44px "비우기" (clearing a date input is fiddly on phones). */
function DateField({
  label,
  value,
  onChange,
  today,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  today: ISODate
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="date"
          className={cx(inputClass, 'min-w-0 flex-1 px-2.5')}
          value={value}
          min={COUPLE_DATE_MIN}
          max={today}
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <Button variant="ghost" onClick={() => onChange('')} ariaLabel={`${label} 비우기`}>
            비우기
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default function CoupleStep({
  draft,
  patch,
  today,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  today: ISODate
}) {
  const datesNote = coupleDatesNote(draft, today)
  const roles = draftRoles(draft)
  const suggested = draft.partnerRole === undefined && roles.b !== undefined
  return (
    <div className="space-y-4">
      <PersonFields
        legend="나"
        name={draft.myName}
        onName={(myName) => patch({ myName })}
        namePlaceholder={NAME_EXAMPLE[roles.a ?? 'partner']}
        role={roles.a}
        onRole={(myRole) => patch({ myRole })}
        roleLabel="나는"
        birthYear={draft.myBirthYear}
        onBirthYear={(myBirthYear) => patch({ myBirthYear })}
      />
      <PersonFields
        legend="함께하는 사람"
        name={draft.partnerName}
        onName={(partnerName) => patch({ partnerName })}
        namePlaceholder={NAME_EXAMPLE[roles.b ?? 'partner']}
        role={roles.b}
        onRole={(partnerRole) => patch({ partnerRole })}
        roleLabel="함께하는 사람은"
        roleHint={suggested ? '내 선택에 맞춰 골라 뒀어요. 다르면 바꿔 주세요.' : undefined}
        birthYear={draft.partnerBirthYear}
        onBirthYear={(partnerBirthYear) => patch({ partnerBirthYear })}
      />
      <p className="px-1 text-xs leading-relaxed text-ink-3">
        출생연도는 선택이에요. 35세 이상이면 상담 시기 안내가 달라져요.
      </p>

      <fieldset className="space-y-4 rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <legend className="float-left mb-1 w-full text-sm font-bold text-ink">
          우리의 날 <span className="font-medium text-ink-3">(선택)</span>
        </legend>
        <p className="text-xs leading-relaxed text-ink-3">
          넣어 두면 함께한 날수와 100일·주년을 챙겨 드려요. 첫날을 1일로 세어요. 몰라도 괜찮아요, 나중에 우리 탭에서 넣을 수
          있어요.
        </p>
        <DateField label="처음 만난 날 (사귄 날)" value={draft.metDate} onChange={(metDate) => patch({ metDate })} today={today} />
        <DateField label="결혼한 날" value={draft.marriedDate} onChange={(marriedDate) => patch({ marriedDate })} today={today} />
        {/* Always mounted so the gentle note is announced when it appears. */}
        <p aria-live="polite" className="text-xs text-ink-3 empty:hidden">
          {datesNote ?? ''}
        </p>
      </fieldset>
    </div>
  )
}
