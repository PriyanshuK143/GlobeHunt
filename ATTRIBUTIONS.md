# Attributions & licences

Everything bundled with GLOBEHUNT is either original work made for this project,
in the public domain, or used under a licence that permits it. Keep this file up to date
when adding assets.

## Imagery

| Asset | Source | Licence |
| --- | --- | --- |
| Earth base map `public/textures/earth-bluemarble.jpg` and zoom tiles | NASA Blue Marble (Shaded Relief + Bathymetry) via NASA GIBS | Public domain (U.S. Government work) |
| `public/images/satellites/iss.jpg` | NASA Image and Video Library, ID `s134e010137` (STS-134 crew, 2011) | Public domain (NASA) |
| `public/images/satellites/hubble.jpg` | NASA Image and Video Library, ID `s125e006948` (STS-125 crew, 2009) | Public domain (NASA) |
| Sun, planets, Moon, star field, jets, smoke, How to Play artwork | Original work drawn in code for GLOBEHUNT | Project's own |

NASA material is not copyrighted, but NASA asks that it is credited ("NASA") and that it is
not used to imply NASA endorses the game. NASA's name and logos (the "meatball", "worm")
are **not** used anywhere in the game and must not be added.

ESA imagery (Sentinel, Galileo) is deliberately **not** used: it is licensed differently
(e.g. CC BY-SA 3.0 IGO) and would need share-alike terms.

## Map data

| Data | Source | Licence | What you must do |
| --- | --- | --- | --- |
| Country borders, coastlines, rivers, lakes, places (`public/data`, `public/atlas`) | Natural Earth — naturalearthdata.com | Public domain | Nothing required (credit appreciated) |
| Towns, villages, admin regions (`public/atlas`, `public/game/pool.json`) | GeoNames — geonames.org | **CC BY 4.0** | Give credit — shown on screen ("GeoNames (CC BY 4.0)") and in the end credits |

## Fonts

Orbitron, Patrick Hand and Source Sans 3 — Google Fonts, SIL Open Font License 1.1.

## Audio

All music and sound effects are synthesised live in the browser by the game's own code
(`src/audio`). No recorded samples or third-party audio are used.

## Code dependencies

React, three.js, @react-three/fiber, @react-three/drei, Socket.IO, topojson-client,
Express and others — MIT / ISC / BSD licensed (see each package's licence in `node_modules`).

---

This file is a good-faith record, not legal advice. For a commercial release, have the
list reviewed by someone qualified.
