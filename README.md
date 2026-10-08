# ORBITAL — Leave Earth. Briefly.

A scroll-driven landing page for a **fictional** space-tourism company. The page is
the voyage: scrolling carries you through pre-flight, ascent, weightlessness, the
overview effect, and the fall home, while a fixed Three.js canvas renders a parallax
starfield and a shader-built planet with an atmosphere glow rim.

**Live:** https://akshay-th.github.io/orbital/

## The journey

1. **Pre-flight check** — checklist-themed preloader (propellant, telemetry, life support… GO).
2. **Hero** — "Leave Earth. Briefly." with the planet looming below.
3. **Ch 01 · Ascent** — stars streak toward you, subtle camera shake, 3.2 g.
4. **Ch 02 · Weightless** — everything drifts; floating mono UI chips.
5. **Ch 03 · The Overview** — the planet swings up and fills the view.
6. **Ch 04 · Return** — the atmosphere rim shifts amber with re-entry heat.
7. **Manifest** — 2027 flight dates and the ORB-07 price card ($485,000).

**Signature detail:** a fixed mission HUD (Space Mono) whose altitude readout is
driven by scroll — `ALT 000 km → 400 km` — plus velocity, mission phase, and a
mission-elapsed-time clock.

## Stack

- **Three.js r128** (UMD, cdnjs) — starfield (two parallax `Points` layers), shader
  gradient planet + additive atmosphere shell. No textures, nothing to preload.
- **GSAP 3 + ScrollTrigger** (cdnjs) — scroll progress drives keyframed scene
  choreography; per-chapter reveals.
- **Lenis** (jsDelivr) — smooth scroll feeding ScrollTrigger.
- Static files only: `index.html`, `css/style.css`, `js/main.js`. No build step,
  no npm. All paths relative, so it serves fine from the `/orbital/` subpath.

## Notes

- `prefers-reduced-motion` honored: smooth scroll, streaks, drifts and scrubbed
  choreography are disabled; the page becomes a calm static read (HUD still updates).
- Responsive down to 360 px.
- If WebGL or a CDN is unavailable, the page degrades to a readable static layout.
- Design spec: see [DESIGN.md](DESIGN.md).

---

*ORBITAL is fictional. No rockets were fueled in the making of this page.*
