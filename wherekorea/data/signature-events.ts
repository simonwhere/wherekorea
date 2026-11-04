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
  note: string        // short description; not a current schedule or admission claim
  ticketing: Ticketing
}

export const SIGNATURE_EVENTS: SignatureEvent[] = [
  // Seoul
  { city: 'seoul', name: 'Seoul International Fireworks Festival', months: [10], when: 'early Oct',
    note: 'Fireworks by the river at Yeouido', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Lotus Lantern Festival (Yeondeunghoe)', months: [5], when: 'May',
    note: 'Lantern parade through Jongno', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Seoul Lantern Festival', months: [12, 1], when: 'Dec–Jan',
    note: 'Light installations along Cheonggyecheon and Gwanghwamun', ticketing: 'walk-in' },
  { city: 'seoul', name: 'Hangang Summer Festival', months: [7, 8], when: 'late Jul–Aug',
    note: 'Summer events along the Han River', ticketing: 'walk-in' },

  // Busan
  { city: 'busan', name: 'Gwangalli M Drone Light Show', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], when: 'every Sat night',
    note: 'Drone light show over Gwangalli Beach', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan Sea Festival', months: [8], when: 'early Aug',
    note: 'Concerts and events at Busan beaches', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan International Film Festival (BIFF)', months: [10], when: 'early Oct',
    note: 'International film screenings in Busan', ticketing: 'english-booking' },
  { city: 'busan', name: 'Busan Fireworks Festival', months: [11], when: 'Nov',
    note: 'Fireworks over Gwangalli Beach', ticketing: 'walk-in' },
  { city: 'busan', name: 'Haeundae Sand Festival', months: [5], when: 'May',
    note: 'Sand sculptures at Haeundae Beach', ticketing: 'walk-in' },

  // Jeju
  { city: 'jeju', name: 'Jeju Fire Festival', months: [3], when: 'early Mar',
    note: 'Seasonal festival on Jeju; the program varies by year', ticketing: 'walk-in' },
  { city: 'jeju', name: 'Canola flower season', months: [4], when: 'Apr',
    note: 'Canola flowers in eastern Jeju', ticketing: 'walk-in' },
  { city: 'jeju', name: 'Seongsan Sunrise Festival', months: [12, 1], when: 'Dec 31–Jan 1',
    note: 'New Year sunrise events at Seongsan Ilchulbong', ticketing: 'walk-in' },

  // Gyeongju
  { city: 'gyeongju', name: 'Cherry blossom season & marathon', months: [4], when: 'early Apr',
    note: 'Cherry blossoms around Bomun Lake and a spring marathon', ticketing: 'walk-in' },

  // Jeonju
  { city: 'jeonju', name: 'Jeonju International Film Festival', months: [4, 5], when: 'late Apr–early May',
    note: 'Independent film screenings in Jeonju', ticketing: 'english-booking' },
  { city: 'jeonju', name: 'Jeonju Bibimbap Festival', months: [10], when: 'Oct',
    note: 'Food events focused on bibimbap', ticketing: 'walk-in' },

  // Suwon
  { city: 'suwon', name: 'Suwon Hwaseong Cultural Festival', months: [10], when: 'early Oct',
    note: 'Parades and performances around Hwaseong Fortress', ticketing: 'walk-in' },

  // Chuncheon
  { city: 'chuncheon', name: 'Chuncheon Mime Festival', months: [5], when: 'late May',
    note: 'Mime and street performances in Chuncheon', ticketing: 'walk-in' },

  // Gangneung
  { city: 'gangneung', name: 'Gangneung Danoje (UNESCO)', months: [6], when: 'Jun',
    note: 'Traditional rituals, performances and markets', ticketing: 'walk-in' },
  { city: 'gangneung', name: 'Gangneung Coffee Festival', months: [10], when: 'Oct',
    note: 'Coffee tastings and events in Gangneung', ticketing: 'walk-in' },

  // Tongyeong
  { city: 'tongyeong', name: 'Tongyeong International Music Festival', months: [3, 4], when: 'late Mar–early Apr',
    note: 'Classical music concerts in Tongyeong', ticketing: 'english-booking' },
  { city: 'tongyeong', name: 'Hansan Battle Festival', months: [8], when: 'Aug',
    note: 'Naval reenactments of the 1592 victory', ticketing: 'walk-in' },

  // Namhae
  { city: 'namhae', name: 'German Village Oktoberfest', months: [10], when: 'early Oct',
    note: 'Beer festival in Namhae German Village', ticketing: 'walk-in' },

  // Yeosu
  { city: 'yeosu', name: 'Yeosu Turtle Ship Festival', months: [5], when: 'May',
    note: 'Harbor events commemorating Admiral Yi Sun-sin', ticketing: 'walk-in' },

  // Andong
  { city: 'andong', name: 'Andong Mask Dance Festival', months: [9, 10], when: 'late Sep–early Oct',
    note: 'Mask-dance performances in Andong', ticketing: 'walk-in' },

  // Jirisan
  { city: 'jirisan', name: 'Gurye Sansuyu Blossom Festival', months: [3], when: 'mid-Mar',
    note: 'Yellow sansuyu blossoms at the foot of the mountain', ticketing: 'walk-in' },
  { city: 'jirisan', name: 'Hadong Wild Tea Festival', months: [5], when: 'May',
    note: 'Wild green tea harvest in the Hwagae valley', ticketing: 'walk-in' },

  // Damyang & Boseong
  { city: 'damyang-boseong', name: 'Damyang Bamboo Festival', months: [5], when: 'May',
    note: 'Bamboo-themed events in Damyang', ticketing: 'walk-in' },
  { city: 'damyang-boseong', name: 'Boseong Green Tea Festival', months: [5], when: 'May',
    note: 'Tea-related events in Boseong', ticketing: 'walk-in' },
  { city: 'damyang-boseong', name: 'Boseong Tea Field Light Festival', months: [12, 1], when: 'Dec–Jan',
    note: 'Light displays at the tea fields', ticketing: 'walk-in' },
]
