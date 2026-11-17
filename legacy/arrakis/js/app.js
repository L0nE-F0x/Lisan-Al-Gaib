// ==========================================
// ARRAKIS SYSTEM — Application Bootstrap
// ==========================================
// All imports wrapped so that if ANY module in the chain fails
// (e.g. Three.js CDN timeout), the error is surfaced visibly
// instead of silently killing window.startApp.

let initUI, initTimelineUI, initCommandPalette, initCinematicUI, initMentatUI;
let draw, initStars;
let AppState;
let initAudio, toggleMute;

let bootError = null;

try {
    const uiMod = await import('./ui/interface.js');
    initUI = uiMod.initUI;

    const tlMod = await import('./ui/timeline.js');
    initTimelineUI = tlMod.initTimelineUI;

    const cpMod = await import('./ui/command-palette.js');
    initCommandPalette = cpMod.initCommandPalette;

    const cineMod = await import('./ui/cinematic.js');
    initCinematicUI = cineMod.initCinematicUI;

    const mentatMod = await import('./ui/mentat-analysis.js');
    initMentatUI = mentatMod.initMentatUI;

    const orchMod = await import('./render/orchestrator.js');
    draw = orchMod.draw;
    initStars = orchMod.initStars;

    const stateMod = await import('./core/state.js');
    AppState = stateMod.AppState;

    const audioMod = await import('./core/audio.js');
    initAudio = audioMod.initAudio;
    toggleMute = audioMod.toggleMute;
} catch (err) {
    bootError = err;
    console.error("CRITICAL MODULE LOAD ERROR:", err);
}

// --- SERVICE WORKER CLEANUP ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
            registration.unregister().then(boolean => {
                if (boolean) console.log("[SYS] Rogue Service Worker neutralized.");
            });
        }
    });
}

// ==========================================
// GLOBAL BINDINGS — available as soon as module executes
// ==========================================
window.startApp = () => {
    // If modules failed to load, show the error on screen
    if (bootError) {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.innerHTML = `
                <div class="text-red-500 mb-4 title text-2xl tracking-widest text-center px-4">SYSTEM BOOT FAILURE</div>
                <div class="text-zinc-400 mono text-xs text-center px-8 max-w-lg leading-relaxed mb-6">${bootError.message}</div>
                <div class="text-zinc-600 mono text-[10px] text-center">Check browser console (F12) for full error trace.</div>
            `;
        }
        return;
    }

    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => loader.remove(), 1000);
    }

    AppState.imperialYear = 10191;
    AppState.timeRate = 1;

    // Initialize UI Components
    initUI();
    initTimelineUI();
    initCommandPalette();
    initCinematicUI(); 
    initMentatUI(); 

    // Initialize background stars
    initStars();

    // Start master render loop
    requestAnimationFrame(gameLoop);
};

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

// ==========================================
// AUDIO TOGGLE
// ==========================================
let audioInitialized = false;

window.toggleAudio = () => {
    if (bootError) return;
    
    if (!audioInitialized) {
        initAudio();
        audioInitialized = true;
    }
    
    const isActive = toggleMute();
    const btn = document.getElementById('audio-btn');
    if (btn) {
        btn.innerText = isActive ? '🔊' : '🔇';
        btn.title = isActive ? 'Mute Audio' : 'Unmute Audio';
    }
};
