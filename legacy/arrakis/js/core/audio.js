import { AppState, subscribe } from './state.js';

let audioCtx;
let isMuted = true; 
let masterGain;

// Procedural Synths
let windOsc, windGain, windFilter;
let droneOsc, droneGain;

export function initAudio() {
    if (audioCtx) return; 

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.4;

    setupAmbientDrone();
    setupWindNoise();

    // Listen to our app events!
    subscribe('focus-changed', () => playMentatScan());
    subscribe('playback-stopped', () => playChime(220)); 
    subscribe('year-changed', () => {
        // Subtle clicking sound when time is flying by
        if (AppState.isPlaying && Math.random() > 0.85) playTick();
    });

    requestAnimationFrame(updateAudioDynamics);
}

export function toggleMute() {
    if (!audioCtx) initAudio();
    
    isMuted = !isMuted;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Smooth volume fade to prevent speaker popping
    masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.4, audioCtx.currentTime, 0.1);
    return !isMuted;
}

// ==========================================
// UI SOUND EFFECTS ENGINE
// Matches the Universe module's SFX palette
// ==========================================
export function playUI(type) {
    if (isMuted || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    if (type === 'click') {
        // Short, snappy click for buttons and toggles
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(800, t); 
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);
        gain.gain.setValueAtTime(0.1, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); 
        osc.stop(t + 0.05);
    } else if (type === 'focus') {
        // Swoosh/ping for camera flying to locations
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(600, t); 
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
        gain.gain.setValueAtTime(0, t); 
        gain.gain.linearRampToValueAtTime(0.15, t + 0.05); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); 
        osc.stop(t + 0.3);
    } else if (type === 'minimize') {
        // Reverse swoosh for closing panels/menus
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(100, t); 
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        gain.gain.setValueAtTime(0.1, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); 
        osc.stop(t + 0.15);
    } else if (type === 'whir') {
        // Mentat computation / data processing sound
        osc.type = 'square'; 
        osc.frequency.setValueAtTime(100, t);
        for (let i = 0; i < 10; i++) {
            osc.frequency.setValueAtTime(100 + Math.random() * 200, t + i * 0.05);
        }
        gain.gain.setValueAtTime(0.05, t); 
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start(t); 
        osc.stop(t + 0.5);
    } else if (type === 'event') {
        // Deep boom for historical event alerts
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(150, t); 
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
        gain.gain.setValueAtTime(0.2, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        osc.start(t); 
        osc.stop(t + 1.0);
    }
}

function setupAmbientDrone() {
    droneOsc = audioCtx.createOscillator();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 55; // Deep, Hans Zimmer-esque A1 note

    droneGain = audioCtx.createGain();
    droneGain.gain.value = 0;

    droneOsc.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();
}

function setupWindNoise() {
    // Generate static white noise
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    windOsc = audioCtx.createBufferSource();
    windOsc.buffer = buffer;
    windOsc.loop = true;

    // Filter the static to make it sound like muffled rushing wind
    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400; 

    windGain = audioCtx.createGain();
    windGain.gain.value = 0;

    windOsc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windOsc.start();
}

function playMentatScan() {
    if (isMuted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playTick() {
    if (isMuted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function playChime(freq) {
    if (isMuted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(); osc.stop(audioCtx.currentTime + 2.0);
}

function updateAudioDynamics() {
    if (!isMuted && audioCtx) {
        const scale = AppState.currentScale;
        
        // Deep space drone is loud when zoomed out, fades out as we approach the planet
        let droneVol = scale < 0.5 ? 0.4 : Math.max(0, 0.4 - (scale - 0.5) * 0.2);
        droneGain.gain.setTargetAtTime(droneVol, audioCtx.currentTime, 0.5);

        // Wind gets louder and brighter as we enter the atmosphere
        let windVol = scale > 0.8 ? Math.min(0.5, (scale - 0.8) * 0.05) : 0;
        windGain.gain.setTargetAtTime(windVol, audioCtx.currentTime, 0.5);
        
        // Make the wind howl by modulating the filter frequency with a sine wave
        const howl = 400 + Math.sin(performance.now() * 0.001) * 300;
        windFilter.frequency.setTargetAtTime(howl, audioCtx.currentTime, 0.2);
    }
    requestAnimationFrame(updateAudioDynamics);
}
