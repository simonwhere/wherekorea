'use client'

import { Card } from '@/components/ui'
import { SettingsSection } from './bits'

export const APP_VERSION = '0.1'

export default function AboutSection() {
  return (
    <SettingsSection id="about" title="정보" sub="이 버전에서 되는 것과 안 되는 것">
      <Card tone="muted">
        <p className="text-sm leading-relaxed text-ink">
          둘셋은 의료기기가 아니에요. 예측은 추정치이고 진단·치료나 피임에 쓰면 안 돼요. 걱정되면 전문의와 상담하세요.
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3">
          <span className="font-bold text-ink">둘셋</span>
          <span className="tabular-nums">버전 {APP_VERSION} (프로토타입)</span>
        </div>
      </Card>
    </SettingsSection>
  )
}
