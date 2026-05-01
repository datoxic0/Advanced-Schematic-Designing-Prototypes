import gsap from 'gsap';

export class UIManager {
    constructor() {
        this.terminal = document.getElementById('terminal');
        this.startTime = Date.now();
        this.latencyEl = document.getElementById('latency-val');
        this.uptimeEl = document.getElementById('uptime-val');
        this.loadBar = document.getElementById('load-bar');
        this.synapseCount = document.getElementById('synapse-count');
        this.stabilityVal = document.getElementById('stability-val');

        this.lastUpdate = 0;
    }

    log(message) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.textContent = `> ${message}`;
        this.terminal.appendChild(line);
        this.terminal.scrollTop = this.terminal.scrollHeight;

        if (this.terminal.children.length > 10) {
            this.terminal.removeChild(this.terminal.firstChild);
        }
    }

    update(time) {
        // Update every ~0.5s for readability
        if (time - this.lastUpdate < 0.2) return;
        this.lastUpdate = time;

        // Latency jitter
        const lat = 20 + Math.floor(Math.random() * 15);
        this.latencyEl.textContent = `${lat}ms`;

        // Uptime calc
        const diff = Date.now() - this.startTime;
        const secs = Math.floor(diff / 1000) % 60;
        const mins = Math.floor(diff / 60000) % 60;
        const hrs = Math.floor(diff / 3600000);
        this.uptimeEl.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Random metrics
        const load = 40 + Math.sin(time) * 20 + Math.random() * 5;
        this.loadBar.style.width = `${load}%`;
        
        const count = 1400 + Math.floor(Math.sin(time * 0.5) * 50);
        this.synapseCount.textContent = count.toLocaleString();

        const stab = (98 + Math.random() * 1.5).toFixed(1);
        this.stabilityVal.textContent = `${stab}%`;
    }

    triggerRebootEffect() {
        gsap.to('body', {
            filter: 'brightness(2) contrast(2) invert(1)',
            duration: 0.1,
            repeat: 3,
            yoyo: true,
            onComplete: () => {
                gsap.set('body', { filter: 'none' });
            }
        });
    }
}