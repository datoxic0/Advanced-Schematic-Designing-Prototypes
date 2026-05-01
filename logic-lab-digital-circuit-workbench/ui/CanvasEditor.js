export class CanvasEditor {
    constructor(canvas, engine, soundManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.engine = engine;
        this.sounds = soundManager;

        this.offset = { x: 0, y: 0 };
        this.zoom = 1;
        this.isPanning = false;
        this.isDraggingNode = false;
        this.selectedNode = null;
        this.selectedWire = null;
        this.connectingFrom = null;
        this.lastPointer = { x: 0, y: 0 };
        this.pointers = new Map();

        this.nodeWidth = 90;
        this.nodeHeight = 50;
        this.portRadius = 4;

        this.onSelectionChanged = null;

        this.setupEvents();
        this.resize();
    }

    setupEvents() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const worldBefore = this.screenToWorld(mouseX, mouseY);
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.2, Math.min(4, this.zoom * delta));
            const worldAfter = this.screenToWorld(mouseX, mouseY);
            this.offset.x += (worldAfter.x - worldBefore.x) * this.zoom;
            this.offset.y += (worldAfter.y - worldBefore.y) * this.zoom;
        }, { passive: false });
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();

        // Reset transform before resizing to avoid compounded scaling
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.offset.x) / this.zoom,
            y: (y - this.offset.y) / this.zoom
        };
    }

    handlePointerDown(e) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rect = this.canvas.getBoundingClientRect();
        const pointerPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        
        let foundInteraction = false;
        
        // 1. Check for ports
        for (const n of this.engine.nodes) {
            const port = this.getPortAt(n, pointerPos);
            if (port) {
                this.connectingFrom = { ...port, nodeId: n.id };
                foundInteraction = true;
                break;
            }
        }

        // 2. Check for nodes
        if (!foundInteraction) {
            for (let i = this.engine.nodes.length - 1; i >= 0; i--) {
                const n = this.engine.nodes[i];
                const nh = n.type === '7-SEG' ? 120 : this.nodeHeight;
                if (pointerPos.x > n.x && pointerPos.x < n.x + this.nodeWidth && 
                    pointerPos.y > n.y && pointerPos.y < n.y + nh) {
                    
                    this.selectedNode = n;
                    this.selectedWire = null;
                    this.isDraggingNode = true;
                    foundInteraction = true;
                    
                    // Interaction: Toggle switch
                    if (n.type === 'SWITCH') {
                        n.params.state = !n.params.state;
                        this.sounds.play('click');
                    } else if (n.type === 'PUSH-BUTTON') {
                        n.params.pressed = true;
                        this.sounds.play('click');
                    }
                    
                    if (this.onSelectionChanged) this.onSelectionChanged(n);
                    
                    // Move to front
                    this.engine.nodes.splice(i, 1);
                    this.engine.nodes.push(n);
                    break;
                }
            }
        }

        // 3. Check for wire hits (simple midpoint proximity check)
        if (!foundInteraction) {
            for (let i = this.engine.wires.length - 1; i >= 0; i--) {
                const w = this.engine.wires[i];
                const fn = this.engine.nodes.find(n => n.id === w.from.nodeId);
                const tn = this.engine.nodes.find(n => n.id === w.to.nodeId);
                if (fn && tn) {
                    const midX = (fn.x + this.nodeWidth + tn.x) / 2;
                    const fIdx = fn.outputs.findIndex(o => o.id === w.from.portId);
                    const tIdx = tn.inputs.findIndex(i => i.id === w.to.portId);
                    const midY = (fn.y + (fIdx + 1) * (50 / (fn.outputs.length + 1)) + tn.y + (tIdx + 1) * (50 / (tn.inputs.length + 1))) / 2;
                    if (Math.hypot(pointerPos.x - midX, pointerPos.y - midY) < 15) {
                        this.selectedWire = w;
                        this.selectedNode = null;
                        if (this.onSelectionChanged) this.onSelectionChanged({ type: 'WIRE', id: w.id });
                        foundInteraction = true;
                        break;
                    }
                }
            }
        }

        if (!foundInteraction) {
            this.isPanning = true;
            this.selectedNode = null;
            this.selectedWire = null;
            if (this.onSelectionChanged) this.onSelectionChanged(null);
        }

        this.lastPointer = { x: e.clientX, y: e.clientY };
    }

    handlePointerMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;

        if (this.isPanning) {
            this.offset.x += dx;
            this.offset.y += dy;
        } else if (this.isDraggingNode && this.selectedNode) {
            this.selectedNode.x += dx / this.zoom;
            this.selectedNode.y += dy / this.zoom;
        }
        this.lastPointer = { x: e.clientX, y: e.clientY };
    }

    handlePointerUp(e) {
        if (this.selectedNode && this.selectedNode.type === 'PUSH-BUTTON') {
            this.selectedNode.params.pressed = false;
        }

        if (this.connectingFrom) {
            const rect = this.canvas.getBoundingClientRect();
            const pointerPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            
            let connected = false;
            for (const n of this.engine.nodes) {
                const targetPort = this.getPortAt(n, pointerPos);
                // Ensure target exists and is different type (input vs output)
                if (targetPort && targetPort.isOutput !== this.connectingFrom.isOutput) {
                    const targetWithId = { ...targetPort, nodeId: n.id };
                    const from = this.connectingFrom.isOutput ? this.connectingFrom : targetWithId;
                    const to = this.connectingFrom.isOutput ? targetWithId : this.connectingFrom;
                    
                    if (from.nodeId && to.nodeId) {
                        this.engine.addWire(from.nodeId, from.id, to.nodeId, to.id);
                        this.sounds.play('connect');
                        connected = true;
                        break;
                    }
                }
            }
        }
        this.isPanning = false;
        this.isDraggingNode = false;
        this.connectingFrom = null;
        this.pointers.delete(e.pointerId);
    }

    getPortAt(node, pos) {
        const h = node.type === '7-SEG' ? 120 : this.nodeHeight;
        const threshold = 20; 
        
        let bestPort = null;
        let minDist = threshold;

        const checkPorts = (ports, isOutput, xBase) => {
            ports.forEach((p, i) => {
                const py = node.y + (i + 1) * (h / (ports.length + 1));
                const d = Math.hypot(pos.x - xBase, pos.y - py);
                if (d < minDist) {
                    minDist = d;
                    bestPort = { id: p.id, isOutput, x: xBase, y: py };
                }
            });
        };

        checkPorts(node.inputs, false, node.x);
        checkPorts(node.outputs, true, node.x + this.nodeWidth);
        
        return bestPort;
    }

    draw() {
        const { ctx, canvas, engine, zoom, offset } = this;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Wires
        engine.wires.forEach(wire => {
            const fromNode = engine.nodes.find(n => n.id === wire.from.nodeId);
            const toNode = engine.nodes.find(n => n.id === wire.to.nodeId);
            if (!fromNode || !toNode) return;

            const fromH = fromNode.type === '7-SEG' ? 120 : this.nodeHeight;
            const toH = toNode.type === '7-SEG' ? 120 : this.nodeHeight;
            const fIdx = fromNode.outputs.findIndex(o => o.id === wire.from.portId);
            const tIdx = toNode.inputs.findIndex(i => i.id === wire.to.portId);
            
            if (fIdx === -1 || tIdx === -1) return;

            const fx = fromNode.x + this.nodeWidth;
            const fy = fromNode.y + (fIdx + 1) * (fromH / (fromNode.outputs.length + 1));
            const tx = toNode.x;
            const ty = toNode.y + (tIdx + 1) * (toH / (toNode.inputs.length + 1));

            const isActive = fromNode.outputs[fIdx].value;
            const isSelected = this.selectedWire?.id === wire.id;

            ctx.beginPath();
            ctx.moveTo(fx, fy);
            const dist = Math.abs(tx - fx);
            ctx.bezierCurveTo(fx + dist/2, fy, tx - dist/2, ty, tx, ty);
            
            ctx.strokeStyle = isSelected ? '#fff' : (isActive ? '#00f3ff' : '#2d333b');
            ctx.lineWidth = isSelected ? 4 : (isActive ? 3 : 1.5);
            
            if (isActive || isSelected) {
                ctx.shadowBlur = isSelected ? 20 : 12;
                ctx.shadowColor = isSelected ? '#fff' : '#00f3ff';
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        });

        // Connection drag preview
        if (this.connectingFrom) {
            const rect = this.canvas.getBoundingClientRect();
            const mouse = this.screenToWorld(this.lastPointer.x - rect.left, this.lastPointer.y - rect.top);
            ctx.beginPath();
            ctx.moveTo(this.connectingFrom.x, this.connectingFrom.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = '#64748b';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Nodes
        engine.nodes.forEach(node => this.drawNode(node));

        ctx.restore();
    }

    drawNode(node) {
        const { ctx } = this;
        const w = this.nodeWidth, h = node.type === '7-SEG' ? 120 : this.nodeHeight;
        const isSel = this.selectedNode?.id === node.id;

        // Container
        ctx.fillStyle = '#141417';
        ctx.strokeStyle = isSel ? '#00f3ff' : '#2d333b';
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.beginPath();
        this.drawRoundedRect(ctx, node.x, node.y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = isSel ? '#fff' : '#64748b';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.params.label || node.type, node.x + w/2, node.y + 12);

        // Core Type Icon / Visual
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px JetBrains Mono, monospace';
        ctx.fillText(node.type, node.x + w/2, node.y + h/2 + 4);

        // Component specific visuals
        if (node.type === 'LED') {
            const on = node.params.state;
            ctx.beginPath();
            ctx.arc(node.x + w/2, node.y + h - 12, 6, 0, Math.PI*2);
            ctx.fillStyle = on ? (node.params.color || '#00f3ff') : '#1e1e22';
            if (on) { ctx.shadowBlur = 15; ctx.shadowColor = node.params.color || '#00f3ff'; }
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (node.type === 'SWITCH') {
            ctx.fillStyle = node.params.state ? '#00f3ff' : '#2d333b';
            ctx.beginPath();
            ctx.roundRect(node.x + w/2 - 10, node.y + h - 18, 20, 10, 5);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(node.x + w/2 + (node.params.state ? 6 : -6), node.y + h - 13, 4, 0, Math.PI*2);
            ctx.fill();
        } else if (node.type === 'PUSH-BUTTON') {
            ctx.fillStyle = node.params.pressed ? '#00f3ff' : '#2d333b';
            ctx.beginPath();
            ctx.arc(node.x + w/2, node.y + h - 18, 8, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        } else if (node.type === 'BUZZER') {
            ctx.fillStyle = node.params.active ? '#ff00ff' : '#1e1e22';
            ctx.beginPath();
            ctx.moveTo(node.x + w/2 - 10, node.y + h - 25);
            ctx.lineTo(node.x + w/2 + 10, node.y + h - 25);
            ctx.lineTo(node.x + w/2 + 15, node.y + h - 10);
            ctx.lineTo(node.x + w/2 - 15, node.y + h - 10);
            ctx.closePath();
            ctx.fill();
        } else if (node.type === 'LDR') {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(node.x + w/2, node.y + h - 18, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        } else if (node.type === '7-SEG' || node.type === 'BCD-7SEG') {
            this.drawSevenSegment(node);
        }

        // Ports
        const rect = this.canvas.getBoundingClientRect();
        const mouseWorld = this.screenToWorld(this.lastPointer.x - rect.left, this.lastPointer.y - rect.top);

        const drawPort = (x, y, val, isOutput) => {
            const isHovered = Math.hypot(mouseWorld.x - x, mouseWorld.y - y) < 15;
            const isCompatible = this.connectingFrom && this.connectingFrom.isOutput !== isOutput;

            ctx.beginPath();
            ctx.arc(x, y, this.portRadius + (isHovered ? 2 : 0), 0, Math.PI*2);
            
            if (isCompatible && isHovered) {
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#fff';
            } else {
                ctx.fillStyle = val ? '#00f3ff' : '#2d333b';
            }
            
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = isCompatible ? '#00f3ff' : '#000';
            ctx.lineWidth = isCompatible ? 1.5 : 0.5;
            ctx.stroke();
        };

        node.inputs.forEach((p, i) => {
            const py = node.y + (i + 1) * (h / (node.inputs.length + 1));
            drawPort(node.x, py, p.value, false);
        });
        node.outputs.forEach((p, i) => {
            const py = node.y + (i + 1) * (h / (node.outputs.length + 1));
            drawPort(node.x + w, py, p.value, true);
        });
    }

    drawRoundedRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    drawSevenSegment(node) {
        const { ctx } = this;
        const w = 40, h = 60;
        const cx = node.x + this.nodeWidth/2 - w/2;
        const cy = node.y + 40;
        
        const segs = {
            'A': [0, 0, w, 4], 'B': [w-4, 0, 4, h/2], 'C': [w-4, h/2, 4, h/2],
            'D': [0, h-4, w, 4], 'E': [0, h/2, 4, h/2], 'F': [0, 0, 4, h/2],
            'G': [0, h/2-2, w, 4]
        };

        Object.entries(segs).forEach(([id, [sx, sy, sw, sh]]) => {
            const active = node.inputs.find(i => i.id === id)?.value;
            ctx.fillStyle = active ? '#ff0044' : '#1e1e22';
            if (active) { ctx.shadowBlur = 8; ctx.shadowColor = '#ff0044'; }
            ctx.fillRect(cx + sx, cy + sy, sw, sh);
            ctx.shadowBlur = 0;
        });
    }
}