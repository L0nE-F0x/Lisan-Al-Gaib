import { AppState, emit } from '../core/state.js';
import { DATA, CONFIG } from '../data/arrakis-lore.js';
import { getSphericalCoords, getCharacterLocation } from './utils.js';
import { drawMentatHUD, drawScanlines } from './effects.js';
import { initStars, drawStars, drawCentralStar, drawAsteroidBelt } from './system-view.js';
import { drawPlanetSurface, drawMoonsInOrbit } from './planet-view.js';
import { drawRegionsAndLocations } from './region-view.js';
import { init3D, transitionTo3D } from './planet-3d.js';

export { initStars };

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let is3DInitialized = false;

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = width;
        canvas.height = height;
    }
});

if (canvas.parentElement) {
    resizeObserver.observe(canvas.parentElement);
}

// ==========================================
// UNIFIED RENDER ENGINE (ORCHESTRATOR)
// ==========================================
export function draw() {
    if (!is3DInitialized) {
        init3D();
        is3DInitialized = true;
    }
    
    // Stop rendering the heavy 2D loop if 3D is taking over
    if (AppState.is3DMode) return;

    // FIX: Master Time Control. Time must flow regardless of camera locks!
    if (AppState.isPlaying) {
        AppState.planetRotation -= (AppState.timeRate / 60.0) * 0.01;
        AppState.imperialYear += (AppState.timeRate / 60.0) * 0.05; 
        emit('year-changed', AppState.imperialYear);
    }

    if (AppState.isCameraLocked && AppState.focusedObject && AppState.focusedObjectType) {
        const item = AppState.focusedObject;
        const type = AppState.focusedObjectType;
        let objX = 0, objY = 0;

        let trackingLoc = null;
        if (type === 'location') trackingLoc = item;
        else if (type === 'character') trackingLoc = getCharacterLocation(item, AppState.imperialYear);

        if (trackingLoc) {
            let targetRot = -(trackingLoc.x - 0.5) * Math.PI * 2;
            let diff = targetRot - AppState.planetRotation;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            AppState.planetRotation += diff * 0.08; 

            const arrakis = DATA.bodies.find(b => b.name === 'Arrakis');
            const orbitBase = arrakis.orbitRadius * CONFIG.orbitScale * 10;
            const angle = (AppState.imperialYear * arrakis.speed * 0.1) % (Math.PI * 2);
            const ax = Math.cos(angle) * orbitBase;
            const ay = Math.sin(angle) * orbitBase;
            
            const lp = getSphericalCoords(trackingLoc.x, trackingLoc.y, arrakis.size * 0.95, AppState.planetRotation);
            objX = ax + lp.x;
            objY = ay + lp.y;
        } 
        else if (type === 'body') {
            const orbitBase = item.orbitRadius * CONFIG.orbitScale * 10;
            const angle = (AppState.imperialYear * item.speed * 0.1) % (Math.PI * 2);
            objX = Math.cos(angle) * orbitBase;
            objY = Math.sin(angle) * orbitBase;
        } 
        else if (type === 'moon') {
            const parent = DATA.bodies.find(b => b.name === 'Arrakis'); 
            const pOrbitBase = parent.orbitRadius * CONFIG.orbitScale * 10;
            const pAngle = (AppState.imperialYear * parent.speed * 0.1) % (Math.PI * 2);
            const px = Math.cos(pAngle) * pOrbitBase;
            const py = Math.sin(pAngle) * pOrbitBase;
            const mAngle = (AppState.imperialYear * item.speed) % (Math.PI * 2);
            objX = px + Math.cos(mAngle) * item.orbitRadius;
            objY = py + Math.sin(mAngle) * item.orbitRadius;
        }

        if (AppState.forceCenterOnNextFrame) {
            let screenOffsetX = window.innerWidth > 768 ? -180 : 0;
            AppState.targetOffsetX = (-objX * AppState.targetScale) + screenOffsetX;
            AppState.targetOffsetY = (-objY * AppState.targetScale);
            AppState.forceCenterOnNextFrame = false;
        } 
        else if (AppState.lastTrackedX !== null && AppState.lastTrackedY !== null && (objX !== 0 || objY !== 0)) {
            const dx = objX - AppState.lastTrackedX;
            const dy = objY - AppState.lastTrackedY;
            AppState.targetOffsetX -= dx * AppState.targetScale;
            AppState.targetOffsetY -= dy * AppState.targetScale;
            AppState.currentOffsetX -= dx * AppState.currentScale;
            AppState.currentOffsetY -= dy * AppState.currentScale;
        }
        
        AppState.lastTrackedX = objX;
        AppState.lastTrackedY = objY;
    } else {
        AppState.lastTrackedX = null;
        AppState.lastTrackedY = null;
        
        AppState.targetOffsetX += AppState.momentumX || 0;
        AppState.targetOffsetY += AppState.momentumY || 0;
        AppState.momentumX *= 0.9;
        AppState.momentumY *= 0.9;
    }

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    AppState.currentScale += (AppState.targetScale - AppState.currentScale) * 0.1;
    AppState.currentOffsetX += (AppState.targetOffsetX - AppState.currentOffsetX) * 0.1;
    AppState.currentOffsetY += (AppState.targetOffsetY - AppState.currentOffsetY) * 0.1;

    if (AppState.scanAnim > 0) {
        AppState.scanAnim -= 0.02;
        if (AppState.scanAnim < 0) AppState.scanAnim = 0;
    }

    if (AppState.currentScale < CONFIG.zoomThresholds.systemToPlanet) AppState.zoomLevel = 'system';
    else if (AppState.currentScale < CONFIG.zoomThresholds.planetToRegion) AppState.zoomLevel = 'planet';
    else AppState.zoomLevel = 'region';

    drawStars(ctx, width, height);

    const scaleDiff = Math.abs(AppState.targetScale - AppState.currentScale);
    let shakeX = 0, shakeY = 0;
    if (scaleDiff > 15.0 && AppState.isCameraLocked) {
        const shakeIntensity = Math.min((scaleDiff - 15.0) * 0.3, 10) / AppState.currentScale;
        shakeX = (Math.random() - 0.5) * shakeIntensity;
        shakeY = (Math.random() - 0.5) * shakeIntensity;
    }

    ctx.save();
    ctx.translate(width / 2 + AppState.currentOffsetX + shakeX, height / 2 + AppState.currentOffsetY + shakeY);
    ctx.scale(AppState.currentScale, AppState.currentScale);

    drawSystemView();

    ctx.restore();
    drawScanlines(ctx, width, height);
}

function drawSystemView() {
    const timeOffset = performance.now() * 0.001;
    drawCentralStar(ctx);
    drawAsteroidBelt(ctx);

    DATA.bodies.forEach(body => {
        const orbitBase = body.orbitRadius * CONFIG.orbitScale * 10;
        if (AppState.toggles.orbits) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.1)';
            ctx.lineWidth = 1 / AppState.currentScale;
            ctx.beginPath(); ctx.arc(0, 0, orbitBase, 0, Math.PI * 2); ctx.stroke();
        }
        const angle = (AppState.imperialYear * body.speed * 0.1) % (Math.PI * 2);
        const x = Math.cos(angle) * orbitBase;
        const y = Math.sin(angle) * orbitBase;
        ctx.save();
        ctx.translate(x, y); 
        const r = body.size;
        const sunAngle = Math.atan2(-y, -x);

        // BUG FIX: Only render Arrakis's full planet detail (surface, regions, locations,
        // storms, ecology) when the camera is actually focused on Arrakis or no specific
        // body is focused. Previously, zooming into ANY planet would trigger Arrakis's
        // surface rendering because the zoom threshold was global, not per-body.
        const isFocusedOnArrakis = !AppState.focusedObject 
            || AppState.focusedObject.name === 'Arrakis' 
            || AppState.focusedObject.name === 'Krelln' 
            || AppState.focusedObject.name === 'Arvon'
            || AppState.focusedObjectType === 'location' 
            || AppState.focusedObjectType === 'character';

        if (body.name === 'Arrakis') {
            if (isFocusedOnArrakis) {
                drawPlanetSurface(ctx, body, r, sunAngle, timeOffset, DATA.moons);
                if (AppState.zoomLevel !== 'system' && !AppState.toggles.mentatVision) {
                    ctx.save(); ctx.rotate(timeOffset * 0.1); ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)'; ctx.lineWidth = 1 / AppState.currentScale;
                    ctx.setLineDash([10 / AppState.currentScale, 20 / AppState.currentScale]); ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.stroke();
                    ctx.rotate(-timeOffset * 0.2); ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'; ctx.setLineDash([40 / AppState.currentScale, 80 / AppState.currentScale]);
                    ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
                }
                const camX = (-AppState.currentOffsetX / AppState.currentScale) - x;
                const camY = (-AppState.currentOffsetY / AppState.currentScale) - y;
                drawRegionsAndLocations(ctx, r, sunAngle, timeOffset, camX, camY);
            } else {
                // When focused on another body, just render Arrakis as a simple colored dot
                ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        }

        if (AppState.focusedObject && AppState.focusedObject.name === body.name) drawMentatHUD(ctx, body.name, body.size * 1.5);
        if (body.name === 'Arrakis' && isFocusedOnArrakis) drawMoonsInOrbit(ctx, r, sunAngle, DATA.moons);

        if (AppState.toggles.labels && AppState.zoomLevel === 'system') {
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `600 ${12 / AppState.currentScale}px 'JetBrains Mono'`;
            ctx.textAlign = 'center'; ctx.fillText(body.name.toUpperCase(), 0, body.size + (20 / AppState.currentScale));
        }
        ctx.restore();
    });
}

// ==========================================
// INTERACTION CONTROLS
// ==========================================
let initialPinchDist = null;
let initialScale = null;
let lastTapTime = 0;
let lastPanX = 0, lastPanY = 0;
let panVelX = 0, panVelY = 0;

canvas.addEventListener('mousedown', startPan);
canvas.addEventListener('mousemove', pan);
window.addEventListener('mouseup', endPan);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (AppState.is3DMode) return; 

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const cx = width / 2, cy = height / 2;
    const worldX = (mouseX - cx - AppState.targetOffsetX) / AppState.targetScale;
    const worldY = (mouseY - cy - AppState.targetOffsetY) / AppState.targetScale;
    
    const zoomSensitivity = 0.0015; 
    const delta = -e.deltaY * zoomSensitivity;
    let newScale = AppState.targetScale * (1 + delta);
    
    // BUG FIX: Only transition to 3D globe when focused on Arrakis or its moons/locations.
    // The 3D view is hardcoded to render Arrakis — entering it while looking at Canopus I
    // would show Arrakis's landmarks on the wrong planet.
    const isArrakisFocus = AppState.focusedObject && (
        AppState.focusedObject.name === 'Arrakis' ||
        AppState.focusedObject.name === 'Krelln' ||
        AppState.focusedObject.name === 'Arvon' ||
        AppState.focusedObjectType === 'location' ||
        AppState.focusedObjectType === 'character'
    );

    if (newScale >= 7.5) {
        if (isArrakisFocus) {
            AppState.is3DMode = true;
            transitionTo3D(true);
            window.dispatchEvent(new CustomEvent('enter-3d'));
            return;
        } else {
            // Not Arrakis — clamp zoom at max, don't enter 3D
            newScale = CONFIG.zoomLevels.region.max;
        }
    }

    newScale = Math.max(CONFIG.zoomLevels.system.min, Math.min(newScale, CONFIG.zoomLevels.region.max));
    
    AppState.targetOffsetX = mouseX - cx - (worldX * newScale);
    AppState.targetOffsetY = mouseY - cy - (worldY * newScale);
    AppState.targetScale = newScale;

    if (delta > 0 && newScale > CONFIG.zoomThresholds.systemToPlanet && !AppState.isCameraLocked) {
        let hitBody = DATA.bodies.find(body => {
            const orbitBase = body.orbitRadius * CONFIG.orbitScale * 10;
            const angle = (AppState.imperialYear * body.speed * 0.1) % (Math.PI * 2);
            return Math.hypot(worldX - (Math.cos(angle) * orbitBase), worldY - (Math.sin(angle) * orbitBase)) < body.size * 4;
        });
        if (hitBody) {
            AppState.focusedObject = hitBody; AppState.focusedObjectType = 'body';
            AppState.isCameraLocked = true; AppState.forceCenterOnNextFrame = false; 
        }
    }
    if (delta < 0 && newScale <= CONFIG.zoomThresholds.systemToPlanet) AppState.isCameraLocked = false;
}, {passive: false});

window.addEventListener('exit-3d', () => {
    AppState.is3DMode = false;
    AppState.targetScale = 6.0; 
    AppState.currentScale = 6.0;
    transitionTo3D(false);
});

function startPan(e) {
    if (AppState.is3DMode) return;
    AppState.isPanning = true;
    AppState.prevPanX = e.clientX; AppState.prevPanY = e.clientY;
    lastPanX = e.clientX; lastPanY = e.clientY;
    panVelX = 0; panVelY = 0;
    AppState.dragDist = 0; 
    AppState.momentumX = 0; AppState.momentumY = 0;
}

function pan(e) {
    if (!AppState.isPanning || AppState.is3DMode) return;
    const dx = e.clientX - AppState.prevPanX;
    const dy = e.clientY - AppState.prevPanY;
    
    panVelX = e.clientX - lastPanX;
    panVelY = e.clientY - lastPanY;
    lastPanX = e.clientX; lastPanY = e.clientY;

    if (!AppState.isCameraLocked && AppState.zoomLevel !== 'system') {
        AppState.planetRotation -= dx * 0.005 / AppState.currentScale;
    }
    
    AppState.targetOffsetX += dx; AppState.targetOffsetY += dy;
    AppState.prevPanX = e.clientX; AppState.prevPanY = e.clientY;
    AppState.dragDist += Math.abs(dx) + Math.abs(dy);
}

function endPan() {
    AppState.isPanning = false;
    if (Math.abs(panVelX) > 2 || Math.abs(panVelY) > 2) {
        AppState.momentumX = panVelX * 1.5;
        AppState.momentumY = panVelY * 1.5;
    }
}
