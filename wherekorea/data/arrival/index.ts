import { andong } from './andong'
import { gyeongju } from './gyeongju'
import { jeonju } from './jeonju'
import { sokcho } from './sokcho'
import { tongyeong } from './tongyeong'
import { jeju } from './jeju'

export const arrivalCards = [andong, gyeongju, jeonju, sokcho, tongyeong, jeju]

export const modeLabels = {
  rail: { service: 'Train', arrival: 'From the station' },
  coach: { service: 'Coach', arrival: 'From the terminal' },
  flight: { service: 'Flight', arrival: 'From the airport' },
}
