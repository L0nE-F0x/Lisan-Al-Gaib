import { CONFIG, DATA } from '../data/dune-lore.js';
import { AppState } from '../core/state.js';
import { AudioEngine } from '../core/audio.js';
import { showInfo, closeInfo, updateMentatScanner } from '../ui/interface.js';

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d', { alpha: false });
export let dpr = window.devicePixelRatio || 1;

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const rect = entry.contentRect;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // FIX: ctx.scale() was accumulating on every resize
        if(AppState.currentScale === 0.15 && !AppState.cinematicMode) {
            const offsets = getScreenTargetOffsets();
            AppState.targetOffsetX = offsets.x;
            AppState.currentOffsetX = AppState.targetOffsetX;
        }
    }
});
resizeObserver.observe(document.getElementById('canvas-container'));

// ==========================================
// TACTICAL REPLAY AI ENGINE
// ==========================================

canvas.addEventListener('click', e => {
    if (!AppState.isReplayingBattle || AppState.battleState.ended) return;
    const pos = getMousePos(e);
    
    // Create Massive Shockwave
    AppState.battleState.effects.push({ type: 'orbital_strike', x: pos.x, y: pos.y, radius: 0, maxRadius: 150, life: 1.0 });
    AudioEngine.playUI('event'); 
    
    // Annihilate all units caught in the blast
    AppState.battleEntities.forEach(ent => {
        if (ent.type !== 'particle' && ent.type !== 'projectile' && ent.type !== 'worm') {
            if (Math.hypot(ent.x - pos.x, ent.y - pos.y) < 150) ent.hp -= 200; 
        }
    });
});

function showBattleSummary(goodWon) {
    const ui = document.getElementById('battle-ui');
    if(ui) ui.classList.add('hidden');
    
    const modal = document.getElementById('battle-summary-modal');
    if(!modal) return;
    
    const title = document.getElementById('summary-title');
    if(title) {
        title.textContent = goodWon ? "DECISIVE VICTORY" : "CRITICAL DEFEAT";
        title.style.color = goodWon ? "#34d399" : "#ef4444";
    }
    
    const goodLoss = document.getElementById('summary-good-loss');
    const badLoss = document.getElementById('summary-bad-loss');
    if(goodLoss) goodLoss.textContent = AppState.battleState.goodKills + " Lost";
    if(badLoss) badLoss.textContent = AppState.battleState.badKills + " Destroyed";
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('scale-95', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export function closeBattleSummary() {
    const modal = document.getElementById('battle-summary-modal');
    if(modal) {
        modal.classList.remove('scale-100', 'opacity-100');
        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            closeBattle(); 
        }, 300);
    }
}

export function initBattle(type) {
    AppState.isReplayingBattle = true;
    AppState.battleEntities = [];
    AppState.battleState = { time: 0, phase: 1, goodKills: 0, badKills: 0, effects: [], ended: false };
    
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const ev = AppState.activeEvent;
    
    let goodColor = '#3b82f6'; let badColor = '#ef4444';
    
    if (ev && ev.title.includes("Arrakeen")) {
        goodColor = '#d97706'; badColor = '#9333ea';
        AppState.battleEntities.push({ id: 'paul', type: 'hero', isHero: true, name: "Muad'Dib", isGood: true, x: w*0.2, y: h*0.8, hp: 800, maxHp: 800, size: 8, color: goodColor, speed: 0.8, range: 60, cooldown: 0 });
        for(let i=0; i<60; i++) AppState.battleEntities.push({ type: 'infantry', isGood: true, x: Math.random()*w*0.4, y: h*0.6 + Math.random()*h*0.4, hp: 30, maxHp: 30, size: 3, color: goodColor, speed: 1.5, range: 40, cooldown: 0 });
        for(let i=0; i<40; i++) AppState.battleEntities.push({ type: 'elite', isGood: false, x: w*0.6 + Math.random()*w*0.4, y: Math.random()*h*0.5, hp: 50, maxHp: 50, size: 4, color: badColor, speed: 1.0, range: 60, cooldown: 0 });
        for(let i=0; i<2; i++) AppState.battleEntities.push({ type: 'worm', isGood: true, x: Math.random()*w*0.3, y: h + 100, angle: -Math.PI/2, hp: 2000, maxHp: 2000, size: 25, color: '#b45309', speed: 2.0 });
    } else if (ev && ev.title.includes("Atreides")) {
        goodColor = '#0284c7'; badColor = '#dc2626';
        AppState.battleEntities.push({ id: 'leto', type: 'hero', isHero: true, name: "Duke Leto", isGood: true, x: w*0.5, y: h*0.8, hp: 500, maxHp: 500, size: 8, color: goodColor, speed: 0.5, range: 50, cooldown: 0 });
        for(let i=0; i<30; i++) AppState.battleEntities.push({ type: 'infantry', isGood: true, x: w*0.4 + Math.random()*w*0.2, y: h*0.7 + Math.random()*h*0.2, hp: 40, maxHp: 40, size: 3.5, color: goodColor, speed: 1.2, range: 50, cooldown: 0 });
        for(let i=0; i<50; i++) AppState.battleEntities.push({ type: 'infantry', isGood: false, x: Math.random()*w, y: -50 - Math.random()*100, hp: 25, maxHp: 25, size: 3, color: badColor, speed: 1.8, range: 40, cooldown: 0 }); 
    } else if (type === 'space_fleet') {
        for(let i=0; i<20; i++) AppState.battleEntities.push({ type: 'ship', isGood: true, x: Math.random()*w*0.3, y: Math.random()*h, vx: 2, vy: (Math.random()-0.5), hp: 100, maxHp: 100, size: 6, color: '#38bdf8', speed: 2, range: 150, cooldown: 0 });
        for(let i=0; i<20; i++) AppState.battleEntities.push({ type: 'ship', isGood: false, x: w - Math.random()*w*0.3, y: Math.random()*h, vx: -2, vy: (Math.random()-0.5), hp: 100, maxHp: 100, size: 6, color: '#ef4444', speed: 2, range: 150, cooldown: 0 });
    } else {
        for(let i=0; i<30; i++) AppState.battleEntities.push({ type: 'infantry', isGood: true, x: Math.random()*w*0.4, y: Math.random()*h, hp: 20, maxHp: 20, size: 3, color: '#38bdf8', speed: 1.5, range: 50, cooldown: 0 });
        for(let i=0; i<30; i++) AppState.battleEntities.push({ type: 'infantry', isGood: false, x: w - Math.random()*w*0.4, y: Math.random()*h, hp: 20, maxHp: 20, size: 3, color: '#ef4444', speed: 1.5, range: 50, cooldown: 0 });
    }

    const ui = document.getElementById('battle-ui');
    if(ui) ui.classList.remove('hidden');
    AudioEngine.playUI('event');
}

export function closeBattle() {
    AppState.isReplayingBattle = false;
    AppState.battleEntities = [];
    const ui = document.getElementById('battle-ui');
    if(ui) ui.classList.add('hidden');
}

function updateBattleEntities() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const dt = 1/60; 
    AppState.battleState.time += dt;

    for (let i = AppState.battleEntities.length - 1; i >= 0; i--) {
        const e = AppState.battleEntities[i];
        
        if (e.hp <= 0 && e.type !== 'particle' && e.type !== 'projectile') {
            if (e.isGood) AppState.battleState.goodKills++; 
            else AppState.battleState.badKills++; 
            
            for(let p=0; p<12; p++) AppState.battleEntities.push({ type: 'particle', x: e.x, y: e.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 1.0, color: e.color });
            AppState.battleEntities.splice(i, 1); 
            continue;
        }

        if (e.type === 'particle') {
            e.life -= dt * 1.5; e.x += e.vx; e.y += e.vy;
            if (e.life <= 0) AppState.battleEntities.splice(i, 1);
            continue;
        }

        if (e.type === 'projectile') {
            e.x += e.vx; e.y += e.vy; e.life -= dt;
            let hit = false;
            for (let ent of AppState.battleEntities) {
                if (ent.type !== 'particle' && ent.type !== 'projectile' && ent.type !== 'worm' && ent.isGood !== e.isGood && ent.hp > 0) {
                    if (Math.hypot(ent.x - e.x, ent.y - e.y) < ent.size + 2) {
                        ent.hp -= e.damage; hit = true;
                        for(let p=0; p<3; p++) AppState.battleEntities.push({ type: 'particle', x: e.x, y: e.y, vx: -e.vx*0.3+(Math.random()-0.5)*2, vy: -e.vy*0.3+(Math.random()-0.5)*2, life: 0.4, color: '#fef08a' });
                        break;
                    }
                }
            }
            if (hit || e.life <= 0) AppState.battleEntities.splice(i, 1);
            continue;
        }

        if (e.type === 'worm') {
            e.angle = (e.angle || -Math.PI/2) + (Math.random()-0.5)*0.05;
            e.x += Math.cos(e.angle) * e.speed; e.y += Math.sin(e.angle) * e.speed;
            for (let ent of AppState.battleEntities) {
                if (ent.type !== 'particle' && ent.type !== 'projectile' && ent.type !== 'worm') {
                    if (Math.hypot(ent.x - e.x, ent.y - e.y) < e.size) ent.hp -= 1000; 
                }
            }
            continue;
        }

        let nearest = null; let minDist = Infinity;
        for (let enemy of AppState.battleEntities) {
            if (enemy.type !== 'particle' && enemy.type !== 'projectile' && enemy.type !== 'worm' && enemy.isGood !== e.isGood && enemy.hp > 0) {
                let d = Math.hypot(enemy.x - e.x, enemy.y - e.y);
                if (d < minDist) { minDist = d; nearest = enemy; }
            }
        }

        if (nearest) {
            let angle = Math.atan2(nearest.y - e.y, nearest.x - e.x);
            if (minDist > e.range * 0.8) {
                e.x += Math.cos(angle) * e.speed; e.y += Math.sin(angle) * e.speed;
                e.vx = Math.cos(angle); e.vy = Math.sin(angle); 
            } else if (e.cooldown <= 0) {
                e.cooldown = 0.5 + Math.random(); 
                let spread = angle + (Math.random()-0.5)*0.2;
                AppState.battleEntities.push({ type: 'projectile', isGood: e.isGood, x: e.x, y: e.y, vx: Math.cos(spread)*10, vy: Math.sin(spread)*10, life: 1.5, damage: 10, color: e.isGood ? '#60a5fa' : '#f87171' });
            }
        }
        if (e.cooldown > 0) e.cooldown -= dt;
        
        for (let friend of AppState.battleEntities) {
            if (friend !== e && friend.isGood === e.isGood && friend.type === e.type && friend.hp > 0) {
                if (Math.hypot(friend.x - e.x, friend.y - e.y) < e.size * 2.5) {
                    e.x += (e.x - friend.x) * 0.05; e.y += (e.y - friend.y) * 0.05;
                }
            }
        }
    }

    for (let i = AppState.battleState.effects.length - 1; i >= 0; i--) {
        let fx = AppState.battleState.effects[i];
        fx.life -= dt; fx.radius += (fx.maxRadius - fx.radius) * 0.1;
        if (fx.life <= 0) AppState.battleState.effects.splice(i, 1);
    }

    if (AppState.battleState.time > 3.0 && !AppState.battleState.ended) { 
        let goodAlive = AppState.battleEntities.some(e => e.isGood && e.hp > 0 && e.type !== 'projectile' && e.type !== 'particle');
        let badAlive = AppState.battleEntities.some(e => !e.isGood && e.hp > 0 && e.type !== 'projectile' && e.type !== 'particle');
        if (!goodAlive || !badAlive) {
            AppState.battleState.ended = true;
            setTimeout(() => showBattleSummary(goodAlive), 2000);
        }
    }
}

function drawBattleSimulation() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width/dpr, canvas.height/dpr);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)'; ctx.lineWidth = 1;
    const w = canvas.width / dpr; const h = canvas.height / dpr;
    for(let x=0; x<w; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=0; y<h; y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    AppState.battleState.effects.forEach(fx => {
        if (fx.type === 'orbital_strike') {
            ctx.globalAlpha = fx.life; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.2)'; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = '#f59e0b'; ctx.stroke(); ctx.globalAlpha = 1;
        }
    });

    AppState.battleEntities.forEach(e => {
        if (e.type === 'particle') {
            ctx.fillStyle = e.color; ctx.globalAlpha = e.life;
            ctx.beginPath(); ctx.arc(e.x, e.y, 2, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (e.type === 'projectile') {
            ctx.fillStyle = '#fff'; ctx.shadowColor = e.color; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(e.x, e.y, 2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        } else if (e.type === 'worm') {
            ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        } else {
            ctx.fillStyle = e.color;
            if (e.type === 'ship') {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy||0.1, e.vx||0.1)); 
                ctx.beginPath(); ctx.moveTo(e.size, 0); ctx.lineTo(-e.size, e.size*0.8); ctx.lineTo(-e.size, -e.size*0.8); ctx.fill(); ctx.restore();
            } else {
                ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();
            }
            
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(e.x - e.size, e.y - e.size - 6, e.size*2, 2);
            ctx.fillStyle = e.isGood ? '#22c55e' : '#ef4444'; ctx.fillRect(e.x - e.size, e.y - e.size - 6, (e.size*2)*(Math.max(0, e.hp)/e.maxHp), 2);
            
            if (e.isHero) {
                ctx.fillStyle = '#fff'; ctx.font = '600 10px "JetBrains Mono"'; ctx.textAlign = 'center';
                ctx.fillText(e.name, e.x, e.y - e.size - 10);
                ctx.strokeStyle = e.color; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 4 + Math.sin(Date.now()/150)*2, 0, Math.PI*2); ctx.stroke();
            }
        }
    });
}

// ==========================================
// DYNAMIC TIMELINE INTERPOLATORS
// ==========================================
export function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : {r: 82, g: 82, b: 91};
}

export function lerpColor(color1, color2, factor) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}

export function toRgba(color, alpha) {
    if (!color) return `rgba(82, 82, 91, ${alpha})`;
    if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${alpha})`);
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    const rgb = hexToRgb(color);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getFactionState(body, year) {
    if (!body.factionHistory) return { name: body.faction, color: DATA.factions[body.faction] || '#52525b', isTransitioning: false };
    
    let current = body.factionHistory[0];
    let next = null;
    
    for (let i = 0; i < body.factionHistory.length; i++) {
        if (year >= body.factionHistory[i].y) {
            current = body.factionHistory[i];
            next = (i + 1 < body.factionHistory.length) ? body.factionHistory[i + 1] : null;
        } else { break; }
    }
    
    if (!next || next.y === current.y) return { name: current.f, color: DATA.factions[current.f] || '#52525b', isTransitioning: false };
    
    const transitionWindow = 1.5; 
    if (year > next.y - transitionWindow) {
        const factor = Math.max(0, Math.min(1, (year - (next.y - transitionWindow)) / transitionWindow));
        const color1 = DATA.factions[current.f] || '#52525b';
        const color2 = DATA.factions[next.f] || '#52525b';
        return { 
            name: next.f, 
            color: lerpColor(color1, color2, factor), 
            isTransitioning: true,
            factor: factor,
            color1: color1,
            color2: color2
        };
    }
    
    return { name: current.f, color: DATA.factions[current.f] || '#52525b', isTransitioning: false };
}

// ==========================================
// STANDARD RENDER LOOP
// ==========================================
export function initStars() {
    AppState.bgStars = [];
    for(let i=0; i<500; i++) {
        AppState.bgStars.push({
            x: Math.random() * 5000 - 2500, y: Math.random() * 5000 - 2500,
            size: Math.random() * 1.5 + 0.15, alpha: Math.random() * 0.7 + 0.15, parallax: Math.random() * 0.4 + 0.08,
            hue: Math.random() > 0.85 ? (Math.random() > 0.5 ? '#fef3c7' : '#bfdbfe') : '#ffffff', twinkleSpeed: 300 + Math.random() * 800
        });
    }
}

export function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

export function getOrbitalPos(item, isMoon=false) {
    const scaleFactor = isMoon ? 1 : CONFIG.orbitScale;
    const a = item.localA * scaleFactor;
    const M = AppState.imperialYear * (item.speed * 0.005) * Math.PI * 2;
    const e = item.e || 0;
    const omega = item.omega || 0;
    if(e === 0) return { dx: a * Math.cos(M + omega), dy: a * Math.sin(M + omega), a };
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(M));
    return { dx: r * Math.cos(M + omega), dy: r * Math.sin(M + omega), a };
}

export function getAbsolutePos(item, type='body') {
    const cx = (canvas.width/dpr)/2 + AppState.currentOffsetX;
    const cy = (canvas.height/dpr)/2 + AppState.currentOffsetY;
    const sc = AppState.currentScale;
    if(type === 'system') return { x: cx + item.baseX * sc * CONFIG.orbitScale, y: cy + item.baseY * sc * CONFIG.orbitScale };
    if(type === 'body') {
        const sys = getAbsolutePos(DATA.systems[item.system], 'system');
        const pos = getOrbitalPos(item, false);
        return { x: sys.x + pos.dx * sc, y: sys.y + pos.dy * sc, ...pos };
    }
    if(type === 'moon') {
        const parent = getAbsolutePos(DATA.bodies[item.parentIndex], 'body');
        const pos = getOrbitalPos(item, true);
        return { x: parent.x + pos.dx * sc, y: parent.y + pos.dy * sc };
    }
    return { x: cx, y: cy };
}

export function getScreenTargetOffsets() {
    let targetScreenX = 0;
    let targetScreenY = 0;

    if (window.innerWidth >= 1024 && !AppState.cinematicMode) {
        const infoPanel = document.getElementById('info-panel');
        const eventModal = document.getElementById('event-modal');
        const isInfoOpen = infoPanel && infoPanel.classList.contains('open');
        const isEventOpen = eventModal && !eventModal.classList.contains('hidden');
        
        if (isInfoOpen && isEventOpen) targetScreenX = 50; 
        else if (isInfoOpen) targetScreenX = -100; 
        else if (isEventOpen) targetScreenX = 200; 
        else targetScreenX = 170; 
    } else if (AppState.cinematicMode) {
        targetScreenY = -80;
    } else if (window.innerWidth < 1024 && !AppState.cinematicMode) {
        targetScreenY = -100; 
    }
    
    return { x: targetScreenX, y: targetScreenY };
}

function updateCamera() {
    AppState.currentScale += (AppState.targetScale - AppState.currentScale) * 0.12;
    AppState.currentOffsetX += (AppState.targetOffsetX - AppState.currentOffsetX) * 0.12;
    AppState.currentOffsetY += (AppState.targetOffsetY - AppState.currentOffsetY) * 0.12;
}

export function centerOn(obj, type, isDoubleTap = false) {
    if (isDoubleTap) { AppState.targetScale = 15.0; } 
    else if(AppState.targetScale < 1.2) { AppState.targetScale = 1.5; }
    
    let worldX = 0, worldY = 0;
    if(type === 'system' || type === 'star') {
        worldX = obj.baseX * CONFIG.orbitScale; worldY = obj.baseY * CONFIG.orbitScale;
    } else if(type === 'body') {
        const sys = DATA.systems[obj.system]; 
        if (!sys) return; // Safety check
        const pos = getOrbitalPos(obj, false);
        worldX = sys.baseX * CONFIG.orbitScale + pos.dx; worldY = sys.baseY * CONFIG.orbitScale + pos.dy;
    } else {
        // Fallback for Characters/Artifacts if their location isn't a mapped celestial body
        let targetSystemId = null;
        if(obj.eras && obj.eras.length > 0) {
             const eraMatch = obj.eras.find(e => e.era === AppState.currentEra);
             targetSystemId = eraMatch ? eraMatch.system : obj.eras[0].system; 
        }
        if(targetSystemId !== null && targetSystemId !== undefined) {
             const sys = DATA.systems.find(s => s.id === targetSystemId);
             if (sys) {
                 worldX = sys.baseX * CONFIG.orbitScale;
                 worldY = sys.baseY * CONFIG.orbitScale;
                 AppState.targetScale = 1.0;
             } else { return; }
        } else { return; }
    }

    const offsets = getScreenTargetOffsets();
    AppState.targetOffsetX = offsets.x - (worldX * AppState.targetScale);
    AppState.targetOffsetY = offsets.y - (worldY * AppState.targetScale);
}

// ==========================================
// BULLETPROOF LORE ENGINE & FOCUS LOGIC
// ==========================================
export function focusObject(obj, type, isDoubleTap = false) {
    AppState.focusedObject = obj;
    
    // 1. Show the Info Panel immediately so the UI is highly responsive
    showInfo(obj, type);
    AudioEngine.playUI('focus');

    // 2. Handle specific camera panning based on type
    if (type === 'character' || type === 'school' || type === 'artifact') {
        let targetLocationName = null;
        if (type === 'character' && obj.history) {
            const currentYear = Math.floor(AppState.imperialYear);
            let latestLoc = obj.origin || "Unknown";
            for (let h of obj.history) { if (currentYear >= h.y) latestLoc = h.loc; }
            targetLocationName = latestLoc;
        } else if (type === 'school' && obj.location) {
            targetLocationName = obj.location;
        }

        let celestialTarget = null;
        if (targetLocationName && targetLocationName !== "Unknown") {
            celestialTarget = DATA.bodies.find(b => b.name === targetLocationName) || DATA.systems.find(s => s.name.includes(targetLocationName) || s.starName === targetLocationName);
        }

        if (celestialTarget) {
            // Success! The character is on a mapped planet. Pan to it.
            centerOn(celestialTarget, celestialTarget.baseX !== undefined ? 'system' : 'body');
            updateMentatScanner(celestialTarget, celestialTarget.baseX !== undefined ? 'system' : 'body');
        } else {
            // Elegant Fallback: Location is unknown or off-map. Gently zoom out so the Info Panel remains readable.
            const offsets = getScreenTargetOffsets();
            AppState.targetOffsetX = offsets.x;
            AppState.targetOffsetY = offsets.y;
            AppState.targetScale = 0.15; 
        }
    } else {
        // Standard celestial bodies
        centerOn(obj, type, isDoubleTap);
        updateMentatScanner(obj, type);
    }
    
    AudioEngine.updateAtmosphere();
    
    if(window.innerWidth < 1024 && !AppState.cinematicMode) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.getElementById('overlay').classList.add('hidden');
    }
}

export function resetView() {
    AppState.targetScale = AppState.cinematicMode ? 0.3 : 0.15;
    const offsets = getScreenTargetOffsets();
    AppState.targetOffsetX = offsets.x;
    AppState.targetOffsetY = offsets.y;
    AppState.zoomedSystem = null;
    closeInfo();
}

function drawBackground() {
    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, canvas.width/dpr, canvas.height/dpr);
    const cx = (canvas.width/dpr)/2 + AppState.currentOffsetX;
    const cy = (canvas.height/dpr)/2 + AppState.currentOffsetY;
    const now = Date.now();
    
    if (AppState.toggles.stars) {
        AppState.bgStars.forEach(s => {
            const px = cx * s.parallax + s.x + (canvas.width/dpr)/2;
            const py = cy * s.parallax + s.y + (canvas.height/dpr)/2;
            const wrapX = (px % 5000 + 5000) % 5000 - 1250;
            const wrapY = (py % 5000 + 5000) % 5000 - 1250;
            const twinkle = Math.sin(now/s.twinkleSpeed + s.x)*0.25;
            ctx.fillStyle = s.hue; ctx.globalAlpha = Math.max(0, s.alpha + twinkle);
            ctx.beginPath(); ctx.arc(wrapX, wrapY, s.size, 0, Math.PI*2); ctx.fill();
        });
    }
    ctx.globalAlpha = 1;

    if (AppState.toggles.nebula) {
        const centerPos = getAbsolutePos({baseX:0, baseY:0}, 'system');
        let grad = ctx.createRadialGradient(centerPos.x, centerPos.y, 50*AppState.currentScale, centerPos.x, centerPos.y, 2500*AppState.currentScale);
        grad.addColorStop(0, 'rgba(147, 51, 234, 0.045)'); grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.02)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width/dpr, canvas.height/dpr);
        
        const armPos = getAbsolutePos({baseX:-1500, baseY:1500}, 'system');
        grad = ctx.createRadialGradient(armPos.x, armPos.y, 0, armPos.x, armPos.y, 2000*AppState.currentScale);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.025)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width/dpr, canvas.height/dpr);
        
        const arm2 = getAbsolutePos({baseX:2000, baseY:-500}, 'system');
        grad = ctx.createRadialGradient(arm2.x, arm2.y, 0, arm2.x, arm2.y, 1800*AppState.currentScale);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.018)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width/dpr, canvas.height/dpr);

        if (AppState.toggles.houseRings) {
            DATA.systems.forEach(sys => {
                const planets = DATA.bodies.filter(b => b.system === sys.id);
                let activeColor = null;
                for(let p of planets) {
                    let fState = getFactionState(p, AppState.imperialYear);
                    if(fState.name !== 'None') { activeColor = fState.color; break; }
                }
                if (activeColor) {
                    const pos = getAbsolutePos(sys, 'system');
                    const rad = 2500 * AppState.currentScale;
                    if (pos.x > -rad && pos.x < (canvas.width/dpr) + rad && pos.y > -rad && pos.y < (canvas.height/dpr) + rad) {
                        let fGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, rad);
                        fGrad.addColorStop(0, toRgba(activeColor, 0.08)); fGrad.addColorStop(0.5, toRgba(activeColor, 0.02)); fGrad.addColorStop(1, 'rgba(0,0,0,0)');
                        ctx.globalCompositeOperation = 'screen';
                        ctx.fillStyle = fGrad; ctx.beginPath(); ctx.arc(pos.x, pos.y, rad, 0, Math.PI*2); ctx.fill();
                        ctx.globalCompositeOperation = 'source-over';
                    }
                }
            });
        }
    }
}

function drawPlanetTexture(pos, r, body, sc) {
    if (r < 25) return; 
    ctx.save();
    ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.clip();
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#000';
    let seed = (body.name.length * 13) % 100;
    
    if (body.type === 'gas') {
        for(let i=0; i<10; i++) {
            let yOff = (Math.sin(seed + i) * r * 0.8);
            let h = (Math.cos(seed + i*2) * 0.5 + 0.5) * r * 0.4 + 5*sc;
            ctx.fillRect(pos.x - r, pos.y + yOff, r*2, h);
        }
    } else if (body.type === 'desert' || body.type === 'rocky' || body.type === 'ice') {
        for(let i=0; i<15; i++) {
            let x = pos.x - r + (Math.sin(seed * i) * 0.5 + 0.5) * 2 * r;
            let y = pos.y - r + (Math.cos(seed * i * 2) * 0.5 + 0.5) * 2 * r;
            let cr = Math.max(1, r * (Math.sin(seed * i * 3) * 0.15 + 0.15) + 2*sc);
            ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI*2); ctx.fill();
        }
    } else {
        for(let i=0; i<8; i++) {
            let x = pos.x + Math.sin(seed * i + Date.now()/2000) * r * 0.6;
            let y = pos.y + Math.cos(seed * i * 2 + Date.now()/2000) * r * 0.6;
            let cr = Math.max(1, r * (Math.sin(seed * i * 3) * 0.2 + 0.3) + 5*sc);
            ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();
}

function drawMinimap() {
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;
    const size = Math.min(200, logicalW * 0.25);
    if (size < 100) return; 

    const padding = 20;
    const x = padding;
    const cy = logicalH - padding - (AppState.cinematicMode ? 180 : 0);

    if (!AppState.minimapExpanded) {
        const collapsedW = 120;
        const collapsedH = 28;
        const y = cy - collapsedH;
        AppState.minimapHitbox = { x, y, w: collapsedW, h: collapsedH };
        
        ctx.save();
        ctx.fillStyle = 'rgba(10, 10, 14, 0.85)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x, y, collapsedW, collapsedH, 6); ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.font = '600 10px "JetBrains Mono"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SECTOR MAP +', x + collapsedW/2, y + collapsedH/2);
        ctx.restore();
        return;
    }

    const y = cy - size;
    AppState.minimapHitbox = { x, y, w: size, h: size };
    AppState.minimapToggleRect = { x: x + size - 26, y: y + 6, w: 20, h: 20 };
    
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 14, 0.85)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.fill(); ctx.stroke();
    ctx.clip(); 
    
    const mapScale = size / 10000;
    const cx = x + size / 2;
    const cy_map = y + size / 2;
    AppState.minimapData = { cx, cy: cy_map, mapScale };

    DATA.systems.forEach(sys => {
        const planets = DATA.bodies.filter(b => b.system === sys.id);
        let activeColor = null;
        for(let p of planets) {
            let fState = getFactionState(p, AppState.imperialYear);
            if(fState.name !== 'None') { activeColor = fState.color; break; }
        }
        if (activeColor) {
            const sx = cx + sys.baseX * mapScale * CONFIG.orbitScale;
            const sy = cy_map + sys.baseY * mapScale * CONFIG.orbitScale;
            const rGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 3000 * mapScale);
            rGrad.addColorStop(0, toRgba(activeColor, 0.5)); rGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rGrad; ctx.beginPath(); ctx.arc(sx, sy, 3000 * mapScale, 0, Math.PI*2); ctx.fill();
        }
    });

    DATA.systems.forEach(sys => {
        const sx = cx + sys.baseX * mapScale * CONFIG.orbitScale;
        const sy = cy_map + sys.baseY * mapScale * CONFIG.orbitScale;
        ctx.fillStyle = sys.sunColor;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI*2); ctx.fill();
    });

    const viewW = (logicalW / AppState.currentScale) * mapScale;
    const viewH = (logicalH / AppState.currentScale) * mapScale;
    const viewX = cx - (AppState.currentOffsetX / AppState.currentScale) * mapScale - viewW / 2;
    const viewY = cy_map - (AppState.currentOffsetY / AppState.currentScale) * mapScale - viewH / 2;

    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.strokeRect(viewX, viewY, viewW, viewH);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'; ctx.fillRect(viewX, viewY, viewW, viewH);

    ctx.fillStyle = 'rgba(10, 10, 14, 0.9)'; ctx.fillRect(x, y, size, 32);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)'; ctx.beginPath(); ctx.moveTo(x, y+32); ctx.lineTo(x+size, y+32); ctx.stroke();
    
    ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'; ctx.font = '600 10px "JetBrains Mono"';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('SECTOR MAP', x + 12, y + 16);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.beginPath(); ctx.roundRect(AppState.minimapToggleRect.x, AppState.minimapToggleRect.y, 20, 20, 4); ctx.fill();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.textAlign = 'center'; ctx.fillText('—', AppState.minimapToggleRect.x + 10, AppState.minimapToggleRect.y + 10);

    ctx.restore();
}

export function draw() {
    updateCamera();
    
    if (AppState.isReplayingBattle) {
        updateBattleEntities();
        drawBattleSimulation();
        return;
    }
    
    drawBackground();
    const sc = AppState.currentScale;
    const now = Date.now();
    
    if(AppState.toggles.guildRoutes) {
        ctx.lineWidth = Math.max(1, 2 * sc);
        const pulse = Math.sin(now / 400) * 0.3 + 0.5;
        DATA.guildRoutes.forEach((route, idx) => {
            const p1 = getAbsolutePos(DATA.systems[route.from], 'system');
            const p2 = getAbsolutePos(DATA.systems[route.to], 'system');
            const cx_ = (p1.x + p2.x)/2 + (Math.sin(route.from)*200*sc);
            const cy_ = (p1.y + p2.y)/2 + (Math.cos(route.to)*200*sc);
            ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10 * sc;
            ctx.strokeStyle = `rgba(56, 189, 248, ${pulse * 0.4})`; ctx.setLineDash([8*sc, 20*sc]); ctx.lineDashOffset = -(now / 25) % 100;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(cx_, cy_, p2.x, p2.y); ctx.stroke();
            ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
            
            for(let i=0; i<2; i++) {
                let t = ((now * 0.00004) + (idx * 0.3) + (i * 0.5)) % 1;
                let x = Math.pow(1-t, 2)*p1.x + 2*(1-t)*t*cx_ + Math.pow(t, 2)*p2.x;
                let y = Math.pow(1-t, 2)*p1.y + 2*(1-t)*t*cy_ + Math.pow(t, 2)*p2.y;
                let dx = 2*(1-t)*(cx_ - p1.x) + 2*t*(p2.x - cx_); let dy = 2*(1-t)*(cy_ - p1.y) + 2*t*(p2.y - cy_);
                let angle = Math.atan2(dy, dx);
                ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
                if (t > 0.02 && t < 0.98) {
                    ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 15 * sc;
                    ctx.strokeStyle = `rgba(217, 70, 239, ${Math.sin(t * Math.PI) * 0.7})`; ctx.lineWidth = 2 * sc;
                    ctx.beginPath(); ctx.ellipse(16*sc, 0, 3*sc, 12*sc, 0, 0, Math.PI*2); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
                }
                ctx.shadowBlur = 0; ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.moveTo(14*sc, 0); ctx.lineTo(-8*sc, 5*sc); ctx.lineTo(-8*sc, -5*sc); ctx.fill();
                ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#0ea5e9'; ctx.shadowBlur = 20 * sc;
                ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(-8*sc, 0, 3*sc, 0, Math.PI*2); ctx.fill(); ctx.restore();
            }
        });
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }

    if (AppState.activeRoute && AppState.activeRoute.length > 1) {
        ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 20 * sc; ctx.lineWidth = 4 * sc;
        for(let i=0; i<AppState.activeRoute.length-1; i++) {
            const p1 = getAbsolutePos(DATA.systems[AppState.activeRoute[i]], 'system');
            const p2 = getAbsolutePos(DATA.systems[AppState.activeRoute[i+1]], 'system');
            const cx_ = (p1.x + p2.x)/2 + (Math.sin(AppState.activeRoute[i])*200*sc);
            const cy_ = (p1.y + p2.y)/2 + (Math.cos(AppState.activeRoute[i+1])*200*sc);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.6 + Math.sin(now / 150) * 0.4})`;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(cx_, cy_, p2.x, p2.y); ctx.stroke();
            let t = (now * 0.0005) % 1;
            let hx = Math.pow(1-t, 2)*p1.x + 2*(1-t)*t*cx_ + Math.pow(t, 2)*p2.x; let hy = Math.pow(1-t, 2)*p1.y + 2*(1-t)*t*cy_ + Math.pow(t, 2)*p2.y;
            let dx = 2*(1-t)*(cx_ - p1.x) + 2*t*(p2.x - cx_); let dy = 2*(1-t)*(cy_ - p1.y) + 2*t*(p2.y - cy_);
            let angle = Math.atan2(dy, dx);
            ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
            ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.beginPath(); ctx.moveTo(24*sc, 0); ctx.lineTo(-14*sc, 10*sc); ctx.lineTo(-14*sc, -10*sc); ctx.fill();
            ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(-18*sc, 0, 8*sc, 0, Math.PI*2); ctx.fill(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }

    DATA.systems.forEach(sys => {
        let alpha = (AppState.zoomedSystem !== null && AppState.zoomedSystem !== sys.id) ? 0.08 : 1;
        ctx.globalAlpha = alpha;
        const pos = getAbsolutePos(sys, 'system');
        ctx.shadowColor = sys.sunColor; ctx.shadowBlur = 35 * sc;
        if (sc > 5.0) {
            ctx.fillStyle = sys.sunColor; const t = now / 1000;
            for(let i=0; i<10; i++) {
                let angle = (i * Math.PI / 5) + (t * 0.08); let pR = 22*sc + Math.sin(t * 2 + i) * 5 * sc;
                ctx.beginPath(); ctx.moveTo(pos.x + Math.cos(angle - 0.08)*22*sc, pos.y + Math.sin(angle - 0.08)*22*sc);
                ctx.lineTo(pos.x + Math.cos(angle)*pR, pos.y + Math.sin(angle)*pR); ctx.lineTo(pos.x + Math.cos(angle + 0.08)*22*sc, pos.y + Math.sin(angle + 0.08)*22*sc); ctx.fill();
            }
        }
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 22*sc);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.25, sys.sunColor); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(pos.x, pos.y, 22*sc, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        
        if(sc < 0.8 && AppState.toggles.planetNames) {
            ctx.font = `600 ${Math.max(9, 11*sc)}px Rajdhani, sans-serif`; ctx.fillStyle = '#a1a1aa'; ctx.textAlign = 'center'; ctx.fillText(sys.name.toUpperCase(), pos.x, pos.y - 32*sc);
        } else if (sc >= 0.8 && AppState.toggles.planetNames) {
            ctx.font = `600 ${Math.max(11, 12*sc)}px Exo 2, sans-serif`; ctx.fillStyle = sys.sunColor; ctx.textAlign = 'center'; ctx.globalAlpha = alpha * 0.6; ctx.fillText(sys.starName.toUpperCase(), pos.x, pos.y + 35*sc); ctx.globalAlpha = alpha;
        }
    });

    if(AppState.toggles.orbits) {
        ctx.lineWidth = 1;
        DATA.bodies.forEach(body => {
            let alpha = (AppState.zoomedSystem !== null && AppState.zoomedSystem !== body.system) ? 0.04 : 0.12;
            ctx.globalAlpha = alpha; ctx.strokeStyle = body.color;
            const sys = getAbsolutePos(DATA.systems[body.system], 'system');
            ctx.beginPath(); ctx.arc(sys.x, sys.y, body.localA * sc, 0, Math.PI*2); ctx.stroke();
        });
    }

    DATA.bodies.forEach(body => {
        let alpha = (AppState.zoomedSystem !== null && AppState.zoomedSystem !== body.system) ? 0.08 : 1;
        ctx.globalAlpha = alpha;
        const pos = getAbsolutePos(body, 'body');
        const r = Math.max(2, body.size * sc);
        const fState = getFactionState(body, AppState.imperialYear);
        
        if (AppState.toggles.atmosphere && body.atmo && r > 3) {
            const atmoSize = r * 1.6;
            const atmoGrad = ctx.createRadialGradient(pos.x, pos.y, r * 0.8, pos.x, pos.y, atmoSize);
            let atmoColor = body.color;
            if (body.type === 'ocean') atmoColor = '#60a5fa'; else if (body.type === 'jungle') atmoColor = '#34d399'; else if (body.type === 'desert') atmoColor = '#fbbf24'; else if (body.type === 'industrial') atmoColor = '#a1a1aa';
            atmoGrad.addColorStop(0, `${atmoColor}00`); atmoGrad.addColorStop(0.5, `${atmoColor}15`); atmoGrad.addColorStop(1, `${atmoColor}00`);
            ctx.fillStyle = atmoGrad; ctx.beginPath(); ctx.arc(pos.x, pos.y, atmoSize, 0, Math.PI*2); ctx.fill();
        }
        
        const grad = ctx.createRadialGradient(pos.x - r*0.3, pos.y - r*0.3, 0, pos.x, pos.y, r);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, body.color); grad.addColorStop(0.8, '#111'); grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.fill();

        if (sc > 5.0) drawPlanetTexture(pos, r, body, sc);
        if (sc > 1.5) {
            const shadowGrad = ctx.createLinearGradient(pos.x - r, pos.y - r, pos.x + r, pos.y + r);
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0)'); shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0.2)'); shadowGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
            ctx.fillStyle = shadowGrad; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.fill();
        }

        if (sc > 3.0 && AppState.toggles.atmosphere) {
            ctx.save(); ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 1.2, 0, Math.PI*2); ctx.clip();
            if (body.name === 'Arrakis') {
                ctx.globalCompositeOperation = 'screen';
                for(let w=0; w<15; w++) {
                    let wTime = now / (1000 + w*100); let wx = pos.x + Math.sin(wTime + w) * r; let wy = pos.y + Math.cos(wTime * 1.2 + w) * r * 0.5;
                    ctx.fillStyle = `rgba(217, 119, 6, ${0.1 + Math.sin(wTime*5)*0.1})`; ctx.beginPath(); ctx.ellipse(wx, wy, r*0.8, r*0.15, wTime*0.5, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
            } else if (body.name === 'Caladan') {
                ctx.globalCompositeOperation = 'screen';
                for(let w=0; w<20; w++) {
                    let wTime = now / (800 + w*50); let wx = pos.x + Math.sin(wTime + w) * r; let wy = pos.y + Math.cos(wTime * 0.8 + w) * r;
                    ctx.fillStyle = `rgba(224, 242, 254, ${0.05 + Math.sin(wTime*3)*0.05})`; ctx.beginPath(); ctx.ellipse(wx, wy, r*0.6, r*0.2, -0.2, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
            } else if (body.name === 'Giedi Prime') {
                ctx.globalCompositeOperation = 'multiply';
                for(let w=0; w<12; w++) {
                    let wTime = now / (1500 + w*200); let wx = pos.x + Math.sin(wTime + w) * r * 0.8; let wy = pos.y + Math.cos(wTime * 1.1 + w) * r * 0.8;
                    ctx.fillStyle = `rgba(41, 37, 36, ${0.4 + Math.sin(wTime*2)*0.2})`; ctx.beginPath(); ctx.arc(wx, wy, r*0.4, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.restore();
        }

        if (fState.isTransitioning && sc > 1.0) {
            const t = now / 100; ctx.save();
            if (fState.factor < 0.8) { 
                let shieldRadius = r + 8*sc; let shieldAlpha = (0.8 - fState.factor) * (0.5 + Math.sin(t * 5)*0.3);
                ctx.strokeStyle = toRgba(fState.color1, shieldAlpha); ctx.lineWidth = 2 * sc; ctx.setLineDash([10*sc, 15*sc]); ctx.lineDashOffset = t * 10;
                ctx.shadowColor = fState.color1; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(pos.x, pos.y, shieldRadius, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
            }
            ctx.globalCompositeOperation = 'lighter';
            for(let l=0; l<8; l++) {
                let angle = (l * Math.PI/4) + (t * 0.1); let strikeProgress = (t + l*0.5) % 1; 
                if (strikeProgress < 0.2) {
                    let lx = pos.x + Math.cos(angle) * (r + 40*sc); let ly = pos.y + Math.sin(angle) * (r + 40*sc);
                    let tx = pos.x + Math.cos(angle) * r; let ty = pos.y + Math.sin(angle) * r;
                    ctx.strokeStyle = fState.color2; ctx.lineWidth = 2 * sc; ctx.shadowColor = fState.color2; ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();
                    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tx, ty, 4*sc * (1-strikeProgress*5), 0, Math.PI*2); ctx.fill();
                }
            }
            ctx.globalCompositeOperation = 'source-over'; ctx.restore();
        }

        if(AppState.toggles.houseRings && fState.name !== "None" && body.type !== "asteroid") {
            const factionColor = fState.color; ctx.strokeStyle = factionColor; ctx.lineWidth = 1.5 * sc;
            ctx.globalAlpha = alpha * (0.25 + Math.sin(now/900)*0.08); ctx.shadowColor = factionColor; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 6*sc, 0, Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = alpha;
        }
        
        if(AppState.toggles.planetNames && sc > 0.4) {
            ctx.font = `${sc > 5.0 ? '700' : '600'} ${Math.max(10, 7*sc)}px Exo 2, sans-serif`; 
            ctx.fillStyle = '#e4e4e7'; ctx.textAlign = 'center'; ctx.fillText(body.name, pos.x, pos.y - r - 7 - (sc>5 ? 4*sc : 0));
        }
    });

    if (AppState.toggles.spiceParticles) {
        const arrakis = DATA.bodies.find(b => b.name === 'Arrakis');
        if (arrakis) {
            const aPos = getAbsolutePos(arrakis, 'body'); const aR = Math.max(2, arrakis.size * sc);
            if (aR > 3) {
                ctx.globalCompositeOperation = 'lighter';
                DATA.spiceParticles.forEach(p => {
                    p.angle += p.speed; const px = aPos.x + Math.cos(p.angle) * (aR + p.dist * sc * 0.3); const py = aPos.y + Math.sin(p.angle + p.drift) * (aR + p.dist * sc * 0.3); const sz = Math.max(0.5, p.size * sc * 0.15);
                    ctx.globalAlpha = p.alpha * 0.5; ctx.fillStyle = '#f59e0b'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 6;
                    ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI*2); ctx.fill();
                });
                ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
            }
        }
    }
    
    if (AppState.toggles.wormSign) {
        const arrakis = DATA.bodies.find(b => b.name === 'Arrakis');
        if (arrakis) {
            const aPos = getAbsolutePos(arrakis, 'body'); const aR = Math.max(2, arrakis.size * sc);
            if (aR > 5 && sc > 0.6) {
                DATA.wormSigns.forEach(w => {
                    w.angle += w.speed; const wormAlpha = (Math.sin(now / 1500 + w.phase) * 0.5 + 0.5) * 0.4;
                    const wx = aPos.x + Math.cos(w.angle) * (w.dist * sc); const wy = aPos.y + Math.sin(w.angle) * (w.dist * sc * 0.6);
                    ctx.globalAlpha = wormAlpha; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2 * sc; ctx.setLineDash([3*sc, 6*sc]); ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const tx = wx + Math.cos(w.angle + i * 0.3) * (10 + i * 8) * sc; const ty = wy + Math.sin(w.angle * 2 + i * 0.4) * (5 + i * 4) * sc;
                        if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
                    }
                    ctx.stroke(); ctx.setLineDash([]);
                });
            }
        }
    }

    if (AppState.toggles.moons) {
        DATA.moonData.forEach(moon => {
            let alpha = (AppState.zoomedSystem !== null && AppState.zoomedSystem !== DATA.bodies[moon.parentIndex].system) ? 0.08 : 1;
            ctx.globalAlpha = alpha; const pos = getAbsolutePos(moon, 'moon'); const r = Math.max(1, moon.size * sc);
            const grad = ctx.createRadialGradient(pos.x - r*0.3, pos.y - r*0.3, 0, pos.x, pos.y, r);
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, moon.color); grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.fill();
            if (sc > 5.0) drawPlanetTexture(pos, r, {name: moon.name, type: 'rocky'}, sc);
            if(AppState.toggles.planetNames && sc > 3.0) {
                ctx.font = `500 ${Math.max(8, 5*sc)}px Exo 2, sans-serif`; ctx.fillStyle = '#a1a1aa'; ctx.textAlign = 'center'; ctx.fillText(moon.name, pos.x, pos.y - r - 4*sc);
            }
        });
    }

    if(AppState.toggles.events && AppState.activeEvent) {
        const sys = DATA.systems[AppState.activeEvent.system];
        if(sys) {
            const pos = getAbsolutePos(sys, 'system'); AppState.eventPulse += 0.025; const r = 38 * sc + Math.sin(AppState.eventPulse * Math.PI) * 8 * sc;
            ctx.strokeStyle = AppState.activeEvent.color; ctx.lineWidth = 1.5 * sc; ctx.globalAlpha = 0.5;
            ctx.setLineDash([12*sc, 18*sc]); ctx.lineDashOffset = -AppState.eventPulse * 40;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
    }

    let objPos = null, objR = 0;
    
    // Calculate focus brackets and tethers for the currently selected object
    if(AppState.focusedObject && !AppState.cinematicMode) {
        let targetEntity = AppState.focusedObject;
        
        // If focusing a character/school, derive their celestial location
        if (targetEntity.baseX === undefined && targetEntity.system === undefined) {
            let targetLocationName = null;
            if (targetEntity.history) {
                const currentYear = Math.floor(AppState.imperialYear);
                let latestLoc = targetEntity.origin || "Unknown";
                for (let h of targetEntity.history) { if (currentYear >= h.y) latestLoc = h.loc; }
                targetLocationName = latestLoc;
            } else if (targetEntity.location) {
                targetLocationName = targetEntity.location;
            }
            if (targetLocationName && targetLocationName !== "Unknown") {
                targetEntity = DATA.bodies.find(b => b.name === targetLocationName) || DATA.systems.find(s => s.name.includes(targetLocationName) || s.starName === targetLocationName);
            }
        }
        
        if (targetEntity && targetEntity.baseX !== undefined) { 
            objPos = getAbsolutePos(targetEntity, 'system'); objR = 32 * sc; 
        } else if (targetEntity && targetEntity.system !== undefined) { 
            objPos = getAbsolutePos(targetEntity, 'body'); objR = targetEntity.size * sc + 12; 
        } 
    }
    
    // Draw the cool sci-fi corner brackets around the selected planet
    if (objPos) {
        objR = Math.max(14, objR); ctx.globalAlpha = 0.7 + Math.sin(now / 200) * 0.2; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; const len = objR * 0.3;
        ctx.beginPath();
        ctx.moveTo(objPos.x - objR, objPos.y - objR + len); ctx.lineTo(objPos.x - objR, objPos.y - objR); ctx.lineTo(objPos.x - objR + len, objPos.y - objR);
        ctx.moveTo(objPos.x + objR - len, objPos.y - objR); ctx.lineTo(objPos.x + objR, objPos.y - objR); ctx.lineTo(objPos.x + objR, objPos.y - objR + len);
        ctx.moveTo(objPos.x + objR, objPos.y + objR - len); ctx.lineTo(objPos.x + objR, objPos.y + objR); ctx.lineTo(objPos.x + objR - len, objPos.y + objR);
        ctx.moveTo(objPos.x - objR + len, objPos.y + objR); ctx.lineTo(objPos.x - objR, objPos.y + objR); ctx.lineTo(objPos.x - objR, objPos.y + objR - len);
        ctx.stroke();
    }
    
    // Draw the tether line from the planet to the Info Panel
    const infoPanel = document.getElementById('info-panel');
    if(infoPanel && AppState.toggles.tethers && AppState.focusedObject && !AppState.cinematicMode && infoPanel.classList.contains('open')) {
        if (objPos) {
            const tetherPos = objPos;
            const rect = infoPanel.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect();
            const panelLeft = rect.left - canvasRect.left; const panelTop = rect.top - canvasRect.top; const panelRight = rect.right - canvasRect.left;
            let anchorX = tetherPos.x < panelLeft ? panelLeft : panelRight; let anchorY = panelTop + 45;
            ctx.beginPath(); ctx.moveTo(tetherPos.x, tetherPos.y); const cpOffset = Math.abs(anchorX - tetherPos.x) * 0.5;
            ctx.bezierCurveTo(tetherPos.x + (tetherPos.x < anchorX ? cpOffset : -cpOffset), tetherPos.y, anchorX - (tetherPos.x < anchorX ? cpOffset : -cpOffset), anchorY, anchorX, anchorY);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -(now / 40) % 100;
            ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8; ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(tetherPos.x, tetherPos.y, 2.5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        }
    }

    // Draw the tether line from the planet to the Event Anomaly Modal
    const eventModal = document.getElementById('event-modal');
    if(eventModal && AppState.toggles.tethers && !eventModal.classList.contains('hidden') && AppState.activeEvent && !AppState.cinematicMode) {
        let tetherPos = getAbsolutePos(DATA.systems[AppState.activeEvent.system], 'system');
        if (tetherPos) {
            const rect = eventModal.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect();
            const panelRight = rect.right - canvasRect.left; const panelTop = rect.top - canvasRect.top;
            let anchorX = panelRight; let anchorY = panelTop + 45; 
            ctx.beginPath(); ctx.moveTo(tetherPos.x, tetherPos.y); const cpOffset = Math.abs(anchorX - tetherPos.x) * 0.5;
            ctx.bezierCurveTo(tetherPos.x - cpOffset, tetherPos.y, anchorX + cpOffset, anchorY, anchorX, anchorY);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -(now / 30) % 100;
            ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(tetherPos.x, tetherPos.y, 2.5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        }
    }

    drawMinimap();
    ctx.globalAlpha = 1;
}