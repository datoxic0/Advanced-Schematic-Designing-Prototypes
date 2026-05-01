import { LogicEngine } from './logic/LogicEngine.js';
import { CanvasEditor } from './ui/CanvasEditor.js';
import { SoundManager } from './audio/SoundManager.js';
import { LogicSolver } from './logic/LogicSolver.js';
import gsap from 'gsap';

class App {
    constructor() {
        this.engine = new LogicEngine();
        this.sounds = new SoundManager();
        this.editor = new CanvasEditor(document.getElementById('workbench-canvas'), this.engine, this.sounds);
        
        this.simTimeEl = document.getElementById('sim-time');
        this.waveCanvas = document.getElementById('waveform-canvas');
        this.waveCtx = this.waveCanvas.getContext('2d');
        this.history = new Map();
        
        this.inspector = document.getElementById('inspector');
        this.insBody = document.getElementById('ins-body');
        this.insType = document.getElementById('ins-type');

        this.init();
    }

    init() {
        this.setupSidebar();
        this.setupModals();
        this.setupButtons();
        this.setupInspector();
        this.setupWaveformCanvas();

        // Load existing circuit if present, otherwise create starter
        const saved = localStorage.getItem('logic_lab_save');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.nodes) && Array.isArray(parsed.wires)) {
                    this.engine.nodes = parsed.nodes;
                    this.engine.wires = parsed.wires;

                    // Make sure any legacy save files are upgraded to the
                    // current node schema so the editor and solver never see
                    // undefined inputs/outputs/params.
                    this.engine.normalizeAllNodes();
                } else {
                    this.createStarterCircuit();
                }
            } catch {
                this.createStarterCircuit();
            }
        } else {
            this.createStarterCircuit();
        }
        
        requestAnimationFrame((t) => this.loop(t));
    }

    setupButtons() {
        const pauseBtn = document.getElementById('btn-pause');
        const pauseIcon = document.getElementById('pause-icon');
        const simDot = document.getElementById('sim-status-dot');

        pauseBtn.onclick = () => {
            this.engine.paused = !this.engine.paused;
            pauseIcon.innerHTML = this.engine.paused 
                ? '<path d="M8 5v14l11-7z"></path>' 
                : '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>';
            simDot.classList.toggle('animate-pulse', !this.engine.paused);
            this.sounds.play('click');
        };

        document.getElementById('btn-refresh').onclick = () => {
            this.engine.simTime = 0;
            this.sounds.play('click');
        };

        document.getElementById('btn-reset').onclick = () => {
            this.engine.nodes = [];
            this.engine.wires = [];
            this.engine.simTime = 0;
            this.history.clear();
            this.sounds.play('ping');
            this.showInspector(null);
        };

        document.getElementById('btn-save').onclick = () => {
            const data = JSON.stringify({ nodes: this.engine.nodes, wires: this.engine.wires });
            localStorage.setItem('logic_lab_save', data);
            this.sounds.play('click');
            alert('Circuit saved to local storage.');
        };

        document.getElementById('zoom-in').onclick = () => this.editor.zoom = Math.min(4, this.editor.zoom * 1.2);
        document.getElementById('zoom-out').onclick = () => this.editor.zoom = Math.max(0.2, this.editor.zoom / 1.2);
        document.getElementById('clear-waveforms').onclick = () => this.history.clear();
        
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName !== 'INPUT') {
                if (this.editor.selectedNode) {
                    this.engine.removeNode(this.editor.selectedNode.id);
                    this.editor.selectedNode = null;
                    this.showInspector(null);
                    this.sounds.play('ping');
                } else if (this.editor.selectedWire) {
                    this.engine.removeWire(this.editor.selectedWire.id);
                    this.editor.selectedWire = null;
                    this.showInspector(null);
                    this.sounds.play('ping');
                }
            }
        });
    }

    setupInspector() {
        this.editor.onSelectionChanged = (item) => {
            if (item && item.type === 'WIRE') {
                this.showWireInspector(item);
            } else {
                this.showInspector(item);
            }
        };
        document.querySelector('.ins-close').onclick = () => this.showInspector(null);
        document.getElementById('ins-delete').onclick = () => {
            if (this.editor.selectedNode) {
                this.engine.removeNode(this.editor.selectedNode.id);
                this.editor.selectedNode = null;
                this.showInspector(null);
                this.sounds.play('ping');
            } else if (this.editor.selectedWire) {
                this.engine.removeWire(this.editor.selectedWire.id);
                this.editor.selectedWire = null;
                this.showInspector(null);
                this.sounds.play('ping');
            }
        };
    }

    showWireInspector(wireRef) {
        this.insType.textContent = 'CONFIG: WIRE';
        this.insBody.innerHTML = '<div class="text-[10px] text-slate-500 italic">High-speed digital interconnect. Supports multi-signal aggregation.</div>';
        this.inspector.classList.remove('hidden');
        gsap.to(this.inspector, { opacity: 1, y: 0, duration: 0.3 });
    }

    showInspector(node) {
        if (!node) {
            gsap.to(this.inspector, { opacity: 0, y: 10, duration: 0.2, onComplete: () => this.inspector.classList.add('hidden') });
            return;
        }

        this.insType.textContent = `CONFIG: ${node.type}`;
        this.insBody.innerHTML = '';
        this.inspector.classList.remove('hidden');
        gsap.to(this.inspector, { opacity: 1, y: 0, duration: 0.3 });

        // Label field
        const labelDiv = this.createField('Label', 'text', node.params.label, (val) => node.params.label = val);
        this.insBody.appendChild(labelDiv);

        if (['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(node.type)) {
            const currentCount = node.inputs.length;
            this.insBody.appendChild(this.createField('Inputs Count', 'number', currentCount, (val) => {
                const count = Math.max(1, Math.min(8, parseInt(val) || 1));
                if (count !== node.inputs.length) {
                    node.inputs = this.engine.getDefaultInputsForType(node.type, count);
                    // Remove dangling wires
                    this.engine.wires = this.engine.wires.filter(w => {
                        if (w.to.nodeId !== node.id) return true;
                        return node.inputs.some(i => i.id === w.to.portId);
                    });
                }
            }));
        }

        if (node.type === 'CLOCK') {
            this.insBody.appendChild(this.createField('Freq (Hz)', 'number', node.params.freq, (val) => node.params.freq = parseFloat(val)));
        }
        if (node.type === 'LED') {
            this.insBody.appendChild(this.createField('Hex Color', 'text', node.params.color, (val) => node.params.color = val));
        }
        if (node.type === 'LDR') {
            this.insBody.appendChild(this.createField('Light Intensity', 'number', node.params.lightLevel || 0, (val) => node.params.lightLevel = parseInt(val)));
            this.insBody.appendChild(this.createField('Threshold', 'number', node.params.threshold || 50, (val) => node.params.threshold = parseInt(val)));
        }
    }

    createField(label, type, value, onChange) {
        const div = document.createElement('div');
        div.className = 'space-y-2';
        div.innerHTML = `<label class="text-[9px] uppercase tracking-widest text-slate-500 font-bold">${label}</label>
                         <input type="${type}" value="${value}" class="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-cyan-500 outline-none transition-colors">`;
        div.querySelector('input').oninput = (e) => onChange(e.target.value);
        return div;
    }

    setupSidebar() {
        const categories = {
            'gates': ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER', 'BCD-7SEG'],
            'sequential': ['JK-FF', 'D-FF', 'SR-LATCH', 'MUX'],
            'io': ['SWITCH', 'PUSH-BUTTON', 'CLOCK', 'CONST-H', 'CONST-L', 'LED', '7-SEG', 'BUZZER', 'LDR']
        };

        Object.entries(categories).forEach(([cat, list]) => {
            const container = document.getElementById(`component-list-${cat}`);
            const mobile = document.getElementById('mobile-tools');
            list.forEach(type => {
                const el = document.createElement('div');
                el.className = 'gate-item';
                el.innerHTML = `<div class="gate-icon-mini">${type.slice(0,4)}</div><span class="text-[9px] font-black tracking-tighter uppercase">${type}</span>`;
                el.onclick = () => {
                    const rect = this.editor.canvas.getBoundingClientRect();
                    const pos = this.editor.screenToWorld(rect.width/2, rect.height/2);
                    this.engine.addNode(type, pos.x - 45, pos.y - 25);
                    this.sounds.play('click');
                };
                container.appendChild(el);
                
                const mel = el.cloneNode(true);
                mel.onclick = el.onclick;
                mobile.appendChild(mel);
            });
        });
    }

    setupModals() {
        const modal = document.getElementById('modal-container');
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        
        const close = () => gsap.to(modal, { opacity: 0, duration: 0.2, onComplete: () => modal.classList.add('hidden') });
        document.querySelectorAll('.modal-close').forEach(b => b.onclick = close);

        const open = (title, content) => {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            modal.classList.remove('hidden');
            gsap.to(modal, { opacity: 1, duration: 0.3 });
        };

        document.getElementById('btn-algebra').onclick = () => {
            open('Advanced Logic Solver', `
                <div class="space-y-6">
                    <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
                         <div class="text-[9px] text-slate-500 uppercase tracking-widest">Syntax: AB + !C (AND: adjacent, OR: +, NOT: ! or ')</div>
                         <button id="btn-learn" class="text-[9px] font-bold text-cyan-400 hover:underline">View Laws & Theorems</button>
                    </div>
                    <input type="text" id="expr-in" placeholder="Enter logic (e.g. A(B+C))" class="w-full bg-black/40 border border-white/10 p-5 rounded-2xl font-mono text-cyan-400 text-lg outline-none focus:border-cyan-500 shadow-inner">
                    
                    <div id="solver-results" class="hidden space-y-6">
                        <!-- Simplified Out -->
                        <div class="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
                            <div class="flex justify-between items-center mb-4">
                                <span class="text-[10px] text-cyan-500 font-black uppercase tracking-widest">Simplified Solution</span>
                                <button id="btn-instantiate" class="bg-cyan-500 text-black text-[9px] font-black px-3 py-1.5 rounded-lg hover:bg-white transition-colors">GENERATE CIRCUIT</button>
                            </div>
                            <div id="sop-res" class="text-2xl font-mono text-white break-all"></div>
                        </div>

                        <!-- Steps & Analysis -->
                        <div class="grid md:grid-cols-2 gap-4">
                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Reduction Steps</div>
                                <div id="steps-container" class="space-y-3"></div>
                            </div>
                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto">
                                <div class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Truth Table</div>
                                <table class="w-full text-[10px] font-mono border-collapse" id="ttable-res"></table>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            const input = document.getElementById('expr-in');
            const results = document.getElementById('solver-results');
            const sopRes = document.getElementById('sop-res');
            const stepsCont = document.getElementById('steps-container');
            const tableRes = document.getElementById('ttable-res');
            const instantiateBtn = document.getElementById('btn-instantiate');

            document.getElementById('btn-learn').onclick = () => {
                alert("Boolean Laws:\n- DeMorgan's: !(A+B) = !A!B\n- Involution: !!A = A\n- Distribution: A(B+C) = AB + AC\n- Null: A+1=1, A*0=0");
            };

            input.oninput = () => {
                const raw = input.value.trim();
                if (!raw) { results.classList.add('hidden'); return; }
                const solution = LogicSolver.solveFull(LogicSolver.parseExpression(raw));
                if (!solution) return;

                results.classList.remove('hidden');
                sopRes.textContent = solution.sop;

                // Render Steps
                stepsCont.innerHTML = solution.steps.map(s => `
                    <div class="border-l-2 border-cyan-500/30 pl-3">
                        <div class="text-[8px] text-slate-500 uppercase font-black">${s.title}</div>
                        <div class="text-[10px] text-white font-mono">${s.content}</div>
                    </div>
                `).join('');

                // Render Truth Table
                let tableHtml = `<thead><tr>${solution.variables.map(v => `<th class="p-1 border border-white/5">${v}</th>`).join('')}<th class="p-1 border border-white/5 text-cyan-400">F</th></tr></thead><tbody>`;
                solution.table.forEach((row, idx) => {
                    tableHtml += `<tr>${solution.variables.map(v => `<td class="p-1 border border-white/5 text-center ${row[v] ? 'text-white' : 'text-slate-600'}">${row[v] ? '1' : '0'}</td>`).join('')}<td class="p-1 border border-white/5 text-center ${solution.results[idx] ? 'text-cyan-400 font-bold' : 'text-slate-600'}">${solution.results[idx] ? 'T' : 'F'}</td></tr>`;
                });
                tableRes.innerHTML = tableHtml + '</tbody>';

                instantiateBtn.onclick = () => {
                    this.engine.nodes = [];
                    this.engine.wires = [];
                    this.engine.buildFromSOP(solution.sop);
                    this.sounds.play('connect');
                    close();
                };
            };
        };

        document.getElementById('btn-kmap').onclick = () => {
            const inputs = this.engine.nodes.filter(n => n.type === 'SWITCH').sort((a,b) => a.params.label.localeCompare(b.params.label));
            const output = this.engine.nodes.find(n => n.type === 'LED');

            if (inputs.length < 2 || inputs.length > 4 || !output) {
                open('K-Map Optimizer', '<div class="p-4 text-slate-400 text-sm">Please create exactly 2-4 SWITCHES and at least 1 LED to analyze the current circuit.</div>');
                return;
            }

            const varCount = inputs.length;
            const rows = Math.pow(2, varCount);
            const indices = LogicSolver.getKMapIndices(varCount);
            const originalStates = inputs.map(n => n.params.state);

            let tableHtml = `<div class="grid grid-cols-${varCount === 3 ? 4 : (varCount === 4 ? 4 : 2)} gap-2 bg-black/40 p-4 border border-white/10 rounded-2xl">`;
            
            indices.forEach((mintermIndex) => {
                // Set circuit state
                inputs.forEach((n, i) => {
                    n.params.state = !!((mintermIndex >> (varCount - 1 - i)) & 1);
                });
                // Pulse sim
                this.engine.solve(0.1, 10);
                const result = output.params.state ? 1 : 0;
                tableHtml += `<div class="kmap-cell rounded ${result ? 'bg-cyan-500/30 text-white' : 'bg-white/5'}">${result}</div>`;
            });
            tableHtml += `</div>`;

            // Restore
            inputs.forEach((n, i) => n.params.state = originalStates[i]);

            open(`${varCount}-Variable K-Map (Auto-Analyzed)`, `
                <div class="flex flex-col items-center gap-8">
                    <div class="text-[10px] text-slate-500 uppercase tracking-widest">Inputs: ${inputs.map(n => n.params.label).join(', ')} → Output: ${output.params.label}</div>
                    ${tableHtml}
                    <div class="w-full p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl text-center">
                        <span class="text-[8px] text-cyan-500 uppercase font-black block mb-2">Live Circuit Analysis</span>
                        <div class="text-xs text-slate-400 italic">K-Map auto-generated from current canvas connections.</div>
                    </div>
                </div>
            `);
        };

        document.getElementById('btn-truth-table').onclick = () => {
            const inputs = this.engine.nodes.filter(n => n.type === 'SWITCH').sort((a,b) => a.params.label.localeCompare(b.params.label));
            const outputs = this.engine.nodes.filter(n => n.type === 'LED');

            if (!inputs.length || !outputs.length) {
                open('Truth Table', '<div class="p-4 text-slate-400 text-sm">Create some SWITCHES and LEDs to generate a truth table.</div>');
                return;
            }

            const rowsCount = Math.min(Math.pow(2, inputs.length), 64); // Cap for safety
            const originalStates = inputs.map(n => n.params.state);
            
            let html = `<table class="w-full text-[10px] font-mono border-collapse"><thead><tr>`;
            inputs.forEach(n => html += `<th class="p-2 border border-white/5 bg-white/5">${n.params.label}</th>`);
            outputs.forEach(n => html += `<th class="p-2 border border-white/5 text-cyan-400 bg-white/5">${n.params.label}</th>`);
            html += `</tr></thead><tbody>`;

            for (let i = 0; i < rowsCount; i++) {
                inputs.forEach((n, idx) => {
                    n.params.state = !!((i >> (inputs.length - 1 - idx)) & 1);
                });
                this.engine.solve(0.1, 10);
                html += `<tr>`;
                inputs.forEach(n => html += `<td class="p-1 border border-white/5 text-center ${n.params.state ? 'text-white' : 'text-slate-600'}">${n.params.state ? '1' : '0'}</td>`);
                outputs.forEach(n => html += `<td class="p-1 border border-white/5 text-center ${n.params.state ? 'text-cyan-400 font-bold' : 'text-slate-600'}">${n.params.state ? '1' : '0'}</td>`);
                html += `</tr>`;
            }
            html += `</tbody></table>`;

            inputs.forEach((n, i) => n.params.state = originalStates[i]);
            open('Circuit Truth Table', `<div class="overflow-x-auto">${html}</div>`);
        };
    }

    createStarterCircuit() {
        const clk = this.engine.addNode('CLOCK', 100, 150, { freq: 2, label: 'Master Clk' });
        const sw = this.engine.addNode('SWITCH', 100, 250, { label: 'Enable' });
        const and = this.engine.addNode('AND', 280, 200);
        const led = this.engine.addNode('LED', 450, 200, { label: 'Out Signal', color: '#ffcc00' });
        
        this.engine.addWire(clk.id, 'OUT', and.id, 'A');
        this.engine.addWire(sw.id, 'OUT', and.id, 'B');
        this.engine.addWire(and.id, 'OUT', led.id, 'IN');
    }

    setupWaveformCanvas() {
        const resize = () => {
            const rect = this.waveCanvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.waveCanvas.width = rect.width * dpr;
            this.waveCanvas.height = rect.height * dpr;
            this.waveCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.waveCtx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener('resize', resize);
    }

    updateWaveforms() {
        const canvas = this.waveCanvas;
        const ctx = this.waveCtx;
        const monitored = this.engine.nodes.filter(n => ['LED', 'CLOCK', 'SWITCH', 'JK-FF'].includes(n.type));
        document.getElementById('active-traces-count').textContent = `${monitored.length} TRACES ACTIVE`;

        if (monitored.length === 0) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

        const historyMax = 500;
        monitored.forEach(node => {
            if (!this.history.has(node.id)) this.history.set(node.id, []);
            const h = this.history.get(node.id);
            const val = node.type === 'LED' ? node.params.state : (node.outputs[0]?.value || false);
            h.push(val ? 1 : 0);
            if (h.length > historyMax) h.shift();
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const trackH = canvas.height / monitored.length;
        
        monitored.forEach((node, idx) => {
            const h = this.history.get(node.id);
            const yBase = (idx + 1) * trackH - 10;
            const xStep = canvas.width / historyMax;

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = node.outputs[0]?.value ? '#00f3ff' : '#1e1e22';
            
            h.forEach((v, i) => {
                const x = i * xStep;
                const y = yBase - (v * (trackH * 0.5));
                if (i === 0) ctx.moveTo(x, y);
                else {
                    ctx.lineTo(x, yBase - (h[i-1] * (trackH * 0.5))); // Vertical edge
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '8px JetBrains Mono';
            ctx.fillText(node.params.label || node.type, 10, yBase + 8);
        });
    }

    loop(time) {
        const delta = 1/60;
        this.engine.update(delta);
        this.editor.draw();
        this.updateWaveforms();
        
        // Output audio for active buzzers
        this.engine.nodes.forEach(n => {
            if (n.type === 'BUZZER' && n.params.active && !this.engine.paused) {
                if (Math.random() > 0.8) this.sounds.play('buzz');
            }
        });

        this.simTimeEl.textContent = this.engine.simTime.toFixed(2) + 's';
        requestAnimationFrame((t) => this.loop(t));
    }
}

new App();