export { useSingleplayerGame } from './rounds/useSingleplayerGame'
export type { SingleplayerGameApi } from './rounds/useSingleplayerGame'
export {
  DEFAULT_CONFIG,
  DIFFICULTY_OPTIONS,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_TIMER_SECONDS,
  MAX_TIMER_SECONDS,
  clampRounds,
  clampTimerSeconds,
} from './config'
export { challengeLabel, answerLocation, featureLabel } from './navigation/regionCamera'
export { PLACE_INFO, type PlaceInfo } from './data/facts'
export { travelTo, setTravelReducedMotion } from './navigation/travel'
export { regionalRoundView } from './navigation/regionView'
export type {
  Challenge,
  Difficulty,
  GameConfig,
  GamePhase,
  MatchSummary,
  RoundCount,
  RoundResult,
  TimerSeconds,
} from './types'
export { discoveryInfoFor, discoveryInfoForReveal } from './discovery'
export { labelFilterFor, labelTargetFor, labelTargetForId, labelTargetForMultiplayer, type LabelTarget } from './labels'
export { loadPool, poolEntryById } from './data/pool'
