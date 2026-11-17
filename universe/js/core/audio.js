export const AudioEngine = {
    ctx: null, 
    musicEnabled: false, 
    sfxEnabled: false,
    masterGain: null,

    // MP3 ambient music state
    _audioEl: null,
    _sourceNode: null,
    _musicGain: null,
    
    _initCtxIfNeeded() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.5;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this._initCtxIfNeeded();
        const btn = document.getElementById('music-btn');
        if (this.musicEnabled) {
            if(btn) { btn.textContent = '🎵'; btn.classList.add('text-amber-400'); }
            this.startAmbient();
        } else {
            if(btn) { btn.textContent = '🔇'; btn.classList.remove('text-amber-400'); }
            this.stopAmbient();
        }
    },

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        this._initCtxIfNeeded();
        const btn = document.getElementById('sfx-btn');
        if (this.sfxEnabled) {
            if(btn) { btn.textContent = '🔊'; btn.classList.add('text-cyan-400'); }
            this.playUI('click');
        } else {
            if(btn) { btn.textContent = '🔈'; btn.classList.remove('text-cyan-400'); }
        }
    },

    startAmbient() {
        // If already playing, don't start a second instance
        if (this._audioEl && !this._audioEl.paused) return;

        // Create the HTML5 Audio element for the MP3 file
        if (!this._audioEl) {
            this._audioEl = new Audio('audio/ambient.mp3');
            this._audioEl.loop = true;
            this._audioEl.crossOrigin = 'anonymous';

            // Route through Web Audio API so it respects the master gain
            this._sourceNode = this.ctx.createMediaElementSource(this._audioEl);
            this._musicGain = this.ctx.createGain();
            this._musicGain.gain.value = 0;
            this._sourceNode.connect(this._musicGain);
            this._musicGain.connect(this.masterGain);
        }

        // Fade in over 2 seconds
        this._musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this._musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this._musicGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 2);

        this._audioEl.play().catch(err => {
            console.warn('[AudioEngine] Music playback blocked:', err.message);
        });
    },

    stopAmbient() {
        if (!this._audioEl || !this._musicGain) return;

        // Fade out over 1 second, then pause
        this._musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this._musicGain.gain.setValueAtTime(this._musicGain.gain.value, this.ctx.currentTime);
        this._musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);

        setTimeout(() => {
            if (this._audioEl && !this.musicEnabled) {
                this._audioEl.pause();
            }
        }, 1100);
    },

    playUI(type) {
        if (!this.sfxEnabled) return;
        this._initCtxIfNeeded();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); 
        gain.connect(this.masterGain);

        if (type === 'click') {
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(800, t); 
            osc.frequency.exponentialRampToValueAtTime(200, t+0.05);
            gain.gain.setValueAtTime(0.1, t); 
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.05);
            osc.start(t); 
            osc.stop(t+0.05);
        } else if (type === 'focus') {
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(600, t); 
            osc.frequency.exponentialRampToValueAtTime(100, t+0.3);
            gain.gain.setValueAtTime(0, t); 
            gain.gain.linearRampToValueAtTime(0.15, t+0.05); 
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.3);
            osc.start(t); 
            osc.stop(t+0.3);
        } else if (type === 'minimize') {
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(100, t); 
            osc.frequency.exponentialRampToValueAtTime(600, t+0.15);
            gain.gain.setValueAtTime(0.1, t); 
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.15);
            osc.start(t); 
            osc.stop(t+0.15);
        } else if (type === 'whir') {
            osc.type = 'square'; 
            osc.frequency.setValueAtTime(100, t);
            for(let i=0; i<10; i++) { osc.frequency.setValueAtTime(100 + Math.random()*200, t + i*0.05); }
            gain.gain.setValueAtTime(0.05, t); 
            gain.gain.linearRampToValueAtTime(0, t+0.5);
            osc.start(t); 
            osc.stop(t+0.5);
        } else if (type === 'event') {
            osc.type = 'sawtooth'; 
            osc.frequency.setValueAtTime(150, t); 
            osc.frequency.exponentialRampToValueAtTime(30, t+0.8);
            gain.gain.setValueAtTime(0.2, t); 
            gain.gain.exponentialRampToValueAtTime(0.001, t+1.0);
            osc.start(t); 
            osc.stop(t+1.0);
        }
    },
    
    updateAtmosphere() {} // Maintained for backwards compatibility
};
