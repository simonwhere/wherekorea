// Signature annual events — editorial seed, one-time entry, refreshed yearly.
// Rules (docs/planning-neighborhoods-events.md):
// - Only events inside our 15 destinations. Only well-established annual events;
//   when timing/ticketing is uncertain, the event is OMITTED (no guessing).
// - Timing is expressed as typical windows ('early Oct'), not exact dates —
//   exact dates drift yearly and live in the festival's own channels.
// - Information only: never a ranking input.
// Ticketing labels:
//   walk-in          — show up; free or on-site entry
//   english-booking  — bookable via an English-language channel (official site / Interpark Global)
//   id-required      — booking needs Korean ID verification (hard for foreigners)

export type Ticketing = 'walk-in' | 'english-booking' | 'id-required'

export interface SignatureEvent {
  city: string        // destination slug
  name: string
  months: number[]    // months it typically runs (1–12)
  when: string        // human timing, e.g. 'early Oct'
  note: string        // one-line decision language
  ticketing: Ticketing
}

export const SIGNATURE_EVENTS: SignatureEvent[] = [
  // Seoul
  { city: 'seoul', name: 'Seoul International Fireworks Festival', months: [10], when: 'early Oct',
    note: 'Yeouido riverside, free — claim a spot by mid-afternoon', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Lotus Lantern Festival (Yeondeunghoe)', months: [5], when: 'May',
    note: 'UNESCO-listed lantern parade through Jongno', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Seoul Lantern Festival', months: [12, 1], when: 'Dec–Jan',
    note: 'Light installations along Cheonggyecheon and Gwanghwamun', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Hangang Summer Festival', months: [7, 8], when: 'late Jul–Aug',
    note: 'Riverside pools, night markets and concerts along the Han', ticketing: 'walk-in' },

  // Busan
  { city: 'busan', name: 'Gwangalli M Drone Light Show', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], when: 'every Sat night',
    note: 'Free weekly drone show over Gwangalli Beach — year-round', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan Sea Festival', months: [8], when: 'early Aug',
    note: 'Beach concerts and water events across the city beaches', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan International Film Festival (BIFF)', months: [10], when: 'early Oct',
    note: "Asia's biggest film festival — open-air screenings by the sea", ticketing: 'english-booking' },
  { city: 'busan', name: 'Busan Fireworks Festival', months: [11], when: 'Nov',
    note: 'Gwangalli Beach, free — arrive hours early or book a café seat', ticketing: 'walk-in' },
  { city: 'busan', name: 'Haeundae Sand Festival', months: [5], when: 'May',
    note: 'Sand sculptures on the main beach, family-friendly', ticketing: 'walk-in' },

  // Jeju
  { city: 'jeju', name: 'Jeju Fire Festival', months: [3], when: 'early Mar',
    note: "A whole hillside set alight — one of Korea's most dramatic sights", ticketing: 'walk-in' },
  { city: 'jeju', name: 'Canola flower season', months: [4], when: 'Apr',
    note: 'Yellow fields across the east — peak photo season', ticketing: 'walk-in' },
  { city: 'jeju', name: 'Seongsan Sunrise Festival', months: [12, 1], when: 'Dec 31–Jan 1',
    note: 'New-year sunrise crowd at Ilchulbong crater', ticketing: 'walk-in' },

  // Gyeongju
  { city: 'gyeongju', name: 'Cherry blossom season & marathon', months: [4], when: 'early Apr',
    note: 'Bomun Lake in full bloom — the city at its best', ticketing: 'walk-in' },

  // Jeonju
  { city: 'jeonju', name: 'Jeonju International Film Festival', months: [4, 5], when: 'late Apr–early May',
    note: 'Indie cinema takes over the old town', ticketing: 'english-booking' },
  { city: 'jeonju', name: 'Jeonju Bibimbap Festival', months: [10], when: 'Oct',
    note: 'The signature dish, celebrated where it was born', ticketing: 'walk-in' },

  // Suwon
  { city: 'suwon', name: 'Suwon Hwaseong Cultural Festival', months: [10], when: 'early Oct',
    note: 'Royal parade and performances at the UNESCO fortress', ticketing: 'walk-in' },

  // Chuncheon
  { city: 'chuncheon', name: 'Chuncheon Mime Festival', months: [5], when: 'late May',
    note: 'Street theatre takes over the lakeside city', ticketing: 'walk-in' },

  // Gangneung
  { city: 'gangneung', name: 'Gangneung Danoje (UNESCO)', months: [6], when: 'Jun',
    note: 'Millennium-old shamanic festival — rites, wrestling, night markets', ticketing: 'walk-in' },
  { city: 'gangneung', name: 'Gangneung Coffee Festival', months: [10], when: 'Oct',
    note: "The Anmok café scene's biggest week", ticketing: 'walk-in' },

  // Tongyeong
  { city: 'tongyeong', name: 'Tongyeong International Music Festival', months: [3, 4], when: 'late Mar–early Apr',
    note: 'World-class classical festival in a fishing harbor', ticketing: 'english-booking' },
  { city: 'tongyeong', name: 'Hansan Battle Festival', months: [8], when: 'Aug',
    note: 'Naval reenactments of the 1592 victory', ticketing: 'walk-in' },

  // Namhae
  { city: 'namhae', name: 'German Village Oktoberfest', months: [10], when: 'early Oct',
    note: 'Beer festival in the hillside German settlers village', ticketing: 'walk-in' },

  // Yeosu
  { city: 'yeosu', name: 'Yeosu Turtle Ship Festival', months: [5], when: 'May',
    note: 'Admiral Yi heritage festival along the old harbor', ticketing: 'walk-in' },

  // Andong
  { city: 'andong', name: 'Andong Mask Dance Festival', months: [9, 10], when: 'late Sep–early Oct',
    note: "The city's signature week — book Hahoe stays early", ticketing: 'walk-in' },

  // Jirisan
  { city: 'jirisan', name: 'Gurye Sansuyu Blossom Festival', months: [3], when: 'mid-Mar',
    note: 'Yellow sansuyu blossoms at the foot of the mountain', ticketing: 'walk-in' },
  { city: 'jirisan', name: 'Hadong Wild Tea Festival', months: [5], when: 'May',
    note: 'Wild green tea harvest in the Hwagae valley', ticketing: 'walk-in' },

  // Damyang & Boseong
  { city: 'damyang-boseong', name: 'Damyang Bamboo Festival', months: [5], when: 'May',
    note: 'Juknokwon forest at its greenest', ticketing: 'walk-in' },
  { city: 'damyang-boseong', name: 'Boseong Green Tea Festival', months: [5], when: 'May',
    note: 'First-pluck season on the terraced fields', ticketing: 'walk-in' },
  { city: 'damyang-boseong', name: 'Boseong Tea Field Light Festival', months: [12, 1], when: 'Dec–Jan',
    note: 'The tea terraces lit up after dark — a winter reason to come south', ticketing: 'walk-in' },
]
