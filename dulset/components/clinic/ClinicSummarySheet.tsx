'use client'

// '병원에 보여 줄 요약' (Next B — B1): one sheet, opened from the 주기 tab by the
// cycle owner (and from the clinic-mode home card through openClinicSummary).
// It shows what the file will hold, then hands it over three ways: a preview
// here, a standalone .html file, or the same lines as text for the clipboard.
// The model is lib/logic/clinicSummary.ts (records only, no reading of them);
// nothing private — personalLog, 나만 보기 lines, 관계일 — is ever in it.

import { useMemo, useState } from 'react'
import { copyText } from '@/components/clinic/copyText'
import { Button, Sheet, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { CLINIC_SUMMARY_PRIVACY_NOTE, clinicSummary } from '@/lib/logic/clinicSummary'
import { CLINIC_SUMMARY_FILENAME, buildClinicSummaryHtml, buildClinicSummaryText, summarySections } from '@/lib/logic/clinicSummaryExport'
import { downloadText } from '@/lib/logic/ics'
import { useApp } from '@/lib/store'
import { CLINIC_SUMMARY_SHEET_TITLE } from './summaryTitle'

export { CLINIC_SUMMARY_SHEET_TITLE }

export default function ClinicSummarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, today, viewer } = useApp()
  const toast = useToast()
  const [preview, setPreview] = useState(false)
  // Built only while open: the summary walks every record the couple has.
  const summary = useMemo(() => (open ? clinicSummary(state, viewer, today) : null), [open, state, viewer, today])
  const sections = useMemo(() => (summary ? summarySections(summary) : []), [summary])

  const download = () => {
    if (!summary) return
    downloadText(CLINIC_SUMMARY_FILENAME, buildClinicSummaryHtml(summary), 'text/html;charset=utf-8')
    toast.show('파일로 저장했어요 · 열어서 인쇄하거나 보여 주세요')
  }

  const copy = async () => {
    if (!summary) return
    const ok = await copyText(buildClinicSummaryText(summary))
    toast.show(ok ? '요약을 텍스트로 복사했어요' : '복사하지 못했어요. 파일로 받아 주세요')
  }

  return (
    <Sheet open={open} onClose={onClose} title={CLINIC_SUMMARY_SHEET_TITLE}>
      {summary ? (
        <div className="pb-2">
          <p className="text-[13px] font-semibold leading-relaxed text-ink">{summary.header}</p>
          <p className="mt-1 text-xs text-ink-3">
            만든 날 {formatKo(summary.generatedOn, { year: true })} · 기록된 주기 {summary.cycles.length}개 · 영양제·약 {summary.medications.length}개 · 검사·접종{' '}
            {summary.checkups.length}개 · 일정 {summary.appointments.length}개 · 시술 {summary.treatments.length}회
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            기록한 값과 평균(예상)만 담겨요. 해석이나 판단은 넣지 않아요 — 그건 담당 의료진이 해요.
          </p>

          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3" role="note">
            <Icon name="lock" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-2" />
            <p className="min-w-0 text-xs leading-relaxed text-ink-2">{CLINIC_SUMMARY_PRIVACY_NOTE}</p>
          </div>

          <div className="mt-4 space-y-2">
            <Button full variant="secondary" onClick={() => setPreview((v) => !v)} ariaLabel={preview ? '미리보기 닫기' : '미리보기'}>
              {preview ? '미리보기 닫기' : '미리보기'}
            </Button>
            <Button full onClick={download}>
              파일로 받기 (.html)
            </Button>
            <Button full variant="secondary" onClick={copy}>
              텍스트 복사
            </Button>
          </div>

          {preview ? (
            <div className="mt-4 rounded-xl2 border border-line bg-surface p-3" aria-label="요약 미리보기">
              {sections.map((sec, i) => (
                <section key={sec.id} className={cx(i > 0 && 'mt-3 border-t border-line pt-3')}>
                  <h3 className="text-xs font-bold text-brand-ink">{sec.title}</h3>
                  {sec.lines.length ? (
                    <ul className="mt-1 space-y-1">
                      {sec.lines.map((line, j) => (
                        <li key={j} className="text-[12px] leading-relaxed text-ink-2">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] text-ink-3">{sec.empty}</p>
                  )}
                </section>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            파일은 이 기기에만 저장돼요. 브라우저에서 열어 인쇄(Ctrl+P · ⌘P)하면 PDF로도 만들 수 있어요.
          </p>
        </div>
      ) : (
        <p className="pb-4 text-sm text-ink-2">주기 기록을 함께 볼 수 있을 때만 만들 수 있어요.</p>
      )}
    </Sheet>
  )
}
