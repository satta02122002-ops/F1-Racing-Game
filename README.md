# F1 Racing Game MVP

A browser-based, realistic F1 racing game built with Three.js.

## Quick Start

```bash
# Option 1 – using serve (recommended)
npx serve . -p 3000
# Then open: http://localhost:3000

# Option 2 – Python (no install needed)
python3 -m http.server 3000
# Then open: http://localhost:3000
```

> **Important:** Must be served over HTTP (not `file://`) because of ES module imports.

---

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / Reverse |
| `A` / `←` | Steer Left |
| `D` / `→` | Steer Right |
| `E` | DRS (activate when available in DRS zone) |
| `Q` | ERS boost (uses battery) |
| `C` | Cycle camera (Chase → Cockpit → TV Pod → Helicopter) |
| `R` | Reset / Respawn to start line |

Gamepad supported: RT=throttle, LT=brake, Left stick=steer, RB=DRS, LB=ERS, Y=camera

---

## Features (MVP v1.0)

### Physics
- Realistic F1 tyre grip model (downforce-dependent grip, temperature, wear)
- 7-speed automatic gearbox with realistic RPM curves
- DRS drag reduction (+22% top speed on straights)
- ERS energy deployment and regen under braking
- Off-track grip penalty

### Track
- Monaco-inspired circuit (~3.5 km lap)
- 3 sectors with timing
- DRS zone on main straight
- Kerbs, barriers, grandstands, runoff areas
- Start/finish gantry with chequered flag line

### Camera
- **Chase cam** – follows car from behind, pulls back at speed
- **Cockpit cam** – driver's eye view
- **TV Pod cam** – orbiting low-angle broadcast camera
- **Helicopter** – overhead view

### HUD / UI
- Analogue speedometer (0-380 km/h)
- Live RPM bar with gear display
- Lap timer (current, best, last)
- Throttle/brake input visualiser
- DRS & ERS status indicators
- Mini-map with car position
- Sector flash messages (purple/green/yellow)
- Race finish screen with stats

---

## Project Structure

```
F1-Racing-Game/
├── index.html              # Entry point + importmap
├── src/
│   ├── main.js             # Game bootstrap & loop
│   ├── styles/main.css     # All UI styles
│   ├── physics/
│   │   └── CarPhysics.js   # F1 car dynamics engine
│   ├── car/
│   │   └── CarRenderer.js  # 3D car model (Three.js)
│   ├── track/
│   │   ├── TrackLayout.js  # Circuit geometry & lap logic
│   │   └── TrackRenderer.js # 3D track visuals
│   ├── camera/
│   │   └── CameraController.js # 4 camera modes
│   ├── ui/
│   │   └── HUD.js          # All HUD/telemetry display
│   └── utils/
│       ├── InputManager.js # Keyboard + gamepad input
│       └── RaceManager.js  # Lap timing, sectors, race state
└── package.json
```

---

## Planned Improvements (next steps)
- Particle effects (tyre smoke, sparks, exhaust flames)
- Sound engine (engine note, tyre squeal, gearshift blip)
- AI opponent cars
- Pit stop mechanics
- Weather system (rain, wet tyres)
- More circuits
- Replay system
