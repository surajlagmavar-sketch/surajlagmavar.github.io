/* ==========================================================================
   Homepage hero: a messy designer's desk.
   Projects, sticky notes and tools drop in with real physics (Matter.js).
   Grab and throw anything. Click a product to open its case study.
   Scrolling tilts the desk so everything slides out of the way.
   ========================================================================== */
(function () {
  const desk = document.querySelector('[data-desk]');
  if (!desk) return;
  const hero = desk.closest('.hero');
  // small screens get a tidier desk: products + a couple of notes (items marked data-extra stay hidden)
  const all = [...desk.querySelectorAll('[data-desk-item]')];
  const items = all.filter((el) => !(window.innerWidth < 700 && el.hasAttribute('data-extra')));
  all.forEach((el) => { if (!items.includes(el)) el.style.display = 'none'; });
  const reduce = document.documentElement.classList.contains('reduce-motion');
  const M = window.Matter;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  desk.classList.add('is-live');
  items.forEach((el) => { el.style.transform = 'translate3d(-9999px, -9999px, 0)'; });

  const imgs = items.flatMap((el) => [...el.querySelectorAll('img')]);
  const imagesReady = Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  }))));

  // Calm fallback (reduced motion or no physics library): a tidy row on the desk.
  function tidyLayout() {
    const W = desk.clientWidth;
    const H = desk.clientHeight;
    const list = items;
    const total = list.reduce((s, el) => s + el.offsetWidth, 0);
    const gap = (W * 0.92 - total) / Math.max(1, list.length - 1);
    let x = W * 0.04;
    list.forEach((el, i) => {
      el.style.transform = `translate3d(${x}px, ${H - el.offsetHeight}px, 0) rotate(${i % 2 ? 2 : -2}deg)`;
      x += el.offsetWidth + gap;
    });
  }

  imagesReady.then(() => {
    if (reduce || !M) {
      tidyLayout();
      window.addEventListener('resize', tidyLayout);
      return;
    }
    physics();
  });

  function physics() {
    const { Engine, Bodies, Body, Composite, Constraint, Sleeping, Events } = M;
    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.1;
    const world = engine.world;
    const T = 200; // thick walls so fast throws can't tunnel through

    let walls = [];
    function buildWalls() {
      const W = desk.clientWidth;
      const H = desk.clientHeight;
      if (walls.length) Composite.remove(world, walls);
      walls = [
        Bodies.rectangle(W / 2, H + T / 2, W + T * 4, T, { isStatic: true, friction: 0.9 }),
        Bodies.rectangle(-T / 2, H / 2 - 2000, T, H + 6000, { isStatic: true }),
        Bodies.rectangle(W + T / 2, H / 2 - 2000, T, H + 6000, { isStatic: true }),
      ];
      Composite.add(world, walls);
    }

    const bodies = items.map((el) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const d = el.dataset;
      const opts = {
        restitution: +d.bounce || 0.3,
        friction: 0.6,
        frictionAir: 0.014,
        density: +d.density || 0.0016,
        chamfer: { radius: Math.min(w, h) * (d.round ? +d.round : 0.12) },
        sleepThreshold: 40,
      };
      const body = d.shape === 'circle'
        ? Bodies.circle(0, 0, Math.min(w, h) * 0.46, opts)
        : Bodies.rectangle(0, 0, w * (+d.bw || 1), h * (+d.bh || 1), opts);
      body.plugin = { el, w, h, home: +d.x || Math.random() };
      return body;
    });
    Composite.add(world, bodies);
    buildWalls();

    function render() {
      for (const b of bodies) {
        const { el, w, h } = b.plugin;
        el.style.transform = `translate3d(${(b.position.x - w / 2).toFixed(1)}px, ${(b.position.y - h / 2).toFixed(1)}px, 0) rotate(${b.angle.toFixed(4)}rad)`;
      }
    }

    // Rain everything in from above the hero, tools first so the projects land on top.
    function drop() {
      const W = desk.clientWidth;
      bodies.forEach((b, i) => {
        const { w, h, home } = b.plugin;
        const x = clamp(W * (home + (Math.random() - 0.5) * 0.06), w / 2 + 8, W - w / 2 - 8);
        Body.setPosition(b, { x, y: -h - 80 - i * 120 });
        Body.setVelocity(b, { x: (Math.random() - 0.5) * 2, y: 0 });
        Body.setAngle(b, (Math.random() - 0.5) * 0.9);
        Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.06);
        Sleeping.set(b, false);
      });
      render();
    }

    // keep things sane: cap speed, rescue anything that escapes
    Events.on(engine, 'beforeUpdate', () => {
      const W = desk.clientWidth;
      const H = desk.clientHeight;
      for (const b of bodies) {
        const v = b.velocity;
        const s = Math.hypot(v.x, v.y);
        if (s > 36) Body.setVelocity(b, { x: (v.x / s) * 36, y: (v.y / s) * 36 });
        if (b.position.y > H + 500 || b.position.x < -400 || b.position.x > W + 400) {
          Body.setPosition(b, { x: W / 2, y: -b.plugin.h - 40 });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      }
    });

    /* ---------- loop (fixed step, paused when the hero is off screen) ---------- */
    const STEP = 1000 / 60;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let started = false;
    let visible = true;
    function tick(now) {
      acc += Math.min(now - last, 100);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 4) { Engine.update(engine, STEP); acc -= STEP; n++; }
      render();
      raf = requestAnimationFrame(tick);
    }
    function run() {
      if (raf || !started || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function halt() { cancelAnimationFrame(raf); raf = 0; }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : halt(); }).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? halt() : run()));

    function begin() {
      if (started) return;
      started = true;
      drop();
      setTimeout(run, 250);
    }
    if (window.Studio && window.Studio.introDone) begin();
    else document.addEventListener('intro:done', () => setTimeout(begin, 350), { once: true });
    setTimeout(begin, 4000); // safety net

    /* ---------- grab & throw ---------- */
    const local = (e) => { const r = desk.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let grab = null;
    items.forEach((el, i) => {
      const body = bodies[i];
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        const p = local(e);
        Sleeping.set(body, false);
        const c = Constraint.create({
          pointA: p, bodyB: body,
          pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
          stiffness: 0.2, damping: 0.1, length: 0,
        });
        Composite.add(world, c);
        grab = { el, c, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-grabbed');
        desk.classList.add('is-touched');
        run();
      });
      el.addEventListener('pointermove', (e) => {
        if (!grab || grab.el !== el || e.pointerId !== grab.id) return;
        grab.c.pointA = local(e);
        if (Math.hypot(e.clientX - grab.x, e.clientY - grab.y) > 6) grab.moved = true;
      });
      const release = () => {
        if (!grab || grab.el !== el) return;
        Composite.remove(world, grab.c);
        el.classList.remove('is-grabbed');
        el.dataset.dragged = grab.moved ? '1' : '';
        grab = null;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      // a throw is not a click: don't open the project after dragging it
      el.addEventListener('click', (e) => {
        if (el.dataset.dragged) { e.preventDefault(); e.stopPropagation(); el.dataset.dragged = ''; }
      }, true);
      el.addEventListener('dragstart', (e) => e.preventDefault());
    });

    /* ---------- scroll tilts the desk (desktop) ---------- */
    document.addEventListener('hero:progress', (e) => {
      const gx = window.innerWidth > 860 ? -1.1 * clamp(e.detail * 1.8, 0, 1) : 0;
      if (Math.abs(gx - engine.gravity.x) > 0.02) {
        engine.gravity.x = gx;
        bodies.forEach((b) => Sleeping.set(b, false));
      }
    });

    /* ---------- reset + resize ---------- */
    const resetBtn = hero.querySelector('[data-desk-reset]');
    if (resetBtn) resetBtn.addEventListener('click', () => { engine.gravity.x = 0; drop(); run(); });

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        buildWalls();
        const W = desk.clientWidth;
        const H = desk.clientHeight;
        bodies.forEach((b) => {
          const { w, h } = b.plugin;
          Body.setPosition(b, { x: clamp(b.position.x, w / 2, W - w / 2), y: Math.min(b.position.y, H - h / 2) });
          Sleeping.set(b, false);
        });
        run();
      }, 150);
    });
  }
})();
