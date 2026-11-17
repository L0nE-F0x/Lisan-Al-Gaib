import { AppState, emit } from '../core/state.js';
import { playUI } from '../core/audio.js';
import { DATA } from '../data/arrakis-lore.js';

export function initCinematicUI() {
    const container = document.createElement('div');
    container.id = 'mentat-alert-container';
    // Positioned below the top header, on the right side
    container.className = 'fixed top-20 right-4 md:right-6 z-[100] flex flex-col gap-3 pointer-events-none';
    document.body.appendChild(container);
}

export function playEventCinematic(eventTitle, forceFocus = false) {
    const ev = DATA.events.find(e => e.title === eventTitle);
    if (!ev) return;

    // If the user explicitly clicks a timeline notch, force the camera jump and pause
    if (forceFocus) {
        AppState.isPlaying = false;
        emit('playback-stopped');
        AppState.imperialYear = ev.year;
        emit('year-changed', ev.year);
        const loc = DATA.locations.find(l => l.id === ev.location);
        if (loc && window.selectItem) window.selectItem(loc.id, 'location');
    }

    const container = document.getElementById('mentat-alert-container');
    
    // Create the toast notification
    const alertBox = document.createElement('div');
    alertBox.className = 'bg-zinc-950/95 border border-zinc-800 border-l-4 p-4 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md transform translate-x-[120%] transition-transform duration-500 pointer-events-auto cursor-pointer w-72 md:w-80 flex flex-col gap-2 rounded-r-md group';
    alertBox.style.borderLeftColor = ev.color;
    
    alertBox.innerHTML = `
        <div class="flex items-center justify-between mb-1">
            <span class="mono text-[10px] text-zinc-400 tracking-widest uppercase">YEAR ${ev.year} AG</span>
            <span class="mono text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded uppercase tracking-wider">Log Entry</span>
        </div>
        <h3 class="title text-lg uppercase tracking-wide leading-none drop-shadow-md" style="color: ${ev.color}">${ev.title}</h3>
        <p class="text-xs text-zinc-300 font-serif italic leading-relaxed line-clamp-3">"${ev.desc}"</p>
        <div class="mt-2 text-[9px] mono uppercase tracking-widest text-zinc-500 group-hover:text-amber-500 transition-colors flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            Click to Investigate
        </div>
    `;

    // Clicking the toast brings the camera to the location and pauses the simulation
    alertBox.onclick = () => {
        playUI('focus');
        AppState.isPlaying = false;
        emit('playback-stopped');
        const loc = DATA.locations.find(l => l.id === ev.location);
        if (loc && window.selectItem) window.selectItem(loc.id, 'location');
        dismissToast();
    };

    container.appendChild(alertBox);
    playUI('event');

    // Subtle atmospheric screen flash for battles (non-blocking)
    if (ev.battleType) {
        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-red-600/10 z-[110] pointer-events-none mix-blend-screen transition-opacity duration-1000';
        document.body.appendChild(flash);
        setTimeout(() => { flash.classList.add('opacity-0'); }, 100);
        setTimeout(() => { flash.remove(); }, 1000);
    }

    // Animate in
    requestAnimationFrame(() => {
        alertBox.classList.remove('translate-x-[120%]');
    });

    // Auto dismiss after 8 seconds of not being clicked
    let dismissTimeout = setTimeout(dismissToast, 8000);

    function dismissToast() {
        if (document.body.contains(alertBox)) {
            alertBox.classList.add('translate-x-[120%]');
            setTimeout(() => alertBox.remove(), 500);
        }
    }
}
