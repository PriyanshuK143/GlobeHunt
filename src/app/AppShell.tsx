import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GlobeCanvas,
  HOME_CAMERA_ALTITUDE,
  MENU_CAMERA_ALTITUDE,
  prefersReducedMotion,
  createMarkerStore,
  type AmbientProfile,
  type GlobeNavigationApi,
  type LatLng,
} from '../globe'
import { usePassAndPlay, useSingleplayerGame } from '../game'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import { HomeScreen } from './HomeScreen'
import { MainMenu } from './MainMenu'
import { AudioStartPrompt } from './AudioStartPrompt'
import { GameConfigPanel } from './GameConfigPanel'
import { GameHUD } from './GameHUD'
import { RoundResultOverlay } from './RoundResultOverlay'
import { ResultsScreen } from './ResultsScreen'
import { MultiplayerHub } from './multiplayer/MultiplayerHub'
import { CreateJoinForms } from './multiplayer/CreateJoinForms'
import { LobbyPanel } from './multiplayer/LobbyPanel'
import {
  MpGameHUD,
  MpMatchResults,
  MpRoundResultPanel,
} from './multiplayer/MpMatchOverlays'
import { SettingsScreen } from './SettingsScreen'
import { CreditsScreen } from './CreditsScreen'
import { HowToPlay } from './howto/HowToPlay'
import { PauseMenu } from './pause/PauseMenu'
import { SatelliteCard } from './SatelliteCard'
import { PlanetCard } from './PlanetCard'
import type { CelestialSpec, SatelliteSpec } from '../globe'
import { audio } from '../audio'
import { saveSettings } from '../settings/settings'
import { loadSettings, type AppSettings } from '../settings/settings'
import { gameAudio } from '../settings/audio'
import { useAudioSettings, useAudioUnlock } from '../audio'
import { useGameAudio } from './useGameAudio'
import { setTravelReducedMotion, travelTo } from '../game/navigation/travel'
import { revealView } from '../game/navigation/revealView'
import { answerLocation, labelFilterFor, labelTargetFor, labelTargetForMultiplayer, practiceTargetLabels } from '../game'
import type { GlobeLabelsConfig } from '../globe'
import { SpaceCorners } from './ambient/SpaceCorners'
import { MarkerConfirm } from './MarkerConfirm'
import { AmbientCommentary } from './ambient/AmbientCommentary'
import { revealApp } from './launchVeil'
import { takeInviteCode } from '../multiplayer/invite'
import { PassPlaySetup } from './passplay/PassPlaySetup'
import { PassPlayHandoff } from './passplay/PassPlayHandoff'
import { PassPlayFinal, PassPlayReveal } from './passplay/PassPlayResults'
import './game-ui.css'
import './ambient/ambient.css'
import './mobile.css'
import './passplay/passplay.css'
import './modes/modes.css'
import { ModeChooser, ModeRules } from './modes/PlayModes'
import type { PlayMode } from './modes/playModes'

export type AppMode =
  | 'home'
  | 'menu'
  | 'singleplayer'
  | 'multiplayer'
  | 'passplay'
  | 'choose-single'
  | 'choose-multi'
  | 'rules'
  | 'settings'
  | 'credits'
  | 'howto'
  | 'exit'

const HOME_VIEW = { lat: 12, lng: -55, altitude: HOME_CAMERA_ALTITUDE }
const SCREEN_LEAVE_MS = 200
const CREDITS_TRANSITION_MS = 620
const MENU_VIEW = { lat: 15, lng: -70, altitude: MENU_CAMERA_ALTITUDE }

export function AppShell() {
  const [mode, setMode] = useState<AppMode>('home')
  const [flyingIn, setFlyingIn] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  // Screen changes fade the current panel out briefly before the next one fades in.
  const [leaving, setLeaving] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [creditsTransition, setCreditsTransition] = useState(false)
  const [creditsIncoming, setCreditsIncoming] = useState(false)
  const [menuIncoming, setMenuIncoming] = useState(false)
  // The scene a menu ↔ credits crossfade just handed off to. It keeps its crossfaded
  // state instead of replaying its normal entrance (which would blank it for a frame).
  const [arrivedScene, setArrivedScene] = useState<'menu' | 'credits' | null>(null)
  // Opened from an invite link (?join=1234): the guest still starts on the Fly screen.
  const [inviteCode, setInviteCode] = useState<string | null>(() => takeInviteCode())
  const leaveTimer = useRef<number | null>(null)
  const transitionLocked = useRef(false)
  const globeRef = useRef<GlobeNavigationApi | null>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const sp = useSingleplayerGame()
  const mp = useMultiplayer()
  const pp = usePassAndPlay()
  // Mode whose rules screen is showing (between the chooser and that mode's setup).
  const [rulesFor, setRulesFor] = useState<PlayMode>('classic')
  // Draggable answer marker (separate from scoring; confirm hands lat/lng to onGlobePick).
  const marker = useMemo(() => createMarkerStore(), [])
  useAudioUnlock()
  useAudioSettings(settings)

  // Start pulled back in space on the home screen
  // Set by Back (menu → home): the camera is already flying home, don't snap it.
  const returningHome = useRef(false)
  useEffect(() => {
    if (mode !== 'home') return
    if (returningHome.current) return
    // The globe scene mounts after its textures load (Suspense), so keep retrying
    // briefly until the navigation API is live and the camera has been placed.
    let tries = 0
    const id = window.setInterval(() => {
      tries++
      const api = globeRef.current
      api?.setView(HOME_VIEW)
      const placed = api && Math.abs(api.getView().altitude - HOME_VIEW.altitude) < 0.05
      if (placed || tries > 40) {
        window.clearInterval(id)
        revealApp()
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [mode])

  useEffect(() => {
    if (!sp.missFlash) return
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-miss', 'is-success')
    void el.offsetWidth
    el.classList.add('is-miss')
  }, [sp.missFlash])

  useEffect(() => {
    if (!sp.successFlash) return
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-miss', 'is-success')
    void el.offsetWidth
    el.classList.add('is-success')
  }, [sp.successFlash])

  // Open singleplayer configuration when entering that mode
  useEffect(() => {
    if (mode !== 'singleplayer') return
    if (sp.phase === 'menu') sp.openConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const mpRoundKey = mp.challenge?.roundKey
  const mpGuide = mp.challenge?.guide

  // The server supplies an intentionally broad, target-independent regional anchor.
  useEffect(() => {
    if (mode !== 'multiplayer' || mp.screen !== 'playing' || !mpGuide) return
    void travelTo(globeRef.current, mpGuide, { maxMs: 2200 })
  }, [mode, mp.screen, mpRoundKey, mpGuide])

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (mode !== 'multiplayer' || mp.screen !== 'playing' || !mp.roundEndsAt) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [mode, mp.screen, mp.roundEndsAt])

  const mpRemaining = mp.roundEndsAt ? Math.max(0, mp.roundEndsAt - now) : 0

  const pickingEnabled = useMemo(() => {
    if (mode === 'singleplayer') return sp.pickingEnabled
    if (mode === 'passplay') return pp.pickingEnabled
    if (mode === 'multiplayer' && mp.screen === 'playing' && !mp.finished) {
      return Boolean(mp.roundStartedAt && now >= mp.roundStartedAt)
    }
    return false
  }, [mode, sp.pickingEnabled, pp.pickingEnabled, mp.screen, mp.finished, mp.roundStartedAt, now])

  const onGlobePick = (coords: LatLng) => {
    if (mode === 'singleplayer') {
      sp.handleGlobePick(coords)
      return
    }
    if (mode === 'passplay') {
      // One guess per player: lock it in with no right/wrong feedback until the reveal.
      gameAudio.play('click', settings)
      pp.submit(coords, globeRef.current)
      return
    }
    if (mode === 'multiplayer' && mp.screen === 'playing' && !mp.finished) {
      void mp.submitAnswer(coords.lat, coords.lng).then((correct) => {
        gameAudio.play(correct ? 'correct' : 'miss', settings)
        const el = flashRef.current
        if (!el) return
        el.classList.remove('is-miss', 'is-success')
        void el.offsetWidth
        el.classList.add(correct ? 'is-success' : 'is-miss')
      })
    }
  }

  const inSpMatch =
    mode === 'singleplayer' &&
    (sp.phase === 'playing' ||
      sp.phase === 'loading' ||
      sp.phase === 'round_result' ||
      sp.phase === 'results')

  const inMpMatch =
    mode === 'multiplayer' &&
    (mp.screen === 'playing' || mp.screen === 'round_result' || mp.screen === 'match_results')

  const reducedMotion = settings.reducedMotion || prefersReducedMotion()
  useEffect(() => setTravelReducedMotion(reducedMotion), [reducedMotion])
  const inPpMatch = mode === 'passplay' && pp.phase !== 'setup'
  const inMatch = inSpMatch || inMpMatch || inPpMatch

  const ambient = useMemo<AmbientProfile>(
    () => ({
      mode: inMatch ? 'gameplay' : 'showcase',
      effects: settings.ambientEffects,
      reducedMotion,
      quality: settings.graphicsQuality,
    }),
    [inMatch, settings.ambientEffects, reducedMotion, settings.graphicsQuality],
  )

  const activelySearching =
    (mode === 'singleplayer' && sp.phase === 'playing' && sp.pickingEnabled) ||
    (mode === 'multiplayer' && mp.screen === 'playing' && !mp.finished) ||
    (mode === 'passplay' && pp.phase === 'turn' && pp.pickingEnabled)
  const commentaryRound =
    mode === 'singleplayer'
      ? `sp-${sp.roundIndex}-${sp.currentChallenge?.id ?? ''}`
      : mode === 'passplay'
        ? `pp-${pp.roundIndex}-${pp.turnIndex}`
        : `mp-${mp.challenge?.roundKey ?? ''}`

  // New challenge, a new Pass & Play turn, or leaving play → remove the previous target.
  const challengeKey =
    mode === 'singleplayer'
      ? sp.currentChallenge?.id ?? null
      : mode === 'multiplayer'
        ? mp.challenge?.roundKey ?? null
        : mode === 'passplay' && pp.phase !== 'setup'
          ? `pp-${pp.roundIndex}-${pp.turnIndex}-${pp.phase === 'handoff' ? 'handoff' : 'play'}`
          : null
  useEffect(() => {
    marker.clear()
  }, [marker, challengeKey, mode])

  // Discovery / reveal: lock the reticle on the answer and glide the camera to it,
  // keeping the answer clear of the result card when the card covers the centre.
  const revealCamera = (loc: LatLng) => {
    const view = globeRef.current?.getView()
    const altitude = Math.min(2.3, Math.max(1.6, (view?.altitude ?? 2) * 0.88))
    const card = document.querySelector('.discovery-card')?.getBoundingClientRect()
    const coversCentre = card && card.left < window.innerWidth / 2 && card.right > window.innerWidth / 2
    const target = revealView(loc, altitude, coversCentre ? card.top : null)
    void travelTo(globeRef.current, target, { minMs: 900, maxMs: 1700, sound: false })
  }
  useEffect(() => {
    if (mode !== 'singleplayer' || sp.phase !== 'round_result' || !sp.lastRoundResult) return
    const { challenge, outcome } = sp.lastRoundResult
    const own = marker.get().position
    // Countries and rivers are areas/paths: a correct pick stays where the player put it.
    // Areas, paths and polygons: a correct pick stays where the player put it.
    const keepOwn = outcome === 'correct' && own && (challenge.kind === 'country' || challenge.v.m === 'path' || challenge.v.m === 'poly')
    const loc = keepOwn && own ? own : answerLocation(challenge)
    marker.reveal(loc)
    revealCamera(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sp.phase, sp.lastRoundResult])
  useEffect(() => {
    if (mode !== 'passplay' || pp.phase !== 'reveal' || !pp.challenge) return
    const loc = answerLocation(pp.challenge)
    marker.reveal(loc)
    revealCamera(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pp.phase, pp.roundIndex])
  useEffect(() => {
    if (mode !== 'multiplayer' || mp.screen !== 'round_result' || !mp.roundResult?.reveal) return
    const loc = mp.roundResult.reveal.location
    marker.reveal(loc)
    revealCamera(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mp.screen, mp.roundResult])

  // Atlas labels: only during a match, per the (host's) setup; answer labels hidden while searching.
  const showLabelsSetting =
    mode === 'multiplayer' ? mp.room?.config.showLabels ?? true : mode === 'passplay' ? pp.config.showLabels : sp.config.showLabels
  const searchTargetId =
    mode === 'singleplayer' && (sp.phase === 'playing' || sp.phase === 'loading')
      ? sp.currentChallenge?.id ?? null
      : mode === 'passplay'
        ? pp.challenge?.id ?? null
        : null
  // Same round index on every client → identical decoys in multiplayer.
  const searchRound = mode === 'multiplayer' ? mp.room?.roundIndex ?? 0 : mode === 'passplay' ? pp.roundIndex : sp.roundIndex
  // Pass & Play: no labels on the hand-off screen (they return with the next turn).
  const ppLabelsOff = mode === 'passplay' && pp.phase !== 'turn' && pp.phase !== 'reveal'
  // Practice is for learning the map: every name is shown, including the place being searched.
  const practiceLabels = mode === 'singleplayer' && sp.practice
  const labelConfig = useMemo<GlobeLabelsConfig>(() => {
    const practicePin = practiceLabels ? practiceTargetLabels(sp.currentChallenge) : null
    return {
      enabled: inMatch && (practiceLabels || showLabelsSetting) && !ppLabelsOff,
      extra: practicePin?.extra,
      filter: practiceLabels
        ? practicePin?.filter
        : labelFilterFor(
        mode === 'singleplayer'
          ? labelTargetFor(sp.currentChallenge, searchRound)
          : mode === 'passplay'
            ? labelTargetFor(pp.challenge, searchRound)
            : labelTargetForMultiplayer(mp.challenge?.name, mp.challenge?.kind, mp.challenge?.featureKind, mp.challenge?.roundKey),
      ),
    }
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inMatch, practiceLabels, showLabelsSetting, ppLabelsOff, searchTargetId, searchRound, mp.challenge?.roundKey],
  )

  useGameAudio({
    // The first click only unlocks browser audio; the home screen stays in full colour.
    // How to Play has its own old-school "space class" tape music (no voices anywhere).
    scene: mode === 'credits' ? 'credits' : mode === 'howto' ? 'howto' : inMatch ? 'gameplay' : 'home',
    marker,
    searching: activelySearching,
    challengeKey,
    remainingMs: mode === 'multiplayer' ? mpRemaining : mode === 'passplay' ? pp.remainingMs : sp.remainingMs,
    spSuccess: sp.successFlash,
    spMiss: sp.missFlash,
    spTimeoutKey:
      sp.lastRoundResult && sp.lastRoundResult.outcome === 'timeout'
        ? `${sp.roundIndex}-${sp.lastRoundResult.challenge.id}`
        : null,
    mpScreen: mode === 'multiplayer' ? mp.screen : 'none',
    mpWinner: mp.rankings && mp.self ? mp.rankings[0]?.playerId === mp.self.id : null,
  })

  // ───────── Pause menu (ESC) ─────────
  const [pauseOpen, setPauseOpen] = useState(false)
  const [satellite, setSatellite] = useState<SatelliteSpec | null>(null)
  const [planet, setPlanet] = useState<CelestialSpec | null>(null)
  // One space card at a time: picking a satellite closes a planet card and vice versa.
  const selectSatellite = (spec: SatelliteSpec) => {
    setPlanet(null)
    setSatellite(spec)
  }
  const selectPlanet = (spec: CelestialSpec) => {
    setSatellite(null)
    setPlanet(spec)
  }
  const spLive = mode === 'singleplayer' && sp.phase === 'playing' && sp.pickingEnabled
  const mpLive = mode === 'multiplayer' && (mp.screen === 'playing' || mp.screen === 'round_result')
  const ppLive = mode === 'passplay' && pp.phase === 'turn' && pp.pickingEnabled
  /** Shared by ESC and the touch menu button. Returns true when the menu opened. */
  const openPause = useCallback((): boolean => {
    if (pauseOpen) return false
    // Never interrupt an in-progress marker drag.
    if (marker.get().dragging) return false
    if (spLive) {
      if (!sp.pause()) return false
      setPauseOpen(true)
      return true
    }
    if (ppLive) {
      if (!pp.pause()) return false
      setPauseOpen(true)
      return true
    }
    if (mpLive) {
      // Multiplayer: local-only menu; the server match keeps running.
      setPauseOpen(true)
      return true
    }
    return false
  }, [pauseOpen, spLive, ppLive, mpLive, marker, sp, pp])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      if (openPause()) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPause])
  // Close the menu if the match ends underneath it (e.g. multiplayer results).
  useEffect(() => {
    if (pauseOpen && !inMatch) setPauseOpen(false)
  }, [pauseOpen, inMatch])
  useEffect(() => {
    audio.setDucked(pauseOpen)
  }, [pauseOpen])
  const resumeFromPause = () => {
    setPauseOpen(false)
    if (mode === 'singleplayer') sp.resume()
    if (mode === 'passplay') pp.resume()
  }
  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }

  /** Fade the current screen out, then switch (instant with reduced motion). */
  const go = (next: AppMode, after?: () => void) => {
    if (transitionLocked.current) return
    const isCreditsHandoff = (mode === 'menu' && next === 'credits') || (mode === 'credits' && next === 'menu')
    const commit = () => {
      leaveTimer.current = null
      setMode(next)
      setArrivedScene(isCreditsHandoff && !settings.reducedMotion && (next === 'menu' || next === 'credits') ? next : null)
      after?.()
      setLeaving(false)
      const unlock = () => {
        transitionLocked.current = false
        setTransitioning(false)
        setCreditsTransition(false)
        setCreditsIncoming(false)
        setMenuIncoming(false)
      }
      unlock()
    }
    if (settings.reducedMotion) return commit()
    transitionLocked.current = true
    setTransitioning(true)
    setCreditsTransition(isCreditsHandoff)
    if (isCreditsHandoff) {
      // Mount the next scene immediately so its opacity can overlap the outgoing scene.
      // The audio engine is idempotent and crossfades this scene change on its own buses.
      if (next === 'credits') setCreditsIncoming(true)
      else setMenuIncoming(true)
      audio.setScene(next === 'credits' ? 'credits' : 'home')
    }
    setLeaving(true)
    leaveTimer.current = window.setTimeout(commit, isCreditsHandoff ? CREDITS_TRANSITION_MS : SCREEN_LEAVE_MS)
  }
  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }, [])

  const goMenu = () => {
    if (mode === 'singleplayer') sp.backToMenu()
    if (mode === 'passplay') pp.reset()
    if (mode === 'multiplayer' && mp.room) mp.leaveRoom()
    const fromMatch = inMatch
    go('menu', () => {
      // Leaving a match: glide back out instead of snapping the camera.
      if (fromMatch) void globeRef.current?.flyTo(MENU_VIEW, settings.reducedMotion ? 300 : 1400)
      else globeRef.current?.setView(MENU_VIEW)
    })
  }

  /** Leave a mode's setup (or online hub) for its Singleplayer / Multiplayer chooser. */
  const goChooser = (kind: 'single' | 'multi') => {
    if (mode === 'singleplayer') sp.backToMenu()
    if (mode === 'passplay') pp.reset()
    if (mode === 'multiplayer' && mp.room) mp.leaveRoom()
    go(kind === 'single' ? 'choose-single' : 'choose-multi')
  }

  /** Rules → that mode's setup screen. */
  const startMode = (m: PlayMode) => {
    gameAudio.play('click', settings)
    if (m === 'classic' || m === 'practice') go('singleplayer', () => sp.setPractice(m === 'practice'))
    else if (m === 'online') go('multiplayer', () => mp.backToHub())
    else go('passplay', () => pp.reset())
  }

  /** Menu → back out to the Fly screen with a gentle camera pull-back. */
  const goHome = () => {
    gameAudio.play('click', settings)
    setSatellite(null)
    setPlanet(null)
    setLeaving(true)
    returningHome.current = true
    // The menu fades out fast; the camera pulls back while the Fly screen fades in over
    // the end of the move (instead of waiting for the whole flight on an empty screen).
    const flight = settings.reducedMotion ? 300 : 1100
    void globeRef.current?.flyTo(HOME_VIEW, flight)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null
      setMode('home')
      setArrivedScene(null)
      setLeaving(false)
    }, settings.reducedMotion ? 0 : 380)
  }

  const handleFly = () => {
    if (flyingIn) return
    gameAudio.play('announce', settings)
    setFlyingIn(true)
    void (async () => {
      await globeRef.current?.flyTo(MENU_VIEW, settings.reducedMotion ? 400 : 2400)
      setMode('menu')
      setFlyingIn(false)
    })()
  }

  return (
    <main
      className={`game-shell ${inMatch ? 'is-playing' : ''} ${leaving ? 'is-leaving' : ''} ${transitioning ? 'is-transitioning' : ''} ${creditsTransition ? 'is-credits-transition' : ''} ${settings.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <div className="game-shell__glow" aria-hidden />
      {transitioning ? <div className="scene-transition-shield" aria-hidden /> : null}
      <GlobeCanvas
        ref={globeRef}
        pickingEnabled={pickingEnabled}
        onGlobePick={onGlobePick}
        dprCap={settings.graphicsQuality === 'high' ? 2 : settings.graphicsQuality === 'low' ? 1 : 1.5}
        rotateSpeed={0.35 + settings.orbitSensitivity * 0.4}
        ambient={ambient}
        marker={marker}
        // Resume as soon as the menu starts fading in over it, not after the handoff.
        paused={(mode === 'credits' && !menuIncoming) || mode === 'howto'}
        labels={labelConfig}
        onSatelliteSelect={inMatch ? undefined : selectSatellite}
        onPlanetSelect={inMatch ? undefined : selectPlanet}
      />
      <MarkerConfirm store={marker} enabled={pickingEnabled} onConfirm={onGlobePick} />
      {(mode !== 'credits' || menuIncoming) && mode !== 'howto' && mode !== 'exit' ? (
        <SpaceCorners
          mode={inMatch ? 'gameplay' : 'showcase'}
          showTracking={settings.ambientEffects !== 'off'}
        />
      ) : null}
      <AmbientCommentary
        active={settings.ambientCommentary && activelySearching}
        cycleKey={commentaryRound}
      />
      <div ref={flashRef} className="feedback-flash" aria-hidden />
      <AudioStartPrompt muted={settings.muted} />

      {mode === 'home' ? <HomeScreen flying={flyingIn} onFly={handleFly} inviteCode={inviteCode} returning={returningHome.current} /> : null}

      {mode === 'menu' || menuIncoming ? (
        <div className={menuIncoming ? 'scene-transition-incoming' : arrivedScene === 'menu' ? 'scene-transition-arrived' : undefined}>
          <MainMenu
          onSingleplayer={() => {
            gameAudio.play('click', settings)
            go('choose-single')
          }}
          onMultiplayer={() => {
            gameAudio.play('click', settings)
            const code = inviteCode
            if (!code) {
              go('choose-multi')
              return
            }
            // Invite link: straight to Join with the room code filled in.
            go('multiplayer', () => {
              mp.setJoinCode(code)
              mp.openJoin()
              setInviteCode(null)
            })
          }}
          onSettings={() => {
            gameAudio.play('click', settings)
            go('settings')
          }}
          onCredits={() => {
            gameAudio.play('click', settings)
            go('credits')
          }}
          onHowTo={() => {
            gameAudio.play('click', settings)
            go('howto')
          }}
          onBack={goHome}
            inviteCode={inviteCode}
          />
        </div>
      ) : null}

      {mode === 'choose-single' || mode === 'choose-multi' ? (
        <ModeChooser
          title={mode === 'choose-single' ? 'Singleplayer' : 'Multiplayer'}
          options={mode === 'choose-single' ? ['classic', 'practice'] : ['online', 'passplay']}
          onPick={(m) => {
            gameAudio.play('click', settings)
            go('rules', () => setRulesFor(m))
          }}
          onBack={() => go('menu')}
        />
      ) : null}

      {mode === 'rules' ? (
        <ModeRules
          mode={rulesFor}
          onContinue={() => startMode(rulesFor)}
          onBack={() => go(rulesFor === 'classic' || rulesFor === 'practice' ? 'choose-single' : 'choose-multi')}
        />
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'config' ? (
        <>
          <header className="brand-float">
            <h1 className="brand-float__title">GLOBEHUNT</h1>
          </header>
          <GameConfigPanel
            practice={sp.practice}
            config={sp.config}
            error={sp.error}
            onChange={sp.setConfig}
            onBack={() => goChooser('single')}
            onStart={() => {
              void sp.startGame(globeRef.current)
            }}
          />
        </>
      ) : null}

      {mode === 'singleplayer' &&
      (sp.phase === 'playing' || sp.phase === 'loading') ? (
        <GameHUD
          challenge={sp.currentChallenge}
          difficulty={sp.config.difficulty}
          roundIndex={sp.roundIndex}
          totalRounds={sp.totalRounds}
          remainingMs={sp.remainingMs}
          totalScore={sp.totalScore}
          loading={sp.phase === 'loading' || (!sp.pickingEnabled && !sp.paused)}
          practice={sp.practice}
        />
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'round_result' && sp.lastRoundResult ? (
        <RoundResultOverlay
          result={sp.lastRoundResult}
          isLast={!sp.practice && sp.roundIndex + 1 >= sp.totalRounds}
          onContinue={() => {
            void sp.continueAfterRound(globeRef.current)
          }}
          onEndPractice={sp.practice ? sp.endPractice : undefined}
        />
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'results' && sp.summary ? (
        <ResultsScreen
          practice={sp.practice}
          summary={sp.summary}
          onMenu={goMenu}
          onPlayAgain={() => {
            void sp.playAgain(globeRef.current)
          }}
        />
      ) : null}

      {mode === 'passplay' && pp.phase === 'setup' ? (
        <>
          <header className="brand-float">
            <h1 className="brand-float__title">GLOBEHUNT</h1>
          </header>
          <PassPlaySetup
            config={pp.config}
            error={pp.error}
            initialPlayers={pp.players}
            onConfig={pp.setConfig}
            onBack={() => goChooser('multi')}
            onStart={(players) => {
              gameAudio.play('click', settings)
              void pp.start(players, globeRef.current)
            }}
          />
        </>
      ) : null}

      {mode === 'passplay' && (pp.phase === 'turn' || pp.phase === 'loading') ? (
        <GameHUD
          challenge={pp.challenge}
          difficulty={pp.config.difficulty}
          roundIndex={pp.roundIndex}
          totalRounds={pp.totalRounds}
          remainingMs={pp.remainingMs}
          totalScore={pp.scores[pp.turnIndex] ?? 0}
          loading={pp.phase === 'loading' || (!pp.pickingEnabled && !pp.paused)}
          player={
            pp.players[pp.turnIndex]
              ? { ...pp.players[pp.turnIndex], turn: pp.turnIndex + 1, turns: pp.players.length }
              : undefined
          }
        />
      ) : null}

      {mode === 'passplay' && pp.phase === 'handoff' && pp.players[pp.turnIndex] ? (
        <PassPlayHandoff
          player={pp.players[pp.turnIndex]}
          roundIndex={pp.roundIndex}
          totalRounds={pp.totalRounds}
          turnIndex={pp.turnIndex}
          totalTurns={pp.players.length}
          onReady={() => pp.ready(globeRef.current)}
          onQuit={goMenu}
        />
      ) : null}

      {mode === 'passplay' && pp.phase === 'reveal' && pp.challenge && pp.roundResults ? (
        <PassPlayReveal
          challenge={pp.challenge}
          players={pp.players}
          results={pp.roundResults}
          scores={pp.scores}
          isLast={pp.roundIndex + 1 >= pp.totalRounds}
          onNext={() => pp.nextRound(globeRef.current)}
        />
      ) : null}

      {mode === 'passplay' && pp.phase === 'final' && pp.rankings ? (
        <PassPlayFinal
          rankings={pp.rankings}
          totalRounds={pp.totalRounds}
          onRematch={() => {
            void pp.rematch(globeRef.current)
          }}
          onChangePlayers={pp.reset}
          onMenu={goMenu}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'hub' ? (
        <MultiplayerHub
          connected={mp.connected}
          onCreate={mp.openCreate}
          onJoin={mp.openJoin}
          onBack={() => goChooser('multi')}
        />
      ) : null}

      {mode === 'multiplayer' && (mp.screen === 'create' || mp.screen === 'join') ? (
        <CreateJoinForms
          mode={mp.screen}
          nickname={mp.nickname}
          joinCode={mp.joinCode}
          error={mp.error}
          onNickname={mp.setNickname}
          onCode={mp.setJoinCode}
          onBack={mp.backToHub}
          onSubmit={mp.screen === 'create' ? mp.createRoom : mp.joinRoom}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'lobby' && mp.room ? (
        <LobbyPanel
          room={mp.room}
          isHost={mp.isHost}
          ready={Boolean(mp.self?.ready)}
          error={mp.error}
          onReady={mp.setReady}
          onConfig={mp.setConfig}
          onStart={mp.startMatch}
          onLeave={() => {
            mp.leaveRoom()
          }}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'playing' && mp.room ? (
        <MpGameHUD
          challenge={mp.challenge}
          room={mp.room}
          remainingMs={mpRemaining}
          finished={mp.finished}
          finishedCount={mp.finishedPeers.length}
          travelling={Boolean(mp.roundStartedAt && now < mp.roundStartedAt)}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'round_result' && mp.roundResult ? (
        <MpRoundResultPanel
          view={mp.roundResult}
          selfId={mp.self?.id ?? null}
          isLast={(mp.room?.roundIndex ?? 0) + 1 >= (mp.room?.totalRounds ?? mp.room?.config.rounds ?? 1)}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'match_results' && mp.rankings ? (
        <MpMatchResults
          rankings={mp.rankings}
          isHost={mp.isHost}
          onLobby={mp.returnLobby}
          onAgain={mp.playAgain}
          onMenu={goMenu}
        />
      ) : null}

      {mode === 'settings' ? (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => go('menu')}
        />
      ) : null}

      {satellite && !inMatch && (mode === 'home' || mode === 'menu') ? (
        <SatelliteCard spec={satellite} onClose={() => setSatellite(null)} />
      ) : null}

      {planet && !inMatch && (mode === 'home' || mode === 'menu') ? (
        <PlanetCard key={planet.id} spec={planet} onClose={() => setPlanet(null)} />
      ) : null}

      {/* Touch screens have no Esc key: this opens the same pause menu (shown only on
          touch / no-hover devices via CSS, so desktop is unchanged). */}
      {(spLive || ppLive || mpLive) && !pauseOpen ? (
        <button
          type="button"
          className="hud-menu-btn"
          aria-label={mode === 'multiplayer' ? 'Open match menu' : 'Pause'}
          aria-haspopup="dialog"
          onClick={() => {
            openPause()
          }}
        >
          <span className="hud-menu-btn__icon" aria-hidden />
        </button>
      ) : null}

      {pauseOpen && inMatch ? (
        <PauseMenu
          multiplayer={mode === 'multiplayer'}
          settings={settings}
          onSettingsChange={updateSettings}
          onResume={resumeFromPause}
          onQuit={() => {
            setPauseOpen(false)
            goMenu()
          }}
        />
      ) : null}

      {mode === 'howto' ? (
        <HowToPlay
          reducedMotion={settings.reducedMotion}
          onMenu={() => go('menu')}
          onPlay={() => go('singleplayer', () => sp.setPractice(false))}
        />
      ) : null}

      {mode === 'credits' || creditsIncoming ? (
        <div className={creditsIncoming ? 'scene-transition-incoming' : arrivedScene === 'credits' ? 'scene-transition-arrived' : undefined}>
          <CreditsScreen
            reducedMotion={settings.reducedMotion}
            onBack={() => go('menu')}
          />
        </div>
      ) : null}
    </main>
  )
}
