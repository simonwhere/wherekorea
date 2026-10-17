// One wording for [같이 할게요] on every surface (founder decision 2026-10-17,
// "추천대로 1~3번 다 진행해줘" — 3). Once he said it, the app's button
// (components/plan/SupportButton: 같이 챙길 것 on his home, 챙길 것 rows, the
// 임신 tab's 검사 일정) and the link's toggle (components/link/LinkTogether
// SupportToggle, also on LinkStage) both draw a check + '같이 하기로 했어요'
// and a separate small [취소], and their toasts say the same thing.
// Her screen's '민수님이 같이 챙긴대요' (lib/logic/together) is not here.
//
// No imports: the /link bundle pulls this in, and it stays small.

/** The not-pressed button: [+ 같이 할게요]. */
export const SUPPORT_LABEL = '같이 할게요'
/** The pressed state's line, after a check. */
export const SUPPORT_PRESSED = '같이 하기로 했어요'
/** The separate small button beside it that takes it back. */
export const SUPPORT_CANCEL = '취소'
/** The toast after [취소] — the app and the link alike. */
export const SUPPORT_TOAST_OFF = '같이 하기를 취소했어요'

/** The not-pressed button's accessible name: '‘NT(목덜미 투명대)’ 같이 할게요'. */
export function supportAriaLabel(short: string): string {
  return `‘${short}’ ${SUPPORT_LABEL}`
}

/** [취소]'s accessible name: '‘NT(목덜미 투명대)’ 같이 하기 취소'. */
export function supportCancelAriaLabel(short: string): string {
  return `‘${short}’ 같이 하기 ${SUPPORT_CANCEL}`
}

/** The app's toast after [같이 할게요]: '같이 하기로 했어요 · 지은님 화면에도 보여요' (`name` is the bare name). */
export function supportToastAppOn(name: string): string {
  return `${SUPPORT_PRESSED} · ${name}님 화면에도 보여요`
}

/** The link's toast after [같이 할게요]: '‘국민행복카드’ 같이 하기로 했어요. 지은님에게 전해져요' (`to` carries its own 님). */
export function supportToastLinkOn(short: string, to: string): string {
  return `‘${short}’ ${SUPPORT_PRESSED}. ${to}에게 전해져요`
}
