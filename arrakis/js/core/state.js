export let isAppRunning = false;

export function setAppRunning(value) {
    isAppRunning = value;
}

const listeners = {};

export function subscribe(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
}

export function emit(event, data) {
    if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
    }
}

export const AppState = { 
    zoomLevel: 'system', 
    imperialYear: 10191, 
    isPlaying: false, 
    timeRate: 50,
    
    toggles: { 
        stars: true, 
        orbits: true, 
        moons: true, 
        labels: true, 
        atmosphere: true, 
        spiceParticles: true, 
        wormSign: true,
        uiOverlay: true,
        mentatVision: false,
        territories: false 
    }, 
    
    currentScale: 0.15, targetScale: 0.15,
    currentOffsetX: 0, targetOffsetX: 0,
    currentOffsetY: 0, targetOffsetY: 0,
    
    isPanning: false, prevPanX: 0, prevPanY: 0, dragDist: 0, 
    momentumX: 0, momentumY: 0, 
    
    bgStars: [], 
    
    focusedObject: null, 
    focusedObjectType: null,
    isCameraLocked: false,
    forceCenterOnNextFrame: false,
    lastTrackedX: null,
    lastTrackedY: null,
    
    lastTapTime: 0,
    scanAnim: 0,
    planetRotation: 0 
};
