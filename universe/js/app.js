import { initStars, draw, resetView, focusObject, closeBattle, closeBattleSummary } from './render/canvas-engine.js';
import { initSpiceParticles, AppState, isAppRunning, setAppRunning } from './core/state.js';
import { AudioEngine } from './core/audio.js';
import { DATA } from './data/dune-lore.js';
import { 
    updateEra, buildSidebarLists, switchTab, jumpToEvent, 
    toggleLayer, toggleAutoCam, adjustSpeed, togglePlay, 
    startCinematicTour, exitCinematicTour, toggleSidebar, closeInfo, 
    initEventListeners, selectSearch, calculateJump, checkEventTrigger, stepYear,
    startBattleSimulation, closeEventModal, changeChapter, toggleNavigator
} from './ui/interface.js';

// ==========================================
// BULLETPROOF GLOBAL BINDINGS
// ==========================================
// We bind these immediately so the HTML buttons never lose reference to them.
window.startApp = function() {
    setAppRunning(true);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('opacity-0', 'invisible');
    }
    lastTime = performance.now();
    requestAnimationFrame(loop);
};

window.toggleSidebar = toggleSidebar;
window.toggleMusic = () => AudioEngine.toggleMusic();
window.toggleSfx = () => AudioEngine.toggleSfx();
window.startCinematicTour = startCinematicTour;
window.adjustSpeed = adjustSpeed;
window.togglePlay = togglePlay;
window.toggleLayer = toggleLayer;
window.switchTab = switchTab;
window.resetView = resetView;
window.closeInfo = closeInfo;
window.toggleAutoCam = toggleAutoCam;
window.exitCinematicTour = exitCinematicTour;
window.jumpToEvent = jumpToEvent;
window.selectSearch = selectSearch;
window.calculateJump = calculateJump;
window.stepYear = stepYear;
window.startBattleSimulation = startBattleSimulation;
window.closeEventModal = closeEventModal;
window.changeChapter = changeChapter; 
window.toggleNavigator = toggleNavigator;
window.closeBattle = closeBattle;
window.closeBattleSummary = closeBattleSummary;

let lastTime = performance.now();

function loop() {
    if (!isAppRunning) return;
    const now = performance.now(); 
    const dt = now - lastTime; 
    lastTime = now;
    
    if(AppState.isPlaying) {
        const speedEl = document.getElementById('cine-tour-speed');
        let currentRateYPM = AppState.cinematicMode ? (speedEl ? parseInt(speedEl.value) : 50) : AppState.timeRate;
        let currentRateYPS = currentRateYPM / 60.0; 
        
        AppState.imperialYear += currentRateYPS * (dt / 1000);
        
        const slider = document.getElementById('timeline-slider');
        if (slider) {
            const maxYear = parseInt(slider.max);
            const minYear = parseInt(slider.min);
            if(AppState.imperialYear > maxYear) AppState.imperialYear = minYear; 
        }
        
        updateEra();
        
        // AI DIRECTOR LOGIC
        if(AppState.cinematicMode && !AppState.activeEvent && AppState.autoCamera) {
            if (now - AppState.lastAutoCamTime > 15000) {
                const populated = DATA.bodies.filter(b => b.faction !== 'None');
                if(populated.length > 0) {
                    const target = populated[Math.floor(Math.random() * populated.length)];
                    focusObject(target, 'body');
                }
                AppState.lastAutoCamTime = now;
            } else if (!AppState.focusedObject) {
                AppState.targetOffsetX = Math.sin(now / 8000) * 150;
                AppState.targetOffsetY = Math.cos(now / 8000) * 150;
            }
        }
    }
    
    draw(); 
    requestAnimationFrame(loop);
}

window.onload = () => {
    try {
        initStars(); 
        initSpiceParticles();
        buildSidebarLists(); 
        switchTab(0); 
        initEventListeners();

        const select = document.getElementById('chapter-select');
        if (select) {
            DATA.eras.forEach(era => {
                const opt = document.createElement('option');
                opt.value = era.id;
                const startLabel = era.start < 0 ? Math.abs(era.start) + ' BG' : era.start + ' AG';
                opt.textContent = `${era.name.toUpperCase()} (${startLabel} - ${era.end} AG)`;
                select.appendChild(opt);
            });
        }

        const cineSelect = document.getElementById('cine-chapter-select');
        if (cineSelect) {
            DATA.eras.forEach(era => {
                const opt = document.createElement('option');
                opt.value = era.id;
                const startLabel = era.start < 0 ? Math.abs(era.start) + ' BG' : era.start + ' AG';
                opt.textContent = `${era.name.toUpperCase()} (${startLabel} - ${era.end} AG)`;
                cineSelect.appendChild(opt);
            });
        }

        changeChapter('all');

        const mainSlider = document.getElementById('timeline-slider');
        if (mainSlider) {
            mainSlider.addEventListener('input', e => {
                AppState.isPlaying = false;
                AppState.imperialYear = parseInt(e.target.value);
                updateEra();
            });
        }

        const cineSlider = document.getElementById('cine-timeline-slider');
        if (cineSlider) {
            cineSlider.addEventListener('input', e => {
                AppState.isPlaying = false;
                AppState.imperialYear = parseInt(e.target.value);
                updateEra();
            });
        }

        const mainSpeed = document.getElementById('time-speed-slider');
        if (mainSpeed) {
            mainSpeed.addEventListener('input', e => {
                AppState.timeRate = parseInt(e.target.value);
                const speedDisp = document.getElementById('speed-display');
                if (speedDisp) speedDisp.textContent = AppState.timeRate + 'y';
            });
        }

        const cineSpeed = document.getElementById('cine-tour-speed');
        if (cineSpeed) {
            cineSpeed.addEventListener('input', e => {
                AppState.timeRate = parseInt(e.target.value);
                if (mainSpeed) mainSpeed.value = AppState.timeRate;
                const speedDisp = document.getElementById('speed-display');
                if (speedDisp) speedDisp.textContent = AppState.timeRate + 'y';
            });
        }
        
        draw();
    } catch (err) {
        console.error("CRITICAL BOOT ERROR:", err);
    }
};