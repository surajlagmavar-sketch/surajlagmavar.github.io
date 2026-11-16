/* ==========================================================================
   Compare slider: sketch (left) ↔ final render (right)
   Reusable: any element with [data-compare-slider] is set up automatically.
   No dependencies. Mouse, touch and keyboard. Respects reduced motion.

   Markup contract (see any work/*.html → .evo-block for a full example):
     [data-compare-slider]            root (optional data-start="50", data-ratio="16/9")
       [data-compare-stage]           area you can drag on
         [data-compare-layer=render]  > img   bottom image (full)
         [data-compare-layer=sketch]  > img   top image (clipped to the left of the line)
         [data-compare-handle]        role="slider" knob
   Missing images show a labelled placeholder built from the img's data-slot.
   ========================================================================== */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function placeholder(layer, img) {
    if (layer.querySelector('.evo-ph')) return;
    const ph = document.createElement('div');
    ph.className = 'evo-ph';
    ph.setAttribute('aria-hidden', 'true');
    const tag = document.createElement('span');
    tag.className = 'evo-ph__tag';
    tag.textContent = 'Temporary placeholder';
    const name = document.createElement('strong');
    name.textContent = img.dataset.slot || img.alt || 'Image slot';
    const path = document.createElement('code');
    path.textContent = img.getAttribute('src');
    ph.append(tag, name, path);
    layer.appendChild(ph);
  }

  function watchImage(layer, onReady) {
    const img = layer.querySelector('img');
    if (!img) return;
    img.setAttribute('draggable', 'false');
    const missing = () => { layer.classList.add('is-missing'); placeholder(layer, img); };
    const ready = () => {
      if (!img.naturalWidth) return missing();
      layer.classList.remove('is-missing');
      onReady && onReady(img);
    };
    img.addEventListener('error', missing);
    img.addEventListener('load', ready);
    if (img.complete) (img.naturalWidth ? ready() : missing());
  }

  function init(root) {
    if (root.__compare) return root.__compare;
    const stage = root.querySelector('[data-compare-stage]');
    const handle = root.querySelector('[data-compare-handle]');
    const sketchLayer = root.querySelector('[data-compare-layer="sketch"]');
    const renderLayer = root.querySelector('[data-compare-layer="render"]');
    if (!stage || !handle || !sketchLayer || !renderLayer) return null;

    let pos = clamp(parseFloat(root.dataset.start) || 50, 0, 100);
    let raf = 0;
    let tweenRaf = 0;
    let interacted = false;

    // frame proportions: fixed via data-ratio, otherwise taken from the final render
    const fixedRatio = root.dataset.ratio && root.dataset.ratio.split('/').map(Number);
    if (fixedRatio && fixedRatio[0] && fixedRatio[1]) root.style.setProperty('--ar', fixedRatio[0] / fixedRatio[1]);
    watchImage(renderLayer, (img) => {
      if (!fixedRatio) root.style.setProperty('--ar', clamp(img.naturalWidth / img.naturalHeight, 0.7, 2.6).toFixed(4));
    });
    watchImage(sketchLayer);

    function apply() {
      raf = 0;
      const v = Math.round(pos * 10) / 10;
      root.style.setProperty('--pos', `${v}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
      handle.setAttribute('aria-valuetext', `${Math.round(pos)}% initial sketch, ${100 - Math.round(pos)}% final render`);
      root.classList.toggle('is-left-hidden', pos < 9);
      root.classList.toggle('is-right-hidden', pos > 91);
    }
    function setPos(v, now) {
      pos = clamp(v, 0, 100);
      if (now) { cancelAnimationFrame(raf); apply(); } else if (!raf) raf = requestAnimationFrame(apply);
    }
    function stopTween() { cancelAnimationFrame(tweenRaf); tweenRaf = 0; }
    function tweenTo(to, ms) {
      stopTween();
      if (reduce || ms <= 0) { setPos(to, true); return Promise.resolve(); }
      const from = pos;
      const t0 = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          setPos(from + (to - from) * ease(t), true);
          if (t < 1) tweenRaf = requestAnimationFrame(step);
          else { tweenRaf = 0; resolve(); }
        };
        tweenRaf = requestAnimationFrame(step);
      });
    }
    const takeOver = () => { interacted = true; stopTween(); root.classList.add('is-touched'); };

    /* ---------- pointer (mouse / touch / pen) ---------- */
    const toPercent = (clientX) => {
      const r = stage.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    };
    const handleX = () => { const r = stage.getBoundingClientRect(); return r.left + (pos / 100) * r.width; };
    let drag = null;

    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const onHandle = handle.contains(e.target);
      takeOver();
      drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY, onHandle,
        offset: onHandle ? handleX() - e.clientX : 0,
        // mouse and the knob itself drag straight away; touches on the image wait to see
        // whether you're dragging sideways or scrolling the page
        active: e.pointerType === 'mouse' || onHandle,
      };
      if (drag.active) {
        e.preventDefault();
        stage.setPointerCapture(e.pointerId);
        root.classList.add('is-dragging');
        if (!onHandle) setPos(toPercent(e.clientX));
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.active) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // vertical → page scroll
        drag.active = true;
        stage.setPointerCapture(e.pointerId);
        root.classList.add('is-dragging');
      }
      setPos(toPercent(e.clientX + drag.offset));
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.active && e.type === 'pointerup') tweenTo(toPercent(e.clientX), 420); // tap to jump
      drag = null;
      root.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    // touches are implicitly captured by the element under the finger; moving that capture to the
    // stage fires lostpointercapture on the child (it bubbles), so only react to the stage's own loss
    stage.addEventListener('lostpointercapture', (e) => {
      if (e.target !== stage || !drag || e.pointerId !== drag.id) return;
      drag = null;
      root.classList.remove('is-dragging');
    });
    stage.addEventListener('dragstart', (e) => e.preventDefault());

    /* ---------- keyboard ---------- */
    handle.addEventListener('keydown', (e) => {
      const small = e.shiftKey ? 10 : 2;
      let target = null;
      let ms = 0;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowDown': target = pos - small; break;
        case 'ArrowRight': case 'ArrowUp': target = pos + small; break;
        case 'PageDown': target = pos - 10; ms = 260; break;
        case 'PageUp': target = pos + 10; ms = 260; break;
        case 'Home': target = 0; ms = 420; break;
        case 'End': target = 100; ms = 420; break;
        default: return;
      }
      e.preventDefault();
      takeOver();
      ms ? tweenTo(target, ms) : setPos(target);
    });

    /* ---------- hint: nudge the line once when it first comes into view ---------- */
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        setTimeout(async () => {
          const start = pos;
          for (const [to, ms] of [[start + 12, 700], [start - 10, 900], [start, 650]]) {
            if (interacted) return;
            await tweenTo(to, ms);
          }
        }, 450);
      }, { threshold: 0.6 });
      io.observe(stage);
    }

    apply();
    const api = { get value() { return pos; }, set: (v) => setPos(v, true), animateTo: tweenTo };
    root.__compare = api;
    return api;
  }

  const initAll = (scope = document) => [...scope.querySelectorAll('[data-compare-slider]')].map(init);
  window.CompareSlider = { init, initAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
})();
