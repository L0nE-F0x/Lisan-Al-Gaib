/* ============================================================
   DUNE IMPERIUM — Hero WebGL scene
   Arrakis planet, fresnel atmosphere, starfield, spice dust
   ============================================================ */
import * as THREE from 'three';

const ATMOSPHERE_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = 1.0 - abs(dot(viewDir, normalize(vNormal)));
    float glow = pow(rim, 3.2) * uIntensity;
    gl_FragColor = vec4(uColor, 1.0) * glow;
  }
`;

export function initHero(canvas, { onTextureProgress, onReady, onError } = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    onError?.(err);
    return null;
  }

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 0, 7.5);

  /* ---------------- lights ---------------- */
  const sun = new THREE.DirectionalLight(0xffd2a0, 3.4);
  sun.position.set(6, 2.2, 4);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x3d5a80, 0.5);
  fill.position.set(-6, -1, 3);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0x201409, 1.4));

  /* ---------------- Arrakis ---------------- */
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  const PLANET_R = 2.05;
  const planetGeo = new THREE.SphereGeometry(PLANET_R, 96, 96);
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0xf7c489,            // warm amber grade over the mars-red source
    roughness: 0.92,
    metalness: 0.02,
  });

  const loader = new THREE.TextureLoader();
  loader.load(
    'assets/textures/arrakis-2k.jpg',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      planetMat.map = tex;
      planetMat.color.set(0xffd9a8);
      planetMat.needsUpdate = true;
      onTextureProgress?.(1);
      onReady?.();
    },
    (xhr) => {
      if (xhr.total > 0) onTextureProgress?.(xhr.loaded / xhr.total);
    },
    () => {
      // texture failed — keep tinted fallback sphere, still count as ready
      onTextureProgress?.(1);
      onReady?.();
    }
  );

  const planet = new THREE.Mesh(planetGeo, planetMat);
  planet.rotation.z = -0.18;
  planetGroup.add(planet);

  // subtle bump-illusion: second darker shell rotated for depth parallax
  const hazeGeo = new THREE.SphereGeometry(PLANET_R * 1.012, 64, 64);
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xd98a3d,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haze = new THREE.Mesh(hazeGeo, hazeMat);
  planetGroup.add(haze);

  // atmosphere rim glow
  const atmoGeo = new THREE.SphereGeometry(PLANET_R * 1.22, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERT,
    fragmentShader: ATMOSPHERE_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(0xf0913c) },
      uIntensity: { value: 1.15 },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  planetGroup.add(atmosphere);

  // place planet right-of-center, slightly below eye line
  const placePlanet = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 0.85) {
      planetGroup.position.set(0, 0.55, -1.6);
      planetGroup.scale.setScalar(0.9);
    } else {
      planetGroup.position.set(2.35, -0.35, -0.8);
      planetGroup.scale.setScalar(1);
    }
  };
  placePlanet();

  /* ---------------- starfield ---------------- */
  const makeStars = (count, rMin, rMax, size, tint) => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new THREE.Color(0xffffff);
    const warm = new THREE.Color(tint);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 20;
      const c = Math.random() < 0.82 ? base : warm;
      const b = 0.45 + Math.random() * 0.55;
      col[i * 3] = c.r * b;
      col[i * 3 + 1] = c.g * b;
      col[i * 3 + 2] = c.b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  };

  const starsFar = makeStars(1400, 26, 60, 0.055, 0xffd9a0);
  const starsNear = makeStars(500, 12, 26, 0.075, 0xffe9c4);
  scene.add(starsFar, starsNear);

  /* ---------------- spice dust ---------------- */
  const isSmall = window.innerWidth < 720;
  const DUST_COUNT = reduceMotion ? 0 : (isSmall ? 260 : 620);
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST_COUNT * 3);
  const dSeed = new Float32Array(DUST_COUNT * 2);
  for (let i = 0; i < DUST_COUNT; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 22;
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    dPos[i * 3 + 2] = 1 + Math.random() * 5.5;
    dSeed[i * 2] = Math.random() * Math.PI * 2;       // phase
    dSeed[i * 2 + 1] = 0.15 + Math.random() * 0.5;    // speed
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf0a44a,
    size: 0.035,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ---------------- interaction state ---------------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0;      // 0 = top, 1 = past hero
  let running = true;
  let inView = true;

  const onMouseMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    placePlanet();
  };
  window.addEventListener('resize', onResize, { passive: true });

  const io = new IntersectionObserver(
    (entries) => { inView = entries[0].isIntersecting; },
    { threshold: 0 }
  );
  io.observe(document.getElementById('hero'));

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  /* ---------------- render loop ---------------- */
  const clock = new THREE.Clock();
  let elapsed = 0;

  const frame = () => {
    requestAnimationFrame(frame);
    if (!running || !inView) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;

    // eased mouse
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;

    if (!reduceMotion) {
      planet.rotation.y += dt * 0.05;
      haze.rotation.y -= dt * 0.012;
      starsFar.rotation.y += dt * 0.004;
      starsNear.rotation.y += dt * 0.009;

      // dust drift
      const p = dustGeo.attributes.position.array;
      for (let i = 0; i < DUST_COUNT; i++) {
        const ph = dSeed[i * 2];
        const sp = dSeed[i * 2 + 1];
        p[i * 3] += Math.sin(t * 0.3 + ph) * 0.0012 - 0.0016 * sp;
        p[i * 3 + 1] += Math.cos(t * 0.24 + ph * 1.7) * 0.0009 + 0.0007 * sp;
        if (p[i * 3] < -11) p[i * 3] = 11;
        if (p[i * 3 + 1] > 6.2) p[i * 3 + 1] = -6.2;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // camera drift + parallax
      camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 0.22 - camera.position.y) * 0.03;
      camera.position.z = 7.5 + Math.sin(t * 0.16) * 0.12;
      camera.lookAt(0.6, 0, 0);

      // gentle atmosphere breathing
      atmoMat.uniforms.uIntensity.value = 1.1 + Math.sin(t * 0.5) * 0.12;
    }

    // scroll: planet sinks and dims as you descend
    const sp = scrollP;
    planetGroup.position.y = (window.innerWidth / window.innerHeight < 0.85 ? 0.55 : -0.35) - sp * 2.6;
    planetGroup.rotation.y = sp * 0.6;

    renderer.render(scene, camera);
  };
  frame();

  return {
    setScroll(p) { scrollP = p; },
    dispose() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      renderer.dispose();
    },
  };
}
