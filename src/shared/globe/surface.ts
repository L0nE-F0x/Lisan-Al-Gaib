/**
 * Bakes an original, procedurally generated Arrakis surface into two equirectangular
 * textures on the GPU (once per page load, ~10-40 ms):
 *
 *   albedo: RGB colour of the bare desert
 *   data:   R = height (0..1), G = moisture potential (where life could take hold),
 *           B = rock mask, A = salt-flat/pan mask
 *
 * Geography is stylised after the novels: an inhabited, rock-walled north polar region
 * (the Shield Wall country), basins and pans, an equatorial open erg of linear dunes,
 * and a small polar cap at each pole.
 */
import * as THREE from 'three';
import { NOISE } from './glsl.ts';

const BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uPass;
uniform float uSeed;

${NOISE}

const float PI = 3.141592653589793;

vec3 dirFromUv(vec2 uv) {
  float lon = (uv.x - 0.5) * 2.0 * PI;
  float lat = (uv.y - 0.5) * PI;
  float c = cos(lat);
  return vec3(c * sin(lon), sin(lat), c * cos(lon));
}

void main() {
  vec3 p = dirFromUv(vUv);
  float lat = (vUv.y - 0.5) * PI;
  float lon = (vUv.x - 0.5) * 2.0 * PI;
  float latDeg = degrees(lat);
  vec3 sp = p + vec3(uSeed);

  // --- large scale structure -------------------------------------------------
  vec3 warp = vec3(fbm(sp * 1.3 + 4.1, 3), fbm(sp * 1.3 + 9.7, 3), fbm(sp * 1.3 + 1.7, 3));
  float continent = fbm(sp * 1.6 + warp * 0.6, 5) * 0.5 + 0.5;          // 0..1

  // Rock: ridged ranges, much more common toward the north polar region.
  float northness = smoothstep(35.0, 75.0, latDeg);
  float southRock = smoothstep(-45.0, -75.0, latDeg) * 0.55;
  float ranges = ridged(sp * 3.2 + warp * 0.8, 6);
  float rockBias = mix(0.86, 0.56, max(northness, southRock));
  // A long escarpment ring around the north pole: the Shield Wall country.
  float wallBand = exp(-pow((latDeg - 71.0 + fbm(sp * 6.0, 3) * 5.0) / 2.6, 2.0));
  float rock = smoothstep(rockBias, rockBias + 0.12, ranges * 0.85 + continent * 0.35);
  rock = max(rock, wallBand * smoothstep(-0.2, 0.3, snoise(sp * 4.0)) * 0.95);

  // Pans and salt flats: low, smooth, pale basins.
  float basin = fbm(sp * 2.4 + 21.0, 4) * 0.5 + 0.5;
  float pan = smoothstep(0.66, 0.74, basin) * (1.0 - rock);
  pan *= 1.0 - smoothstep(60.0, 85.0, abs(latDeg)) * 0.6;

  // Polar caps (small; Arrakis is famously dry).
  float capEdge = 84.5 + fbm(sp * 8.0, 4) * 2.5;
  float cap = smoothstep(capEdge, capEdge + 1.2, abs(latDeg));
  cap *= latDeg > 0.0 ? 1.0 : 0.7;

  // --- dunes ------------------------------------------------------------------
  // Prevailing winds run east-west, so crests run roughly north-south (linear dunes),
  // bending with a domain warp. Strongest in the equatorial erg.
  float erg = 1.0 - smoothstep(30.0, 65.0, abs(latDeg));
  float dw = fbm(sp * 5.0 + 3.3, 4);
  float crestCoord = lon * 190.0 * cos(lat) + dw * 14.0 + fbm(sp * 18.0, 2) * 3.0;
  float crest = pow(0.5 + 0.5 * sin(crestCoord), 1.6);
  // Dune fields come and go in large seas rather than covering everything evenly.
  float sea = smoothstep(-0.15, 0.35, fbm(sp * 2.2 + 55.0, 4));
  float star = ridged(sp * 34.0 + warp, 3);                // star dunes / chaos in the sand seas
  float dunes = mix(star * 0.7, crest, erg * 0.8 + 0.2) * sea;
  float duneMask = (1.0 - rock) * (1.0 - pan) * (1.0 - cap);

  // --- height -----------------------------------------------------------------
  float height = 0.42 + continent * 0.1;
  height += dunes * 0.1 * duneMask;
  height = mix(height, 0.22 + basin * 0.05, pan);
  height = mix(height, 0.62 + ranges * 0.35, rock);
  height = mix(height, 0.6, cap);

  // --- moisture potential (for the God Emperor's green Arrakis) --------------
  float moisture = smoothstep(0.35, 0.75, 1.0 - height) * 0.6 + smoothstep(55.0, 80.0, abs(latDeg)) * 0.5;
  moisture += fbm(sp * 3.0 + 40.0, 4) * 0.35;
  moisture *= 1.0 - cap * 0.8;
  moisture = clamp(moisture, 0.0, 1.0);

  if (uPass == 1) {
    gl_FragColor = vec4(height, moisture, rock, pan);
    return;
  }

  // --- albedo -----------------------------------------------------------------
  vec3 sandLight = vec3(0.88, 0.72, 0.49);
  vec3 sandMid   = vec3(0.81, 0.63, 0.43);
  vec3 sandDeep  = vec3(0.67, 0.48, 0.31);
  vec3 sandRed   = vec3(0.72, 0.46, 0.28);
  vec3 rockDark  = vec3(0.30, 0.21, 0.15);
  vec3 rockLight = vec3(0.50, 0.37, 0.26);
  vec3 panCol    = vec3(0.92, 0.85, 0.72);
  vec3 capCol    = vec3(0.95, 0.92, 0.86);

  float tone = fbm(sp * 2.0 + 77.0, 4) * 0.5 + 0.5;
  float macro = fbm(sp * 1.1 + 91.0, 5) * 0.5 + 0.5;
  vec3 sand = mix(sandDeep, sandMid, smoothstep(0.2, 0.6, macro));
  sand = mix(sand, sandLight, smoothstep(0.55, 0.9, macro));
  sand = mix(sand, sandRed, smoothstep(0.55, 0.85, tone) * 0.35);
  sand *= 0.94 + 0.12 * dunes;               // dunes read as texture, not as pattern
  sand = mix(sand, sand * 0.86, (1.0 - sea) * 0.25);

  vec3 rockCol = mix(rockDark, rockLight, smoothstep(0.3, 0.9, ranges));
  rockCol *= 0.85 + 0.3 * fbm(sp * 30.0, 2);

  vec3 col = sand;
  col = mix(col, panCol * (0.92 + 0.08 * basin), pan);
  col = mix(col, rockCol, rock);
  col = mix(col, capCol, cap);

  gl_FragColor = vec4(col, 1.0);
}
`;

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export interface BakedSurface {
  albedo: THREE.Texture;
  data: THREE.Texture;
  dispose(): void;
}

export function bakeSurface(renderer: THREE.WebGLRenderer, width: number, seed = 0.37): BakedSurface {
  const height = width / 2;
  const make = () =>
    new THREE.WebGLRenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    });
  const albedoRT = make();
  const dataRT = make();

  const mat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    uniforms: { uPass: { value: 0 }, uSeed: { value: seed } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.Camera();

  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(albedoRT);
  renderer.render(scene, cam);
  mat.uniforms.uPass.value = 1;
  renderer.setRenderTarget(dataRT);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);

  quad.geometry.dispose();
  mat.dispose();

  return {
    albedo: albedoRT.texture,
    data: dataRT.texture,
    dispose() {
      albedoRT.dispose();
      dataRT.dispose();
    },
  };
}
