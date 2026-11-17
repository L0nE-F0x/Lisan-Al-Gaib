import { AppState } from '../core/state.js';
import { playUI } from '../core/audio.js';
import { DATA } from '../data/arrakis-lore.js';

let searchIndex = [];
let isPaletteOpen = false;
let selectedIndex = 0;
let currentResults = [];

export function initCommandPalette() {
    buildSearchIndex();
    createPaletteDOM();
    attachEventListeners();
    
    // Expose globally so the HTML header button works natively
    window.toggleCommandPalette = togglePalette;
}

function buildSearchIndex() {
    searchIndex = [];
    
    // Index Locations
    if (DATA.locations) {
        DATA.locations.forEach(loc => {
            searchIndex.push({ id: loc.id, name: loc.name, type: 'location', desc: loc.desc, icon: loc.icon || '📍', color: loc.color });
        });
    }
    
    // Index Characters
    if (DATA.characters) {
        DATA.characters.forEach(char => {
            searchIndex.push({ id: char.id, name: char.name, type: 'character', desc: char.fact || `House ${char.house}`, icon: '👤', color: char.color });
        });
    }
    
    // Index Historical Events
    if (DATA.events) {
        DATA.events.forEach(ev => {
            searchIndex.push({ id: ev.title, name: ev.title, type: 'event', desc: `${ev.year} AG • ${ev.desc}`, icon: '📜', color: ev.color });
        });
    }
    
    // Index Celestial Bodies
    if (DATA.bodies) {
        DATA.bodies.forEach(body => {
            searchIndex.push({ id: body.name, name: body.name, type: 'body', desc: body.fact, icon: '🪐', color: body.color });
        });
    }

    // Index Regions
    if (DATA.regions) {
        DATA.regions.forEach(reg => {
            searchIndex.push({ id: reg.id, name: reg.name, type: 'region', desc: reg.desc, icon: '🗺️', color: reg.color });
        });
    }
}

function createPaletteDOM() {
    const container = document.createElement('div');
    container.id = 'command-palette-backdrop';
    container.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] hidden items-start justify-center pt-[10vh] md:pt-[15vh] px-4 opacity-0 transition-opacity duration-200';
    
    container.innerHTML = `
        <div id="command-palette-window" class="bg-zinc-950 border border-amber-500/30 w-full max-w-2xl rounded-md shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transform scale-95 transition-transform duration-200">
            
            <div class="p-4 border-b border-zinc-800 flex items-center gap-3">
                <svg class="w-6 h-6 text-amber-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input type="text" id="command-input" class="w-full bg-transparent text-white text-lg md:text-xl outline-none placeholder-zinc-600 font-mono tracking-wide" placeholder="Search Imperial Archives..." autocomplete="off" spellcheck="false" title="Type to search locations, personnel, or events">
                <button id="command-close" class="text-zinc-500 hover:text-white px-2 py-1 text-xs mono tracking-widest bg-zinc-900 border border-zinc-800 rounded-sm transition-colors" title="Close Search (ESC)">ESC</button>
            </div>
            
            <div id="command-results" class="max-h-[50vh] md:max-h-[60vh] overflow-y-auto no-scrollbar p-2 flex flex-col gap-1">
                </div>
            
            <div class="p-2 border-t border-zinc-800/80 bg-zinc-900/30 text-[9px] md:text-[10px] text-zinc-500 mono flex justify-between uppercase tracking-widest">
                <span>Navigate: â†‘ â†“ • Select: ENTER</span>
                <span>Matches Found: <span id="command-count">0</span></span>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
}

function attachEventListeners() {
    const backdrop = document.getElementById('command-palette-backdrop');
    const input = document.getElementById('command-input');
    const closeBtn = document.getElementById('command-close');
    const windowEl = document.getElementById('command-palette-window');

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) togglePalette(false);
    });

    // Close on ESC button click
    closeBtn.addEventListener('click', () => togglePalette(false));

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Toggle with Ctrl+K or Cmd+K (keeping the hidden shortcut for power users, but removing it from UI)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            togglePalette();
        }
        
        // Close with Escape
        if (e.key === 'Escape' && isPaletteOpen) {
            e.preventDefault();
            togglePalette(false);
        }

        // Navigation inside palette
        if (isPaletteOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
                renderResults();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderResults();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentResults[selectedIndex]) {
                    executeSelection(currentResults[selectedIndex]);
                }
            }
        }
    });

    // Live Search
    input.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });
}

function togglePalette(forceState) {
    const backdrop = document.getElementById('command-palette-backdrop');
    const windowEl = document.getElementById('command-palette-window');
    const input = document.getElementById('command-input');
    
    isPaletteOpen = forceState !== undefined ? forceState : !isPaletteOpen;

    if (isPaletteOpen) {
        playUI('focus');
        // Reset and Open
        input.value = '';
        performSearch('');
        backdrop.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating opacity
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            windowEl.classList.remove('scale-95');
            input.focus();
        });
    } else {
        playUI('minimize');
        // Close and Animate out
        backdrop.classList.add('opacity-0');
        windowEl.classList.add('scale-95');
        input.blur();
        setTimeout(() => {
            backdrop.classList.add('hidden');
        }, 200); // Matches Tailwind duration-200
    }
}

function performSearch(query) {
    query = query.toLowerCase().trim();
    
    if (!query) {
        // Default view: Show a mix of top locations and characters
        currentResults = searchIndex.slice(0, 10);
    } else {
        currentResults = searchIndex.filter(item => {
            return item.name.toLowerCase().includes(query) || 
                   item.desc.toLowerCase().includes(query) || 
                   item.type.toLowerCase().includes(query);
        }).slice(0, 50); // Limit to 50 results for performance
    }
    
    selectedIndex = 0; // Reset selection to top
    renderResults();
}

function renderResults() {
    const container = document.getElementById('command-results');
    const countLabel = document.getElementById('command-count');
    
    countLabel.innerText = currentResults.length;
    
    if (currentResults.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-zinc-500 mono text-xs uppercase tracking-widest">
                No records found in Imperial Archives.
            </div>
        `;
        return;
    }

    let html = '';
    currentResults.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const bgClass = isSelected ? 'bg-amber-500/10 border-amber-500/50' : 'bg-transparent border-transparent hover:bg-zinc-900 border-zinc-900';
        const colorHex = item.color || '#f59e0b'; // Default amber
        
        html += `
            <button data-index="${index}" class="search-result-btn w-full text-left px-3 py-2.5 rounded-sm border ${bgClass} transition-colors flex items-center gap-3 group" title="Access Data: ${item.name}">
                <div class="w-8 h-8 rounded-sm bg-black/50 border border-zinc-800 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                    ${item.icon}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-medium text-zinc-200 truncate group-hover:text-white transition-colors" style="${isSelected ? `color: ${colorHex}` : ''}">${item.name}</span>
                        <span class="text-[9px] mono uppercase px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 flex-shrink-0 tracking-widest">${item.type}</span>
                    </div>
                    <div class="text-[10px] md:text-xs text-zinc-500 truncate mt-0.5 group-hover:text-zinc-400 transition-colors">${item.desc}</div>
                </div>
                ${isSelected ? `<svg class="w-4 h-4 text-amber-500 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>` : ''}
            </button>
        `;
    });
    
    container.innerHTML = html;

    // Attach click listeners to the newly rendered buttons
    const buttons = container.querySelectorAll('.search-result-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            executeSelection(currentResults[idx]);
        });
        
        // Update selection styling on mouse hover
        btn.addEventListener('mouseenter', (e) => {
            selectedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            renderResults(); // Re-render to update the visual highlight
        });
    });

    // Auto-scroll to keep selected item in view
    const selectedBtn = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedBtn) {
        selectedBtn.scrollIntoView({ block: 'nearest' });
    }
}

function executeSelection(item) {
    if (!item) return;
    playUI('focus');
    togglePalette(false); // Close the palette
    
    // Route the selection based on type
    if (item.type === 'event') {
        if (window.triggerEventCinematic) {
            window.triggerEventCinematic(item.id, true);
        }
    } else {
        // For locations, characters, bodies
        if (window.selectItem) {
            // Region is not strictly a selectable 'item' in the normal HUD yet, 
            // but we can default it to location handling if needed.
            const routeType = item.type === 'region' ? 'location' : item.type;
            window.selectItem(item.id, routeType);
        }
    }
}
