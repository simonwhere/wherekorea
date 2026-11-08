export type CardFestivalLink = {
  city: string
  name: string
  nameKo: string
  anchor: string
  aliases: string[]
}

export function searchedCityFestival(links: CardFestivalLink[], city: string, query: string) {
  const text = query.trim().toLowerCase()
  if (text.length < 2) return
  return links.find(event => event.city === city && [event.name, event.nameKo, ...event.aliases]
    .some(name => name.toLowerCase() === text))
}
