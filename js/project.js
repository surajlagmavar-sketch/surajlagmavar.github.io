/* ==========================================================================
   Project page interactions (shared by every project page)
   - product intro: 3D model if the .glb exists, otherwise a tilting render
   - chapter rail, feature hotspots, word-by-word problem statement
   - sketch → render compare slider, exploded view, lightbox
   ========================================================================== */
const { gsap, ScrollTrigger } = window;
const reduce = document.documentElement.classList.contains('reduce-motion');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function fileExists(url) {
  if (!url || location.protocol === 'file:') return false;
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html');
  } catch { return false; }
}

/* ---------- 01 product intro ---------- */
async function productIntro() {
  const stageEl = $('[data-product-stage]');
  if (!stageEl) return;
  const img = $('.product-img', stageEl);

  if (await fileExists(stageEl.dataset.model)) {
    try {
      const { createStage } = await import('./stage.js');
      stageEl.classList.add('is-3d');
      const stage = createStage(stageEl, { drag: true, size: 2.9, startRotation: -Math.PI / 2, autoRotate: 0.18, distance: 7 });
      stage.setModel(await stage.loadGLB(stageEl.dataset.model));
      return;
    } catch (err) {
      console.warn('3D model failed, using render instead', err);
      stageEl.classList.remove('is-3d');
      $('canvas', stageEl)?.remove();
    }
  }

  // render fallback: gentle 3D tilt toward the pointer
  if (fine && !reduce) {
    gsap.set(img, { transformPerspective: 1200 });
    const rx = gsap.quickTo(img, 'rotationX', { duration: 1.2, ease: 'power3.out' });
    const ry = gsap.quickTo(img, 'rotationY', { duration: 1.2, ease: 'power3.out' });
    window.addEventListener('pointermove', (e) => {
      ry(((e.clientX / innerWidth) - 0.5) * 16);
      rx(-((e.clientY / innerHeight) - 0.5) * 8);
    }, { passive: true });
  }
}

/* ---------- hero entrance + scroll parallax ---------- */
function heroMotion() {
  if (reduce) return;
  const tl = gsap.timeline({ delay: document.documentElement.classList.contains('is-arriving') ? 0.5 : 0.1 });
  tl.from('.p-hero__ghost', { opacity: 0, scale: 1.08, duration: 2, ease: 'expo.out' }, 0)
    .from('.product-move', { opacity: 0, xPercent: 12, duration: 1.8, ease: 'expo.out' }, 0.15)
    .from('.p-hero__glow', { opacity: 0, duration: 2 }, 0.3)
    .from('.p-hero__info .crumbs, .p-hero__title, .p-hero__tagline, .specs > div', { opacity: 0, y: 30, duration: 1.2, ease: 'expo.out', stagger: 0.07 }, 0.35);

  gsap.to('.product-move', {
    yPercent: -18, scale: 0.9, ease: 'none',
    scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.p-hero__ghost', {
    yPercent: 30, ease: 'none',
    scrollTrigger: { trigger: '.p-hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------- chapter rail ---------- */
function rail() {
  const railEl = $('.rail');
  if (!railEl) return;
  const links = $$('a', railEl);
  links.forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => self.isActive && links.forEach((l) => l.classList.toggle('is-active', l === a)),
    });
  });
  ScrollTrigger.create({
    trigger: 'main', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { $('.rail__bar span').style.transform = `scaleY(${self.progress})`; },
  });
  ScrollTrigger.create({
    trigger: '#features', start: 'top 80%', endTrigger: '#final', end: 'bottom 40%',
    onToggle: (self) => railEl.classList.toggle('is-visible', self.isActive),
  });
}

/* ---------- 02 feature hotspots ---------- */
function features() {
  const spots = $$('.hotspot');
  const items = $$('.feature-list li');
  if (!spots.length) return;
  let current = 0, timer = null, userTook = false;
  const set = (i) => {
    current = i;
    spots.forEach((s) => s.classList.toggle('is-active', +s.dataset.feature === i));
    items.forEach((s) => s.classList.toggle('is-active', +s.dataset.feature === i));
  };
  const take = (i) => { userTook = true; clearInterval(timer); set(i); };
  spots.forEach((s) => { s.addEventListener('click', () => take(+s.dataset.feature)); s.addEventListener('pointerenter', () => take(+s.dataset.feature)); });
  items.forEach((s) => s.addEventListener('click', () => take(+s.dataset.feature)));
  // auto-cycle while the section is on screen, until someone interacts
  ScrollTrigger.create({
    trigger: '#features', start: 'top 60%', end: 'bottom 30%',
    onToggle: (self) => {
      clearInterval(timer);
      if (self.isActive && !userTook && !reduce) timer = setInterval(() => set((current + 1) % spots.length), 3800);
    },
  });
}

/* ---------- 03 problem statement lights up word by word ---------- */
function statement() {
  if (reduce) return;
  $$('[data-scrub-words]').forEach((el) => {
    gsap.to($$('.w > span', el), {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
  });
}

/* ---------- 06 looping exploded view (parts slide apart and back, like a GIF) ---------- */
// Sketch → render sliders are handled by js/compare-slider.js.
function explodeLoops() {
  $$('[data-explode-loop]').forEach((fig) => {
    const stage = $('.xloop__stage', fig);
    const parts = $$('.xloop__part', fig).map((el) => ({ el, dx: +el.dataset.dx || 0, dy: +el.dataset.dy || 0 }));
    const kmax = parseFloat(fig.dataset.kmax || '0.75');
    const btn = $('.xloop__toggle', fig);
    const label = btn && $('span', btn);
    const state = { k: 0 };
    let w = 0, h = 0;
    const measure = () => { const r = stage.getBoundingClientRect(); w = r.width; h = r.height; };
    const render = () => {
      for (const p of parts) p.el.style.transform = `translate3d(${(p.dx / 100) * w * state.k}px, ${(p.dy / 100) * h * state.k}px, 0)`;
      stage.style.setProperty('--pins', String(Math.max(0, 1 - state.k / (kmax * 0.3))));
    };
    measure();
    new ResizeObserver(() => { measure(); render(); }).observe(stage);

    if (reduce) { render(); if (btn) btn.remove(); return; } // static exploded view

    state.k = kmax; // start assembled, explode once it scrolls into view, then loop
    render();
    const tl = gsap.timeline({ repeat: -1, paused: true, onUpdate: render })
      .to(state, { k: 0, duration: 1.7, ease: 'expo.inOut' })
      .to({}, { duration: 2.6 })
      .to(state, { k: kmax, duration: 1.5, ease: 'power3.inOut' })
      .to({}, { duration: 0.9 });

    let userPaused = false;
    let inView = false;
    const sync = () => {
      if (inView && !userPaused) tl.play(); else tl.pause();
      fig.classList.toggle('is-paused', userPaused);
      if (btn) { btn.setAttribute('aria-pressed', String(userPaused)); label.textContent = userPaused ? 'Play' : 'Pause'; }
    };
    if (btn) btn.addEventListener('click', () => { userPaused = !userPaused; sync(); });
    ScrollTrigger.create({ trigger: fig, start: 'top 80%', end: 'bottom 10%', onToggle: (self) => { inView = self.isActive; sync(); } });
  });
}

/* ---------- 06 exploded view ---------- */
function explode() {
  const root = $('[data-explode]');
  if (!root) return;
  const stack = $('.explode__stack', root);
  const layers = $$('.layer', root).sort((a, b) => a.dataset.layer - b.dataset.layer); // 0 = top
  const labels = $$('.xl', root);
  const labelBox = $('.explode__labels', root);
  const wide = () => innerWidth > 960;
  const state = { gap: 6, rz: -24 };

  const place = () => {
    const n = layers.length;
    stack.style.setProperty('--rz', `${state.rz}deg`);
    layers.forEach((l, i) => l.style.setProperty('--z', `${(n - 1 - i) * state.gap}px`));
    if (!wide()) return;
    const base = labelBox.getBoundingClientRect();
    labels.forEach((lab) => {
      const r = layers[+lab.dataset.for].getBoundingClientRect();
      lab.style.setProperty('--ty', `${r.top + r.height / 2 - base.top}px`);
    });
  };

  // hover a label → spotlight that layer
  labels.forEach((lab) => {
    lab.addEventListener('pointerenter', () => layers.forEach((l, i) => l.classList.toggle('is-dim', i !== +lab.dataset.for)));
    lab.addEventListener('pointerleave', () => layers.forEach((l) => l.classList.remove('is-dim')));
  });

  if (reduce) { state.gap = 90; place(); labels.forEach((l) => (l.style.opacity = 1)); return; }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: root, start: 'center center', end: '+=130%', pin: true, scrub: 0.6 },
      onUpdate: place,
    });
    tl.to(state, { gap: 96, ease: 'power2.inOut', duration: 1 }, 0)
      .to(state, { rz: -16, ease: 'none', duration: 1 }, 0)
      .to(labels, { opacity: 1, stagger: 0.12, duration: 0.3 }, 0.35);
    place();
  });
  mm.add('(max-width: 960px)', () => {
    gsap.to(state, {
      gap: 54, ease: 'none', onUpdate: place,
      scrollTrigger: { trigger: root, start: 'top 75%', end: 'center 40%', scrub: true },
    });
    place();
  });
  window.addEventListener('resize', place);
}

/* ---------- 07 final reveal ---------- */
function finalReveal() {
  if (reduce) return;
  gsap.from('[data-final-product]', {
    scale: 0.8, opacity: 0, y: 80, ease: 'expo.out', duration: 1.8,
    scrollTrigger: { trigger: '[data-final-product]', start: 'top 85%' },
  });
}

/* ---------- lightbox ---------- */
function lightbox() {
  const box = $('.lightbox');
  if (!box) return;
  const img = $('img', box);
  const lenis = window.Studio && window.Studio.lenis;
  const open = (src, alt) => { img.src = src; img.alt = alt; box.classList.add('is-open'); lenis && lenis.stop(); $('.lightbox__close', box).focus(); };
  const close = () => { box.classList.remove('is-open'); lenis && lenis.start(); };
  $$('[data-lightbox]').forEach((f) => {
    f.setAttribute('tabindex', '0');
    f.setAttribute('role', 'button');
    const i = $('img', f);
    f.addEventListener('click', () => open(i.currentSrc || i.src, i.alt));
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i.currentSrc || i.src, i.alt); } });
  });
  box.addEventListener('click', (e) => { if (e.target !== img) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

productIntro();
heroMotion();
rail();
features();
statement();
explodeLoops();
explode();
finalReveal();
lightbox();
window.addEventListener('load', () => ScrollTrigger.refresh());
