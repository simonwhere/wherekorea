/* This reader must run after a full reload with no Next.js chunks or network.
   It uses the same explicit, browser-local bookmarks as the online Saved page. */
(() => {
  const walks = JSON.parse(document.getElementById('walk-data').textContent)
  const main = document.getElementById('offline-walk')
  const prefix = 'wherekorea.saved-walks.v1.'
  const walk = walks.find(item => '/walks/' + item.slug === location.pathname.replace(/\/$/, ''))
  let changedInPage = false
  let storageNotice = ''

  function node(tag, text, className) {
    const element = document.createElement(tag)
    if (text) element.textContent = text
    if (className) element.className = className
    return element
  }

  function link(href, text) {
    const element = node('a', text)
    element.href = href
    return element
  }

  function read(guide) {
    try {
      const raw = localStorage.getItem(prefix + guide.slug)
      if (raw === null) return null
      const saved = JSON.parse(raw)
      if (saved?.slug !== guide.slug || !Number.isInteger(saved.stop) || saved.stop < 1 ||
          saved.stop > guide.stops.length || !Number.isSafeInteger(saved.savedAt) || saved.savedAt < 0) {
        throw new Error('Invalid walk')
      }
      return saved
    } catch {
      storageNotice = 'A saved walk could not be read in this browser.'
      return null
    }
  }

  function bookmarkedStop(guide, saved) {
    const values = new URLSearchParams(location.search).getAll('stop')
    if (!values.length) return saved.stop
    const stop = values.length === 1 && /^[1-9]\d*$/.test(values[0]) ? Number(values[0]) : 0
    return stop >= 1 && stop <= guide.stops.length ? stop : 1
  }

  function remove(guide) {
    try { localStorage.removeItem(prefix + guide.slug); render() }
    catch { showError('This browser could not remove the walk. Try again.') }
  }

  function choose(guide, stop) {
    const saved = read(guide)
    if (!saved) { render(); return }
    try {
      localStorage.setItem(prefix + guide.slug, JSON.stringify({ slug: guide.slug, stop, savedAt: Date.now() }))
    } catch {
      showError('This browser could not save the new stop. Your previous stop is still saved.')
      return
    }
    const url = new URL(location.href)
    url.searchParams.set('stop', String(stop))
    history.replaceState(null, '', url)
    changedInPage = true
    render()
  }

  function showError(text) {
    let warning = main.querySelector('[role="alert"]')
    if (!warning) { warning = node('p'); warning.setAttribute('role', 'alert'); main.prepend(warning) }
    warning.textContent = text
  }

  function renderList() {
    document.title = 'Saved walks · WhereKorea'
    main.append(node('h1', 'Saved walks'), node('p', 'Walking directions kept on this browser.', 'note'))
    const list = node('ul')
    const saved = walks.map(guide => ({ guide, record: read(guide) })).filter(item => item.record)
    saved.sort((a, b) => b.record.savedAt - a.record.savedAt)
    for (const { guide, record } of saved) {
      const row = node('li'), heading = node('h2')
      heading.append(link('/walks/' + guide.slug + '?stop=' + record.stop, guide.name))
      const place = guide.stops[record.stop - 1]
      const text = node('p', 'Stop ' + record.stop + ' · ' + place.name + ' ')
      const localName = node('span', place.nameKo)
      localName.lang = 'ko'
      text.append(localName)
      const button = node('button', 'Remove')
      button.setAttribute('aria-label', 'Remove ' + guide.name + ' from Saved')
      button.onclick = () => remove(guide)
      const actions = node('div', '', 'row')
      actions.append(heading, button)
      row.append(actions, text)
      list.append(row)
    }
    main.append(list)
    if (!saved.length && !storageNotice) main.append(node('p', 'No walks saved on this browser. Save a walk when you’re online.'))
  }

  function renderWalk(guide) {
    main.append(link('/saved', '← Saved walks'))
    const heading = node('h1', guide.name), ko = node('small', guide.nameKo)
    ko.lang = 'ko'
    heading.append(ko)
    main.append(heading)
    document.title = guide.name + ' · Offline walk'
    const saved = read(guide)
    if (!saved) {
      if (!storageNotice) main.append(node('p', 'This walk isn’t saved in this browser. Open it online to save its directions.'))
      return
    }
    const selected = bookmarkedStop(guide, saved)
    const current = guide.stops[selected - 1]
    const summary = node('p', 'Stop ' + selected + ' of ' + guide.stops.length + ' · ' + current.name + ' ')
    const localName = node('span', current.nameKo)
    localName.lang = 'ko'
    summary.append(localName)
    summary.setAttribute('role', 'status')
    main.append(summary, node('p', 'Reading saved directions offline.', 'note'))
    const list = node('ol')
    guide.stops.forEach((stop, index) => {
      const number = index + 1
      const item = node('li')
      item.id = 'stop-' + number
      if (number === selected) item.setAttribute('aria-current', 'step')
      const title = node('h2', stop.name)
      const ko = node('small', stop.nameKo)
      ko.lang = 'ko'
      title.append(ko)
      item.append(node('p', number === 1 ? '1 · Start here' : 'Stop ' + number, 'step'), title, node('p', stop.walk), node('p', stop.what))
      if (guide.breakfast?.stop === number) {
        const breakfast = guide.breakfast
        item.append(node('h3', 'Breakfast · ' + breakfast.venue + ' · ' + breakfast.venueKo))
        const ordering = breakfast.ordering
        if (ordering) item.append(node('strong', ordering.summary))
        item.append(node('p', breakfast.hours), node('p', breakfast.detail), node('p', breakfast.address))
        if (ordering) {
          const question = node('p', ordering.questionKo)
          question.lang = 'ko'
          item.append(link('tel:' + ordering.phone.replaceAll(' ', ''), 'Call ' + ordering.phone), question)
        }
        item.append(node('p', (ordering ? 'Listing checked ' : 'Hours checked ') + breakfast.checked, 'note'))
      }
      if (number !== selected || saved.stop !== selected) {
        const button = node('button', 'Save this stop')
        button.setAttribute('aria-label', 'Save stop ' + number + ' · ' + stop.name)
        button.onclick = () => choose(guide, number)
        item.append(button)
      }
      list.append(item)
    })
    main.append(list)
    const active = list.children[selected - 1]
    active.tabIndex = -1
    if (changedInPage) { active.focus({ preventScroll: true }); changedInPage = false }
    if (selected !== 1) active.scrollIntoView({ block: 'start' })
  }

  function render() {
    storageNotice = ''
    main.replaceChildren()
    if (walk) renderWalk(walk)
    else renderList()
    if (storageNotice) showError(storageNotice)
  }

  window.addEventListener('storage', event => { if (!event.key || event.key.startsWith(prefix)) render() })
  window.addEventListener('pageshow', render)
  render()
})()
