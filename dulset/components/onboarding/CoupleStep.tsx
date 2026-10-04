'use client'

// ① 우리 둘: names and roles, and who records the cycle. Birth years, the
// wedding day and the trying-since date are not asked here (N15: four
// screens), and since N27 neither is the day they met: the 기록장 (우리 tab)
// asks for 처음 만난 날·결혼한 날 when the couple opens it, and 설정 › 우리 둘
// keeps the birth year the partner's chain needs.

import { Field, inputClass } from '@/components/ui'
import { NAME_MAX, draftNames, draftOwner, draftRoles, roParticle, type OnboardingDraft } from '@/lib/onboardingDraft'
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

export default function CoupleStep({
  draft,
  patch,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  /** Kept for the caller; no date is asked on this screen since N27. */
  today?: ISODate
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
          hint={
            bothRoles
              ? '생리·배테기 기록은 이 사람만 남겨요. 가임기 예상은 ‘우리의 주간’으로 함께 봐요.'
              : '두 사람의 역할을 고르면 알아서 골라 드려요.'
          }
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
    </div>
  )
}
