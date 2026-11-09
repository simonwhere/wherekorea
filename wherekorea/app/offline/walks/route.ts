import { walks } from '@/data/walks'

export const dynamic = 'force-static'

export function GET() {
  // Only public walking directions are bundled. Photos, coordinates, personal
  // bookmarks and meetup drafts do not belong in this offline document.
  const snapshot = walks.map(({ slug, name, nameKo, stops, breakfast }) => ({
    slug, name, nameKo, stops: stops.map(({ name, nameKo, walk, what }) => ({ name, nameKo, walk, what })),
    breakfast: breakfast && {
      venue: breakfast.venue, venueKo: breakfast.venueKo, hours: breakfast.hours, checked: breakfast.checked,
      stop: breakfast.stop, address: breakfast.address, detail: breakfast.detail,
      ordering: breakfast.ordering && {
        summary: breakfast.ordering.summary, phone: breakfast.ordering.phone, questionKo: breakfast.ordering.questionKo,
      },
    },
  }))
  const data = JSON.stringify(snapshot).replace(/</g, '\\u003c')
  const document = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Offline walks · WhereKorea</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#16181f;color:#f5f6f8;font:16px/1.55 system-ui,sans-serif}
header{border-bottom:1px solid #424955;padding:15px max(16px,calc((100% - 650px)/2));font-weight:700}
main{max-width:690px;margin:auto;padding:18px 18px 64px}h1{font-size:clamp(26px,5vw,34px);line-height:1.2;margin:12px 0}h2{font-size:19px}p{margin:8px 0}
h1 small,h2 small{display:block;color:#cfdae2;font-size:16px;font-weight:500}a{color:#ffc4a9}
a,button{min-height:44px;display:inline-flex;align-items:center;overflow-wrap:anywhere}button{font:inherit;font-size:14px;background:transparent;color:#ffccaf;border:1px solid #806e64;border-radius:7px;padding:6px 12px}
:focus-visible{outline:3px solid #ffb595;outline-offset:3px}ol,ul{padding:0;list-style:none}li{margin:10px 0;padding:14px;background:#232934;border:1px solid #445160;border-radius:10px}li h2{margin:0}
li[aria-current="step"]{border-color:#ffb595;border-left-width:4px}li[aria-current="step"] .step{color:#ffd0b6}
.step{margin:0 0 4px;font-size:13px;font-weight:700;color:#b7c8d3}.note{color:#d2dae1;font-size:14px}.row{display:flex;gap:8px 18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
</style></head><body><header>WhereKorea</header><main id="offline-walk"></main>
<noscript>Turn on JavaScript to read the walks saved in this browser.</noscript>
<script type="application/json" id="walk-data">${data}</script><script defer src="/walk-offline-screen.js"></script></body></html>`
  return new Response(document, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow',
    'X-WhereKorea-Offline': '1',
    'X-WhereKorea-Walk-Slugs': walks.map(walk => walk.slug).join(','),
  } })
}
