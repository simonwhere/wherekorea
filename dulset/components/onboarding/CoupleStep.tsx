'use client'

// ① 우리 둘: names and roles, who records the cycle, and (optional) the day
// they met. Birth years, the wedding day and the trying-since date are not
// asked here any more (N15: four screens) — 설정 › 우리 둘 and the 우리 tab take
// them whenever the couple wants.

import { useId } from 'react'
import { Button, Field, cx, inputClass } from '@/components/ui'
import { COUPLE_DATE_MIN, NAME_MAX, draftNames, draftOwner, draftRoles, roParticle, type OnboardingDraft } from '@/lib/onboardingDraft'
import { ROLE_EMOJI, ROLE_LABEL } from '@/lib/initial'
import type { ISODate, MemberId, Role } from '@/lib/types'
import { ChoiceGroup, Group, type Option } from './parts'

const ROLES: Role[] = ['wife', 'husband', 'partner']
const NAME_EXAMPLE: Record<Role, string> = { wife: '예: 지은', husband: '예: 민수', partner: '예: 하늘' }
const ROLE_OPTIONS: Option<Role>[] = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], emoji: ROLE_EMOJI[r] }))

function PersonFields({
  legend,
  name,
  onName,
  namePlaceholder,
  role,
  onRole,
  roleLabel,
  roleHint,
}: {
  legend: string
  name: string
  onName: (v: string) => void
  namePlaceholder: string
  role: Role | undefined
  onRole: (r: Role) => void
  roleLabel: string
  roleHint?: string
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
  const roles = draftRoles(draft)
  const names = draftNames(draft)
  const owner = draftOwner(draft)
  const suggested = draft.partnerRole === undefined && roles.b !== undefined
  const bothRoles = !!roles.a && !!roles.b
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
      />

      <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <Group
          title="누구의 주기를 기록할까요?"
          hint={bothRoles ? '생리·배테기 기록은 이 사람만 남겨요. 가임기 예상은 ‘우리의 주간’으로 함께 봐요.' : '두 사람의 역할을 고르면 알아서 골라 드려요.'}
        >
          <ChoiceGroup<MemberId>
            label="주기를 기록할 사람"
            columns={2}
            value={bothRoles ? owner : undefined}
            onChange={(cycleOwner) => patch({ cycleOwner })}
            disabled={!bothRoles}
            options={[
              { value: 'a', label: `${names.a} (나)` },
              { value: 'b', label: names.b },
            ]}
          />
        </Group>
      </div>

      <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <DateField label="처음 만난 날 (선택)" value={draft.metDate} onChange={(metDate) => patch({ metDate })} today={today} />
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          넣어 두면 함께한 날수와 100일·주년을 챙겨 드려요. 결혼한 날과 출생연도는 나중에 설정에서 넣을 수 있어요.
        </p>
      </div>
    </div>
  )
}
