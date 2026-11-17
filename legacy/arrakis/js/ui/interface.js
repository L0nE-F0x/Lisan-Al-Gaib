import { DATA, CONFIG } from '../data/arrakis-lore.js';
import { AppState, emit, subscribe } from '../core/state.js';
import { playUI } from '../core/audio.js';

let activeDropdown = null;

export function initUI() {
    createTopNav();
    createInfoPanel();

    // REMOVED THE CONSOLE LOG, MENTAT WEB IS NOW LIVE!
    // The actual openMentatWeb function is bound globally by mentat-analysis.js

    subscribe('toggle-changed', () => {
        if (activeDropdown === 'systems') renderDropdownContent('systems');
    });
}

function createTopNav() {
    const navBar = document.getElementById('top-nav-bar');
    if (!navBar) return;

    navBar.innerHTML = `
        <button onclick="window.toggleDropdown('locations')" id="nav-locations" class="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold tracking-[0.2em] text-zinc-400 border border-transparent rounded-sm hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center gap-1" title="View Map Locations">
            LOCATIONS <span class="text-[8px] opacity-50">▼</span>
        </button>
        <button onclick="window.toggleDropdown('characters')" id="nav-characters" class="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold tracking-[0.2em] text-zinc-400 border border-transparent rounded-sm hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center gap-1" title="View Dramatis Personae">
            PERSONNEL <span class="text-[8px] opacity-50">▼</span>
        </button>
        <button onclick="window.toggleDropdown('systems')" id="nav-systems" class="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold tracking-[0.2em] text-zinc-400 border border-transparent rounded-sm hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center gap-1" title="View System Toggles">
            SYSTEMS <span class="text-[8px] opacity-50">▼</span>
        </button>
        
        <div class="ml-auto flex items-center pr-2">
            <button onclick="window.openMentatWeb()" class="px-3 md:px-4 py-1.5 md:py-2 bg-cyan-950/40 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/60 hover:border-cyan-400 transition-all font-bold tracking-[0.2em] text-[10px] md:text-xs flex items-center justify-center gap-2 group shadow-[0_0_15px_rgba(6,182,212,0.15)] rounded-sm whitespace-nowrap" title="Launch Mentat Computation Matrix">
                <svg class="w-3 h-3 md:w-4 md:h-4 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                <span class="hidden sm:inline">MENTAT</span> WEB
            </button>
        </div>
    `;

    window.toggleDropdown = (type) => {
        playUI('click');
        if (activeDropdown === type) {
            window.closeDropdown();
        } else {
            activeDropdown = type;
            updateNavStyles();
            renderDropdownContent(type);
            document.getElementById('dropdown-backdrop').classList.remove('hidden');
        }
    };

    window.closeDropdown = () => {
        playUI('minimize');
        activeDropdown = null;
        updateNavStyles();
        document.getElementById('dropdown-area').innerHTML = '';
        document.getElementById('dropdown-backdrop').classList.add('hidden');
    };
}

function updateNavStyles() {
    ['locations', 'characters', 'systems'].forEach(t => {
        const btn = document.getElementById(`nav-${t}`);
        if (!btn) return;
        if (t === activeDropdown) {
            btn.classList.add('bg-amber-500/10', 'text-amber-500', 'border-amber-500/30');
            btn.classList.remove('text-zinc-400', 'border-transparent');
        } else {
            btn.classList.remove('bg-amber-500/10', 'text-amber-500', 'border-amber-500/30');
            btn.classList.add('text-zinc-400', 'border-transparent');
        }
    });
}

function renderDropdownContent(type) {
    const area = document.getElementById('dropdown-area');
    let contentHtml = '';

    if (type === 'locations') {
        DATA.locations.forEach(loc => {
            contentHtml += `
                <button onclick="window.selectItem('${loc.id}', 'location')" class="w-full text-left px-4 py-3 bg-gradient-to-r hover:from-amber-500/10 hover:to-transparent text-zinc-300 hover:text-white border-b border-amber-500/10 hover:border-amber-500/30 transition-all flex items-center gap-4 group" title="Focus Camera on ${loc.name}">
                    <span class="text-xl group-hover:scale-110 group-hover:text-amber-400 transition-all">${loc.icon}</span> 
                    <div>
                        <div class="font-medium tracking-wide text-sm">${loc.name.toUpperCase()}</div>
                        <div class="text-[9px] text-zinc-500 mono tracking-widest uppercase mt-0.5">${loc.faction}</div>
                    </div>
                </button>`;
        });
    } 
    else if (type === 'characters') {
        DATA.characters.forEach(char => {
            contentHtml += `
                <button onclick="window.selectItem('${char.id}', 'character')" class="w-full text-left px-4 py-3 bg-gradient-to-r hover:from-amber-500/10 hover:to-transparent text-zinc-300 hover:text-white border-b border-amber-500/10 hover:border-amber-500/30 transition-all flex items-center gap-4 group" title="Track ${char.name} on the map">
                    <span class="w-2.5 h-2.5 shadow-[0_0_8px_${char.color}] rotate-45 flex-shrink-0" style="background-color: ${char.color}"></span> 
                    <div class="min-w-0">
                        <div class="font-medium tracking-wide text-sm truncate">${char.name.toUpperCase()}</div>
                        <div class="text-[9px] text-zinc-500 mono tracking-widest uppercase mt-0.5 truncate">${char.house}</div>
                    </div>
                </button>`;
        });
    }
    else if (type === 'systems') {
        const toggleNames = { 
            stars: "Deep Space Telemetry", orbits: "Orbital Pathways", moons: "Lunar Satellites", 
            atmosphere: "Atmospheric Simulation", labels: "Cartographic Labels", mentatVision: "Mentat Vision Overlay",
            territories: "Territorial Control", uiOverlay: "HUD Overlay (Press 'H')" 
        };
        Object.keys(AppState.toggles).forEach(key => {
            if (!toggleNames[key]) return;
            const isActive = AppState.toggles[key];
            contentHtml += `
                <div class="flex items-center justify-between px-4 py-3 border-b border-amber-500/10 hover:bg-white/5" title="Toggle ${toggleNames[key]}">
                    <span class="text-xs font-medium tracking-widest text-zinc-400 uppercase">${toggleNames[key]}</span>
                    <button onclick="window.toggleSetting('${key}')" class="relative w-10 h-5 rounded-full transition-colors border ${isActive ? 'bg-amber-500/20 border-amber-500/50' : 'bg-zinc-900 border-zinc-700'}">
                        <div class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform ${isActive ? 'translate-x-5 bg-amber-500' : 'translate-x-0 bg-zinc-500'}"></div>
                    </button>
                </div>
            `;
        });
        
        window.toggleSetting = (key) => {
            playUI('click');
            AppState.toggles[key] = !AppState.toggles[key];
            if (key === 'uiOverlay') { 
                if (!AppState.toggles.uiOverlay) document.body.classList.add('zen-mode'); 
                else document.body.classList.remove('zen-mode'); 
            }
            emit('toggle-changed', { key, value: AppState.toggles[key] });
            renderDropdownContent('systems'); 
        };
    }

    area.innerHTML = `
        <div class="w-[95vw] sm:w-[320px] bg-black/80 backdrop-blur-xl border border-amber-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.8)] rounded-md overflow-hidden pointer-events-auto flex flex-col max-h-[60vh] animate-in fade-in slide-in-from-top-4 duration-200">
            <div class="overflow-y-auto no-scrollbar flex-1 pb-2">
                ${contentHtml}
            </div>
        </div>
    `;
}

function createInfoPanel() {
    if (document.getElementById('info-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'info-panel';
    panel.className = 'fixed top-16 right-2 left-2 md:top-20 md:right-6 md:left-auto w-auto md:w-[380px] max-h-[55vh] md:max-h-[80vh] glass rounded-sm p-4 md:p-5 z-50 overflow-y-auto no-scrollbar border border-amber-500/40 transition-all duration-300 opacity-0 pointer-events-none translate-y-4 flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)]';
    panel.innerHTML = `
        <button onclick="window.closeInfo()" class="absolute top-3 right-4 text-zinc-500 hover:text-amber-500 transition-colors text-2xl leading-none">&times;</button>
        <div class="flex gap-4 items-start mb-4 border-b border-amber-500/20 pb-3">
            <div id="info-icon" class="w-12 h-12 flex-shrink-0 border border-amber-500/50 bg-amber-500/10 flex items-center justify-center text-2xl shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]"></div>
            <div class="flex-1 min-w-0 pt-1">
                <h2 id="info-title" class="title text-xl md:text-2xl text-white truncate leading-none mb-1 uppercase tracking-wide"></h2>
                <div id="info-subtitle" class="text-amber-500/80 mono text-[9px] md:text-[10px] tracking-[0.25em] uppercase"></div>
            </div>
        </div>
        <div id="info-body" class="space-y-1"></div>
    `;
    document.body.appendChild(panel);
}

function createAccordion(title, content, isOpen = false) {
    return `
        <details class="mb-2 border border-amber-500/20 bg-black/30 open:bg-black/50 transition-colors duration-200 cursor-pointer group" ${isOpen ? 'open' : ''}>
            <summary class="px-3 py-2 text-[10px] text-amber-500 uppercase tracking-widest select-none outline-none group-hover:text-amber-400 flex justify-between items-center">
                ${title}
                <span class="text-amber-500/50 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div class="px-3 pb-3 pt-1 text-xs text-zinc-300 leading-relaxed cursor-text">${content}</div>
        </details>
    `;
}

window.selectItem = (id, type) => {
    window.closeDropdown();

    let item = null;
    if (type === 'location') item = DATA.locations.find(l => l.id === id);
    else if (type === 'character') item = DATA.characters.find(c => c.id === id);
    else if (type === 'body') item = DATA.bodies.find(b => b.name === id);
    else if (type === 'moon') item = DATA.moons.find(m => m.name === id);
    else if (type === 'star') item = DATA.star;
    else if (type === 'building') {
        for (let loc of DATA.locations) {
            if (loc.localMap && loc.localMap.buildings) {
                let found = loc.localMap.buildings.find(b => b.id === id);
                if (found) { item = found; item.parentLoc = loc; break; }
            }
        }
    }
    
    if (!item) return;
    
    AppState.focusedObject = item;
    AppState.focusedObjectType = type;
    AppState.isCameraLocked = true;
    AppState.forceCenterOnNextFrame = true;
    AppState.scanAnim = 1.0; 
    
    if (type === 'building') AppState.targetScale = Math.min(250.0, 7.0); // BUG FIX: Capped to prevent zoom overshoot 
    else if (type === 'location' || type === 'character') AppState.targetScale = 9.0; 
    else if (type === 'body') AppState.targetScale = 4.0;
    else if (type === 'moon') AppState.targetScale = 6.0;
    else if (type === 'star') AppState.targetScale = 1.0;

    emit('focus-changed', { item, type });
    playUI('focus');

    const panel = document.getElementById('info-panel');
    panel.style.display = 'flex';
    setTimeout(() => { panel.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4'); }, 10);

    let subtitleStr = ""; let iconStr = "📄";
    if (type === 'location') { subtitleStr = `${item.faction} Faction • ${item.type}`; iconStr = item.icon; }
    else if (type === 'body') { subtitleStr = `Celestial Body • ${item.type}`; iconStr = "🪐"; }
    else if (type === 'moon') { subtitleStr = `Lunar Satellite`; iconStr = "🌕"; }
    else if (type === 'star') { subtitleStr = `Star • ${item.type}`; iconStr = "☀️"; }
    else if (type === 'character') { subtitleStr = `Dramatis Personae • House ${item.house}`; iconStr = "👤"; }
    else if (type === 'building') { subtitleStr = `${item.faction} Faction • Tactical Level`; iconStr = item.icon; }

    document.getElementById('info-title').innerText = item.name;
    document.getElementById('info-subtitle').innerText = subtitleStr;
    document.getElementById('info-icon').innerText = iconStr;

    let bodyHtml = "";
    bodyHtml += createAccordion("Primary Log", item.desc || item.fact, true);

    if (type === 'building') {
        let stats = `<div class="grid grid-cols-2 gap-2 mt-1"><div><span class="text-amber-500/60 mono text-[9px] block">FACILITY</span><span class="capitalize">${item.type.replace('_', ' ')}</span></div><div><span class="text-amber-500/60 mono text-[9px] block">STAFFING</span><span>${item.population || 'Restricted'}</span></div></div>`;
        bodyHtml += createAccordion("Structural Data", stats, true);
        if (item.lore) bodyHtml += createAccordion("Historical Context", `<div class="border-l border-amber-500/50 pl-2 py-1 text-zinc-400 italic">${item.lore}</div>`, false);
    }
    else if (type === 'location') {
        let stats = `<div class="grid grid-cols-2 gap-2 mt-1"><div><span class="text-amber-500/60 mono text-[9px] block">REGION</span><span class="capitalize">${item.region.replace('_', ' ')}</span></div><div><span class="text-amber-500/60 mono text-[9px] block">POPULATION</span><span>${item.population || 'Unknown'}</span></div></div>`;
        bodyHtml += createAccordion("Geographic Data", stats, true);
        if (item.lore) bodyHtml += createAccordion("Historical Context", `<div class="border-l border-amber-500/50 pl-2 py-1 text-zinc-400 italic">${item.lore}</div>`, false);
        if (item.characters && item.characters.length) {
            let charTags = `<div class="flex flex-wrap gap-1 mt-1">${item.characters.map(c => `<span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] border border-zinc-700">${c}</span>`).join('')}</div>`;
            bodyHtml += createAccordion("Known Associates", charTags, false);
        }
        if (item.events && item.events.length) {
            let evTags = `<div class="flex flex-wrap gap-1 mt-1">${item.events.map(e => `<span class="bg-red-900/30 text-red-300 px-2 py-0.5 rounded text-[10px] border border-red-800/50">${e}</span>`).join('')}</div>`;
            bodyHtml += createAccordion("Recorded Events", evTags, false);
        }
    } 
    else if (type === 'body') {
        let stats = `<div class="grid grid-cols-2 gap-2 mt-1"><div><span class="text-amber-500/60 mono text-[9px] block">PLANET TYPE</span><span class="capitalize">${item.type}</span></div><div><span class="text-amber-500/60 mono text-[9px] block">ECCENTRICITY</span><span>${item.eccentricity}</span></div></div>`;
        bodyHtml += createAccordion("Orbital Mechanics", stats, true);
        if (item.atmosphere) {
            let atm = `<div class="bg-cyan-950/20 border border-cyan-900/50 p-2 mt-1 rounded text-[10px] text-cyan-200/70 grid gap-1"><div><strong class="text-cyan-400">Class:</strong> ${item.atmosphere.type}</div><div><strong class="text-cyan-400">Comp:</strong> ${item.atmosphere.composition}</div><div><strong class="text-cyan-400">Pressure:</strong> ${item.atmosphere.pressure}</div><div><strong class="text-cyan-400">Temp:</strong> ${item.atmosphere.avgTemp}</div></div>`;
            bodyHtml += createAccordion("Atmospheric Scan", atm, false);
        }
    } 
    else if (type === 'character') {
        let stats = `<div class="flex items-center gap-4 mb-2"><div class="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-600 shadow-inner"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 flex-1"><div><span class="text-amber-500/60 mono text-[9px] block">FACTION</span><span class="capitalize">${item.house}</span></div><div><span class="text-amber-500/60 mono text-[9px] block">HOMEWORLD</span><span class="capitalize">${item.origin || 'Unknown'}</span></div></div></div>`;
        bodyHtml += createAccordion("Biographical Data", stats, true);
        let tracking = `<div class="border-l-2 border-cyan-500/50 pl-3 py-1 bg-cyan-500/5 text-[10px] text-cyan-300 mt-1"><strong class="uppercase tracking-widest text-[9px] mb-1 block">Live Tracking Enabled</strong>Signal locked. Adjust the timeline to trace the subject's movement history.</div>`;
        bodyHtml += createAccordion("Mentat Tracking", tracking, true);
        if (item.aliases) bodyHtml += createAccordion("Known Aliases", item.aliases, false);
        if (item.quote) bodyHtml += createAccordion("Recorded Quotation", `<div class="italic text-amber-500/90 font-serif">"${item.quote.replace(/"/g, '')}"</div>`, false);
    }

    const wikiName = encodeURIComponent((item.name).replace(/ /g, '_'));
    bodyHtml += `
        <div class="mt-4 flex justify-end">
            <a href="https://dune.fandom.com/wiki/${wikiName}" target="_blank" class="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-widest mono text-amber-600 hover:text-amber-400 transition-colors">
                Access Imperial Archives
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
        </div>
    `;
    document.getElementById('info-body').innerHTML = bodyHtml;
};

window.closeInfo = () => {
    playUI('minimize');
    const panel = document.getElementById('info-panel');
    panel.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    setTimeout(() => { panel.style.display = 'none'; }, 300); 
    AppState.focusedObject = null;
    AppState.focusedObjectType = null;
};

// 3D Globe click handler — opens the info panel for a location without
// touching the 2D camera state (scale, offsets, camera lock).
window.selectItem3D = (locationId) => {
    const item = DATA.locations.find(l => l.id === locationId);
    if (!item) return;

    AppState.focusedObject = item;
    AppState.focusedObjectType = 'location';
    AppState.scanAnim = 1.0;

    emit('focus-changed', { item, type: 'location' });
    playUI('focus');

    // Open the info panel with location details
    const panel = document.getElementById('info-panel');
    panel.style.display = 'flex';
    setTimeout(() => { panel.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4'); }, 10);

    document.getElementById('info-title').innerText = item.name;
    document.getElementById('info-subtitle').innerText = `${item.faction} Faction • ${item.type}`;
    document.getElementById('info-icon').innerText = item.icon;

    let bodyHtml = "";
    bodyHtml += createAccordion("Primary Log", item.desc || item.fact, true);

    let stats = `<div class="grid grid-cols-2 gap-2 mt-1"><div><span class="text-amber-500/60 mono text-[9px] block">REGION</span><span class="capitalize">${item.region.replace('_', ' ')}</span></div><div><span class="text-amber-500/60 mono text-[9px] block">POPULATION</span><span>${item.population || 'Unknown'}</span></div></div>`;
    bodyHtml += createAccordion("Geographic Data", stats, true);
    if (item.lore) bodyHtml += createAccordion("Historical Context", `<div class="border-l border-amber-500/50 pl-2 py-1 text-zinc-400 italic">${item.lore}</div>`, false);
    if (item.characters && item.characters.length) {
        let charTags = `<div class="flex flex-wrap gap-1 mt-1">${item.characters.map(c => `<span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] border border-zinc-700">${c}</span>`).join('')}</div>`;
        bodyHtml += createAccordion("Known Associates", charTags, false);
    }
    if (item.events && item.events.length) {
        let evTags = `<div class="flex flex-wrap gap-1 mt-1">${item.events.map(e => `<span class="bg-red-900/30 text-red-300 px-2 py-0.5 rounded text-[10px] border border-red-800/50">${e}</span>`).join('')}</div>`;
        bodyHtml += createAccordion("Recorded Events", evTags, false);
    }

    const wikiName = encodeURIComponent((item.name).replace(/ /g, '_'));
    bodyHtml += `
        <div class="mt-4 flex justify-end">
            <a href="https://dune.fandom.com/wiki/${wikiName}" target="_blank" class="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-widest mono text-amber-600 hover:text-amber-400 transition-colors">
                Access Imperial Archives
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
        </div>
    `;
    document.getElementById('info-body').innerHTML = bodyHtml;
};
