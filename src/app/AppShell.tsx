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
import { useSingleplayerGame } from '../game'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import { HomeScreen } from './HomeScreen'
import { MainMenu } from './MainMenu'
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
import type { SatelliteSpec } from '../globe'
import { audio } from '../audio'
import { saveSettings } from '../settings/settings'
import { loadSettings, type AppSettings } from '../settings/settings'
import { gameAudio } from '../settings/audio'
import { useAudioSettings, useAudioUnlock } from '../audio'
import { useGameAudio } from './useGameAudio'
import { setTravelReducedMotion, travelTo } from '../game/navigation/travel'
import { answerLocation, labelFilterFor, labelTargetFor, labelTargetForId, loadPool, poolEntryById, regionalRoundView } from '../game'
import type { GlobeLabelsConfig } from '../globe'
import { SpaceCorners } from './ambient/SpaceCorners'
import { MarkerConfirm } from './MarkerConfirm'
import { AmbientCommentary } from './ambient/AmbientCommentary'
import { revealApp } from './launchVeil'
import { ColorReveal } from './ColorReveal'
import { takeInviteCode } from '../multiplayer/invite'
import './game-ui.css'
import './ambient/ambient.css'

export type AppMode =
  | 'home'
  | 'menu'
  | 'singleplayer'
  | 'multiplayer'
  | 'settings'
  | 'credits'
  | 'howto'
  | 'exit'

const HOME_VIEW = { lat: 12, lng: -55, altitude: HOME_CAMERA_ALTITUDE }
const SCREEN_LEAVE_MS = 200
const MENU_VIEW = { lat: 15, lng: -70, altitude: MENU_CAMERA_ALTITUDE }

export function AppShell() {
  const [mode, setMode] = useState<AppMode>('home')
  const [flyingIn, setFlyingIn] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  // Screen changes fade the current panel out briefly before the next one fades in.
  const [leaving, setLeaving] = useState(false)
  // Set by the first click (colour reveal): the soundtrack starts only then.
  const [entered, setEntered] = useState(false)
  const handleEnter = useCallback(() => setEntered(true), [])
  // Opened from an invite link (?join=1234): the guest still starts on the Fly screen.
  const [inviteCode, setInviteCode] = useState<string | null>(() => takeInviteCode())
  const leaveTimer = useRef<number | null>(null)
  const globeRef = useRef<GlobeNavigationApi | null>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const sp = useSingleplayerGame()
  const mp = useMultiplayer()
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

  // Multiplayer regional fly on new challenge
  useEffect(() => {
    if (mode !== 'multiplayer' || mp.screen !== 'playing' || !mp.challenge) return
    // Same regional guidance as singleplayer, from the shared pool (fits inside the
    // server's travel window).
    const id = mp.challenge.id
    const difficulty = mp.room?.config.difficulty ?? 'simple'
    void loadPool()
      .then((pool) => {
        const entry = poolEntryById(id)
        if (entry) return travelTo(globeRef.current, regionalRoundView(entry, difficulty, pool), { maxMs: 2200 })
      })
      .catch(() => {})
  }, [mode, mp.screen, mp.challenge?.id])

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (mode !== 'multiplayer' || mp.screen !== 'playing' || !mp.roundEndsAt) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [mode, mp.screen, mp.roundEndsAt])

  const mpRemaining = mp.roundEndsAt ? Math.max(0, mp.roundEndsAt - now) : 0

  const pickingEnabled = useMemo(() => {
    if (mode === 'singleplayer') return sp.pickingEnabled
    if (mode === 'multiplayer' && mp.screen === 'playing' && !mp.finished) {
      return Boolean(mp.roundStartedAt && Date.now() >= mp.roundStartedAt)
    }
    return false
  }, [mode, sp.pickingEnabled, mp.screen, mp.finished, mp.roundStartedAt, now])

  const onGlobePick = (coords: LatLng) => {
    if (mode === 'singleplayer') {
      sp.handleGlobePick(coords)
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
  const inMatch = inSpMatch || inMpMatch

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
    (mode === 'multiplayer' && mp.screen === 'playing' && !mp.finished)
  const commentaryRound =
    mode === 'singleplayer' ? `sp-${sp.roundIndex}-${sp.currentChallenge?.id ?? ''}` : `mp-${mp.challenge?.id ?? ''}`

  // New challenge or leaving play → remove the previous target.
  const challengeKey =
    mode === 'singleplayer' ? sp.currentChallenge?.id ?? null : mode === 'multiplayer' ? mp.challenge?.id ?? null : null
  useEffect(() => {
    marker.clear()
  }, [marker, challengeKey, mode])

  // Discovery / reveal: lock the reticle on the answer and glide the camera to it.
  const revealCamera = (loc: LatLng) => {
    const view = globeRef.current?.getView()
    const altitude = Math.min(2.3, Math.max(1.6, (view?.altitude ?? 2) * 0.88))
    void travelTo(globeRef.current, { lat: loc.lat, lng: loc.lng, altitude }, { minMs: 900, maxMs: 1700, sound: false })
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
    if (mode !== 'multiplayer' || mp.screen !== 'round_result' || !mp.roundResult?.reveal) return
    const loc = mp.roundResult.reveal.location
    marker.reveal(loc)
    revealCamera(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mp.screen, mp.roundResult])

  // Atlas labels: only during a match, per the (host's) setup; answer labels hidden while searching.
  const showLabelsSetting =
    mode === 'multiplayer' ? mp.room?.config.showLabels ?? true : sp.config.showLabels
  const searchTargetId =
    mode === 'singleplayer' && (sp.phase === 'playing' || sp.phase === 'loading')
      ? sp.currentChallenge?.id ?? null
      : mode === 'multiplayer' && mp.screen === 'playing'
        ? mp.challenge?.id ?? null
        : null
  // Multiplayer label suppression looks the target id up in the shared pool.
  const [poolReady, setPoolReady] = useState(false)
  useEffect(() => {
    if (mode !== 'multiplayer' || poolReady) return
    void loadPool()
      .then(() => setPoolReady(true))
      .catch(() => {})
  }, [mode, poolReady])
  // Same round index on every client → identical decoys in multiplayer.
  const searchRound = mode === 'multiplayer' ? mp.room?.roundIndex ?? 0 : sp.roundIndex
  const labelConfig = useMemo<GlobeLabelsConfig>(
    () => ({
      enabled: inMatch && showLabelsSetting,
      filter: labelFilterFor(
        mode === 'singleplayer'
          ? labelTargetFor(sp.currentChallenge, searchRound)
          : labelTargetForId(searchTargetId, searchRound, mp.challenge?.name),
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inMatch, showLabelsSetting, searchTargetId, searchRound, poolReady],
  )

  useGameAudio({
    // No soundtrack until the visitor has clicked into the game (the colour reveal).
    // How to Play has its own old-school "space class" tape music (no voices anywhere).
    scene: !entered ? 'none' : mode === 'credits' ? 'credits' : mode === 'howto' ? 'howto' : inMatch ? 'gameplay' : 'home',
    marker,
    searching: activelySearching,
    challengeKey,
    remainingMs: mode === 'multiplayer' ? mpRemaining : sp.remainingMs,
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
  const spLive = mode === 'singleplayer' && sp.phase === 'playing' && sp.pickingEnabled
  const mpLive = mode === 'multiplayer' && (mp.screen === 'playing' || mp.screen === 'round_result')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pauseOpen || e.repeat) return
      // Never interrupt an in-progress marker drag.
      if (marker.get().dragging) return
      if (spLive) {
        if (sp.pause()) {
          e.preventDefault()
          setPauseOpen(true)
        }
      } else if (mpLive) {
        // Multiplayer: local-only menu; the server match keeps running.
        e.preventDefault()
        setPauseOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pauseOpen, spLive, mpLive, marker, sp])
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
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    const commit = () => {
      leaveTimer.current = null
      setMode(next)
      after?.()
      setLeaving(false)
    }
    if (settings.reducedMotion) return commit()
    setLeaving(true)
    leaveTimer.current = window.setTimeout(commit, SCREEN_LEAVE_MS)
  }
  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }, [])

  const goMenu = () => {
    if (mode === 'singleplayer') sp.backToMenu()
    if (mode === 'multiplayer' && mp.room) mp.leaveRoom()
    const fromMatch = inMatch
    go('menu', () => {
      // Leaving a match: glide back out instead of snapping the camera.
      if (fromMatch) void globeRef.current?.flyTo(MENU_VIEW, settings.reducedMotion ? 300 : 1400)
      else globeRef.current?.setView(MENU_VIEW)
    })
  }

  /** Menu → back out to the Fly screen with a gentle camera pull-back. */
  const goHome = () => {
    gameAudio.play('click', settings)
    setSatellite(null)
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
      className={`game-shell ${inMatch ? 'is-playing' : ''} ${leaving ? 'is-leaving' : ''} ${settings.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <div className="game-shell__glow" aria-hidden />
      <GlobeCanvas
        ref={globeRef}
        pickingEnabled={pickingEnabled}
        onGlobePick={onGlobePick}
        dprCap={settings.graphicsQuality === 'high' ? 2 : settings.graphicsQuality === 'low' ? 1 : 1.5}
        rotateSpeed={0.35 + settings.orbitSensitivity * 0.4}
        ambient={ambient}
        marker={marker}
        paused={mode === 'credits' || mode === 'howto'}
        labels={labelConfig}
        onSatelliteSelect={inMatch ? undefined : setSatellite}
      />
      <MarkerConfirm store={marker} enabled={pickingEnabled} onConfirm={onGlobePick} />
      {mode !== 'credits' && mode !== 'howto' && mode !== 'exit' ? (
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

      <ColorReveal disabled={settings.reducedMotion} onEnter={handleEnter} />
      {mode === 'home' ? <HomeScreen flying={flyingIn} onFly={handleFly} inviteCode={inviteCode} returning={returningHome.current} /> : null}

      {mode === 'menu' ? (
        <MainMenu
          onSingleplayer={() => {
            gameAudio.play('click', settings)
            go('singleplayer')
          }}
          onMultiplayer={() => {
            gameAudio.play('click', settings)
            const code = inviteCode
            go('multiplayer', () => {
              if (code) {
                // Invite link: straight to Join with the room code filled in.
                mp.setJoinCode(code)
                mp.openJoin()
                setInviteCode(null)
              } else mp.backToHub()
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
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'config' ? (
        <>
          <header className="brand-float">
            <h1 className="brand-float__title">GLOBEHUNT</h1>
          </header>
          <GameConfigPanel
            config={sp.config}
            error={sp.error}
            onChange={sp.setConfig}
            onBack={goMenu}
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
        />
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'round_result' && sp.lastRoundResult ? (
        <RoundResultOverlay
          result={sp.lastRoundResult}
          isLast={sp.roundIndex + 1 >= sp.totalRounds}
          onContinue={() => {
            void sp.continueAfterRound(globeRef.current)
          }}
        />
      ) : null}

      {mode === 'singleplayer' && sp.phase === 'results' && sp.summary ? (
        <ResultsScreen
          summary={sp.summary}
          onMenu={goMenu}
          onPlayAgain={() => {
            void sp.playAgain(globeRef.current)
          }}
        />
      ) : null}

      {mode === 'multiplayer' && mp.screen === 'hub' ? (
        <MultiplayerHub
          connected={mp.connected}
          onCreate={mp.openCreate}
          onJoin={mp.openJoin}
          onBack={goMenu}
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
        <MpRoundResultPanel view={mp.roundResult} selfId={mp.self?.id ?? null} />
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
          onPlay={() => go('singleplayer')}
        />
      ) : null}

      {mode === 'credits' ? (
        <CreditsScreen
          reducedMotion={settings.reducedMotion}
          onBack={() => go('menu')}
        />
      ) : null}
    </main>
  )
}
