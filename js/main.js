/* ============================================================
   ORBITAL — main.js
   Scroll-driven space voyage.
   Stack: Three.js r128 (UMD) + GSAP ScrollTrigger + Lenis.
   Everything is guarded: if a CDN fails, the page stays readable.
   ============================================================ */

(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  var hasThree = typeof window.THREE !== 'undefined';
  var hasLenis = typeof window.Lenis !== 'undefined';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Opt into JS-driven reveals only when GSAP is actually here.
  if (hasGSAP) document.documentElement.classList.add('js');
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------
     Smooth scroll (Lenis -> GSAP ticker)
     ------------------------------------------------------------ */
  var lenis = null;
  if (hasLenis && hasGSAP && !reduced) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', function () {
      if (hasST) ScrollTrigger.update();
    });
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------
     Helpers
     ------------------------------------------------------------ */
  function pad(n, w) {
    n = String(Math.max(0, Math.round(n)));
    while (n.length < w) n = '0' + n;
    return n;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // Interpolate through {p, ...} keyframes.
  function sample(keys, p, prop) {
    if (p <= keys[0].p) return keys[0][prop];
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (p >= a.p && p <= b.p) {
        var t = (p - a.p) / (b.p - a.p || 1);
        return lerp(a[prop], b[prop], smooth(t));
      }
    }
    return keys[keys.length - 1][prop];
  }

  /* ------------------------------------------------------------
     Scroll progress (0..1 across the whole page)
     ------------------------------------------------------------ */
  var progressTarget = 0;
  var progress = 0;

  function readProgressFromWindow() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progressTarget = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  if (hasST) {
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) { progressTarget = self.progress; }
    });
  } else {
    window.addEventListener('scroll', readProgressFromWindow, { passive: true });
  }
  readProgressFromWindow();

  /* ------------------------------------------------------------
     Mission HUD — the signature detail.
     Altitude / velocity / phase derived from scroll progress.
     ------------------------------------------------------------ */
  var hudAlt = document.getElementById('hudAlt');
  var hudVel = document.getElementById('hudVel');
  var hudPhase = document.getElementById('hudPhase');
  var hudClock = document.getElementById('hudClock');
  var hudTicks = document.getElementById('hudTicks');
  var tickEls = hudTicks ? hudTicks.querySelectorAll('i') : [];

  var ALT_KEYS = [
    { p: 0.00, v: 0 }, { p: 0.12, v: 0 }, { p: 0.30, v: 92 },
    { p: 0.44, v: 400 }, { p: 0.70, v: 400 }, { p: 0.84, v: 58 },
    { p: 0.93, v: 0 }, { p: 1.00, v: 0 }
  ];
  var VEL_KEYS = [
    { p: 0.00, v: 0 }, { p: 0.12, v: 0 }, { p: 0.30, v: 21500 },
    { p: 0.44, v: 28000 }, { p: 0.70, v: 28000 }, { p: 0.84, v: 24800 },
    { p: 0.93, v: 20 }, { p: 1.00, v: 0 }
  ];
  var PHASES = [
    { to: 0.12, name: 'PAD' },
    { to: 0.33, name: 'ASCENT' },
    { to: 0.50, name: 'ORBIT' },
    { to: 0.70, name: 'OVERVIEW' },
    { to: 0.90, name: 'RE-ENTRY' },
    { to: 1.01, name: 'MANIFEST' }
  ];

  var lastHud = { alt: -1, vel: -1, phase: '', ticks: -1 };
  function updateHUD(p) {
    if (!hudAlt) return;
    var alt = Math.round(sample(ALT_KEYS, p, 'v'));
    var vel = Math.round(sample(VEL_KEYS, p, 'v'));
    var phase = 'PAD';
    for (var i = 0; i < PHASES.length; i++) {
      if (p <= PHASES[i].to) { phase = PHASES[i].name; break; }
    }
    if (alt !== lastHud.alt) { hudAlt.textContent = pad(alt, 3); lastHud.alt = alt; }
    if (vel !== lastHud.vel) { hudVel.textContent = pad(vel, 5); lastHud.vel = vel; }
    if (phase !== lastHud.phase) { hudPhase.textContent = phase; lastHud.phase = phase; }
    var lit = Math.round(p * tickEls.length);
    if (lit !== lastHud.ticks) {
      for (var j = 0; j < tickEls.length; j++) {
        tickEls[j].className = j < lit ? 'on' : '';
      }
      lastHud.ticks = lit;
    }
  }

  // Mission Elapsed Time clock.
  var t0 = Date.now();
  setInterval(function () {
    if (!hudClock) return;
    var s = Math.floor((Date.now() - t0) / 1000);
    hudClock.textContent = '+' + pad(s / 3600, 2) + ':' + pad((s / 60) % 60, 2) + ':' + pad(s % 60, 2);
  }, 1000);

  /* ------------------------------------------------------------
     Three.js scene — starfield + shader planet + atmosphere
     ------------------------------------------------------------ */
  var canvas = document.getElementById('scene');
  var scene3d = null;

  // Scene choreography keyframes:
  //   px/py/pz planet position · star = star z-speed · rim = cyan->amber mix
  //   glow = atmosphere intensity · dim = star brightness · shake = camera noise
  var SCENE_KEYS = [
    { p: 0.00, px: 0.0, py: -2.80, pz: -6.2, star: 0.35, rim: 0.00, glow: 1.00, dim: 1.00, shake: 0.00 },
    { p: 0.14, px: 0.0, py: -3.60, pz: -7.0, star: 2.50, rim: 0.00, glow: 0.95, dim: 1.00, shake: 0.35 },
    { p: 0.26, px: 0.7, py: -7.20, pz: -11.5, star: 22.0, rim: 0.00, glow: 0.85, dim: 1.00, shake: 1.00 },
    { p: 0.40, px: 2.6, py: -1.30, pz: -17.0, star: 0.08, rim: 0.00, glow: 0.90, dim: 1.00, shake: 0.00 },
    { p: 0.52, px: 0.8, py: -0.70, pz: -8.5, star: 0.05, rim: 0.00, glow: 1.25, dim: 0.72, shake: 0.00 },
    { p: 0.62, px: 0.0, py: -0.45, pz: -4.6, star: 0.05, rim: 0.10, glow: 1.45, dim: 0.50, shake: 0.00 },
    { p: 0.72, px: 0.0, py: -1.60, pz: -5.6, star: 1.20, rim: 0.65, glow: 1.30, dim: 0.75, shake: 0.30 },
    { p: 0.82, px: 0.0, py: -3.00, pz: -6.6, star: 2.60, rim: 1.00, glow: 1.15, dim: 0.95, shake: 0.45 },
    { p: 0.93, px: 0.0, py: -3.40, pz: -7.8, star: 0.40, rim: 0.30, glow: 1.00, dim: 1.00, shake: 0.00 },
    { p: 1.00, px: 0.0, py: -3.50, pz: -8.0, star: 0.25, rim: 0.20, glow: 1.00, dim: 1.00, shake: 0.00 }
  ];

  function buildScene() {
    if (!hasThree || !canvas) return null;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      return null; // No WebGL — page still works as a static read.
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x030613, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030613, 0.015);

    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 0, 0.1);

    /* --- Starfield: two parallax layers --- */
    function makeStars(count, size, speedMul, tint) {
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(count * 3);
      var col = new Float32Array(count * 3);
      var c = new THREE.Color();
      for (var i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 2] = -Math.random() * 60 + 4;
        var b = 0.35 + Math.random() * 0.65;
        c.setRGB(b * tint.r, b * tint.g, b * tint.b);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var mat = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        sizeAttenuation: true
      });
      var pts = new THREE.Points(geo, mat);
      pts.userData = { speedMul: speedMul, baseSize: size, count: count };
      return pts;
    }

    var starGroup = new THREE.Group();
    var starsFar = makeStars(2600, 0.10, 0.45, { r: 0.85, g: 0.92, b: 1.0 });
    var starsNear = makeStars(1200, 0.17, 1.0, { r: 0.75, g: 0.95, b: 1.0 });
    starGroup.add(starsFar);
    starGroup.add(starsNear);
    scene.add(starGroup);

    /* --- Planet: shader gradient sphere --- */
    var planetUniforms = {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#0B2B4A') },
      uColorB: { value: new THREE.Color('#1F6FA8') },
      uColorC: { value: new THREE.Color('#6FD5E8') },
      uRimCyan: { value: new THREE.Color('#35E0FF') },
      uRimWarm: { value: new THREE.Color('#FFB45C') },
      uRimMix: { value: 0 }
    };

    var planetMat = new THREE.ShaderMaterial({
      uniforms: planetUniforms,
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec3 vPos;',
        'void main() {',
        '  vNormal = normalize(normalMatrix * normal);',
        '  vPos = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC;',
        'uniform vec3 uRimCyan; uniform vec3 uRimWarm; uniform float uRimMix;',
        'varying vec3 vNormal;',
        'varying vec3 vPos;',
        'void main() {',
        '  vec3 n = normalize(vNormal);',
        '  float lat = vPos.y * 0.5 / 2.3 + 0.5;',
        '  float bands = sin(vPos.y * 2.6 + sin(vPos.x * 1.7 + uTime * 0.06) * 0.8) * 0.07;',
        '  float swirl = sin(vPos.x * 3.1 + vPos.z * 2.2 + uTime * 0.04) * 0.04;',
        '  float t = clamp(lat + bands + swirl, 0.0, 1.0);',
        '  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.58, t));',
        '  col = mix(col, uColorC, smoothstep(0.58, 1.0, t));',
        '  float shade = 0.42 + 0.58 * clamp(dot(n, normalize(vec3(-0.45, 0.35, 0.85))), 0.0, 1.0);',
        '  col *= shade;',
        '  float fres = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 2.6);',
        '  vec3 rim = mix(uRimCyan, uRimWarm, uRimMix);',
        '  col += rim * fres * 1.25;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });

    var planet = new THREE.Mesh(new THREE.SphereGeometry(2.3, 96, 96), planetMat);
    scene.add(planet);

    /* --- Atmosphere glow (additive backside shell) --- */
    var atmoUniforms = {
      uColor: { value: new THREE.Color('#35E0FF') },
      uWarm: { value: new THREE.Color('#FFB45C') },
      uRimMix: { value: 0 },
      uIntensity: { value: 1 }
    };
    var atmoMat = new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
        '  vNormal = normalize(normalMatrix * normal);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform vec3 uWarm;',
        'uniform float uRimMix; uniform float uIntensity;',
        'varying vec3 vNormal;',
        'void main() {',
        '  float a = pow(0.62 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 2.0);',
        '  vec3 col = mix(uColor, uWarm, uRimMix);',
        '  gl_FragColor = vec4(col, 1.0) * a * uIntensity;',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    var atmo = new THREE.Mesh(new THREE.SphereGeometry(2.3 * 1.18, 64, 64), atmoMat);
    scene.add(atmo);

    return {
      renderer: renderer,
      scene: scene,
      camera: camera,
      planet: planet,
      atmo: atmo,
      stars: [starsFar, starsNear],
      starGroup: starGroup,
      planetUniforms: planetUniforms,
      atmoUniforms: atmoUniforms
    };
  }

  scene3d = buildScene();

  /* --- Pointer parallax --- */
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduced) {
    window.addEventListener('pointermove', function (e) {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  /* --- Render loop --- */
  var clock = { last: 0 };
  function renderFrame(now) {
    var dt = Math.min(0.05, (now - clock.last) / 1000 || 0.016);
    clock.last = now;

    // Smooth the scroll progress a touch (Lenis already smooths the scroll).
    progress += (progressTarget - progress) * (reduced ? 1 : Math.min(1, dt * 7));
    var p = progress;

    updateHUD(p);

    if (scene3d) {
      var s = scene3d;
      var px = sample(SCENE_KEYS, p, 'px');
      var py = sample(SCENE_KEYS, p, 'py');
      var pz = sample(SCENE_KEYS, p, 'pz');
      var starSpeed = reduced ? 0 : sample(SCENE_KEYS, p, 'star');
      var rimMix = sample(SCENE_KEYS, p, 'rim');
      var glow = sample(SCENE_KEYS, p, 'glow');
      var dim = sample(SCENE_KEYS, p, 'dim');
      var shake = reduced ? 0 : sample(SCENE_KEYS, p, 'shake');

      // Planet + atmosphere
      s.planet.position.set(px, py, pz);
      s.atmo.position.copy(s.planet.position);
      if (!reduced) s.planet.rotation.y += dt * 0.03;
      s.planetUniforms.uTime.value = now / 1000;
      s.planetUniforms.uRimMix.value = rimMix;
      s.atmoUniforms.uRimMix.value = rimMix;
      s.atmoUniforms.uIntensity.value = glow;

      // Stars: drift toward the camera, recycle, streak on ascent.
      for (var i = 0; i < s.stars.length; i++) {
        var layer = s.stars[i];
        var arr = layer.geometry.attributes.position.array;
        var spd = starSpeed * layer.userData.speedMul * dt;
        if (spd > 0) {
          for (var j = 2; j < arr.length; j += 3) {
            arr[j] += spd;
            if (arr[j] > 4) arr[j] -= 60;
          }
          layer.geometry.attributes.position.needsUpdate = true;
        }
        layer.material.opacity = dim;
        layer.material.size = layer.userData.baseSize * (1 + Math.min(starSpeed, 24) * 0.012);
      }

      // Camera: subtle mouse parallax + ascent shake.
      mouse.x += (mouse.tx - mouse.x) * dt * 3;
      mouse.y += (mouse.ty - mouse.y) * dt * 3;
      var shX = shake * 0.03 * Math.sin(now * 0.021);
      var shY = shake * 0.03 * Math.cos(now * 0.017);
      s.camera.position.x = mouse.x * 0.22 + shX;
      s.camera.position.y = -mouse.y * 0.16 + shY;
      s.camera.lookAt(0, 0, -8);
      s.starGroup.rotation.y = mouse.x * 0.02;
      s.starGroup.rotation.x = mouse.y * 0.015;

      s.renderer.render(s.scene, s.camera);
    }

    requestAnimationFrame(renderFrame);
  }
  requestAnimationFrame(renderFrame);

  window.addEventListener('resize', function () {
    if (!scene3d) return;
    scene3d.camera.aspect = window.innerWidth / window.innerHeight;
    scene3d.camera.updateProjectionMatrix();
    scene3d.renderer.setSize(window.innerWidth, window.innerHeight);
    scene3d.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  });

  /* ------------------------------------------------------------
     Preloader — pre-flight check
     ------------------------------------------------------------ */
  var preloader = document.getElementById('preloader');
  var preloaderBar = document.getElementById('preloaderBar');
  var preloaderFoot = document.getElementById('preloaderFoot');
  var preItems = document.querySelectorAll('#preloaderList li');

  function heroIn() {
    if (!hasGSAP) return;
    var tl = gsap.timeline();
    tl.to('#heroTitle .word', {
      y: 0, duration: reduced ? 0.01 : 1.2, ease: 'power4.out', stagger: reduced ? 0 : 0.09
    });
    tl.fromTo('.hero .reveal',
      { opacity: 0, y: reduced ? 0 : 22 },
      { opacity: 1, y: 0, duration: reduced ? 0.01 : 0.9, ease: 'power3.out', stagger: 0.12 },
      reduced ? 0 : '-=0.7');
    if (!reduced) {
      gsap.to('#scrollCue', {
        opacity: 0.35, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2
      });
    }
  }

  function dismissPreloader() {
    if (!preloader) { heroIn(); return; }
    if (hasGSAP && !reduced) {
      gsap.to(preloader, {
        yPercent: -100, duration: 0.9, ease: 'power3.inOut',
        onComplete: function () { preloader.style.display = 'none'; }
      });
      heroIn();
    } else {
      preloader.style.transition = 'opacity 0.4s ease';
      preloader.style.opacity = '0';
      setTimeout(function () {
        preloader.style.display = 'none';
        heroIn();
      }, 420);
    }
  }

  if (hasGSAP && !reduced && preloader) {
    var count = { t: 3 };
    var pre = gsap.timeline({ onComplete: dismissPreloader });
    pre.to(preItems, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.22 });
    pre.to(preloaderBar, { width: '100%', duration: 1.4, ease: 'power1.inOut' }, 0.2);
    pre.to(count, {
      t: 0, duration: 1.4, ease: 'none',
      onUpdate: function () {
        if (preloaderFoot) preloaderFoot.textContent = 'T-MINUS ' + Math.ceil(count.t) + '…';
      }
    }, 0.2);
    pre.call(function () {
      if (preloaderFoot) preloaderFoot.textContent = 'LIFTOFF';
    }, null, '+=0.05');
    pre.to({}, { duration: 0.25 }); // beat before the panel lifts away
  } else {
    // Reduced motion or no GSAP: show content fast.
    setTimeout(dismissPreloader, reduced ? 250 : 600);
  }

  /* ------------------------------------------------------------
     Chapter reveals
     ------------------------------------------------------------ */
  if (hasST && !reduced) {
    var sections = document.querySelectorAll('.chapter, .booking');
    sections.forEach(function (sec) {
      var head = sec.querySelector('.chapter__head');
      var rule = sec.querySelector('.chapter__rule');
      var parts = sec.querySelectorAll(
        '.chapter__title, .chapter__lead, .stats, .chips, .chapter__quote, .booking__grid'
      );

      var tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: 'top 72%', once: true }
      });
      if (head) tl.to(head, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0);
      if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, 0);
      tl.fromTo(parts,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out', stagger: 0.12 },
        0.1
      );
    });

    // Price card gets its own entrance.
    gsap.fromTo('#priceCard',
      { opacity: 0, y: 60, rotateX: 8, transformPerspective: 600 },
      {
        opacity: 1, y: 0, rotateX: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '#booking', start: 'top 60%', once: true }
      }
    );

    // Weightless chips drift forever, desynced.
    document.querySelectorAll('.chip').forEach(function (chip, i) {
      gsap.to(chip, {
        y: (i % 2 ? -1 : 1) * (8 + (i * 3) % 7),
        x: (i % 2 ? 1 : -1) * (4 + (i * 5) % 6),
        rotation: (i % 2 ? -1 : 1) * 1.6,
        duration: 5 + (i * 1.7) % 4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      });
    });
  } else if (hasGSAP) {
    // Reduced motion: simple instant visibility (CSS also covers this).
    gsap.set('.chapter__head, .chapter__title, .chapter__lead, .stats, .chips, ' +
      '.chapter__quote, .booking__grid, .reveal, #priceCard', { opacity: 1, clearProps: 'transform' });
    gsap.set('#heroTitle .word', { y: 0 });
  }

  // Reserve button: it's a fictional airline — be honest about it.
  var reserveBtn = document.getElementById('reserveBtn');
  if (reserveBtn) {
    reserveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var fine = document.querySelector('.price-card__fine');
      if (fine) fine.textContent = 'ORBITAL is fictional — but the view up there is real. Keep looking up.';
    });
  }

  // Anchor links play nice with Lenis.
  if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          lenis.scrollTo(id, { offset: 0 });
        }
      });
    });
  }
})();
