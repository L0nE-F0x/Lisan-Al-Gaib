import { AppState } from '../core/state.js';
import { DATA } from '../data/arrakis-lore.js';
import { getSphericalCoords, getCharacterLocation, getFadeOpacity, getFadeOutOpacity } from './utils.js';
import { drawMentatHUD } from './effects.js';

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

export function drawRegionsAndLocations(ctx, r, sunAngle, timeOffset, camX, camY) {
    const systemToPlanetFade = getFadeOpacity(AppState.currentScale, 0.35, 0.6);
    if (systemToPlanetFade <= 0) return;

    if (AppState.toggles.mentatVision) {
        ctx.save(); ctx.globalAlpha = systemToPlanetFade; ctx.globalCompositeOperation = 'screen';
        DATA.locations.forEach(loc => {
            const lp = getSphericalCoords(loc.x, loc.y, r * 0.95, AppState.planetRotation);
            if (lp.z < -r * 0.1) return;
            let heatColor = 'rgba(0,0,0,0)';
            if (loc.type === 'sietch') heatColor = 'rgba(59, 130, 246, 0.4)'; 
            if (loc.type === 'resource') heatColor = 'rgba(245, 158, 11, 0.5)'; 
            if (loc.type === 'city') heatColor = 'rgba(239, 68, 68, 0.3)'; 
            const hGrad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, r * 0.3);
            hGrad.addColorStop(0, heatColor); hGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = hGrad; ctx.beginPath(); ctx.arc(lp.x, lp.y, r * 0.3, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore();
    }

    const regionFadeIn = getFadeOpacity(AppState.currentScale, 1.5, 3.0);
    // Smoothly fade out the 2D elements before the 3D transition at 7.5
    const transitionTo3DFade = getFadeOutOpacity(AppState.currentScale, 5.5, 7.5);
    const masterRegionAlpha = regionFadeIn * transitionTo3DFade * systemToPlanetFade;

    if (masterRegionAlpha > 0) {
        DATA.regions.forEach(region => {
            const rp = getSphericalCoords(region.x, region.y, r * 0.95, AppState.planetRotation);
            
            // Horizon Fade for Regions
            const distanceFromCenter = Math.sqrt(rp.x*rp.x + rp.y*rp.y);
            const edgeRatio = Math.max(0, 1 - (distanceFromCenter / r));
            const horizonAlpha = Math.min(1, edgeRatio * 2.5);

            if (rp.z > -r * 0.05 && horizonAlpha > 0.01) {
                const rx = rp.x, ry = rp.y, s = r * 0.15; 
                ctx.strokeStyle = region.color; 
                ctx.globalAlpha = masterRegionAlpha * horizonAlpha * 0.6; 
                ctx.lineWidth = 2 / AppState.currentScale;
                
                ctx.beginPath(); ctx.moveTo(rx - s, ry - s + s/2.5); ctx.lineTo(rx - s, ry - s); ctx.lineTo(rx - s + s/2.5, ry - s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rx + s - s/2.5, ry - s); ctx.lineTo(rx + s, ry - s); ctx.lineTo(rx + s, ry - s + s/2.5); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rx + s, ry + s - s/2.5); ctx.lineTo(rx + s, ry + s); ctx.lineTo(rx + s - s/2.5, ry + s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rx - s + s/2.5, ry + s); ctx.lineTo(rx - s, ry + s); ctx.lineTo(rx - s, ry + s - s/2.5); ctx.stroke();
                
                ctx.globalAlpha = masterRegionAlpha * horizonAlpha; 
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; 
                ctx.font = `600 ${10 / AppState.currentScale}px 'JetBrains Mono'`; 
                ctx.textAlign = 'center';
                ctx.fillText(region.name.toUpperCase(), rx, ry + (4 / AppState.currentScale));
            }
        });
    }

    DATA.locations.forEach(loc => {
        const lp = getSphericalCoords(loc.x, loc.y, r * 0.95, AppState.planetRotation);
        
        // 1. Strict Hemisphere Culling
        if (lp.z < -r * 0.05) return; 

        // 2. Horizon Fade (Softens the harsh bunching at the edges)
        const distanceFromCenter = Math.sqrt(lp.x*lp.x + lp.y*lp.y);
        const edgeRatio = Math.max(0, 1 - (distanceFromCenter / r));
        const horizonAlpha = Math.min(1, edgeRatio * 3.0); // Starts fading in the outer 33% of the sphere

        const lx = lp.x, ly = lp.y;
        const dot = (lp.x * Math.cos(sunAngle)) + (lp.y * Math.sin(sunAngle));
        const isNight = dot < -0.1 * r;

        // 3. Zoom-Based LOD (Level of Detail)
        const isMajorCity = loc.type === 'city' || loc.type === 'sietch';
        let lodAlpha = 1;
        if (!isMajorCity) {
            // Fade in minor locations only when zoomed in past 2.5
            lodAlpha = getFadeOpacity(AppState.currentScale, 2.5, 4.0);
        }

        const dotFade = transitionTo3DFade * systemToPlanetFade * horizonAlpha * lodAlpha;

        if (dotFade > 0.01) {
            ctx.save(); ctx.globalAlpha = dotFade;

            // Faction-Colored Light Spills at Night
            if (isNight && (loc.type === 'city' || loc.type === 'installation')) {
                const spillColor = loc.color ? hexToRgb(loc.color) : '245, 158, 11';
                
                ctx.globalCompositeOperation = 'screen';
                const spillGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 4 / AppState.currentScale);
                spillGrad.addColorStop(0, `rgba(${spillColor}, 0.8)`);
                spillGrad.addColorStop(1, `rgba(${spillColor}, 0)`);
                ctx.fillStyle = spillGrad;
                ctx.beginPath(); ctx.arc(lx, ly, 4 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
                ctx.globalCompositeOperation = 'source-over';

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; 
                ctx.beginPath(); ctx.arc(lx, ly, 0.8 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
                
                let seed = loc.name.length;
                for(let i=1; i<=6; i++) {
                    let cx = lx + Math.sin(seed * i) * ((i+2) / AppState.currentScale);
                    let cy = ly + Math.cos(seed * i * 2) * ((i+2) / AppState.currentScale);
                    ctx.globalAlpha = dotFade * (0.4 + Math.random() * 0.4);
                    ctx.fillStyle = `rgba(${spillColor}, 0.9)`;
                    ctx.beginPath(); ctx.arc(cx, cy, 0.5 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = dotFade;
            } else {
                ctx.strokeStyle = loc.color; ctx.lineWidth = 1 / AppState.currentScale;
                ctx.beginPath(); ctx.arc(lx, ly, (4 + Math.sin(timeOffset * 5) * 2) / AppState.currentScale, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = loc.color; ctx.beginPath(); ctx.arc(lx, ly, 2 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
            }

            // 4. Smart Label Offsetting
            const showDetails = AppState.currentScale > 1.8;
            if (isMajorCity || showDetails) {
                const txt = `${loc.icon} ${loc.name}`; 
                ctx.font = `500 ${14 / AppState.currentScale}px 'Rajdhani'`; 
                const tWidth = ctx.measureText(txt).width;
                
                const paddingX = 8 / AppState.currentScale;
                const paddingY = 3 / AppState.currentScale;
                const boxHeight = 16 / AppState.currentScale;
                const boxY = ly - (10 / AppState.currentScale);

                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                
                // Fan text outward away from the center of the globe
                if (lx < 0) {
                    ctx.textAlign = 'right';
                    ctx.fillRect(lx - tWidth - paddingX - (2/AppState.currentScale), boxY, tWidth + (4/AppState.currentScale), boxHeight);
                    ctx.fillStyle = loc.color; 
                    ctx.fillText(txt, lx - paddingX, ly + paddingY);
                } else {
                    ctx.textAlign = 'left';
                    ctx.fillRect(lx + paddingX - (2/AppState.currentScale), boxY, tWidth + (4/AppState.currentScale), boxHeight);
                    ctx.fillStyle = loc.color; 
                    ctx.fillText(txt, lx + paddingX, ly + paddingY);
                }
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(lx, ly, 1 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        if (AppState.focusedObject && AppState.focusedObject.id === loc.id && AppState.focusedObjectType === 'location') {
            ctx.save(); ctx.translate(lx, ly);
            drawMentatHUD(ctx, loc.name, 12); ctx.restore();
        }
    });

    if (AppState.focusedObject && AppState.focusedObjectType === 'character') {
        const charLoc = getCharacterLocation(AppState.focusedObject, AppState.imperialYear);
        if (charLoc) {
            const lp = getSphericalCoords(charLoc.x, charLoc.y, r * 0.95, AppState.planetRotation);
            if (lp.z > -r * 0.1) {
                ctx.save(); ctx.translate(lp.x, lp.y);
                const pulseR = 3 / AppState.currentScale + (Math.sin(timeOffset * 4) + 1) * (4 / AppState.currentScale);
                ctx.strokeStyle = AppState.focusedObject.color; ctx.lineWidth = 1.5 / AppState.currentScale;
                ctx.beginPath(); ctx.arc(0, 0, pulseR, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = AppState.focusedObject.color; ctx.beginPath(); ctx.arc(0, 0, 2 / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
                drawMentatHUD(ctx, `TRK_${AppState.focusedObject.name.split(' ')[0]}`, 18, AppState.focusedObject.color); ctx.restore();
            }
        }
    }
}
