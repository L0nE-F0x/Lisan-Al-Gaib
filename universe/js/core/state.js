import { DATA } from '../data/dune-lore.js';

export let isAppRunning = false;

export function setAppRunning(value) {
    isAppRunning = value;
}

export const AppState = { 
    currentEra: 0, 
    isPlaying: false, 
    imperialYear: 10191, 
    timeRate: 50,
    prevYear: 10191,
    
    toggles: { 
        stars: true, orbits: true, moons: true, planetNames: true, atmosphere: true, nebula: true,
        houseRings: true, guildRoutes: false, events: true, tethers: true, spiceParticles: true, wormSign: true 
    }, 
    
    currentScale: 0.15, targetScale: 0.15,
    currentOffsetX: 0, targetOffsetX: 0,
    currentOffsetY: 0, targetOffsetY: 0,
    
    isPanning: false, prevPanX: 0, prevPanY: 0, dragDist: 0, 
    bgStars: [], 
    focusedObject: null, 
    zoomedSystem: null, 
    lastTapTime: 0, 
    
    cinematicMode: false, 
    cinematicPaused: false, 
    autoCamera: true, 
    lastAutoCamTime: 0,
    
    activeEvent: null, 
    eventPulse: 0,
    
    // Advanced Battle Engine State
    isReplayingBattle: false,
    battleEntities: [],
    battleState: {
        time: 0,
        phase: 1,
        goodKills: 0,
        badKills: 0,
        effects: [],
        ended: false
    },

    minimapExpanded: true,
    minimapHitbox: { x:0, y:0, w:0, h:0 },
    minimapToggleRect: { x:0, y:0, w:0, h:0 },
    minimapData: { cx:0, cy:0, mapScale:0 },

    activeChapterId: 'all',
    activeRoute: null
};

export function initSpiceParticles() {
    DATA.spiceParticles = [];
    for (let i = 0; i < 60; i++) {
        DATA.spiceParticles.push({
            angle: Math.random() * Math.PI * 2,
            dist: 50 + Math.random() * 200,
            speed: 0.001 + Math.random() * 0.003,
            size: 0.5 + Math.random() * 2,
            alpha: 0.2 + Math.random() * 0.6,
            drift: Math.random() * 0.5
        });
    }
    DATA.wormSigns = [];
    for (let i = 0; i < 5; i++) {
        DATA.wormSigns.push({
            angle: Math.random() * Math.PI * 2,
            dist: 80 + Math.random() * 100,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0002 + Math.random() * 0.0005
        });
    }
}