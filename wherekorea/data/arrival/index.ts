import { andong } from './andong'
import { gyeongju } from './gyeongju'
import { jeonju } from './jeonju'
import { sokcho } from './sokcho'
import { tongyeong } from './tongyeong'
import { jeju } from './jeju'
import { gangneung } from './gangneung'
import { yeosu } from './yeosu'
import { namhae } from './namhae'

export const arrivalCards = [andong, gyeongju, jeonju, sokcho, tongyeong, jeju, gangneung, yeosu, namhae]

export const modeLabels = {
  rail: { service: 'Train', arrival: 'From the station' },
  coach: { service: 'Coach', arrival: 'From the terminal' },
  flight: { service: 'Flight', arrival: 'From the airport' },
}
