/* ==========================================================================
   Shared site behaviour: smooth scroll, preloader, page transitions, nav,
   custom cursor, magnetic buttons, card tilt, text reveals, marquees and the
   homepage hero scroll choreography.
   Loaded as a normal script on every page (needs gsap + ScrollTrigger + Lenis).
   ========================================================================== */
(function () {
  const html = document.documentElement;
  const reduce = html.classList.contains('reduce-motion');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';

  // If the animation libraries failed to load (offline), show everything statically.
  if (!hasGsap) {
    html.classList.remove('js');
    html.classList.add('no-preloader');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.Studio = { lenis, reduce, emit };

  const scrollToTarget = (target, immediate) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const offset = el === document.body ? 0 : -(parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    if (lenis) lenis.scrollTo(el, { offset, immediate: !!immediate, duration: 1.6 });
    else el.scrollIntoView({ behavior: immediate || reduce ? 'auto' : 'smooth' });
  };

  /* ---------- split text helpers ---------- */
  // Headings with data-split: each <br>-separated line slides up from a mask.
  document.querySelectorAll('[data-split]').forEach((el) => {
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map((l) => `<span class="split-line"><span>${l.trim()}</span></span>`).join('');
  });
  // Elements with data-words: every word wrapped so it can light up on scroll.
  function splitWords(root) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(root);
  }
  document.querySelectorAll('[data-words]').forEach(splitWords);

  /* ---------- page transitions ---------- */
  const tRed = document.querySelector('.transition__panel--red');
  const tNavy = document.querySelector('.transition__panel--navy');

  function arrive() {
    if (!html.classList.contains('is-arriving')) return;
    sessionStorage.removeItem('arriving');
    gsap.set(tNavy, { scaleY: 1, transformOrigin: 'top' });
    gsap.to(tNavy, {
      scaleY: 0, duration: 0.9, ease: 'expo.inOut', delay: 0.05,
      onComplete: () => { html.classList.remove('is-arriving'); gsap.set(tNavy, { clearProps: 'all' }); },
    });
  }
  function leave(href) {
    if (reduce || !tRed) { location.href = href; return; }
    gsap.timeline({ onComplete: () => { sessionStorage.setItem('arriving', '1'); location.href = href; } })
      .set([tRed, tNavy], { transformOrigin: 'bottom' })
      .to(tRed, { scaleY: 1, duration: 0.55, ease: 'expo.inOut' })
      .to(tNavy, { scaleY: 1, duration: 0.5, ease: 'expo.inOut' }, 0.16);
  }
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) { gsap.set([tRed, tNavy], { scaleY: 0 }); html.classList.remove('is-arriving'); }
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) {
      if (url.hash) {
        e.preventDefault();
        closeMenu();
        scrollToTarget(url.hash === '#top' ? document.body : url.hash);
      }
      return;
    }
    e.preventDefault();
    leave(url.href);
  });

  /* ---------- nav ---------- */
  const nav = document.querySelector('.nav');
  const menuBtn = document.querySelector('.nav__menu-btn');
  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('is-open');
    menuBtn && menuBtn.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
    });
  }
  if (nav) {
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 40);
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 500 && !nav.classList.contains('is-open'));
      },
    });
    document.querySelectorAll('.nav__link[href^="#"]').forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section, start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  /* ---------- custom cursor ---------- */
  const cursor = document.querySelector('.cursor');
  if (cursor && finePointer && !reduce) {
    html.classList.add('has-cursor');
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');
    const label = cursor.querySelector('.cursor__label');
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...pos };
    window.addEventListener('pointermove', (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    }, { passive: true });
    gsap.ticker.add(() => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
    });
    document.addEventListener('pointerover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, [data-hover], input[type="range"]');
      cursor.classList.toggle('is-label', !!labelled);
      cursor.classList.toggle('is-hover', !!hover && !labelled);
      label.textContent = labelled ? labelled.dataset.cursor : '';
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
  }

  /* ---------- magnetic buttons ---------- */
  if (finePointer && !reduce) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.28);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    /* card tilt */
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 1400 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 5); rx(-py * 5);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------- marquees ---------- */
  document.querySelectorAll('[data-marquee] .marquee__track').forEach((track) => {
    const originals = [...track.children];
    let guard = 0;
    while (track.scrollWidth < window.innerWidth * 1.3 && guard++ < 10) {
      originals.forEach((n) => track.appendChild(n.cloneNode(true)));
    }
    [...track.children].forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
  });

  /* ---------- reveals ---------- */
  if (!reduce) {
    document.querySelectorAll('[data-split]').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.from(el.querySelectorAll('.split-line > span'), {
        yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });

    const proc = document.querySelector('.process__progress');
    if (proc) {
      gsap.to(proc, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: '.process__track', start: 'top 85%', end: 'bottom 45%', scrub: true },
      });
    }
  }

  /* ---------- homepage hero choreography ---------- */
  const hero = document.querySelector('.hero');
  function heroIntro() {
    if (!hero) return;
    gsap.timeline()
      .to('.hero .ht-line > span', { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.12 })
      .to('[data-hero-fade]', { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 0.5);
  }
  if (hero) {
    if (!reduce) {
      gsap.set('.hero .ht-line > span', { yPercent: 110 });
      gsap.set('[data-hero-fade]', { autoAlpha: 0, y: 20 });
    }
    gsap.set('.hero__statement', { autoAlpha: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero, start: 'top top', end: '+=140%',
        pin: true, scrub: reduce ? true : 0.6,
        onUpdate: (self) => emit('hero:progress', self.progress),
      },
    });
    tl.to('.hero .ht-1 > span', { xPercent: -35, autoAlpha: 0, ease: 'none', duration: 0.5 }, 0)
      .to('.hero .ht-2 > span', { xPercent: 35, autoAlpha: 0, ease: 'none', duration: 0.5 }, 0)
      // explicit start values: these are still hidden (waiting for the intro) when this timeline is built
      .fromTo('.hero__intro, .desk__doodle', { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', duration: 0.25, immediateRender: false }, 0)
      .fromTo('.hero__statement', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.35 }, 0.4)
      .to({}, { duration: 0.25 });
  }

  /* ---------- preloader ---------- */
  const pre = document.querySelector('.preloader');
  function introDone() { arrive(); heroIntro(); window.Studio.introDone = true; emit('intro:done'); }

  if (pre && !html.classList.contains('no-preloader') && !reduce) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    lenis && lenis.stop();
    const counter = pre.querySelector('.preloader__count');
    const bar = pre.querySelector('.preloader__bar span');
    const state = { v: 0 };
    const render = () => {
      counter.textContent = String(Math.round(state.v)).padStart(3, '0');
      bar.style.transform = `scaleX(${state.v / 100})`;
    };
    const stageReady = new Promise((res) => {
      if (!document.querySelector('[data-model]')) return res();
      document.addEventListener('stage:ready', res, { once: true });
      setTimeout(res, 3500);
    });
    const pageLoaded = new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true })));
    gsap.from('.preloader__name span', { yPercent: 110, duration: 1, ease: 'expo.out' });
    const fake = gsap.to(state, { v: 82, duration: 1.4, ease: 'power2.out', onUpdate: render });
    Promise.all([stageReady, pageLoaded, new Promise((r) => setTimeout(r, 900))]).then(() => {
      fake.kill();
      gsap.timeline()
        .to(state, { v: 100, duration: 0.45, ease: 'power2.inOut', onUpdate: render })
        .to('.preloader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' }, '+=0.1')
        .to(pre, {
          yPercent: -100, duration: 1.1, ease: 'expo.inOut',
          onStart: () => { sessionStorage.setItem('seenIntro', '1'); introDone(); },
          onComplete: () => { pre.remove(); lenis && lenis.start(); },
        }, '-=0.1');
    });
  } else {
    pre && pre.remove();
    // landing on a hash (e.g. coming back to index.html#work from a project)
    if (location.hash && document.querySelector(location.hash)) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.addEventListener('load', () => {
        ScrollTrigger.refresh();
        scrollToTarget(location.hash, true);
      }, { once: true });
    }
    introDone();
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
