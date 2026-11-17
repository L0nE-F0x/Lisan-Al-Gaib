import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AppState } from '../core/state.js';
import { DATA } from '../data/arrakis-lore.js';

let scene, camera, renderer, controls;
let arrakisGroup, sandstormSystem, planetMesh;
let moons = [];
let is3DActive = false;

// Raycasting for interactive landmarks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const markers = []; 
const tempV = new THREE.Vector3();

// Info panel tether context
let tetherCtx;

// ==========================================
// INIT
// ==========================================
export function init3D() {
    const canvas = document.getElementById('canvas-3d');
    if (!canvas) return;

    // 1. Core Engine Setup
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();
    scene.background = null; 

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 18);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 5.5; 
    controls.maxDistance = 25;

    controls.addEventListener('change', () => {
        if (controls.getDistance() >= 24.5 && is3DActive) {
            window.dispatchEvent(new CustomEvent('exit-3d'));
        }
    });

    // 2. Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.06);
    scene.add(ambientLight);
    
    // Canopus sunlight — warm white with a hint of yellow
    const sunLight = new THREE.DirectionalLight(0xfffdd0, 2.8);
    sunLight.position.set(20, 5, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // Cool blue rim light — the void of space behind the planet
    const rimLight = new THREE.DirectionalLight(0x0ea5e9, 0.25);
    rimLight.position.set(-20, 0, -10);
    scene.add(rimLight);

    // Subtle warm fill from below — scattered light from the desert surface
    const fillLight = new THREE.HemisphereLight(0xd97706, 0x0c0a09, 0.15);
    scene.add(fillLight);

    arrakisGroup = new THREE.Group();
    scene.add(arrakisGroup);

    // 3. Build the Planet
    const radius = 5;
    buildPlanet(radius);
    createRegionOverlay(radius);
    createSandstorms(radius);
    createAtmosphereLayers(radius);

    // 4. Moons
    createMoons();

    // 5. HTML UI Overlay
    buildUIOverlay();

    // 6. Interactive Landmarks
    populateLandmarks(radius);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('enter-3d', onEnter3D);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);

    animate();
}

// ==========================================
// PLANET SURFACE — Image Texture with Derived Maps
// ==========================================
function buildPlanet(radius) {
    const geometry = new THREE.SphereGeometry(radius, 128, 64);
    const loader = new THREE.TextureLoader();

    // Start with a placeholder material so the planet renders immediately
    const placeholderMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.95,
        metalness: 0.0
    });
    planetMesh = new THREE.Mesh(geometry, placeholderMat);
    planetMesh.receiveShadow = true;
    planetMesh.castShadow = true;
    arrakisGroup.add(planetMesh);

    // Load the real texture asynchronously
    loader.load(
        'textures/arrakis-surface.jpg',
        (baseTexture) => {
            baseTexture.colorSpace = THREE.SRGBColorSpace;
            baseTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            // Warm-tint the Mars texture toward Arrakis amber
            const tintedMap = warmTintTexture(baseTexture, 1.15, 0.95, 0.75);
            tintedMap.colorSpace = THREE.SRGBColorSpace;
            tintedMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

            // Derive a bump map from the grayscale of the texture
            const bumpMap = deriveBumpMap(baseTexture);
            bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

            // Derive a roughness map (dark = smooth basins, bright = rough ridges)
            const roughnessMap = deriveRoughnessMap(baseTexture);

            // Apply the real material
            planetMesh.material.dispose();
            planetMesh.material = new THREE.MeshStandardMaterial({
                map: tintedMap,
                bumpMap: bumpMap,
                bumpScale: 0.12,
                roughnessMap: roughnessMap,
                roughness: 0.85,
                metalness: 0.02,
            });
        },
        undefined,
        (err) => {
            console.warn('[Arrakis 3D] Could not load surface texture, using procedural fallback:', err.message);
            // Fall back to procedural texture
            planetMesh.material.dispose();
            planetMesh.material = new THREE.MeshStandardMaterial({
                map: generateProceduralFallback(),
                roughness: 0.95,
                metalness: 0.0
            });
        }
    );
}

function warmTintTexture(sourceTexture, rMult, gMult, bMult) {
    const image = sourceTexture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
        d[i]     = Math.min(255, d[i] * rMult);       // R — boost
        d[i + 1] = Math.min(255, d[i + 1] * gMult);   // G — slight reduce
        d[i + 2] = Math.min(255, d[i + 2] * bMult);   // B — reduce more
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

function deriveBumpMap(sourceTexture) {
    const image = sourceTexture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    // Convert to grayscale with contrast boost for terrain relief
    for (let i = 0; i < d.length; i += 4) {
        let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        // Boost contrast to make ridges and craters more pronounced
        gray = Math.min(255, Math.max(0, (gray - 100) * 2.0 + 100));
        d[i] = d[i + 1] = d[i + 2] = gray;
    }

    ctx.putImageData(imgData, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function deriveRoughnessMap(sourceTexture) {
    const image = sourceTexture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    // Invert brightness: dark terrain features = smoother, bright sand = rougher
    for (let i = 0; i < d.length; i += 4) {
        let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        // Map to roughness range 0.6 (smooth dark basins) to 1.0 (rough bright sand)
        let roughness = 0.6 + (gray / 255) * 0.4;
        const val = roughness * 255;
        d[i] = d[i + 1] = d[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function generateProceduralFallback() {
    // Same as the old procedural texture, used only if the image file fails to load
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#C27A3E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        let py = Math.floor((i / 4) / canvas.width);
        let noise = (Math.random() - 0.5) * 40;
        let lat = (py / canvas.height) * Math.PI - (Math.PI / 2);
        let band = Math.sin(lat * 8) * 20;
        data[i]     = Math.max(0, Math.min(255, 194 + noise + band));
        data[i + 1] = Math.max(0, Math.min(255, 122 + noise + band));
        data[i + 2] = Math.max(0, Math.min(255, 62 + noise + band));
        data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    for (let j = 0; j < 60; j++) {
        let cx = Math.random() * canvas.width;
        let cy = Math.random() * canvas.height;
        let r = Math.random() * 40 + 5;
        let grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
        grad.addColorStop(0, 'rgba(80, 40, 15, 0.6)');
        grad.addColorStop(0.8, 'rgba(150, 90, 40, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// ==========================================
// ATMOSPHERE — Multi-layer glow
// ==========================================
function createAtmosphereLayers(radius) {
    // Inner atmospheric shell — warm amber limb glow
    const innerAtmGeo = new THREE.SphereGeometry(radius * 1.015, 64, 64);
    const innerAtmMat = new THREE.MeshBasicMaterial({
        color: 0xe0ac69,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    arrakisGroup.add(new THREE.Mesh(innerAtmGeo, innerAtmMat));

    // Outer atmospheric haze — softer, wider, more blue at the edge
    const outerAtmGeo = new THREE.SphereGeometry(radius * 1.06, 64, 64);
    const outerAtmMat = new THREE.MeshBasicMaterial({
        color: 0xd4a056,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    arrakisGroup.add(new THREE.Mesh(outerAtmGeo, outerAtmMat));
}

// ==========================================
// REGION OVERLAY
// ==========================================
function createRegionOverlay(radius) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    DATA.regions.forEach(reg => {
        const cx = reg.x * canvas.width;
        const cy = reg.y * canvas.height;
        const regionRadius = 180;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, regionRadius);
        
        const hex = reg.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
        grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.1)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        // Use arc instead of fillRect to avoid rectangular bleed
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, regionRadius, 0, Math.PI * 2);
        ctx.fill();
    });

    const regionTexture = new THREE.CanvasTexture(canvas);
    const regionGeo = new THREE.SphereGeometry(radius * 1.005, 64, 64);
    const regionMat = new THREE.MeshBasicMaterial({
        map: regionTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    
    arrakisGroup.add(new THREE.Mesh(regionGeo, regionMat));
}

// ==========================================
// SANDSTORM PARTICLE SYSTEM
// Uses soft sprite textures and organic distributions
// ==========================================
function createSandstorms(radius) {
    // Generate a soft circular sprite texture procedurally
    // This eliminates the hard square edges of default PointsMaterial
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const sCtx = spriteCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

    // --- Gaussian random helper (Box-Muller) ---
    function gaussRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // --- LAYER 1: Global Dust Veil ---
    // Very subtle, evenly distributed, barely visible — atmospheric haze
    const dustCount = 1500;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.PI / 2) + gaussRandom() * 0.5; // Gaussian concentration at equator
        const r = radius * 1.002 + Math.random() * 0.015;
        dustPos[i * 3]     = r * Math.sin(phi) * Math.sin(theta);
        dustPos[i * 3 + 1] = r * Math.cos(phi);
        dustPos[i * 3 + 2] = r * Math.sin(phi) * Math.cos(theta);
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
        size: 0.08, map: spriteTexture, color: 0x92400e,
        transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
    });
    const dustLayer = new THREE.Points(dustGeo, dustMat);
    arrakisGroup.add(dustLayer);

    // --- LAYER 2: Coriolis Storm Cells ---
    // Each storm: elongated elliptical shape with spiral arm distribution
    const stormClusters = [];
    const stormCount = 4; // Fewer, larger, more convincing storms

    for (let s = 0; s < stormCount; s++) {
        const particleCount = 120; // Fewer particles, larger sprites
        const clusterGeo = new THREE.BufferGeometry();
        const clusterPos = new Float32Array(particleCount * 3);

        // Storm center — scattered across the equatorial belt
        const centerTheta = (s / stormCount) * Math.PI * 2 + Math.random() * 1.2;
        const centerPhi = (Math.PI / 2) + (Math.random() - 0.5) * 0.5;

        for (let i = 0; i < particleCount; i++) {
            // Spiral arm distribution — particles follow logarithmic spiral from center
            const armAngle = (i / particleCount) * Math.PI * 4; // 2 full spiral turns
            const armRadius = (i / particleCount) * 0.25; // Grows outward
            const jitter = gaussRandom() * 0.03; // Organic scatter

            const theta = centerTheta + Math.cos(armAngle) * armRadius + jitter;
            const phi = centerPhi + Math.sin(armAngle) * armRadius * 0.5 + jitter * 0.5;
            const r = radius * 1.004 + Math.random() * 0.04;

            clusterPos[i * 3]     = r * Math.sin(phi) * Math.sin(theta);
            clusterPos[i * 3 + 1] = r * Math.cos(phi);
            clusterPos[i * 3 + 2] = r * Math.sin(phi) * Math.cos(theta);
        }

        clusterGeo.setAttribute('position', new THREE.BufferAttribute(clusterPos, 3));

        // Each storm gets a slightly different warm tone
        const hue = 0.07 + Math.random() * 0.05; // Amber range
        const lightness = 0.5 + Math.random() * 0.15;

        const clusterMat = new THREE.PointsMaterial({
            size: 0.15 + Math.random() * 0.1, // Larger soft blobs
            map: spriteTexture,
            color: new THREE.Color().setHSL(hue, 0.7, lightness),
            transparent: true,
            opacity: 0.15 + Math.random() * 0.1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        const cluster = new THREE.Points(clusterGeo, clusterMat);
        cluster.userData = {
            rotSpeed: (0.0002 + Math.random() * 0.0003) * (Math.random() > 0.5 ? 1 : -1),
            wobbleSpeed: 0.15 + Math.random() * 0.2,
            wobbleAmp: 0.0005 + Math.random() * 0.001,
        };
        arrakisGroup.add(cluster);
        stormClusters.push(cluster);
    }

    // --- LAYER 3: High-Altitude Wisp Streaks ---
    // Very sparse, large, faint — cirrus-like dust veils
    const wispCount = 200;
    const wispGeo = new THREE.BufferGeometry();
    const wispPos = new Float32Array(wispCount * 3);
    for (let i = 0; i < wispCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.PI / 2) + gaussRandom() * 0.7;
        const r = radius * 1.03 + Math.random() * 0.08;
        wispPos[i * 3]     = r * Math.sin(phi) * Math.sin(theta);
        wispPos[i * 3 + 1] = r * Math.cos(phi);
        wispPos[i * 3 + 2] = r * Math.sin(phi) * Math.cos(theta);
    }
    wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
    const wispMat = new THREE.PointsMaterial({
        size: 0.25, map: spriteTexture, color: 0xfcd34d,
        transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
    });
    const wispLayer = new THREE.Points(wispGeo, wispMat);
    arrakisGroup.add(wispLayer);

    sandstormSystem = { dustLayer, stormClusters, wispLayer };
}

// ==========================================
// MOONS
// ==========================================
function createMoons() {
    if (!DATA.moons) return;
    DATA.moons.forEach(moonData => {
        const moonGeo = new THREE.SphereGeometry(moonData.size * 2, 32, 32); 
        const moonMat = new THREE.MeshStandardMaterial({ 
            color: moonData.color || 0xcccccc, roughness: 0.8, metalness: 0.1
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.castShadow = true; 
        moonMesh.receiveShadow = true;
        moonMesh.userData = { distance: moonData.orbitRadius * 15, speed: moonData.speed };
        scene.add(moonMesh);
        moons.push(moonMesh);
    });
}

// ==========================================
// HTML UI OVERLAY
// ==========================================
function buildUIOverlay() {
    let uiContainer = document.getElementById('arrakis-3d-ui');
    if (!uiContainer) {
        uiContainer = document.createElement('div');
        uiContainer.id = 'arrakis-3d-ui';
        uiContainer.className = 'absolute inset-0 pointer-events-none z-[30] opacity-0 transition-opacity duration-500';
        document.getElementById('canvas-container').appendChild(uiContainer);
    }
    uiContainer.innerHTML = `
        <canvas id="tether-canvas" class="absolute inset-0 pointer-events-none"></canvas>
        <div id="arrakis-3d-tooltip" class="absolute hidden bg-black/95 border border-amber-500/50 p-3 rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.8)] text-xs z-50 transform -translate-x-1/2 -translate-y-[calc(100%+15px)] pointer-events-none backdrop-blur-md min-w-[140px]">
            <div id="a3d-tt-title" class="text-amber-500 font-bold uppercase tracking-wide text-sm mb-0.5"></div>
            <div id="a3d-tt-type" class="text-zinc-400 mono text-[9px] uppercase tracking-widest"></div>
        </div>
        <div id="arrakis-3d-labels" class="absolute inset-0"></div>
    `;
    const tCanvas = document.getElementById('tether-canvas');
    tCanvas.width = window.innerWidth;
    tCanvas.height = window.innerHeight;
    tetherCtx = tCanvas.getContext('2d');
}

// ==========================================
// INTERACTIVE LANDMARKS
// ==========================================
function populateLandmarks(radius) {
    const labelsContainer = document.getElementById('arrakis-3d-labels');

    DATA.locations.forEach(loc => {
        const phi = loc.y * Math.PI; 
        const theta = loc.x * Math.PI * 2; 
        const r = radius * 1.01; 
        const py = r * Math.cos(phi);
        const px = r * Math.sin(phi) * Math.sin(theta);
        const pz = r * Math.sin(phi) * Math.cos(theta);

        const isMajor = loc.type === 'city' || loc.type === 'sietch';
        const markerGeo = new THREE.SphereGeometry(isMajor ? 0.08 : 0.04, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: loc.color || 0xffffff });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(px, py, pz);
        
        if (isMajor) {
            const ringGeo = new THREE.RingGeometry(0.1, 0.12, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: loc.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(px, py, pz);
            ring.lookAt(0, 0, 0); 
            arrakisGroup.add(ring);
        }

        const labelEl = document.createElement('div');
        labelEl.className = 'absolute text-[9px] md:text-[10px] font-bold mono uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] transition-opacity duration-100 will-change-transform';
        labelEl.style.color = loc.color || '#ffffff';
        labelEl.innerHTML = `<span class="opacity-80">${loc.icon}</span> ${loc.name}`;
        labelsContainer.appendChild(labelEl);

        marker.userData = { id: loc.id, name: loc.name, faction: loc.faction, type: loc.type, labelEl };
        arrakisGroup.add(marker);
        markers.push(marker);
    });
}

// ==========================================
// INTERACTION HANDLERS
// ==========================================
function onPointerMove(event) {
    if (!is3DActive) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers);
    const tooltip = document.getElementById('arrakis-3d-tooltip');

    if (intersects.length > 0) {
        const hit = intersects[0].object.userData;
        if (tooltip.getAttribute('data-current') !== hit.id) {
            document.body.style.cursor = 'pointer';
            document.getElementById('a3d-tt-title').innerText = hit.name;
            document.getElementById('a3d-tt-title').style.color = intersects[0].object.material.color.getStyle();
            document.getElementById('a3d-tt-type').innerText = `${hit.faction} • ${hit.type}`;
            tooltip.setAttribute('data-current', hit.id);
            tooltip.classList.remove('hidden');
        }
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
    } else {
        document.body.style.cursor = 'grab';
        tooltip.classList.add('hidden');
        tooltip.removeAttribute('data-current');
    }
}

function onPointerDown(event) {
    if (!is3DActive) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers);
    if (intersects.length > 0) {
        const hitMarker = intersects[0].object;
        if (window.selectItem3D) {
            window.selectItem3D(hitMarker.userData.id);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const tCanvas = document.getElementById('tether-canvas');
    if (tCanvas) {
        tCanvas.width = window.innerWidth;
        tCanvas.height = window.innerHeight;
    }
}

function onEnter3D() {
    camera.position.set(0, 0, 18); 
    controls.target.set(0, 0, 0);
    controls.update();
}

// ==========================================
// RENDER LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    if (!is3DActive) return;

    controls.update();
    
    if (AppState.isPlaying) {
        arrakisGroup.rotation.y += 0.001 * AppState.timeRate;
        
        if (sandstormSystem) {
            const time = performance.now() * 0.001;
            sandstormSystem.dustLayer.rotation.y -= 0.0005 * AppState.timeRate;
            sandstormSystem.stormClusters.forEach(cluster => {
                const ud = cluster.userData;
                cluster.rotation.y += ud.rotSpeed * AppState.timeRate;
                cluster.rotation.x = Math.sin(time * ud.wobbleSpeed) * ud.wobbleAmp;
                cluster.rotation.z = Math.cos(time * ud.wobbleSpeed * 0.7) * ud.wobbleAmp * 0.5;
            });
            sandstormSystem.wispLayer.rotation.y -= 0.001 * AppState.timeRate;
            sandstormSystem.wispLayer.material.opacity = 0.05 + Math.sin(time * 0.5) * 0.03;
        }
    }

    moons.forEach(m => {
        const angle = (AppState.imperialYear * m.userData.speed * 0.1) % (Math.PI * 2);
        m.position.x = Math.cos(angle) * m.userData.distance;
        m.position.z = Math.sin(angle) * m.userData.distance;
    });

    // Reset tether canvas
    if (tetherCtx) {
        tetherCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    const planetDist = camera.position.distanceTo(arrakisGroup.position);
    let focusedMarker = null;

    markers.forEach(m => {
        const el = m.userData.labelEl;
        if (AppState.focusedObject && m.userData.id === AppState.focusedObject.id) {
            focusedMarker = m;
        }

        if (!AppState.toggles.labels) {
            el.style.opacity = '0';
            return;
        }

        tempV.setFromMatrixPosition(m.matrixWorld);
        const dist = camera.position.distanceTo(tempV);
        tempV.project(camera);
        
        if (dist > planetDist || tempV.z > 1 || tempV.z < -1) {
            el.style.opacity = '0';
        } else {
            const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
            const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;
            el.style.opacity = '1';
            el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px)`;
        }
    });
    
    // Neon Tether from focused landmark to info panel
    if (focusedMarker && tetherCtx && AppState.focusedObjectType === 'location') {
        const infoPanel = document.getElementById('info-panel');
        if (infoPanel && infoPanel.style.display !== 'none') {
            tempV.setFromMatrixPosition(focusedMarker.matrixWorld);
            const dist = camera.position.distanceTo(tempV);
            
            if (dist <= planetDist) {
                tempV.project(camera);
                const startX = (tempV.x * 0.5 + 0.5) * window.innerWidth;
                const startY = (tempV.y * -0.5 + 0.5) * window.innerHeight;
                const panelRect = infoPanel.getBoundingClientRect();
                const endX = panelRect.left + 20;
                const endY = panelRect.top + 45;
                const color = focusedMarker.material.color.getStyle();
                const now = Date.now();
                
                tetherCtx.save();
                tetherCtx.strokeStyle = color;
                tetherCtx.lineWidth = 1.5;
                tetherCtx.shadowColor = color;
                tetherCtx.shadowBlur = 12;
                tetherCtx.setLineDash([6, 6]);
                tetherCtx.lineDashOffset = -(now / 40) % 100;
                
                const cpOffset = Math.abs(endX - startX) * 0.5;
                tetherCtx.beginPath();
                tetherCtx.moveTo(startX, startY);
                tetherCtx.bezierCurveTo(
                    startX + (startX < endX ? cpOffset : -cpOffset), startY,
                    endX - (startX < endX ? cpOffset : -cpOffset), endY,
                    endX, endY
                );
                tetherCtx.stroke();
                tetherCtx.setLineDash([]);
                
                tetherCtx.fillStyle = color;
                tetherCtx.beginPath(); tetherCtx.arc(startX, startY, 3, 0, Math.PI * 2); tetherCtx.fill();
                tetherCtx.beginPath(); tetherCtx.arc(endX, endY, 3, 0, Math.PI * 2); tetherCtx.fill();
                tetherCtx.restore();
            }
        }
    }
    
    renderer.render(scene, camera);
}

// ==========================================
// 3D TRANSITION
// ==========================================
export function transitionTo3D(active) {
    if (is3DActive === active) return;
    is3DActive = active;
    
    const canvas3D = document.getElementById('canvas-3d');
    const canvas2D = document.getElementById('canvas');
    const uiLayer = document.getElementById('arrakis-3d-ui');
    
    if (active) {
        canvas3D.classList.remove('opacity-0', 'pointer-events-none');
        canvas2D.classList.add('opacity-0');
        canvas2D.style.pointerEvents = 'none'; 
        if (uiLayer) uiLayer.classList.remove('opacity-0');
    } else {
        canvas3D.classList.add('opacity-0', 'pointer-events-none');
        canvas2D.classList.remove('opacity-0');
        canvas2D.style.pointerEvents = 'auto'; 
        if (uiLayer) uiLayer.classList.add('opacity-0');
        if (tetherCtx) tetherCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
}
