export type PlayMode = 'classic' | 'practice' | 'online' | 'passplay'

interface ModeInfo {
  title: string
  blurb: string
  rules: string[]
}

/** The four ways to play: name, one-line summary and the short rules screen. */
export const PLAY_MODES: Record<PlayMode, ModeInfo> = {
  classic: {
    title: 'Classic',
    blurb: 'Timed rounds and a final score',
    rules: [
      'A place name appears and the clock starts.',
      'Spin and zoom the globe, drop your marker, then confirm.',
      'Missed? Keep trying until time runs out.',
      'The faster you find it, the more points you score.',
    ],
  },
  practice: {
    title: 'Practice',
    blurb: 'Learn the map, with every name shown',
    rules: [
      'Place names stay on the map, including the place you’re looking for.',
      'Read the map, find the place, then drop your marker on it and confirm.',
      'Missed? Keep trying until time runs out.',
      'There’s no round limit: end the session whenever you like.',
    ],
  },
  online: {
    title: 'Online',
    blurb: 'Rooms for up to 8 players',
    rules: [
      'Create a room and share its 4-digit code, or join a friend’s room.',
      'Everyone searches for the same place at the same time.',
      'Faster correct answers score more points.',
      'Needs an internet connection.',
    ],
  },
  passplay: {
    title: 'Pass & Play',
    blurb: '2–6 players on this device',
    rules: [
      'Players take turns on one device.',
      'You get one guess per round, so place your marker carefully.',
      'Guesses stay hidden until everyone has played.',
      'Faster correct guesses score more points.',
    ],
  },
}
