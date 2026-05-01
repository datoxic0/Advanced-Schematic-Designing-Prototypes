export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.setup();
    }

    async setup() {
        // High-tech click
        this.sounds.click = () => this.playOsc(800, 0.04, 'sine', 0.1);
        this.sounds.connect = () => {
            this.playOsc(400, 0.05, 'square', 0.03);
            setTimeout(() => this.playOsc(800, 0.08, 'sine', 0.05), 50);
        };
        this.sounds.ping = () => this.playOsc(600, 0.3, 'sine', 0.1, 100);
        this.sounds.buzz = () => this.playOsc(120, 0.1, 'sawtooth', 0.05);
    }

    playOsc(freq, duration, type = 'sine', vol = 0.1, rampEndFreq = null) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (rampEndFreq) {
            osc.frequency.exponentialRampToValueAtTime(rampEndFreq, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    play(key) {
        if (this.sounds[key]) this.sounds[key]();
    }
}