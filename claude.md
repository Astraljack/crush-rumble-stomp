# Crush, Rumble & Stomp (CRS)

## Overview
A spiritual successor to "Crush, Crumble, and Chomp!" (1981, Epyx/Automated Simulations). You play as a kaiju (giant monster) rampaging through a city while managing hunger, health, and military response.

The original game was designed by Jon Freeman, who later created Archon. We have the original C3 manual as reference material.

## Design Philosophy
- **Faithful homage** to C3, but modernized and expanded
- **Turn-based, deliberate gameplay** — strategic, not action
- **Each monster should feel distinct** — not just stat swaps
- **Procedural cities** — no fixed maps, generate on the fly
- **Survival with inevitable doom** — equilibrium between damage and healing, but attrition wins eventually

## Current Features

### Monsters (3 implemented)
| Monster | Emoji | HP | Speed | Special |
|---------|-------|-----|-------|---------|
| Gigasaur | 🦖 | 10 | 1 | Fire breath (range 3, starts fires), can swim in shallow water |
| Megapex | 🦍 | 8 | 2 | Fast (2 moves/turn), can grab enemies and throw them |
| The Ooze | 🟢 | 18 | 1 | Regenerates 0.5 HP/turn, leaves fire trail when moving, 40% damage reduction |

### City Generation
- **60x40 grid**, procedurally generated
- **Scrolling viewport** (17x15) — monster stays centered, city reveals as you explore
- **Road grid** with varying building density (dense downtown, sparse suburbs)
- **River** running through city with **bridges** for crossing
- **Deep water** (impassable) and **shallow water** (Gigasaur only)
- **Parks** with trees (burnable)

### Buildings
| Type | Emoji | HP | Effect |
|------|-------|-----|--------|
| Small house | 🏠 | 1-2 | Low points |
| Medium building | 🏢 | 2-4 | Medium points |
| Skyscraper | 🏙️ | 4-6 | High points, more civilians flee |
| Military Base | ⭐ | 8 | Destroy to force army to spawn from map edges |
| Police Station | 🚔 | 4 | Destroy to reduce police spawns |
| City Hall | 🏛️ | 6 | 1000 points |
| Lab | 🔬 | 4 | +5 HP when destroyed |
| Power Plant | ⚡ | 6 | **INSTANT DEATH if touched!** Destroy from range. Explodes in chain reaction. |
| Bridge | 🌉 | — | Passable terrain over water (not destructible) |
| Park | 🌳 | — | Passable, burnable |

### Enemies
| Type | Emoji | HP | Damage | Notes |
|------|-------|-----|--------|-------|
| Police | 👮 | 1 | 0.25 | Spawn from police stations |
| Infantry | 💂 | 1 | 0.5 | Spawn from base/edges |
| Tank | 🚐 | 2 | 1.5 | Tough, high damage |
| Helicopter | 🚁 | 1 | 0.75 | Can fly over buildings/water |

### Civilians 🏃
- Spawn from destroyed buildings (more from larger buildings)
- Also spawn randomly on streets
- Flee from monster (slowly, sometimes freeze in panic)
- Block ground unit pathfinding
- Very filling when eaten: -4 hunger, +0.5 HP

### Fire System 🔥
- Fire spreads in **wind direction** each turn
- Wind shown in UI as arrow (→ ← ↑ ↓), shifts occasionally
- Fire damages buildings over time
- Fire kills civilians and damages enemies
- The Ooze leaves fire trail automatically

### Hunger & Health
- Hunger increases by 1 each turn
- At 75% hunger: start taking starvation damage
- At 85% hunger: **BERSERK MODE** — lose control, monster auto-moves toward food
- Eating heals: civilians (+0.5 HP), enemies (+1 HP)
- Destroying buildings sometimes yields "snacks" (+0.5 HP, -2 hunger)

### Grab & Throw (Ape only)
- Walk into enemy to grab instead of eat
- Shows throw direction based on last move
- Press T to throw — damages first enemy or building hit (range 5)

### Controls
- **Arrow keys / WASD**: Move
- **SPACE**: Fire breath (Gigasaur only)
- **T**: Throw (Ape only, when carrying)
- **Period (.)**: Wait/end turn

### UI Layout
- **Left panel**: Event log (color-coded: red=damage, green=heal, yellow=score)
- **Center**: Game grid with scrolling viewport
- **Right panel**: Monster stats, HP/hunger bars, score, buttons, legend

## Future Ideas (discussed but not implemented)

### From Original C3 Manual
- **More monsters**: Kraken (water-only, tentacles), Mantra (flying), Arachnis (spider, webs, burrow)
- **Mechismo** (robot): No hunger, repairs by destroying vehicles
- **Facing/direction system** — decided probably not needed except maybe for flying
- **Underground movement** — burrow to escape or travel
- **Webs** — block squares, flammable, trap civilians, ground flying units
- **Grab → Eat as separate actions** — carry food for later

### Our Ideas
- **More enemy types**: Jets, boats, mechs
- **City landmarks** — recognizable features
- **Multiple city templates** — different grid patterns (Manhattan vs Boston vs SF)
- **Mad scientist enemy** — spawns from lab
- **Objectives beyond survival** — destroy X buildings, reach a location, etc.

## Technical Notes
- Built as single React component with useState
- All game state in one `game` object
- Turn-based: player moves, then `endTurn()` processes enemies, fire, spawns, hunger
- Berserk mode uses useEffect with setTimeout for auto-movement
- Grid uses emoji for display, background colors for terrain

## Known Issues / Recent Fixes
- Berserk mode could hang if food was unreachable — fixed with self-contained state update
- Bridges were destructible — fixed, now just passable terrain
- Blob fire trail wasn't working — fixed, now leaves fire on squares it moves FROM
- Damage wasn't broken down by source — fixed, now shows per-enemy-type

## Files
- Main game code: single React component (currently in Claude.ai artifact)
- Reference: Original C3 manual (PDF) — contains monster cards, city maps, mechanics

---

*This project started as a "can Claude really build a game?" experiment and evolved into a genuine passion project. The goal is a worthy successor to a 1981 classic.*
