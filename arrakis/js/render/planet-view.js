import { AppState } from '../core/state.js';
import { DATA } from '../data/arrakis-lore.js';
import { getSphericalCoords } from './utils.js';

const arrakisTexture = document.createElement('canvas');
arrakisTexture.width = 1024;
arrakisTexture.height = 512;
const tCtx = arrakisTexture.getContext('2d');
tCtx.fillStyle = '#b45309';
tCtx.fillRect(0, 0, 1024, 512);
for(let i=0; i<30000; i++) {
    tCtx.fillStyle = Math.random() > 0.5 ? 'rgba(217, 119, 6, 0.08)' : 'rgba(120, 53, 15, 0.12)';
    const w = Math.random() * 20;
    const h = Math.random() * 4;
    tCtx.fillRect(Math.random() * 1024, Math.random() * 512, w, h);
}

const storms = Array.from({length: 5}, (_, i) => ({
    id: i, lon: Math.random(), lat: 0.2 + Math.random() * 0.6, speedLon: (Math.random() - 0.5) * 0.005, speedLat: (Math.random() - 0.5) * 0.005, size: 0.15 + Math.random() * 0.25, lightningFlash: 0
}));
const spiceBlows = [];
const worms = [];

export function drawPlanetSurface(ctx, body, r, sunAngle, timeOffset, moons) {
    let terraformProgress = 0;
    if (AppState.imperialYear > 10220 && AppState.imperialYear <= 15220) terraformProgress = Math.min(1, (AppState.imperialYear - 10220) / 1000);
    else if (AppState.imperialYear > 15220) terraformProgress = Math.max(0, 1 - (AppState.imperialYear - 15220) / 200); 

    drawAtmosphere(ctx, r, sunAngle);

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    
    if (AppState.currentScale > 0.2) {
        const texOffset = ((AppState.planetRotation / (Math.PI * 2)) % 1) * (r * 2);
        let shift = texOffset > 0 ? texOffset - (r*2) : texOffset;
        
        ctx.drawImage(arrakisTexture, -r + shift, -r, r * 2, r * 2);
        ctx.drawImage(arrakisTexture, -r + shift + (r*2), -r, r * 2, r * 2);
        ctx.drawImage(arrakisTexture, -r + shift + (r*4), -r, r * 2, r * 2); 

        if (terraformProgress > 0) drawTerraformingZones(ctx, r, terraformProgress);
        if (AppState.toggles.territories) drawTerritories(ctx, r);
        if (AppState.toggles.mentatVision) { ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; ctx.fillRect(-r, -r, r * 2, r * 2); }
    } else {
        ctx.fillStyle = body.color; ctx.fill();
    }

    if (AppState.zoomLevel !== 'system') drawEcology(ctx, r, terraformProgress, sunAngle);
    if (AppState.zoomLevel !== 'system' && AppState.toggles.atmosphere && !AppState.toggles.mentatVision) drawStorms(ctx, r, timeOffset);
    if (AppState.toggles.moons) drawMoonShadows(ctx, r, sunAngle, moons);

    drawTerminator(ctx, r, sunAngle, moons); // Phase 2.4: Moon reflection injected here

    if (AppState.zoomLevel !== 'system' && AppState.toggles.atmosphere && !AppState.toggles.mentatVision) drawLightning(ctx, r, timeOffset);
    
    ctx.restore(); 
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

function drawTerritories(ctx, r) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    DATA.locations.forEach(loc => {
        if (loc.faction === 'None' || !loc.color) return;
        const lp = getSphericalCoords(loc.x, loc.y, r * 0.98, AppState.planetRotation);
        if (lp.z < -r * 0.1) return; 
        const influenceRadius = r * 0.35;
        const rgb = hexToRgb(loc.color);
        const tGrad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, influenceRadius);
        tGrad.addColorStop(0, `rgba(${rgb}, 0.65)`);
        tGrad.addColorStop(0.5, `rgba(${rgb}, 0.25)`);
        tGrad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = tGrad;
        ctx.beginPath(); ctx.arc(lp.x, lp.y, influenceRadius, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
}

function drawTerraformingZones(ctx, r, progress) {
    const terrGrad = ctx.createLinearGradient(0, -r, 0, r);
    const spread = progress * 0.45; 
    const green = `rgba(21, 128, 61, ${Math.min(0.85, progress)})`;
    const blue = `rgba(14, 165, 233, ${Math.min(0.5, progress)})`; 
    const transition = `rgba(132, 204, 22, ${Math.min(0.65, progress)})`; 
    const desert = 'rgba(0,0,0,0)'; 
    terrGrad.addColorStop(0, blue);
    terrGrad.addColorStop(Math.max(0.01, spread * 0.4), green);
    terrGrad.addColorStop(Math.max(0.02, spread), transition);
    terrGrad.addColorStop(Math.max(0.03, spread + 0.05), desert);
    terrGrad.addColorStop(0.5, desert); 
    terrGrad.addColorStop(Math.min(0.97, 1 - (spread + 0.05)), desert);
    terrGrad.addColorStop(Math.min(0.98, 1 - spread), transition);
    terrGrad.addColorStop(Math.min(0.99, 1 - (spread * 0.4)), green);
    terrGrad.addColorStop(1, blue);
    ctx.fillStyle = terrGrad; ctx.fillRect(-r, -r, r * 2, r * 2);
}

function drawAtmosphere(ctx, r, sunAngle) {
    ctx.save(); ctx.rotate(sunAngle); 
    const outerGrad = ctx.createRadialGradient(r * 0.1, 0, r * 0.7, 0, 0, r * 1.5);
    outerGrad.addColorStop(0, 'rgba(252, 211, 77, 0)');      
    outerGrad.addColorStop(0.75, 'rgba(252, 211, 77, 0.15)'); 
    outerGrad.addColorStop(0.88, 'rgba(245, 158, 11, 0.7)');  
    outerGrad.addColorStop(0.95, 'rgba(30, 58, 138, 0.35)');  
    outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');            
    ctx.fillStyle = outerGrad;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawTerminator(ctx, r, sunAngle, moons) {
    ctx.save(); ctx.rotate(sunAngle); 
    const twilightGrad = ctx.createLinearGradient(r * 0.2, 0, -r * 0.6, 0);
    twilightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');            
    twilightGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.5)');     
    twilightGrad.addColorStop(0.7, 'rgba(5, 5, 10, 0.9)');       
    twilightGrad.addColorStop(1, 'rgba(2, 2, 5, 0.98)');         
    ctx.fillStyle = twilightGrad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = 'rgba(2, 2, 5, 0.9)';
    ctx.beginPath(); ctx.arc(0, 0, r + 2, Math.PI / 2, Math.PI * 1.5); 
    ctx.ellipse(0, 0, r * 0.25, r + 2, 0, Math.PI * 1.5, Math.PI / 2, true); ctx.fill();

    // Phase 2.4: Moon Night-Side Illumination
    if (AppState.toggles.moons && moons) {
        moons.forEach(moon => {
            const mAngle = (AppState.imperialYear * moon.speed) % (Math.PI * 2);
            let relAngle = mAngle - sunAngle;
            // If moon is generally on the night side
            if (Math.cos(relAngle) < 0) {
                ctx.save();
                ctx.rotate(relAngle);
                const moonGlow = ctx.createRadialGradient(r*0.8, 0, 0, r*0.8, 0, r*0.6);
                moonGlow.addColorStop(0, 'rgba(226, 232, 240, 0.15)'); // Silvery glow
                moonGlow.addColorStop(1, 'rgba(226, 232, 240, 0)');
                ctx.fillStyle = moonGlow;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        });
    }

    const specularGrad = ctx.createRadialGradient(r * 0.8, 0, 0, r * 0.8, 0, r * 0.8);
    specularGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    specularGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specularGrad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawEcology(ctx, r, terraformProgress, sunAngle) {
    const desertBoundary = 0.5 - (terraformProgress * 0.45); 

    if (AppState.toggles.spiceParticles && Math.random() < 0.015 && terraformProgress < 0.9) {
        let nLat = 0.2 + Math.random() * 0.6;
        if (Math.abs(nLat - 0.5) <= desertBoundary) {
            spiceBlows.push({ lon: Math.random(), lat: nLat, radius: 0, maxRadius: (4 + Math.random() * 8) / AppState.currentScale, life: 1.0, id: Math.random() });
        }
    }

    for (let i = spiceBlows.length - 1; i >= 0; i--) {
        const blow = spiceBlows[i];
        blow.radius += (blow.maxRadius - blow.radius) * 0.05; 
        blow.life -= 0.003; 
        if (Math.abs(blow.lat - 0.5) > desertBoundary + 0.05) blow.life -= 0.05;

        const sp = getSphericalCoords(blow.lon, blow.lat, r * 0.95, AppState.planetRotation);
        
        if (sp.z > -r * 0.1 && AppState.toggles.spiceParticles && !AppState.toggles.mentatVision) {
            ctx.save(); ctx.translate(sp.x, sp.y);
            
            // Phase 2.4: Orbital Spice Blow Flash on Night Side
            const dot = (sp.x * Math.cos(sunAngle)) + (sp.y * Math.sin(sunAngle));
            const isNight = dot < -0.1 * r;
            
            ctx.globalCompositeOperation = 'screen';
            const bGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, blow.radius * (isNight ? 1.5 : 1));
            bGrad.addColorStop(0, `rgba(255, 180, 50, ${blow.life * (isNight ? 1.0 : 0.9)})`); // Brighter core at night
            bGrad.addColorStop(0.5, `rgba(245, 158, 11, ${blow.life * (isNight ? 0.6 : 0.4)})`);
            bGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
            
            ctx.fillStyle = bGrad;
            ctx.beginPath(); ctx.arc(0, 0, blow.radius * (isNight ? 1.5 : 1), 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            
            ctx.fillStyle = `rgba(255, 215, 0, ${blow.life})`;
            for(let p=0; p<4; p++) {
                const px = (Math.random()-0.5) * blow.radius; const py = (Math.random()-0.5) * blow.radius;
                ctx.beginPath(); ctx.arc(px, py, 0.8/AppState.currentScale, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }

        if (AppState.toggles.wormSign && Math.random() < 0.02 && worms.length < 6 && terraformProgress < 0.9) {
            if (Math.abs(blow.lat - 0.5) <= desertBoundary) {
                worms.push({ lon: blow.lon + (Math.random() - 0.5) * 0.05, lat: blow.lat + (Math.random() - 0.5) * 0.05, targetLon: blow.lon, targetLat: blow.lat, life: 1.0, history: [] });
            }
        }
        if (blow.life <= 0) spiceBlows.splice(i, 1);
    }

    for (let i = worms.length - 1; i >= 0; i--) {
        const worm = worms[i];
        const dLon = worm.targetLon - worm.lon, dLat = worm.targetLat - worm.lat;
        const dist = Math.hypot(dLon, dLat);
        
        if (dist < 0.002 || worm.life <= 0) { worms.splice(i, 1); continue; }
        
        const moveSpeed = Math.min(dist, 0.0005);
        const wAng = Math.atan2(dLat, dLon);
        
        worm.lon += Math.cos(wAng) * moveSpeed; worm.lat += Math.sin(wAng) * moveSpeed;
        worm.life -= 0.002; 
        if (Math.abs(worm.lat - 0.5) > desertBoundary + 0.05) worm.life -= 0.1;
        worm.history.unshift({lon: worm.lon, lat: worm.lat});
        if (worm.history.length > 12) worm.history.pop();
        
        const wp = getSphericalCoords(worm.lon, worm.lat, r * 0.95, AppState.planetRotation);
        if (wp.z > -r * 0.1 && AppState.toggles.wormSign && worm.history.length > 1 && !AppState.toggles.mentatVision) {
            ctx.save();
            ctx.strokeStyle = `rgba(217, 119, 6, ${worm.life * 0.7})`; ctx.lineWidth = 1.2 / AppState.currentScale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            for(let h=0; h<worm.history.length; h++) {
                const pt = worm.history[h]; const hp = getSphericalCoords(pt.lon, pt.lat, r * 0.95, AppState.planetRotation);
                const wakeWidth = (h * 0.6) / AppState.currentScale;
                const px = hp.x + Math.cos(wAng + Math.PI/2) * wakeWidth, py = hp.y + Math.sin(wAng + Math.PI/2) * wakeWidth;
                if(h===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            
            ctx.beginPath();
            for(let h=0; h<worm.history.length; h++) {
                const pt = worm.history[h]; const hp = getSphericalCoords(pt.lon, pt.lat, r * 0.95, AppState.planetRotation);
                const wakeWidth = (h * 0.6) / AppState.currentScale;
                const px = hp.x + Math.cos(wAng - Math.PI/2) * wakeWidth, py = hp.y + Math.sin(wAng - Math.PI/2) * wakeWidth;
                if(h===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            
            ctx.fillStyle = `rgba(245, 158, 11, ${worm.life})`;
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 1.5 / AppState.currentScale, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }
}

function drawStorms(ctx, r, timeOffset) {
    storms.forEach(storm => {
        // BUG FIX: Used delta step instead of absolute timeOffset (was causing infinite acceleration)
        storm.lon = (storm.lon + storm.speedLon * 0.016) % 1;
        if (storm.lon < 0) storm.lon += 1; 
        storm.lat = Math.max(0.1, Math.min(0.9, storm.lat + storm.speedLat * 0.016));
        
        const sp = getSphericalCoords(storm.lon, storm.lat, r * 1.05, AppState.planetRotation);
        storm.lx = sp.x; storm.ly = sp.y; 
        
        if (sp.z > -r * 0.2) {
            const sr = storm.size * r;
            ctx.save(); ctx.translate(sp.x, sp.y);
            ctx.rotate(timeOffset * 0.5 * (storm.id % 2 === 0 ? 1 : -1)); 
            const stGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
            stGrad.addColorStop(0, 'rgba(217, 119, 6, 0.8)');
            stGrad.addColorStop(0.4, 'rgba(180, 83, 9, 0.5)');
            stGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = stGrad; ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)'; ctx.lineWidth = sr * 0.08; ctx.lineCap = 'round';
            for (let arm = 0; arm < 4; arm++) {
                ctx.save(); ctx.rotate((Math.PI * 2 / 4) * arm + (timeOffset * 0.2)); ctx.beginPath();
                for (let i = 0; i < 25; i++) {
                    const angle = i * 0.15, rad = (i / 25) * (sr * 0.9), x = Math.cos(angle) * rad, y = Math.sin(angle) * rad;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke(); ctx.restore();
            }
            ctx.restore();
        }
    });
}

function drawMoonShadows(ctx, r, sunAngle, moons) {
    moons.forEach(moon => {
        const mAngle = (AppState.imperialYear * moon.speed) % (Math.PI * 2);
        let mDiff = mAngle - sunAngle; mDiff = Math.atan2(Math.sin(mDiff), Math.cos(mDiff)); 
        if (Math.abs(mDiff) < 0.35) {
            const perpAngle = sunAngle + Math.PI/2, shadowOffset = (mDiff / 0.35) * r, sx = Math.cos(perpAngle) * shadowOffset, sy = Math.sin(perpAngle) * shadowOffset;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.shadowColor = 'rgba(0, 0, 0, 1)'; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(sx, sy, moon.size * 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
    });
}

function drawLightning(ctx, r, timeOffset) {
    storms.forEach(storm => {
        const sp = getSphericalCoords(storm.lon, storm.lat, r * 1.05, AppState.planetRotation);
        if (sp.z > -r * 0.2) {
            if (Math.random() > 0.98 && storm.lightningFlash <= 0) storm.lightningFlash = 1.0; 
            if (storm.lightningFlash > 0) {
                ctx.save(); ctx.translate(storm.lx, storm.ly); const sr = storm.size * r;
                ctx.strokeStyle = `rgba(255, 255, 255, ${storm.lightningFlash})`; ctx.lineWidth = 1.5 / AppState.currentScale; ctx.shadowColor = 'rgba(224, 242, 254, 1)'; ctx.shadowBlur = 15 / AppState.currentScale;
                ctx.beginPath(); let jx = (Math.random() - 0.5) * sr * 0.5, jy = (Math.random() - 0.5) * sr * 0.5; ctx.moveTo(jx, jy);
                for(let j = 0; j < 5; j++) { jx += (Math.random() - 0.5) * sr * 0.6; jy += (Math.random() - 0.5) * sr * 0.6; ctx.lineTo(jx, jy); }
                ctx.stroke(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(224, 242, 254, ${storm.lightningFlash * 0.3})`;
                ctx.beginPath(); ctx.arc(0, 0, sr * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                storm.lightningFlash -= 0.1; 
            }
        }
    });
}

export function drawMoonsInOrbit(ctx, r, sunAngle, moons) {
    if (!AppState.toggles.moons) return;
    moons.forEach(moon => {
        const moonAngle = (AppState.imperialYear * moon.speed) % (Math.PI * 2), mx = Math.cos(moonAngle) * moon.orbitRadius, my = Math.sin(moonAngle) * moon.orbitRadius;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 / AppState.currentScale;
        ctx.beginPath(); ctx.arc(0, 0, moon.orbitRadius, 0, Math.PI * 2); ctx.stroke();
        const mGrad = ctx.createRadialGradient(mx - moon.size*0.3, my - moon.size*0.3, 0, mx, my, moon.size);
        mGrad.addColorStop(0, '#ffffff'); mGrad.addColorStop(0.4, moon.color); mGrad.addColorStop(1, '#000000');
        ctx.fillStyle = mGrad; ctx.beginPath(); ctx.arc(mx, my, moon.size, 0, Math.PI * 2); ctx.fill();
    });
}
