import { DATA } from '../data/dune-lore.js';
import { AppState } from '../core/state.js';
import { AudioEngine } from '../core/audio.js';
import { canvas, dpr, getMousePos, getAbsolutePos, focusObject, centerOn, resetView, initBattle, closeBattle, getScreenTargetOffsets } from '../render/canvas-engine.js';

// ==========================================
// TIMELINE CHRONICLE SELECTOR
// ==========================================
export function renderTimelineTicks(minYear, maxYear) {
    const visibleEvents = DATA.events.filter(ev => ev.year >= minYear && ev.year <= maxYear);
    const tickHTML = visibleEvents.map(ev => {
        const pct = ((ev.year - minYear) / (maxYear - minYear)) * 100;
        const yearLabel = ev.year < 0 ? `${Math.abs(ev.year)} BG` : `${ev.year} AG`;
        return `
        <div class="absolute top-1 w-1.5 h-4 bg-white/80 hover:bg-white rounded-full -translate-x-1/2 cursor-pointer pointer-events-auto group z-20 transition-transform hover:scale-125" style="left: ${pct}%; box-shadow: 0 0 6px var(--chapter-color)" onclick="jumpToEvent(${ev.year})">
            <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center w-max max-w-[160px] bg-zinc-950 border text-white p-2 rounded shadow-2xl z-50 pointer-events-none" style="border-color: var(--chapter-color)">
                <span class="mono text-[9px] font-bold mb-0.5 tracking-wider" style="color: var(--chapter-color)">${yearLabel}</span>
                <span class="text-[10px] leading-tight text-center">${ev.title}</span>
                <div class="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent" style="border-top-color: var(--chapter-color)"></div>
            </div>
        </div>`;
    }).join('');

    const mainContainer = document.getElementById('timeline-ticks');
    if (mainContainer) mainContainer.innerHTML = tickHTML;
    const cineContainer = document.getElementById('cine-timeline-ticks');
    if (cineContainer) cineContainer.innerHTML = tickHTML;
}

export function changeChapter(chapterId) {
    AppState.activeChapterId = chapterId;
    let minYear = -200, maxYear = 15300, color = '#f59e0b';
    if (chapterId !== 'all') {
        const era = DATA.eras.find(e => e.id == chapterId);
        if (era) { minYear = era.start; maxYear = era.end; color = era.color || '#f59e0b'; }
    }

    document.documentElement.style.setProperty('--chapter-color', color);
    const overlay = document.getElementById('chronosphere-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100'); AudioEngine.playUI('event');
        setTimeout(() => { overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0'); }, 600);
    }

    const slider = document.getElementById('timeline-slider');
    if (slider) { slider.min = minYear; slider.max = maxYear; }
    const cineSlider = document.getElementById('cine-timeline-slider');
    if (cineSlider) { cineSlider.min = minYear; cineSlider.max = maxYear; }
    
    const mainSelect = document.getElementById('chapter-select');
    if (mainSelect && mainSelect.value !== chapterId) mainSelect.value = chapterId;
    const cineSelect = document.getElementById('cine-chapter-select');
    if (cineSelect && cineSelect.value !== chapterId) cineSelect.value = chapterId;

    const minLabel = document.getElementById('timeline-min-label');
    if(minLabel) minLabel.textContent = minYear < 0 ? `${Math.abs(minYear)} BG` : `${minYear} AG`;
    const maxLabel = document.getElementById('timeline-max-label');
    if(maxLabel) maxLabel.textContent = maxYear < 0 ? `${Math.abs(maxYear)} BG` : `${maxYear} AG`;

    if (AppState.imperialYear < minYear) AppState.imperialYear = minYear;
    if (AppState.imperialYear > maxYear) AppState.imperialYear = maxYear;

    renderTimelineTicks(minYear, maxYear);
    const eventsList = chapterId === 'all' ? DATA.events : DATA.events.filter(ev => ev.year >= minYear && ev.year <= maxYear);
    const jumpersContainer = document.getElementById('event-jumpers');
    if (jumpersContainer) {
        jumpersContainer.innerHTML = eventsList.map(ev => `<button onclick="jumpToEvent(${ev.year})" class="bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded px-2 py-1.5 text-[9px] text-left truncate transition-colors border border-transparent" title="${ev.title}">${ev.title}</button>`).join('');
    }
    updateEra();
}

// ==========================================
// EVENT MODAL & BATTLE SIMULATION
// ==========================================
export function checkEventTrigger(prevYear, newYear) {
    if (AppState.isReplayingBattle) return; 
    for(let ev of DATA.events) {
        if (ev.year > prevYear && ev.year <= newYear) {
            AppState.isPlaying = false;
            if (AppState.cinematicMode) AppState.cinematicPaused = true;
            
            const pIcon = document.getElementById('play-icon'); const paIcon = document.getElementById('pause-icon');
            if(pIcon) pIcon.classList.remove('hidden'); if(paIcon) paIcon.classList.add('hidden');
            const cpIcon = document.getElementById('cine-play-icon'); const cpaIcon = document.getElementById('cine-pause-icon');
            if(cpIcon) cpIcon.classList.remove('hidden'); if(cpaIcon) cpaIcon.classList.add('hidden');
            
            AppState.activeEvent = ev;
            const sys = DATA.systems[ev.system];
            const modal = document.getElementById('event-modal');
            
            if(sys) {
                AppState.focusedObject = sys; closeInfo(); 
                if(modal) modal.classList.remove('hidden'); 
                centerOn(sys, 'system'); updateMentatScanner(sys, 'system'); AudioEngine.updateAtmosphere();
            }
            
            const titleEl = document.getElementById('modal-title'); const descEl = document.getElementById('modal-desc');
            if(titleEl) titleEl.innerText = ev.title; if(descEl) descEl.innerText = ev.desc;
            
            setTimeout(() => { if(modal) { modal.classList.remove('scale-95', 'opacity-0'); modal.classList.add('scale-100', 'opacity-100'); } }, 10);
            AudioEngine.playUI('event');
            
            const battleBtn = document.getElementById('battle-btn');
            if (battleBtn) { if (ev.battleType && ev.battleType !== 'none') { battleBtn.style.display = 'block'; } else { battleBtn.style.display = 'none'; } }
            break; 
        }
    }
}

export function closeEventModal(autoResume = false) {
    const modal = document.getElementById('event-modal');
    if(modal) {
        modal.classList.remove('scale-100', 'opacity-100'); modal.classList.add('scale-95', 'opacity-0');
        AudioEngine.playUI('minimize'); 
        setTimeout(() => {
            modal.classList.add('hidden');
            if(AppState.focusedObject && AppState.focusedObject.baseX !== undefined) {
                centerOn(AppState.focusedObject, 'system');
            } else if (AppState.focusedObject && AppState.focusedObject.system !== undefined) {
                centerOn(AppState.focusedObject, 'body');
            }
            
            if (autoResume) {
                AppState.isPlaying = true; if (AppState.cinematicMode) AppState.cinematicPaused = false;
                const pIcon = document.getElementById('play-icon'); const paIcon = document.getElementById('pause-icon');
                if(pIcon) pIcon.classList.add('hidden'); if(paIcon) paIcon.classList.remove('hidden');
                const cpIcon = document.getElementById('cine-play-icon'); const cpaIcon = document.getElementById('cine-pause-icon');
                if(cpIcon) cpIcon.classList.add('hidden'); if(cpaIcon) cpaIcon.classList.remove('hidden');
            }
        }, 300);
    }
}

export function startBattleSimulation() {
    closeEventModal(); 
    if (AppState.activeEvent && AppState.activeEvent.battleType) initBattle(AppState.activeEvent.battleType);
}

// ==========================================
// GUILD NAVIGATOR PATHFINDING
// ==========================================
export function toggleNavigator() {
    const content = document.getElementById('navigator-content'); const icon = document.getElementById('nav-toggle-icon');
    if(content && icon) {
        content.classList.toggle('hidden');
        if (content.classList.contains('hidden')) { icon.style.transform = 'rotate(-90deg)'; AudioEngine.playUI('minimize'); } 
        else { icon.style.transform = 'rotate(0deg)'; AudioEngine.playUI('click'); }
    }
}

export function populateNavigator() {
    const start = document.getElementById('nav-start'); const end = document.getElementById('nav-end');
    if(!start || start.children.length > 1) return; 
    let systems = [...DATA.systems].sort((a, b) => a.name.localeCompare(b.name));
    let options = '<option value="">Select System...</option>';
    systems.forEach(s => { options += `<option value="${s.id}">${s.name}</option>`; });
    start.innerHTML = options; end.innerHTML = options;
}

export function calculateJump() {
    const startId = parseInt(document.getElementById('nav-start').value); const endId = parseInt(document.getElementById('nav-end').value);
    if(isNaN(startId) || isNaN(endId)) {
        const btn = document.querySelector('button[onclick="calculateJump()"]');
        if(btn) {
            btn.innerText = "⚠️ SELECT PLANETS FIRST"; btn.classList.replace('text-blue-400', 'text-red-400'); btn.classList.replace('bg-blue-900/30', 'bg-red-900/30'); btn.classList.replace('border-blue-800/50', 'border-red-800/50');
            AudioEngine.playUI('click'); 
            setTimeout(() => { btn.innerText = "Calculate Fold-Space"; btn.classList.replace('text-red-400', 'text-blue-400'); btn.classList.replace('bg-red-900/30', 'bg-blue-900/30'); btn.classList.replace('border-red-800/50', 'border-blue-800/50'); }, 2000);
        }
        return;
    }
    if (startId === endId) { AppState.activeRoute = null; const res = document.getElementById('nav-result'); if(res) res.classList.add('hidden'); return; }
    let path = [];
    if (startId === 7) path = [7, endId]; else if (endId === 7) path = [startId, 7]; else path = [startId, 7, endId];
    AppState.activeRoute = path;
    let totalDist = 0;
    for(let i=0; i<path.length-1; i++) {
        let s1 = DATA.systems[path[i]]; let s2 = DATA.systems[path[i+1]];
        totalDist += Math.hypot(s2.baseX - s1.baseX, s2.baseY - s1.baseY);
    }
    const cost = Math.floor(totalDist * 0.42);
    const res = document.getElementById('nav-result'); if(res) { res.classList.remove('hidden'); res.classList.add('flex'); }
    const distEl = document.getElementById('nav-dist'); const spiceEl = document.getElementById('nav-spice');
    if(distEl) distEl.textContent = Math.floor(totalDist) + ' Parsecs'; if(spiceEl) spiceEl.textContent = cost.toLocaleString() + ' Solari';
    AudioEngine.playUI('whir'); 
    
    if(!AppState.toggles.guildRoutes) { toggleLayer('guildRoutes'); const tourToggle = document.getElementById('tour-toggle-guildRoutes'); if(tourToggle) tourToggle.checked = true; }
    AppState.targetScale = 0.12; const offsets = getScreenTargetOffsets(); AppState.targetOffsetX = offsets.x; AppState.targetOffsetY = offsets.y;
}

// ==========================================
// MENTAT INTELLIGENCE SCANNER
// ==========================================
export function updateMentatScanner(obj, type) {
    const scanner = document.getElementById('mentat-scanner'); const body = document.getElementById('scanner-body');
    const target = document.getElementById('scanner-target'); const status = document.getElementById('scanner-status'); const yearEl = document.getElementById('scanner-year');
    if(!scanner || !body || !target || !status || !yearEl) return;

    scanner.classList.remove('hidden'); scanner.classList.add('flex');
    target.textContent = (obj.name || obj.starName || '').toUpperCase();
    const year = Math.floor(AppState.imperialYear);
    yearEl.textContent = year < 0 ? `${Math.abs(year)} BG` : `${year} AG`;
    status.textContent = 'ACTIVE SCAN'; AudioEngine.playUI('whir'); 

    let html = '';
    if (type === 'body' || type === 'moon') {
        const factionColor = DATA.factions[obj.faction] || '#52525b'; let threat = 'LOW'; let threatColor = '#22c55e';
        if (obj.faction === 'Harkonnen' || obj.faction === 'Thinking Machines' || obj.faction === 'Honored Matres') { threat = 'HIGH'; threatColor = '#f97316'; } 
        else if (obj.name === 'Arrakis' || obj.name === 'Salusa Secundus' || obj.name === 'Corrin') { threat = 'EXTREME'; threatColor = '#ef4444'; } 
        else if (obj.faction !== 'None') { threat = 'MODERATE'; threatColor = '#eab308'; }
        
        html += `<div class="mb-3"><div class="flex justify-between items-center mb-1"><span class="scanner-label">Threat Assessment</span><span class="mono text-[10px] font-bold" style="color:${threatColor}">${threat}</span></div><div class="w-full h-1 bg-zinc-900 rounded-full overflow-hidden"><div class="scanner-bar h-full rounded-full" style="width:${threat==='EXTREME'?'95':threat==='HIGH'?'70':threat==='MODERATE'?'45':'20'}%; background: linear-gradient(90deg, ${threatColor}, ${threatColor}88)"></div></div></div>`;
        if (obj.faction && obj.faction !== 'None') html += `<div class="flex justify-between items-center py-1 border-t border-cyan-900/30"><span class="scanner-label">Faction Control</span><span class="mono text-[10px]" style="color:${factionColor}">${obj.faction.toUpperCase()}</span></div>`;
        if (obj.atmo) html += `<div class="mt-2 pt-2 border-t border-cyan-900/30"><span class="scanner-label block mb-1.5">Atmospheric Analysis</span><div class="grid grid-cols-2 gap-x-3 gap-y-1"><div><span class="scanner-label" style="font-size:7px">Type</span><div class="scanner-value">${obj.atmo.type}</div></div><div><span class="scanner-label" style="font-size:7px">Pressure</span><div class="scanner-value">${obj.atmo.pressure}</div></div><div><span class="scanner-label" style="font-size:7px">Composition</span><div class="scanner-value">${obj.atmo.comp}</div></div><div><span class="scanner-label" style="font-size:7px">Temperature</span><div class="scanner-value">${obj.atmo.temp}</div></div></div></div>`;
        if (obj.spice) {
            const spiceLevel = 70 + Math.sin(Date.now() / 2000) * 25;
            html += `<div class="mt-2 pt-2 border-t border-cyan-900/30"><div class="flex justify-between items-center mb-1"><span class="scanner-label" style="color: #f59e0b">⚡ Spice Saturation</span><span class="mono text-[10px] text-amber-400 font-bold">${Math.floor(spiceLevel)}%</span></div><div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${spiceLevel}%; background: linear-gradient(90deg, #d97706, #f59e0b); box-shadow: 0 0 8px rgba(245,158,11,0.6); transition: width 0.3s"></div></div></div>`;
        }
        if (obj.wormActivity) html += `<div class="mt-2 pt-2 border-t border-cyan-900/30"><div class="flex justify-between items-center"><span class="scanner-label" style="color: #f97316">🪱 Worm Activity</span><span class="mono text-[10px] text-orange-400 animate-pulse font-bold">ACTIVE</span></div><div class="mono text-[9px] text-orange-300/50 mt-1">Seismic signatures detected in deep desert zones</div></div>`;
        if (obj.export && obj.export !== 'None') html += `<div class="mt-2 pt-2 border-t border-cyan-900/30"><span class="scanner-label">Primary Export</span><div class="scanner-value mt-0.5">${obj.export}</div></div>`;
    } else if (type === 'star' || type === 'system') {
        const planets = DATA.bodies.filter(b => b.system === obj.id); const habitable = planets.filter(b => b.faction !== 'None');
        html += `<div class="mb-2"><span class="scanner-label">Star Classification</span><div class="scanner-value mt-0.5">${obj.starType || 'Unknown'}</div></div>`;
        html += `<div class="flex gap-4 py-2 border-t border-cyan-900/30"><div><span class="scanner-label">Bodies</span><div class="mono text-lg text-cyan-300 font-bold">${planets.length}</div></div><div><span class="scanner-label">Colonized</span><div class="mono text-lg text-amber-400 font-bold">${habitable.length}</div></div></div>`;
        planets.forEach(p => {
            const fc = DATA.factions[p.faction] || '#52525b';
            html += `<div class="flex items-center gap-2 py-1 border-t border-cyan-900/20"><div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${p.color}"></div><span class="scanner-value flex-1 truncate">${p.name}</span><span class="mono text-[8px]" style="color:${fc}">${p.faction !== 'None' ? p.faction : '—'}</span></div>`;
        });
    } else { html += `<div class="scanner-value text-center py-4 opacity-50">Mentat analysis unavailable for this entity class.</div>`; }
    body.innerHTML = html;
}

// ==========================================
// UI CONTROLS & TIMELINE
// ==========================================
export function stepYear(amount) {
    AppState.imperialYear += amount;
    const slider = document.getElementById('timeline-slider');
    if (slider) {
        if (AppState.imperialYear < parseInt(slider.min)) AppState.imperialYear = parseInt(slider.min);
        if (AppState.imperialYear > parseInt(slider.max)) AppState.imperialYear = parseInt(slider.max);
    }
    AppState.isPlaying = false; if (AppState.cinematicMode) AppState.cinematicPaused = true;
    const playIcon = document.getElementById('play-icon'); const pauseIcon = document.getElementById('pause-icon');
    if (playIcon && pauseIcon) { playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden'); }
    const cinePlay = document.getElementById('cine-play-icon'); const cinePause = document.getElementById('cine-pause-icon');
    if (cinePlay && cinePause) { cinePlay.classList.remove('hidden'); cinePause.classList.add('hidden'); }
    updateEra(); AudioEngine.playUI('click');
}

export function updateEra() {
    let newEra = 0;
    for(let i = DATA.eras.length - 1; i >= 0; i--) { if(AppState.imperialYear >= DATA.eras[i].start) { newEra = DATA.eras[i].id; break; } }
    const year = Math.floor(AppState.imperialYear); const yearLabel = year < 0 ? `${Math.abs(year)} BG` : `${year} AG`;

    const yd = document.getElementById('year-display'); if(yd) yd.textContent = yearLabel;
    const ts = document.getElementById('timeline-slider'); if(ts) ts.value = AppState.imperialYear;
    const cts = document.getElementById('cine-timeline-slider'); if(cts) cts.value = AppState.imperialYear;
    const cy = document.getElementById('cinematic-year'); if(cy) cy.textContent = yearLabel; 
    
    if(AppState.currentEra !== newEra) {
        AppState.currentEra = newEra; const eraObj = DATA.eras.find(e => e.id === newEra);
        if(eraObj) { 
            const ed = document.getElementById('era-display'); if(ed) ed.textContent = eraObj.name; 
            const ce = document.getElementById('cinematic-era'); if(ce) ce.textContent = eraObj.name; 
        }
        buildSidebarLists();
    }

    if (AppState.focusedObject && AppState.focusedObject.birth !== undefined) { showInfo(AppState.focusedObject, 'character'); }
    if (AppState.isPlaying && !AppState.isReplayingBattle) { checkEventTrigger(AppState.prevYear || AppState.imperialYear - 0.1, AppState.imperialYear); AppState.prevYear = AppState.imperialYear; }

    let foundEvent = null;
    for(let ev of DATA.events) { if(AppState.imperialYear >= ev.year && AppState.imperialYear <= ev.year + ev.duration) { foundEvent = ev; break; } }
    
    const ticker = document.getElementById('holonet-ticker'); const tickerTxt = document.getElementById('ticker-text'); const cineTicker = document.getElementById('cinematic-ticker');
    if(foundEvent !== AppState.activeEvent) {
        AppState.activeEvent = foundEvent;
        if(foundEvent) {
            AudioEngine.playUI('event'); AppState.eventPulse = 0;
            if(ticker) ticker.classList.remove('hidden'); if(tickerTxt) tickerTxt.textContent = `${foundEvent.title.toUpperCase()} — ${foundEvent.desc}`;
            if(cineTicker) { cineTicker.textContent = `${foundEvent.title.toUpperCase()} — ${foundEvent.desc}`; cineTicker.classList.add('event-active'); }
            const evSys = DATA.systems[foundEvent.system];
            if (evSys) updateMentatScanner(evSys, 'system');
            if(AppState.cinematicMode && AppState.autoCamera) disableAutoCam();
            if (evSys && AppState.cinematicMode) focusObject(evSys, 'star');
        } else {
            if(ticker) ticker.classList.add('hidden');
            if(cineTicker) { cineTicker.textContent = "Observing Imperial Space..."; cineTicker.classList.remove('event-active'); }
        }
    }
    const scannerYear = document.getElementById('scanner-year'); if (scannerYear) scannerYear.textContent = yearLabel;
}

export function toggleLayer(key) { 
    AppState.toggles[key] = !AppState.toggles[key]; 
    const tourBtn = document.getElementById('tour-toggle-' + key);
    if (tourBtn) {
        if (AppState.toggles[key]) { tourBtn.classList.replace('opacity-40', 'opacity-100'); tourBtn.classList.remove('grayscale'); } 
        else { tourBtn.classList.replace('opacity-100', 'opacity-40'); tourBtn.classList.add('grayscale'); }
    }
    AudioEngine.playUI('click'); 
}

export function disableAutoCam() {
    if(AppState.cinematicMode && AppState.autoCamera) {
        AppState.autoCamera = false; const btn = document.getElementById('cine-auto-cam-btn');
        if(btn) { btn.textContent = 'AUTO-CAM: OFF'; btn.classList.replace('text-amber-500', 'text-zinc-400'); btn.classList.replace('border-amber-500/50', 'border-zinc-700'); btn.classList.remove('bg-black/60', 'hover:bg-amber-500/20'); btn.classList.add('bg-zinc-800/80'); }
    }
}

export function toggleAutoCam() {
    AppState.autoCamera = !AppState.autoCamera; const btn = document.getElementById('cine-auto-cam-btn'); if(!btn) return;
    if(AppState.autoCamera) {
        btn.textContent = 'AUTO-CAM: ON'; btn.classList.replace('text-zinc-400', 'text-amber-500'); btn.classList.replace('border-zinc-700', 'border-amber-500/50'); btn.classList.remove('bg-zinc-800/80'); btn.classList.add('bg-black/60', 'hover:bg-amber-500/20');
        if (AppState.activeEvent) focusObject(DATA.systems[AppState.activeEvent.system], 'star');
    } else {
        btn.textContent = 'AUTO-CAM: OFF'; btn.classList.replace('text-amber-500', 'text-zinc-400'); btn.classList.replace('border-amber-500/50', 'border-zinc-700'); btn.classList.remove('bg-black/60', 'hover:bg-amber-500/20'); btn.classList.add('bg-zinc-800/80');
    }
    AudioEngine.playUI('click'); 
}

export function switchTab(idx) {
    document.querySelectorAll('.tab-button').forEach((b, i) => b.classList.toggle('active', i === idx));
    document.querySelectorAll('[id^="tab-content-"]').forEach((d, i) => d.classList.toggle('hidden', i !== idx));
    AudioEngine.playUI('click');
}

// ==========================================
// DYNAMIC LORE ENGINE (INFO PANEL)
// ==========================================
// THE MISSING FUNCTION HAS BEEN RESTORED HERE
export function adjustSpeed(amount) {
    let newSpeed = Math.max(1, Math.min(1200, AppState.timeRate + amount));
    AppState.timeRate = newSpeed;
    const slider = document.getElementById('time-speed-slider');
    if(slider) slider.value = newSpeed;
    const disp = document.getElementById('speed-display');
    if(disp) disp.textContent = newSpeed + 'y/m';
    const ts = document.getElementById('cine-tour-speed');
    if(ts) ts.value = newSpeed;
    AudioEngine.playUI('click');
}

export function showInfo(obj, typeStr) {
    if (!obj || typeStr === 'moon') return;
    const pnl = document.getElementById('info-panel'); const infoName = document.getElementById('info-name');
    if(!pnl || !infoName) return;

    infoName.textContent = obj.name || obj.starName || "Unknown Entity";
    let iconHtml = '', typeLbl = ''; const grid = document.getElementById('info-grid'); if(grid) grid.innerHTML = '';
    const addField = (lbl, val) => { if(val && grid) grid.innerHTML += `<div><div class="mono text-[9px] text-zinc-600 uppercase tracking-widest">${lbl}</div><div class="text-zinc-200 text-sm">${val}</div></div>`; };

    pnl.style.boxShadow = "0 0 60px rgba(0,0,0,0.9), inset 0 0 50px rgba(245,158,11,0.08)"; pnl.style.borderColor = "rgba(245,158,11,0.25)";

    if(typeStr === 'body') {
        iconHtml = `<div class="absolute inset-0 m-auto w-8 h-8 rounded-full" style="background:radial-gradient(circle at 30% 30%,#fff,${obj.color || '#fff'},#000)"></div>`; typeLbl = 'Planet';
        addField('System', DATA.systems[obj.system] ? DATA.systems[obj.system].name : 'Unknown'); addField('Dominant House', obj.house); addField('Primary Export', obj.export); addField('Key Locations', obj.locations);
    } else if (typeStr === 'star' || typeStr === 'system') {
        iconHtml = `<div class="absolute inset-0 m-auto w-8 h-8 rounded-full shadow-[0_0_12px_${obj.sunColor || '#fff'}]" style="background:radial-gradient(circle at 30% 30%,#fff,${obj.sunColor || '#fff'},#000)"></div>`; typeLbl = 'Star System';
        addField('Star Classification', obj.starType || obj.starName); addField('Major Planets', DATA.bodies.filter(b=>b.system===obj.id).map(b=>b.name).join(', '));
    } else if (typeStr === 'character') {
        iconHtml = `<div class="absolute inset-0 flex items-center justify-center title text-3xl text-amber-500">${(obj.name || '?').charAt(0)}</div>`; typeLbl = 'Character';
        
        let status = "Alive"; let ageStr = "Unknown"; let currentLoc = obj.origin || "Unknown"; let statusColor = "#22c55e"; 
        const currentYear = Math.floor(AppState.imperialYear);
        
        if (obj.birth !== undefined && obj.death !== undefined) {
            if (currentYear < obj.birth) { status = "Not Yet Born"; ageStr = `Expected ${obj.birth < 0 ? Math.abs(obj.birth) + ' BG' : obj.birth + ' AG'}`; statusColor = "#94a3b8"; } 
            else if (currentYear > obj.death) { status = "Deceased"; ageStr = `Died at age ${obj.death - obj.birth}`; statusColor = "#ef4444"; } 
            else { status = "Alive"; ageStr = `${currentYear - obj.birth} Standard Years`; statusColor = "#22c55e"; }
        }

        if (obj.history && currentYear >= (obj.birth !== undefined ? obj.birth : -99999)) {
            let latestHistory = null;
            for(let h of obj.history) { if (currentYear >= h.y) latestHistory = h; }
            currentLoc = latestHistory ? latestHistory.loc : (obj.origin || "Unknown");
        } else if (obj.birth !== undefined && currentYear < obj.birth) { currentLoc = "Unknown (Pre-Birth)"; }

        if (status === "Deceased") { pnl.style.boxShadow = "0 0 60px rgba(0,0,0,0.9), inset 0 0 50px rgba(239,68,68,0.15)"; pnl.style.borderColor = "rgba(239,68,68,0.3)"; }

        if(grid) {
            grid.innerHTML += `<div><div class="mono text-[9px] text-zinc-600 uppercase tracking-widest">Status</div><div class="text-sm font-bold" style="color:${statusColor}">${status}</div></div>
                <div><div class="mono text-[9px] text-zinc-600 uppercase tracking-widest">Current Age</div><div class="text-zinc-200 text-sm">${ageStr}</div></div>
                <div><div class="mono text-[9px] text-zinc-600 uppercase tracking-widest">Known Location</div><div class="text-zinc-200 text-sm font-semibold text-amber-400">${currentLoc}</div></div>
                <div><div class="mono text-[9px] text-zinc-600 uppercase tracking-widest">Origin</div><div class="text-zinc-200 text-sm">${obj.origin || 'Unknown'}</div></div>`;
        }
        if (obj.aliases) addField('Aliases', obj.aliases);
    } else if (typeStr === 'artifact') {
        iconHtml = `<div class="absolute inset-0 flex items-center justify-center text-2xl">✦</div>`; typeLbl = 'Imperial Relic';
    } else if (typeStr === 'school') {
        iconHtml = `<div class="absolute inset-0 flex items-center justify-center text-2xl">❖</div>`; typeLbl = 'School / Order'; addField('Headquarters', obj.location);
    }
    
    const wikiName = encodeURIComponent((obj.name || obj.starName || '').replace(/ /g, '_')); const wikiUrl = `https://dune.fandom.com/wiki/${wikiName}`;
    if(grid) grid.innerHTML += `<div class="mt-2"><a href="${wikiUrl}" target="_blank" class="mono text-[9px] text-amber-500 hover:text-amber-400 font-semibold underline tracking-wider uppercase inline-flex items-center gap-1">Fandom Archives <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a></div>`;

    const leftSlot = document.getElementById('info-left-slot'); if(leftSlot) leftSlot.innerHTML = iconHtml; 
    const typeEl = document.getElementById('info-type'); if(typeEl) typeEl.textContent = typeLbl; 
    const factEl = document.getElementById('info-fact'); if(factEl) factEl.textContent = obj.fact || '';
    pnl.classList.add('open');
}

export function closeInfo() { 
    const pnl = document.getElementById('info-panel');
    if(pnl && pnl.classList.contains('open')) { pnl.classList.remove('open'); AudioEngine.playUI('minimize'); }
    AppState.focusedObject = null; AudioEngine.updateAtmosphere(); 
}

export function buildSidebarLists() {
    populateNavigator(); 
    [0,1,2,3].forEach(i => { const el = document.getElementById(`tab-content-${i}`); if(el) el.innerHTML = ''; });
    const makeCard = (obj, type, tabIdx) => {
        const div = document.createElement('div'); div.className = "celestial-card flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50 cursor-pointer";
        div.innerHTML = `<div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${obj.color || obj.sunColor || '#f59e0b'}"></div><span class="text-[11px] truncate">${obj.name}</span>`;
        div.onclick = () => { if (type === 'character' || type === 'school' || type === 'artifact') { focusEntity(obj, type); } else { focusObject(obj, type); } }; 
        const container = document.getElementById(`tab-content-${tabIdx}`); if(container) container.appendChild(div);
    };
    
    const inCurrentEra = (obj) => {
        if(obj.birth !== undefined && obj.death !== undefined) {
            const currentEraData = DATA.eras.find(e => e.id === AppState.currentEra);
            if (currentEraData) return obj.birth <= currentEraData.end && obj.death >= currentEraData.start; return true;
        }
        if(!obj.eras) return true;
        return obj.eras.some(e => { const eraObj = DATA.eras.find(er => er.id === e.era); return eraObj && AppState.imperialYear >= eraObj.start && AppState.imperialYear <= eraObj.end; });
    };

    DATA.bodies.filter(inCurrentEra).forEach(b => makeCard(b, 'body', 0));
    DATA.schools.filter(inCurrentEra).forEach(s => makeCard(s, 'school', 1));
    DATA.characters.filter(inCurrentEra).forEach(c => makeCard(c, 'character', 2));
    DATA.artifacts.filter(inCurrentEra).forEach(a => makeCard(a, 'artifact', 3));
}

// RESTORED DYNAMIC ENTITY FOCUSING
export function focusEntity(obj, type) {
    try {
        AppState.focusedObject = obj;
        let targetLocationName = null;
        if (type === 'character' && obj.history) {
            const currentYear = Math.floor(AppState.imperialYear); let latestLoc = obj.origin || "Unknown";
            for (let h of obj.history) { if (currentYear >= h.y) latestLoc = h.loc; }
            targetLocationName = latestLoc;
        } else if (type === 'school' && obj.location) { targetLocationName = obj.location; }

        let celestialTarget = null;
        if (targetLocationName && targetLocationName !== "Unknown") {
            celestialTarget = DATA.bodies.find(b => b.name === targetLocationName) || DATA.systems.find(s => s.name.includes(targetLocationName) || s.starName === targetLocationName);
        }

        if (celestialTarget) {
            centerOn(celestialTarget, celestialTarget.baseX !== undefined ? 'system' : 'body'); updateMentatScanner(celestialTarget, celestialTarget.baseX !== undefined ? 'system' : 'body');
        } else if (type !== 'character' && type !== 'school' && type !== 'artifact') {
            centerOn(obj, type);
        } else {
            const offsets = getScreenTargetOffsets(); AppState.targetOffsetX = offsets.x; AppState.targetOffsetY = offsets.y; AppState.targetScale = 0.15; 
        }

        showInfo(obj, type); AudioEngine.playUI('focus'); AudioEngine.updateAtmosphere();
        if(window.innerWidth < 1024 && !AppState.cinematicMode) {
            const sb = document.getElementById('sidebar'); if(sb) sb.classList.add('collapsed');
            const ov = document.getElementById('overlay'); if(ov) ov.classList.add('hidden');
        }
    } catch (err) { console.error("Lore Engine Navigation Error: ", err); }
}

export function togglePlay() {
    AppState.isPlaying = !AppState.isPlaying;
    if(AppState.cinematicMode) { AppState.cinematicPaused = !AppState.isPlaying; }
    const playIcon = document.getElementById('play-icon'); const pauseIcon = document.getElementById('pause-icon');
    if (playIcon && pauseIcon) { if(AppState.isPlaying) { playIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden'); } else { playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden'); } }
    const cinePlay = document.getElementById('cine-play-icon'); const cinePause = document.getElementById('cine-pause-icon');
    if (cinePlay && cinePause) { if(AppState.isPlaying) { cinePlay.classList.add('hidden'); cinePause.classList.remove('hidden'); } else { cinePlay.classList.remove('hidden'); cinePause.classList.add('hidden'); } }
    AudioEngine.playUI('click');
}

export function toggleSidebar() {
    const sb = document.getElementById('sidebar'); if(sb) sb.classList.toggle('collapsed');
    const ov = document.getElementById('overlay'); if(ov) ov.classList.toggle('hidden');
    AudioEngine.playUI('click');
}

export function startCinematicTour() {
    AppState.cinematicMode = true; AppState.cinematicPaused = false; AppState.isPlaying = true;
    if (!AppState.autoCamera) toggleAutoCam();
    const playIcon = document.getElementById('play-icon'); const pauseIcon = document.getElementById('pause-icon');
    if (playIcon && pauseIcon) { playIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden'); }
    const cinePlay = document.getElementById('cine-play-icon'); const cinePause = document.getElementById('cine-pause-icon');
    if (cinePlay && cinePause) { cinePlay.classList.add('hidden'); cinePause.classList.remove('hidden'); }

    const head = document.getElementById('top-header'); if(head) head.style.transform = "translateY(-100%)";
    const sb = document.getElementById('sidebar'); if(sb) sb.classList.add('collapsed');
    const ov = document.getElementById('overlay'); if(ov) ov.classList.add('hidden');
    closeInfo(); const cb = document.getElementById('cinematic-bar'); if(cb) { cb.classList.remove('hidden-tour'); cb.classList.add('flex'); }
    AudioEngine.playUI('focus'); 
    
    if (AppState.focusedObject && AppState.focusedObject.baseX !== undefined) { centerOn(AppState.focusedObject, 'system');
    } else { if(window.innerWidth >= 1024) { AppState.targetOffsetX += 160; AppState.currentOffsetX += 160; } }
}

export function exitCinematicTour() {
    AppState.cinematicMode = false; AppState.isPlaying = false;
    const playIcon = document.getElementById('play-icon'); const pauseIcon = document.getElementById('pause-icon');
    if (playIcon && pauseIcon) { playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden'); }
    const cinePlay = document.getElementById('cine-play-icon'); const cinePause = document.getElementById('cine-pause-icon');
    if (cinePlay && cinePause) { cinePlay.classList.remove('hidden'); cinePause.classList.add('hidden'); }
    
    const head = document.getElementById('top-header'); if(head) head.style.transform = "translateY(0)";
    if(window.innerWidth >= 1024) { const sb = document.getElementById('sidebar'); if(sb) sb.classList.remove('collapsed'); }
    const cb = document.getElementById('cinematic-bar'); if(cb) cb.classList.add('hidden-tour');
    AudioEngine.playUI('minimize'); 
    
    if (AppState.focusedObject && AppState.focusedObject.baseX !== undefined) { centerOn(AppState.focusedObject, 'system');
    } else { if(window.innerWidth >= 1024) { AppState.targetOffsetX -= 160; AppState.currentOffsetX -= 160; } }
}

export function jumpToEvent(year) { AppState.imperialYear = year; updateEra(); AudioEngine.playUI('focus'); }

window._searchResults = [];
export function selectSearch(idx) {
    const res = window._searchResults[idx]; const dd = document.getElementById('search-dropdown');
    if(dd) dd.classList.add('hidden'); const s = document.getElementById('search'); if(s) s.value = ''; 
    if (res.type === 'character' || res.type === 'school' || res.type === 'artifact') { focusEntity(res, res.type); } else { focusObject(res, res.type); }
}

export function initEventListeners() {
    canvas.addEventListener('mousedown', e => { disableAutoCam(); AppState.isPanning = true; AppState.dragDist = 0; const pos = getMousePos(e); AppState.prevPanX = pos.x; AppState.prevPanY = pos.y; });
    window.addEventListener('mousemove', e => {
        if(!AppState.isPanning) return;
        const pos = getMousePos(e); const dx = pos.x - AppState.prevPanX; const dy = pos.y - AppState.prevPanY;
        AppState.targetOffsetX += dx; AppState.targetOffsetY += dy; AppState.currentOffsetX = AppState.targetOffsetX; AppState.currentOffsetY = AppState.targetOffsetY;
        AppState.prevPanX = pos.x; AppState.prevPanY = pos.y; AppState.dragDist += Math.hypot(dx, dy);
    });
    window.addEventListener('mouseup', () => { AppState.isPanning = false; });

    canvas.addEventListener('wheel', e => {
        e.preventDefault(); disableAutoCam();
        const pos = getMousePos(e); const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
        const nextScale = Math.max(0.05, Math.min(25, AppState.targetScale * zoomFactor));
        const wx = (pos.x - (canvas.width/dpr)/2 - AppState.targetOffsetX) / AppState.targetScale; const wy = (pos.y - (canvas.height/dpr)/2 - AppState.targetOffsetY) / AppState.targetScale;
        AppState.targetScale = nextScale; AppState.targetOffsetX = pos.x - (canvas.width/dpr)/2 - wx * nextScale; AppState.targetOffsetY = pos.y - (canvas.height/dpr)/2 - wy * nextScale;
    });

    canvas.addEventListener('click', e => { if(AppState.dragDist > 5) return; handleTap(getMousePos(e).x, getMousePos(e).y); });

    canvas.addEventListener('touchstart', e => {
        disableAutoCam();
        if(e.touches.length === 1) { AppState.isPanning = true; AppState.dragDist = 0; const pos = getMousePos(e); AppState.prevPanX = pos.x; AppState.prevPanY = pos.y; } 
        else if(e.touches.length === 2) AppState.lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, {passive: false});

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if(e.touches.length === 1 && AppState.isPanning) {
            const pos = getMousePos(e); const dx = pos.x - AppState.prevPanX; const dy = pos.y - AppState.prevPanY;
            AppState.targetOffsetX += dx; AppState.targetOffsetY += dy; AppState.currentOffsetX = AppState.targetOffsetX; AppState.currentOffsetY = AppState.targetOffsetY;
            AppState.prevPanX = pos.x; AppState.prevPanY = pos.y; AppState.dragDist += Math.hypot(dx, dy);
        } else if(e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const nextScale = Math.max(0.05, Math.min(25, AppState.targetScale * (dist / AppState.lastPinchDist)));
            const cx_ = (e.touches[0].clientX + e.touches[1].clientX)/2; const cy_ = (e.touches[0].clientY + e.touches[1].clientY)/2;
            const rect = canvas.getBoundingClientRect(); const mx = cx_ - rect.left; const my = cy_ - rect.top;
            const wx = (mx - (canvas.width/dpr)/2 - AppState.targetOffsetX) / AppState.targetScale; const wy = (my - (canvas.height/dpr)/2 - AppState.targetOffsetY) / AppState.targetScale;
            AppState.targetScale = nextScale; AppState.targetOffsetX = mx - (canvas.width/dpr)/2 - wx * nextScale; AppState.targetOffsetY = my - (canvas.height/dpr)/2 - wy * nextScale;
            AppState.lastPinchDist = dist;
        }
    }, {passive: false});

    canvas.addEventListener('touchend', e => { if(e.changedTouches.length === 1 && AppState.dragDist < 10) handleTap(getMousePos(e.changedTouches[0]).x, getMousePos(e.changedTouches[0]).y); AppState.isPanning = false; });

    const searchEl = document.getElementById('search');
    if(searchEl) {
        searchEl.addEventListener('input', function(e) {
            const term = this.value.toLowerCase().trim(); const dd = document.getElementById('search-dropdown');
            if(!dd) return; if(!term) { dd.classList.add('hidden'); return; }
            let results = [];
            DATA.bodies.forEach(b => { if(b.name.toLowerCase().includes(term)) results.push({...b, type:'body'}); });
            DATA.systems.forEach(s => { if(s.name.toLowerCase().includes(term) || s.starName.toLowerCase().includes(term)) results.push({...s, type:'star'}); });
            DATA.characters.forEach(c => { if(c.name.toLowerCase().includes(term) || (c.aliases && c.aliases.toLowerCase().includes(term))) results.push({...c, type:'character'}); });
            DATA.artifacts.forEach(a => { if(a.name.toLowerCase().includes(term)) results.push({...a, type:'artifact'}); });
            if(results.length > 0) {
                window._searchResults = results;
                dd.innerHTML = results.slice(0,8).map((r, i) => `
                    <div class="px-3 py-2 cursor-pointer text-sm hover:bg-zinc-800 border-b border-zinc-800/50 flex justify-between items-center" onclick="selectSearch(${i})">
                        <span>${r.name || r.starName}</span><span class="mono text-[8px] text-amber-500 uppercase tracking-wider">${r.type}</span>
                    </div>`).join('');
                dd.classList.remove('hidden');
            } else { dd.innerHTML = `<div class="px-3 py-2 text-xs text-zinc-600">No records found in Imperial archives...</div>`; dd.classList.remove('hidden'); }
        });
    }
}

function handleTap(mx, my) {
    if (AppState.minimapHitbox && mx >= AppState.minimapHitbox.x && mx <= AppState.minimapHitbox.x + AppState.minimapHitbox.w &&
        my >= AppState.minimapHitbox.y && my <= AppState.minimapHitbox.y + AppState.minimapHitbox.h) {
        if (!AppState.minimapExpanded) { AppState.minimapExpanded = true; AudioEngine.playUI('click'); return; }
        const tRect = AppState.minimapToggleRect;
        if (tRect && mx >= tRect.x && mx <= tRect.x + tRect.w && my >= tRect.y && my <= tRect.y + tRect.h) { AppState.minimapExpanded = false; AudioEngine.playUI('click'); return; }
        if (AppState.minimapData && my > AppState.minimapHitbox.y + 32) { 
            const { cx, cy, mapScale } = AppState.minimapData; const worldX = (mx - cx) / mapScale; const worldY = (my - cy) / mapScale;
            const offsets = getScreenTargetOffsets(); AppState.targetOffsetX = offsets.x - (worldX * AppState.targetScale); AppState.targetOffsetY = offsets.y - (worldY * AppState.targetScale);
            disableAutoCam(); AudioEngine.playUI('click'); return; 
        }
        return; 
    }

    let tapped = null; let type = '';
    for(let moon of DATA.moonData) { const pos = getAbsolutePos(moon, 'moon'); const r = Math.max(15, moon.size * AppState.currentScale); if(Math.hypot(mx - pos.x, my - pos.y) < r + 10) { tapped = moon; type = 'moon'; break; } }
    if(!tapped) { for(let body of DATA.bodies) { const pos = getAbsolutePos(body, 'body'); const r = Math.max(18, body.size * AppState.currentScale); if(Math.hypot(mx - pos.x, my - pos.y) < r + 10) { tapped = body; type = 'body'; break; } } }
    if(!tapped) { for(let sys of DATA.systems) { const pos = getAbsolutePos(sys, 'system'); const r = Math.max(22, 22 * AppState.currentScale); if(Math.hypot(mx - pos.x, my - pos.y) < r + 15) { tapped = sys; type = 'star'; break; } } }

    if(tapped) {
        const now = Date.now(); let isDoubleTap = false;
        if(now - AppState.lastTapTime < 300 && AppState.focusedObject === tapped) { AppState.zoomedSystem = tapped.id !== undefined ? tapped.id : tapped.system; isDoubleTap = true; }
        focusObject(tapped, type, isDoubleTap); AppState.lastTapTime = now;
    } else { 
        closeInfo(); AppState.zoomedSystem = null; 
        const scanner = document.getElementById('mentat-scanner'); if(scanner) { scanner.classList.add('hidden'); scanner.classList.remove('flex'); }
    }
}