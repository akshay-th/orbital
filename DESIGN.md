# ORBITAL — Design Document

> "Leave Earth. Briefly."

A scroll-driven landing page for a fictional space-tourism company. The page **is**
the voyage: scrolling moves the visitor through launch, orbit, the overview effect,
and re-entry. A fixed WebGL canvas (Three.js) renders the journey; DOM chapters
float above it and narrate.

---

## 1. Concept statement

Most space-tourism marketing shouts. ORBITAL whispers. The page is structured as a
flight plan: a pre-flight check (preloader), ascent, weightlessness, the overview
effect, and return. Scroll position *is* mission time. A persistent mission HUD
(monospace, corner-mounted) converts scroll progress into altitude and velocity,
grounding the fantasy in instrument-panel realism. The emotional peak — Chapter 03,
"The Overview" — is the moment the planet fills the frame and the copy goes quiet
and personal.

Design verbs: **drift, loom, streak, hush.**

## 2. Palette

| Token | Hex | Use |
|---|---|---|
| `--void` | `#030613` | Page + scene background (deep space navy/black) |
| `--void-2` | `#071024` | Card/panel surfaces, nav scrim |
| `--ink` | `#F4F1EA` | Warm white — primary text |
| `--ink-dim` | `#8B93A7` | Secondary text, captions |
| `--cyan` | `#35E0FF` | Electric cyan — accents, HUD, links, glow |
| `--cyan-deep` | `#0E7490` | Cyan shadows / borders |
| `--amber` | `#FFB45C` | Warm accent — re-entry heat, price highlight |
| `--line` | `rgba(53,224,255,.18)` | Hairlines, HUD rules |

Planet shader gradient: `#0B2B4A → #1F6FA8 → #6FD5E8` with a `#35E0FF` fresnel rim
and additive atmosphere glow. Re-entry tint shifts rim toward `#FFB45C`.

## 3. Typography

- **Display:** Space Grotesk (Google Fonts, 300/500/700) — headlines, chapter titles.
- **Mono:** Space Mono (Google Fonts, 400/700) — HUD, coordinates, labels, numerals.

Type scale (fluid, `clamp()`):

| Role | Size |
|---|---|
| Hero H1 | `clamp(3rem, 10vw, 8.5rem)` / 0.95 lh / -0.03em |
| Chapter H2 | `clamp(2rem, 5.5vw, 4.5rem)` / 1.02 lh |
| Lead copy | `clamp(1.05rem, 1.6vw, 1.35rem)` / 1.6 lh |
| Body | `1rem` / 1.7 lh |
| HUD / labels | `0.72rem` mono, letter-spacing `.14em`, uppercase |

## 4. Section-by-section storyboard

Scene progress `p` = overall scroll 0→1. The canvas is fixed; keyframed scene
states are interpolated by `p`.

| # | Section | Copy beat | Scene state |
|---|---|---|---|
| 00 | **Preloader** | "PRE-FLIGHT CHECK" — checklist lines (fuel, telemetry, life support) tick OK, progress bar fills, panel lifts away | Canvas fades in beneath |
| 01 | **Hero** | "Leave Earth. Briefly." + sub + scroll cue | Planet looms huge at bottom edge, calm starfield, slow planet rotation |
| 02 | **Ch 01 — Ascent** | "Eight and a half minutes of honest violence." Stats: 3.2g, 28,000 km/h | Stars streak toward camera (speed + stretch ramp), planet sinks away, slight camera shake via noise |
| 03 | **Ch 02 — Weightless** | "Gravity lets go of you politely." Floating UI chips drift | Star speed ≈ 0, everything drifts slowly, planet small and distant, DOM chips float on sine offsets |
| 04 | **Ch 03 — The Overview** | Emotional core: "You will look down and understand the word *home* for the first time." | Planet swings up and **fills the view**, rim glow at max, stars dim 40% |
| 05 | **Ch 04 — Return** | "Falling is just flying with a deadline." | Planet recedes below, rim tint shifts amber (re-entry heat), stars re-brighten |
| 06 | **Booking CTA** | Flight dates list + price card (ORBITAL-7, $485,000) + "Reserve your seat" | Scene settles: calm stars, planet half-set at horizon, gentle glow |
| — | **Footer** | Fictional-company disclaimer, coordinates | — |

**Mission HUD (fixed, bottom-left; signature detail):** mono readout updating every
frame from scroll: `ALT 000 km → 400 km` (eased per chapter: 0 → 92 at Ascent end →
400 through Weightless → holds 400 at Overview → falls to 0 by CTA), plus `VEL`
km/h, mission phase name, and progress ticks. Top-right: fictional coordinates +
UTC-ish mission clock.

## 5. Animation spec

**Stack:** Lenis (smooth scroll, lerp 0.09) feeding GSAP ScrollTrigger; one
ScrollTrigger (scrub) maps page scroll to `p`; per-section triggers reveal DOM.

| Animation | Trigger | Ease / motion | Duration |
|---|---|---|---|
| Preloader checklist | page load | lines stagger 0.28s, `power2.out` | ~1.8s total, then panel exits `y:-100%`, `power3.inOut`, 0.9s |
| Hero headline | after preloader | words rise `y:110%→0`, `power4.out`, stagger 0.08 | 1.2s |
| Scene choreography | ScrollTrigger scrub on `body` | keyframe lerp with `smoothstep`; camera/planet/star-speed per storyboard | scrub 1.2 |
| Chapter text reveal | each `.chapter` at `top 72%` | `y:48, opacity:0 → 0`, `power3.out`, stagger 0.1 | 1.0s |
| Chapter index rule | same trigger | scaleX 0→1, `power2.inOut` | 0.8s |
| Weightless chips | in Ch 02 viewport | continuous sine drift, ±12px, periods 5–9s desynced | ∞ |
| Star streak | p within Ascent band | star z-speed 0.4→22, point size stretch | scrub-driven |
| HUD altitude | every scroll frame | numeric interpolation + tabular numerals, no easing lag beyond Lenis | continuous |
| Price card | CTA at `top 70%` | `y:60, opacity 0→1, rotateX 8→0`, `power3.out` | 0.9s |
| Scroll cue | hero idle | opacity pulse `sine.inOut` yoyo | 2.2s loop |

**Reduced motion (`prefers-reduced-motion: reduce`):** Lenis disabled; scrub
choreography replaced by a static mid-journey scene frame; all reveals become
200ms opacity fades; star streaking, drifting chips and pulsing cues disabled;
HUD still updates (instant, no smoothing).

**Performance:** single renderer, capped `devicePixelRatio ≤ 2`, stars as one
`THREE.Points` buffer (two depth layers for parallax), shader planet (no textures
to load), `powerPreference: high-performance`, canvas `position: fixed` so no
re-layout on scroll.

## 6. Accessibility / robustness

- Semantic sections + h1→h2 order; HUD `aria-hidden` (decorative duplicate of narrative).
- Contrast: `#F4F1EA` on `#030613` ≈ 17:1; dim text ≥ 4.6:1.
- Works at 360px: fluid type, single-column chapters, HUD condenses.
- No build step; CDN UMD scripts with existence guards — page remains readable
  (static fallback) if WebGL or a CDN fails.
