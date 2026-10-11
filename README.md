# PROJECT ORBIT 2.0 — DEEP SPACE OPERATIONS

A fictional spacecraft operations and exploration simulator built with plain HTML, CSS, and JavaScript. Runs locally in a browser and can be published directly to GitHub Pages.

## Files

- `index.html` — app structure and screens
- `style.css` — responsive dark mission-control UI
- `script.js` — mission data, simulation loop, resource systems, events, scoring, logs, and local progress
- `README.md` — setup and test notes

## Run locally

1. Keep all files in the same folder.
2. Open `index.html` in a modern browser.
3. Select one of the eight missions or start **LONG-TERM OPERATIONS**.

No build step, server, external API, or package installation is required. The Google Fonts import is decorative only; system fallback fonts are used if it cannot load.

## Publish on GitHub Pages

1. Create a GitHub repository named `PROJECT-ORBIT-2.0` (or another name).
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under build/deployment, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, then save.
5. Wait for GitHub Pages to publish, then open the displayed URL.

## Controls

- **SCAN**: modest progress increase, power use, and heat.
- **HIGH-POWER SCAN**: more progress, much more power use and heat.
- **COOLING**: spends power and lowers temperature.
- **COMMUNICATION**: toggles the communications system.
- **POWER MANAGEMENT**: reduces net power use and heat, but slows scans.
- **SOLAR ARRAY**: toggles power generation.
- **THRUST / MANEUVER**: spends propellant and can advance maneuver-based missions.
- **SYSTEM DIAGNOSTICS**: takes a short time and reports current active anomalies.
- **PAUSE / RESUME**: freezes simulation time while paused.
- **ABORT / END OPERATION**: asks for confirmation, then produces a result report.

At 90°C, thermal protection locks out scan operations. Cooling the ship to 82°C or below clears the lock; scan operations are not automatically restarted. Long-term operations have no mission countdown, but resource depletion and critical overheating can still end a run.

## Progress storage

Clear status, best scores, and the best long-term score are stored in `localStorage` when available. Storage errors or corrupt data are ignored so the game can still start. Records are local to the current browser/device and are not synced.

## Test report

Static checks performed during packaging:
- All four required files exist in the package.
- JavaScript parses with Node.js syntax check (`node --check script.js`).
- HTML IDs used by the JavaScript were compared against the HTML document.
- CSS and JavaScript references in HTML point to the expected local filenames.
- ZIP archive was reopened and its member list verified.

Not performed in this environment:
- Automated full browser gameplay / visual regression testing.
- Physical iPad Safari touch testing.
- A live GitHub Pages deployment test of this 2.0 package.
- Exhaustive balance testing across every random-event sequence.

These are explicitly not marked as passed. For a manual playtest, verify each mission start, pause/resume, cooling lockout, event response, resource rejection, success/failure result, retry, and long-term mode.

## Known limitations

- This is a game simulation only, not a spacecraft or satellite control system.
- Random events use `Math.random()` and are not seeded in normal play.
- Long-term mode has a scoring result, but does not save a resumable in-progress run.
- The interface uses a Google Fonts stylesheet as a visual enhancement. It has local system fallbacks and does not require the font service to play.
- Browser timers are throttled in background tabs; on return, the simulation deliberately does not apply a large accumulated time jump.


## Rebuilt version
This rebuild uses a delegated click handler for mission cards to make taps on dynamically rendered cards more robust across touch browsers. The progress-storage key was versioned so older saved progress does not interfere with testing this rebuild.

### GitHub Pages upload checklist
Keep these files together in the repository root with these exact names:
- `index.html`
- `style.css`
- `script.js`
- `README.md` (optional, documentation only)

Do not rename the game files to `.txt`. After committing the updated files, reload the published page. If the old page still appears, try a full refresh or wait briefly for Pages deployment to finish.
