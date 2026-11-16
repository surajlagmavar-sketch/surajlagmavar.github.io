/* ==========================================================================
   3D product stage (Three.js)
   - Cinematic lighting: studio reflections + red rim light + soft floor shadow
   - Loads a .glb model (exported from your CAD / Blender) and auto-centres it
   - Idle turntable, mouse parallax, optional drag-to-rotate
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export { THREE };

/** True if a model file is actually there (so we never show a broken viewer). */
export async function modelExists(url) {
  if (!url || location.protocol === 'file:') return false;
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const type = r.headers.get('content-type') || '';
    return r.ok && !type.includes('text/html'); // some hosts answer missing files with an HTML page
  } catch {
    return false;
  }
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function radialTexture(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage(container, options = {}) {
  const o = {
    fov: 28,
    distance: 6.6,
    size: 2.5,            // longest side of the model, in scene units
    autoRotate: 0.12,     // radians / second
    startRotation: -0.6,
    drag: false,
    parallax: 0.22,
    ...options,
  };
  if (!webglAvailable()) throw new Error('WebGL not available');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 100);
  camera.position.set(0, 0.25, o.distance);
  camera.lookAt(0, 0, 0);

  // lighting: white key, red rim from behind-left, cool blue kicker from behind-right
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 5);
  const rimRed = new THREE.DirectionalLight(0xff1e3c, 6);
  rimRed.position.set(-5, 2.5, -4);
  const rimBlue = new THREE.DirectionalLight(0x5a78ff, 2.2);
  rimBlue.position.set(5, 1, -4);
  const fill = new THREE.HemisphereLight(0x8fa6ff, 0x0a0f1e, 0.5);
  scene.add(key, rimRed, rimBlue, fill);

  const pivot = new THREE.Group();   // rotation (idle / scroll / drag / mouse)
  const holder = new THREE.Group();  // model, gently floating
  pivot.add(holder);
  scene.add(pivot);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.75)'), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(225,11,43,0.38)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.rotation.x = -Math.PI / 2;
  scene.add(glow, shadow);

  const state = {
    progress: 0,
    mouseX: 0, mouseY: 0,
    dragRot: 0, dragVel: 0, dragging: false,
    baseDistance: o.distance,
    floorY: -1,
  };
  const smooth = { x: 0, y: 0 };

  window.addEventListener('pointermove', (e) => {
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  if (o.drag) {
    const el = renderer.domElement;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-y';
    let lastX = 0;
    el.addEventListener('pointerdown', (e) => {
      state.dragging = true; lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      state.dragVel = dx * 0.006;
      state.dragRot += state.dragVel;
    });
    const end = () => { state.dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // portrait screens: pull the camera back so the product isn't cropped
    state.baseDistance = o.distance * (camera.aspect < 1 ? Math.min(2.1, 0.85 / camera.aspect) : 1);
    camera.position.z = state.baseDistance;
    glow.visible = camera.aspect >= 1; // seen edge-on from far away it turns into a hard band
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const hooks = [];
  const clock = new THREE.Clock();
  let idle = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!state.dragging) { state.dragRot += state.dragVel; state.dragVel *= 0.94; }
    idle += dt * o.autoRotate;
    smooth.x += (state.mouseX - smooth.x) * 0.045;
    smooth.y += (state.mouseY - smooth.y) * 0.045;

    pivot.rotation.set(smooth.y * o.parallax * 0.35, o.startRotation + idle + state.dragRot + smooth.x * o.parallax, 0);
    pivot.position.set(0, 0, 0);
    holder.position.y = Math.sin(t * 0.9) * 0.045;
    camera.position.z = state.baseDistance;
    camera.position.y = 0.25;

    for (const fn of hooks) fn({ t, dt, state, pivot, holder, camera, scene });

    shadow.position.set(pivot.position.x, state.floorY + pivot.position.y, pivot.position.z);
    glow.position.set(pivot.position.x, state.floorY + pivot.position.y - 0.002, pivot.position.z);
    camera.position.y = 0.25 + camera.position.z * 0.05; // slight look-down so the floor reads as a floor
    camera.lookAt(pivot.position.x * 0.15, 0, 0);
    shadow.material.opacity = 0.9 - Math.sin(t * 0.9) * 0.08;
    renderer.render(scene, camera);
  }

  // only render while on screen
  let running = false;
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? frame : null);
    if (on) clock.getDelta();
  };
  new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { rootMargin: '100px' }).observe(container);
  setRunning(true);

  function setModel(object) {
    holder.clear();
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = o.size / Math.max(size.x, size.y, size.z);
    object.position.sub(center);
    const wrap = new THREE.Group();
    wrap.add(object);
    wrap.scale.setScalar(scale);
    holder.add(wrap);
    state.floorY = -(size.y * scale) / 2 - 0.12;
  }

  function loadGLB(url) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    return new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }

  return {
    renderer, scene, camera, pivot, holder, state,
    setModel, loadGLB,
    onFrame: (fn) => hooks.push(fn),
  };
}
