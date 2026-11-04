export type AnalyticsConfig =
  | { mode: 'site-script'; src: string }
  | { mode: 'legacy'; src: string; domain: string }
  | { mode: 'disabled'; reason: 'not-configured' | 'invalid-script' | 'invalid-domain' }

/** Only the existing provider is allowed; configuration is not arbitrary script injection. */
export function getAnalyticsConfig(script?: string, domain?: string): AnalyticsConfig {
  const src = script?.trim()
  if (src) {
    if (/^https:\/\/plausible\.io\/js\/pa-[A-Za-z0-9_-]+\.js$/.test(src)
      && !src.includes('pa-XXXXX')) return { mode: 'site-script', src }
    return { mode: 'disabled', reason: 'invalid-script' }
  }
  const host = domain?.trim()
  if (!host) return { mode: 'disabled', reason: 'not-configured' }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) {
    return { mode: 'disabled', reason: 'invalid-domain' }
  }
  // Preserve existing installations until the account owner supplies their site script.
  return { mode: 'legacy', domain: host, src: 'https://plausible.io/js/script.js' }
}

/** Runs before the deferred provider, so early product events are not lost.
 * Bounded, in-memory only. No provider configured means no stub and no collection.
 * Queue contract follows Plausible's official installation snippet.
 */
export function analyticsBootstrap(mode: 'site-script' | 'legacy'): string {
  return `(function(){var p=window.plausible=window.plausible||function(){var q=p.q=p.q||[];if(q.length<100)q.push(arguments);};${mode === 'site-script'
    ? 'p.init=p.init||function(options){p.o=options||{};};p.init({captureOnLocalhost:false});'
    : ''}})();`
}
