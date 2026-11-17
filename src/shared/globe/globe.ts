/**
 * ArrakisGlobe — the shared planet renderer used by the hub hero and the Arrakis atlas.
 *
 * View model (no Three.js knowledge needed by callers):
 *   view.centerLat / view.centerLon  degrees; the point facing the viewer
 *   view.distance                    camera distance in planet radii (sphere mode)
 *   view.morph                       0 = globe, 1 = flat equirectangular map (animatable)
 *   view.flatZoom                    zoom factor in flat mode (1 = whole map fits width)
 *
 * Environment:
 *   setSun(subsolarLat, subsolarLon)   degrees, in planet coordinates (drives day/night)
 *   setGreening(0..1)                  Leto II's green Arrakis
 *   setStorms(0..1)                    dust storm coverage
 *
 * Geometry helpers for DOM overlays:
 *   project(lat, lon) -> { x, y, visible, facing }   CSS pixels
 *   pick(x, y)        -> { lat, lon } | null
 *
 * The camera never moves off-axis: rotation is applied in the shaders, which keeps the
 * maths for projection/picking exact and identical between globe and flat map.
 */
import * as THREE from 'three';
import { NOISE, PROJECTION } from './glsl.ts';
import { bakeSurface, type BakedSurface } from './surface.ts';

const DEG = Math.PI / 180;

export interface GlobeOptions {
  /** 'low' | 'mid' | 'high' picks texture size, mesh density and noise octaves. */
  quality?: 'low' | 'mid' | 'high';
  stars?: boolean;
  moons?: boolean;
  storms?: boolean;
  /** Transparent clear so CSS behind the canvas shows through. */
  transparent?: boolean;
  /** Max device pixel ratio. */
  maxDpr?: number;
}

export interface GlobeView {
  centerLat: number;
  centerLon: number;
  distance: number;
  morph: number;
  flatZoom: number;
}

export interface Projected {
  x: number;
  y: number;
  /** In front of the planet / inside the flat map viewport. */
  visible: boolean;
  /** -1..1, how directly the point faces the viewer (for fading labels near the limb). */
  facing: number;
}

const PLANET_VERT = /* glsl */ `
${PROJECTION}
uniform float uCenterLat;
uniform float uMorph;
uniform float uRadius;
uniform float uLift;
varying vec2 vGrid;
varying vec3 vView;
void main() {
  vGrid = position.xy;
  vec3 p = morphPosition(position.xy, uRadius, uCenterLat, uMorph, uLift);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
${PROJECTION}
${NOISE}
uniform sampler2D uAlbedo;
uniform sampler2D uData;
uniform vec2 uTexel;
uniform float uCenterLon;
uniform float uCenterLat;
uniform float uMorph;
uniform vec3 uSun;          // unit vector in planet coordinates
uniform float uGreen;       // 0..1
uniform vec3 uSareer;       // unit vector: the desert Leto II preserved
uniform float uDetail;      // 0..1 close-up procedural detail
uniform float uNightFloor;
uniform int uOctaves;
varying vec2 vGrid;
varying vec3 vView;

void main() {
  float lon = vGrid.x + uCenterLon;
  float lat = vGrid.y;
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

  vec3 albedo = texture2D(uAlbedo, uv).rgb;
  vec4 data = texture2D(uData, uv);
  float hC = data.r;

  // Normal from the baked height field (planet coordinates).
  float hE = texture2D(uData, uv + vec2(uTexel.x, 0.0)).r;
  float hN = texture2D(uData, uv + vec2(0.0, uTexel.y)).r;
  vec3 n = sphereDir(lat, lon);
  vec3 east = normalize(vec3(cos(lon), 0.0, -sin(lon)));
  vec3 north = normalize(cross(n, east));
  float bump = 3.2;
  vec3 N = normalize(n - east * (hE - hC) * bump / max(cos(lat), 0.15) - north * (hN - hC) * bump);

  // Close-up procedural ripples so zooming in never shows texture blur.
  if (uDetail > 0.001) {
    vec3 q = n * 260.0;
    float r1 = snoise(q + vec3(0.0, 0.0, lon * 2.0));
    float r2 = snoise(q * 2.7);
    float sandMask = 1.0 - data.b;
    albedo *= 1.0 + (r1 * 0.06 + r2 * 0.035) * uDetail * sandMask;
    N = normalize(N + (east * r1 + north * r2) * 0.06 * uDetail * sandMask);
  }

  // Greening: life spreads through moist lowlands, never the Sareer.
  if (uGreen > 0.001) {
    float sareer = smoothstep(0.86, 0.93, dot(n, uSareer));
    float potential = smoothstep(0.35, 0.7, data.g + (uGreen - 0.5) * 0.6) * (1.0 - data.b * 0.7) * (1.0 - sareer);
    float g = potential * uGreen;
    vec3 vegLow = vec3(0.30, 0.42, 0.20);
    vec3 vegHigh = vec3(0.45, 0.52, 0.28);
    vec3 veg = mix(vegLow, vegHigh, snoise(n * 40.0) * 0.5 + 0.5);
    albedo = mix(albedo, veg, g * 0.85);
    // A little open water in the deepest basins at full greening.
    float water = smoothstep(0.28, 0.2, hC) * smoothstep(0.75, 1.0, uGreen) * (1.0 - sareer);
    albedo = mix(albedo, vec3(0.16, 0.30, 0.36), water * 0.8);
  }

  // Lighting (identical on globe and flat map, since it lives in planet space).
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.08, 0.25, dot(n, uSun));
  float diffuse = clamp(ndl, 0.0, 1.0);
  float wrap = clamp((ndl + 0.3) / 1.3, 0.0, 1.0);
  vec3 sunCol = vec3(1.0, 0.92, 0.8);
  vec3 lit = albedo * sunCol * (0.25 * wrap + 0.95 * diffuse);
  vec3 night = albedo * vec3(0.10, 0.09, 0.11);
  vec3 col = mix(night, lit, day);
  col = max(col, albedo * uNightFloor);
  // The flat map is for reading, so it is lit almost evenly with only a hint of day/night.
  col = mix(col, albedo * (0.8 + 0.2 * day), uMorph * 0.85);

  // Terminator warmth.
  float term = exp(-pow(dot(n, uSun) / 0.12, 2.0));
  col += vec3(0.35, 0.12, 0.02) * term * 0.25 * (1.0 - uMorph);

  // Atmospheric rim on the globe.
  vec3 V = normalize(vView);
  vec3 vn = tilt(sphereDir(vGrid.y, vGrid.x), uCenterLat);
  float fres = pow(1.0 - clamp(dot(vn, V), 0.0, 1.0), 3.0);
  col += vec3(0.95, 0.55, 0.25) * fres * 0.55 * (0.35 + 0.65 * day) * (1.0 - uMorph);

  gl_FragColor = vec4(col, 1.0);
}
`;

const STORM_FRAG = /* glsl */ `
precision highp float;
${PROJECTION}
${NOISE}
uniform float uCenterLon;
uniform float uTime;
uniform float uStorms;
uniform vec3 uSun;
uniform int uOctaves;
varying vec2 vGrid;
varying vec3 vView;
void main() {
  float lon = vGrid.x + uCenterLon;
  float lat = vGrid.y;
  vec3 n = sphereDir(lat, lon);
  // Storms are dragged eastward, faster near the equator (Coriolis storms).
  float drift = uTime * 0.012 * (1.2 - abs(sin(lat)));
  vec3 q = sphereDir(lat, lon - drift);
  vec3 w = vec3(fbm(q * 2.0 + uTime * 0.01, 3), fbm(q * 2.0 + 13.0, 3), 0.0);
  float d = fbm(q * 3.5 + w * 1.2, uOctaves) * 0.5 + 0.5;
  float band = 1.0 - smoothstep(25.0, 70.0, abs(degrees(lat)));
  float a = smoothstep(0.66 - uStorms * 0.3, 0.86, d * (0.62 + 0.5 * band)) * step(0.001, uStorms);
  float day = smoothstep(-0.1, 0.3, dot(n, uSun));
  vec3 dust = mix(vec3(0.42, 0.3, 0.2), vec3(0.93, 0.76, 0.52), day);
  gl_FragColor = vec4(dust, a * 0.85);
}
`;

const HALO_VERT = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
precision highp float;
uniform float uDist;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vPos;
void main() {
  // Apparent silhouette radius of a unit sphere seen from distance d, in the z=0 plane.
  float rs = uDist / sqrt(max(uDist * uDist - 1.0, 0.0001));
  float r = length(vPos);
  float outside = max(r - rs, 0.0);
  float glow = exp(-outside * 9.0) * step(rs * 0.97, r);
  float inner = smoothstep(rs * 0.9, rs, r) * (1.0 - step(rs, r)) * 0.35;
  float a = (glow * 0.75 + inner) * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

export class ArrakisGlobe {
  readonly canvas: HTMLCanvasElement;
  readonly view: GlobeView = { centerLat: 22, centerLon: 0, distance: 3.2, morph: 0, flatZoom: 1 };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private surface: BakedSurface;
  private planetMat: THREE.ShaderMaterial;
  private stormMat: THREE.ShaderMaterial | null = null;
  private haloMat: THREE.ShaderMaterial;
  private stars: THREE.Points | null = null;
  private moons: { mesh: THREE.Mesh; orbit: number; period: number; phase: number; incl: number }[] = [];
  private sunLight: THREE.DirectionalLight;
  private width = 1;
  private height = 1;
  private time = 0;
  private sun = new THREE.Vector3(0.7, 0.25, 0.65).normalize();
  /** When set, the sun is fixed relative to the viewer (hero shots) instead of the planet. */
  private sunView: THREE.Vector3 | null = null;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private maxDpr: number;

  constructor(canvas: HTMLCanvasElement, opts: GlobeOptions = {}) {
    this.canvas = canvas;
    const quality = opts.quality ?? 'high';
    this.maxDpr = opts.maxDpr ?? (quality === 'high' ? 2 : 1.5);

    // Throws if WebGL is unavailable: callers must catch and show a fallback.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      alpha: !!opts.transparent,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x0a0705, opts.transparent ? 0 : 1);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);

    const texSize = quality === 'high' ? 4096 : 2048;
    const maxTex = this.renderer.capabilities.maxTextureSize;
    this.surface = bakeSurface(this.renderer, Math.min(texSize, maxTex));
    const octaves = quality === 'low' ? 3 : quality === 'mid' ? 4 : 5;

    const seg = quality === 'low' ? [128, 64] : [256, 128];
    const grid = new THREE.PlaneGeometry(Math.PI * 2, Math.PI, seg[0], seg[1]);

    this.planetMat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: {
        uAlbedo: { value: this.surface.albedo },
        uData: { value: this.surface.data },
        uTexel: { value: new THREE.Vector2(1 / Math.min(texSize, maxTex), 2 / Math.min(texSize, maxTex)) },
        uCenterLat: { value: 0 },
        uCenterLon: { value: 0 },
        uMorph: { value: 0 },
        uRadius: { value: 1 },
        uLift: { value: 0 },
        uSun: { value: this.sun },
        uGreen: { value: 0 },
        uSareer: { value: latLonToVec(-5, 20) },
        uDetail: { value: 0 },
        uNightFloor: { value: 0.04 },
        uOctaves: { value: octaves },
      },
    });
    const planet = new THREE.Mesh(grid, this.planetMat);
    planet.frustumCulled = false;
    this.scene.add(planet);

    if (opts.storms !== false) {
      this.stormMat = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: STORM_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uCenterLat: { value: 0 },
          uCenterLon: { value: 0 },
          uMorph: { value: 0 },
          uRadius: { value: 1.012 },
          uLift: { value: 0.002 },
          uTime: { value: 0 },
          uStorms: { value: 0.5 },
          uSun: { value: this.sun },
          uOctaves: { value: Math.max(3, octaves - 1) },
        },
      });
      const storms = new THREE.Mesh(grid, this.stormMat);
      storms.frustumCulled = false;
      storms.renderOrder = 2;
      this.scene.add(storms);
    }

    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uDist: { value: this.view.distance },
        uOpacity: { value: 1 },
        uColor: { value: new THREE.Color(0.95, 0.55, 0.22) },
      },
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), this.haloMat);
    halo.renderOrder = 3;
    this.scene.add(halo);

    this.sunLight = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.scene.add(this.sunLight, new THREE.AmbientLight(0x30251c, 0.6));

    if (opts.stars !== false) this.stars = makeStars(quality === 'low' ? 900 : 2200);
    if (this.stars) this.scene.add(this.stars);
    if (opts.moons) this.addMoons();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  // ---------------------------------------------------------------------------
  // Environment

  setSun(subsolarLat: number, subsolarLon: number): void {
    this.sunView = null;
    this.sun.copy(latLonToVec(subsolarLat, subsolarLon));
  }

  /** Fix the sun relative to the viewer, e.g. (-0.6, 0.35, 0.7) lights from upper left-front. */
  setSunFromView(x: number, y: number, z: number): void {
    this.sunView = new THREE.Vector3(x, y, z).normalize();
  }

  setGreening(g: number): void {
    this.planetMat.uniforms.uGreen.value = Math.min(1, Math.max(0, g));
  }

  setSareer(lat: number, lon: number): void {
    (this.planetMat.uniforms.uSareer.value as THREE.Vector3).copy(latLonToVec(lat, lon));
  }

  setStorms(amount: number): void {
    if (this.stormMat) this.stormMat.uniforms.uStorms.value = Math.min(1, Math.max(0, amount));
  }

  /** Configure moon visuals. Call once; positions animate in render(). */
  setMoons(defs: { orbit: number; size: number; period: number; color: string }[]): void {
    for (const m of this.moons) {
      this.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
    this.moons = defs.map((d, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(d.size, 32, 16),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(d.color) }),
      );
      this.scene.add(mesh);
      return { mesh, orbit: d.orbit, period: d.period, phase: i * 2.1, incl: (i ? -8 : 5) * DEG };
    });
  }

  // ---------------------------------------------------------------------------
  // Geometry

  /** Project planet coordinates (degrees) to CSS pixels on the canvas. */
  project(lat: number, lon: number, lift = 0.0): Projected {
    const p = this.worldPosition(lat, lon, lift);
    const v = p.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * this.width;
    const y = (-v.y * 0.5 + 0.5) * this.height;
    const { morph } = this.view;
    // Facing on the globe: z component of the tilted unit position.
    const s = this.spherePoint(lat, lon);
    const facing = s.z * (1 - morph) + morph;
    const onScreen = x > -40 && x < this.width + 40 && y > -40 && y < this.height + 40;
    return { x, y, visible: onScreen && facing > 0.05, facing };
  }

  /** Inverse of project(): what lat/lon is under the CSS pixel (x, y)? */
  pick(x: number, y: number): { lat: number; lon: number } | null {
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const { morph, centerLat, centerLon } = this.view;
    if (morph < 0.5) {
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), hit)) return null;
      // Undo tilt.
      const c = centerLat * DEG;
      const yy = hit.y * Math.cos(c) + hit.z * Math.sin(c);
      const zz = -hit.y * Math.sin(c) + hit.z * Math.cos(c);
      const lat = Math.asin(Math.max(-1, Math.min(1, yy))) / DEG;
      const lon = wrapLon(Math.atan2(hit.x, zz) / DEG + centerLon);
      return { lat, lon };
    }
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit)) return null;
    const gridLon = (hit.x * Math.PI) / 2;
    const lat = ((hit.y * Math.PI) / 2) / DEG + centerLat;
    if (Math.abs(gridLon) > Math.PI || Math.abs(lat) > 90) return null;
    return { lat, lon: wrapLon(gridLon / DEG + centerLon) };
  }

  // ---------------------------------------------------------------------------
  // Frame

  render(dt: number): void {
    if (this.disposed) return;
    this.time += dt;
    const { centerLat, centerLon, morph } = this.view;
    const u = this.planetMat.uniforms;
    u.uCenterLat.value = centerLat * DEG;
    u.uCenterLon.value = centerLon * DEG;
    u.uMorph.value = morph;
    u.uNightFloor.value = 0.05 + morph * 0.5;

    // Camera: globe distance blends into a flat-map framing.
    const flatDist = this.flatDistance() / this.view.flatZoom;
    const dist = this.view.distance + (flatDist - this.view.distance) * morph;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = Math.max(0.005, (dist - 1.2) * 0.5);
    this.camera.updateProjectionMatrix();
    u.uDetail.value = Math.max(0, Math.min(1, (2.2 - dist) / 0.9)) * (1 - morph * 0.5);

    if (this.stormMat) {
      const s = this.stormMat.uniforms;
      s.uCenterLat.value = centerLat * DEG;
      s.uCenterLon.value = centerLon * DEG;
      s.uMorph.value = morph;
      s.uTime.value = this.time;
    }

    this.haloMat.uniforms.uDist.value = dist;
    this.haloMat.uniforms.uOpacity.value = 1 - morph;

    if (this.sunView) this.sun.copy(this.fromView(this.sunView));
    // Light direction in view space = tilted planet-space sun, rotated by -centerLon.
    const sunView = this.toView(this.sun);
    this.sunLight.position.copy(sunView).multiplyScalar(10);

    for (const m of this.moons) {
      const a = (this.time / m.period) * Math.PI * 2 + m.phase;
      const local = new THREE.Vector3(Math.sin(a) * m.orbit, Math.sin(a) * Math.sin(m.incl) * m.orbit, Math.cos(a) * m.orbit);
      m.mesh.position.copy(this.toView(local.normalize()).multiplyScalar(m.orbit));
      m.mesh.visible = morph < 0.6;
      m.mesh.scale.setScalar(1 - morph);
    }
    if (this.stars) {
      this.stars.rotation.y = -centerLon * DEG * 0.15;
      this.stars.rotation.x = centerLat * DEG * 0.15;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, r.width);
    this.height = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.surface.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------------------
  // Internals

  /** Camera distance at which the 4x2 flat map exactly fits the viewport width. */
  private flatDistance(): number {
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fitW = 2 / Math.tan(hFov / 2);
    const fitH = 1 / Math.tan(vFov / 2);
    return Math.min(fitW, fitH * 1.02);
  }

  /** Unit position on the tilted globe for planet coords (no morph). */
  private spherePoint(lat: number, lon: number): THREE.Vector3 {
    const gl = wrapLon(lon - this.view.centerLon) * DEG;
    const la = lat * DEG;
    const c = Math.cos(la);
    const p = new THREE.Vector3(c * Math.sin(gl), Math.sin(la), c * Math.cos(gl));
    return tilt(p, this.view.centerLat * DEG);
  }

  private worldPosition(lat: number, lon: number, lift: number): THREE.Vector3 {
    const sp = this.spherePoint(lat, lon).multiplyScalar(1 + lift);
    const gl = wrapLon(lon - this.view.centerLon) * DEG;
    const fp = new THREE.Vector3(gl * (2 / Math.PI), (lat - this.view.centerLat) * DEG * (2 / Math.PI), lift * 0.2);
    return sp.lerp(fp, this.view.morph);
  }

  /** Planet-space direction -> view space (same transform as the shaders). */
  private toView(v: THREE.Vector3): THREE.Vector3 {
    const lon = -this.view.centerLon * DEG;
    const x = v.x * Math.cos(lon) + v.z * Math.sin(lon);
    const z = -v.x * Math.sin(lon) + v.z * Math.cos(lon);
    return tilt(new THREE.Vector3(x, v.y, z), this.view.centerLat * DEG);
  }

  /** View space -> planet space (inverse of toView). */
  private fromView(v: THREE.Vector3): THREE.Vector3 {
    const t = tilt(v.clone(), -this.view.centerLat * DEG);
    const lon = this.view.centerLon * DEG;
    const x = t.x * Math.cos(lon) + t.z * Math.sin(lon);
    const z = -t.x * Math.sin(lon) + t.z * Math.cos(lon);
    return new THREE.Vector3(x, t.y, z).normalize();
  }

  private addMoons(): void {
    this.setMoons([
      { orbit: 2.6, size: 0.11, period: 70, color: '#b9b0a2' },
      { orbit: 3.6, size: 0.075, period: 115, color: '#8f8677' },
    ]);
  }
}

// ---------------------------------------------------------------------------

function tilt(p: THREE.Vector3, c: number): THREE.Vector3 {
  const s = Math.sin(c);
  const k = Math.cos(c);
  return new THREE.Vector3(p.x, p.y * k - p.z * s, p.y * s + p.z * k);
}

export function latLonToVec(lat: number, lon: number): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  const c = Math.cos(la);
  return new THREE.Vector3(c * Math.sin(lo), Math.sin(la), c * Math.cos(lo));
}

export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function makeStars(count: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 30;
    const s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(t) * r, u * r, s * Math.sin(t) * r], i * 3);
    const warm = Math.random();
    const b = 0.45 + Math.random() * 0.55;
    col.set([b, b * (0.82 + warm * 0.15), b * (0.65 + warm * 0.25)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
  return new THREE.Points(g, m);
}
