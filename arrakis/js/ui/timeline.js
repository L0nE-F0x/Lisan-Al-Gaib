import { AppState, subscribe, emit } from '../core/state.js';
import { playUI } from '../core/audio.js';
import { DATA } from '../data/arrakis-lore.js';
import { playEventCinematic } from './cinematic.js';

const MIN_YEAR = -500;
const MAX_YEAR = 15300;

let lastYearUpdate = -9999;
let lastAutoPlayYear = 10191;

export function initTimelineUI() {
    // Ensure AppState timeRate defaults to 1x on boot
    AppState.timeRate = 1;

    const container = document.createElement('div');
    container.id = 'timeline-container';
    
    // THE FLOATING ISLAND DESIGN
    container.className = 'absolute bottom-4 left-1/2 -translate-x-1/2 w-[96%] md:w-[600px] lg:w-[800px] p-2 md:p-3 bg-black/80 backdrop-blur-md border border-amber-500/40 rounded-lg flex flex-col justify-center z-[50] transition-transform duration-500 translate-y-0 pointer-events-auto shadow-[0_10px_40px_rgba(0,0,0,0.8)]';
    
    container.innerHTML = `
        <button id="timeline-minimize-btn" onclick="window.toggleTimelineMinimize()" class="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 border border-amber-500/40 border-b-0 text-amber-500 px-4 py-1 rounded-t-md text-[9px] mono tracking-widest hover:bg-amber-500/20 transition-colors" title="Minimize/Maximize Timeline">
            ▼ MINIMIZE
        </button>

        <div class="w-full">
            <div class="flex items-end justify-between mb-1 md:mb-2">
                <div>
                    <div id="era-name" class="title text-amber-500 text-base md:text-xl tracking-[0.2em] uppercase leading-none mb-1" title="Current Historical Era">Era Name</div>
                    <div id="era-desc" class="text-zinc-400 text-[9px] md:text-[10px] max-w-[200px] sm:max-w-[250px] md:max-w-[400px] truncate mono" title="Era Details">Era Description</div>
                </div>
                <div class="text-right flex flex-col items-end">
                    <div class="mono text-xl md:text-3xl text-white tracking-wider leading-none" title="Current Imperial Year"><span id="current-year">10191</span><span class="text-amber-600/80 text-xs md:text-sm ml-1">AG</span></div>
                    <select id="speed-select" onchange="window.changeSpeed(this.value)" class="mt-1 bg-transparent border border-amber-500/30 text-amber-500/80 text-[8px] md:text-[9px] py-0.5 px-1 uppercase tracking-widest outline-none hover:bg-amber-500/10 transition-colors cursor-pointer rounded-sm" title="Adjust Simulation Speed">
                        <option value="1" selected>1x Speed</option>
                        <option value="10">10x Speed</option>
                        <option value="50">50x Speed</option>
                        <option value="200">200x Speed</option>
                        <option value="1000">1000x Speed</option>
                    </select>
                </div>
            </div>
            
            <div class="flex items-center gap-2 md:gap-4 relative mt-1">
                <button id="play-btn" onclick="window.toggleTimeline()" class="w-7 h-7 md:w-9 md:h-9 flex-shrink-0 flex items-center justify-center rounded-sm bg-amber-500/10 border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)] text-[10px] md:text-sm" title="Play/Pause Simulation">
                    ▶
                </button>
                
                <div class="flex-1 relative h-4 md:h-6 flex flex-col justify-end pb-1" title="Drag to scrub through history">
                    <div id="event-track" class="absolute bottom-1 md:bottom-2 left-0 right-0 h-3 pointer-events-none"></div>
                    <input type="range" id="timeline-slider" min="${MIN_YEAR}" max="${MAX_YEAR}" value="10191" class="w-full relative z-10 outline-none cursor-pointer">
                </div>
            </div>
        </div>
    `;
    
    // Append to workspace
    document.getElementById('workspace').appendChild(container);
    
    window.triggerEventCinematic = playEventCinematic;
    generateEventNotches();

    subscribe('year-changed', () => { updateEra(false); });
    subscribe('playback-stopped', () => { document.getElementById('play-btn').innerText = '▶'; });

    window.toggleTimeline = () => {
        playUI('click');
        AppState.isPlaying = !AppState.isPlaying;
        document.getElementById('play-btn').innerText = AppState.isPlaying ? '⏸' : '▶';
        if (AppState.isPlaying) lastAutoPlayYear = AppState.imperialYear; 
    };

    window.scrubTimeline = (val) => {
        AppState.imperialYear = parseFloat(val);
        lastAutoPlayYear = AppState.imperialYear; 
        emit('year-changed', AppState.imperialYear); 
    };

    window.toggleTimelineMinimize = () => {
        playUI('minimize');
        const c = document.getElementById('timeline-container');
        const b = document.getElementById('timeline-minimize-btn');
        if (c.classList.contains('translate-y-[calc(100%+20px)]')) {
            c.classList.remove('translate-y-[calc(100%+20px)]');
            b.innerText = '▼ MINIMIZE';
        } else {
            c.classList.add('translate-y-[calc(100%+20px)]');
            b.innerText = '▲ EXPAND';
        }
    };

    const slider = document.getElementById('timeline-slider');
    slider.addEventListener('input', (e) => window.scrubTimeline(e.target.value));

    window.changeSpeed = (val) => { AppState.timeRate = parseFloat(val); playUI('click'); };
    
    updateEra(true);
}

function generateEventNotches() {
    const track = document.getElementById('event-track');
    const range = MAX_YEAR - MIN_YEAR;
    let html = '';
    DATA.events.forEach(ev => {
        const percent = ((ev.year - MIN_YEAR) / range) * 100;
        html += `
            <div class="absolute bottom-0 w-1 h-3 border-l-2 border-amber-500/80 group pointer-events-auto cursor-pointer hover:border-white hover:h-4 transition-all z-20" style="left: ${percent}%;" onclick="window.triggerEventCinematic('${ev.title.replace(/'/g, "\\'")}', true)" title="View Log: ${ev.title}">
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 md:w-48 p-2 bg-black/95 border border-amber-500/40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-lg pointer-events-none z-[60] rounded-sm">
                    <div class="font-bold text-[10px] md:text-xs mb-0.5 leading-tight" style="color: ${ev.color}">${ev.title}</div>
                    <div class="text-zinc-400 mono text-[8px] md:text-[9px] uppercase">${ev.year} AG • ${ev.location.replace(/_/g, ' ')}</div>
                </div>
            </div>
        `;
    });
    track.innerHTML = html;
}

export function updateEra(force = false) {
    const currentYear = AppState.imperialYear;
    const floorYear = Math.floor(currentYear);
    
    if (AppState.isPlaying && currentYear > lastAutoPlayYear) {
        const crossedEvent = DATA.events.find(e => e.year > lastAutoPlayYear && e.year <= currentYear);
        if (crossedEvent && (currentYear - lastAutoPlayYear) < 100) {
            playUI('event');
            playEventCinematic(crossedEvent.title, false);
        }
    }
    lastAutoPlayYear = currentYear;

    if (floorYear === lastYearUpdate && !force) return;
    lastYearUpdate = floorYear;

    const slider = document.getElementById('timeline-slider');
    const yearDisplay = document.getElementById('current-year');
    
    if (slider) slider.value = floorYear; 
    if (yearDisplay) yearDisplay.innerText = floorYear;

    const activeEra = DATA.eras.find(e => floorYear >= e.start && floorYear < e.end) || DATA.eras[DATA.eras.length - 1];
    const eraNameDisplay = document.getElementById('era-name');
    const eraDescDisplay = document.getElementById('era-desc');
    
    if (eraNameDisplay && eraNameDisplay.innerText !== activeEra.name) {
        eraNameDisplay.innerText = activeEra.name;
        eraDescDisplay.innerText = activeEra.desc;
    }

    DATA.locations.forEach(loc => {
        if (loc.factionHistory) {
            const validHistories = loc.factionHistory.filter(h => h.year <= floorYear);
            if (validHistories.length > 0) {
                const currentFaction = validHistories[validHistories.length - 1].faction;
                loc.faction = currentFaction;
                if (DATA.factions[currentFaction]) {
                    loc.color = DATA.factions[currentFaction];
                }
            }
        }
    });

    if (AppState.focusedObject && AppState.focusedObject.type && AppState.focusedObject.factionHistory) {
        const subtitle = document.getElementById('info-subtitle');
        if (subtitle) {
            subtitle.innerText = `${AppState.focusedObject.faction} Faction • ${AppState.focusedObject.type}`;
        }
    }
}
