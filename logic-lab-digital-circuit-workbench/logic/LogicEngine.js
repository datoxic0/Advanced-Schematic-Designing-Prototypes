export class LogicEngine {
    constructor() {
        this.nodes = [];
        this.wires = [];
        this.simTime = 0;
        this.lastUpdateTime = 0;
        this.paused = false;
    }

    /**
     * Ensure a node has all required structural fields, even if it came from an
     * older save or external JSON with missing properties.
     */
    normalizeNode(node) {
        if (!node.type) return node;

        // Ensure coordinates exist
        if (typeof node.x !== 'number') node.x = 0;
        if (typeof node.y !== 'number') node.y = 0;

        // Ensure IO arrays exist
        if (!Array.isArray(node.inputs)) {
            node.inputs = this.getDefaultInputsForType(node.type);
        }
        if (!Array.isArray(node.outputs)) {
            node.outputs = this.getDefaultOutputsForType(node.type);
        }

        // Ensure params object with sane defaults
        const defaults = {
            label: node.type,
            freq: 1.0,
            state: false,
            color: '#00f3ff'
        };
        node.params = { ...defaults, ...(node.params || {}) };

        // Ensure internal state for sequential elements
        node.internalState = {
            q: false,
            prevClk: false,
            ...(node.internalState || {})
        };

        return node;
    }

    /**
     * Normalize every node currently registered with the engine.
     */
    normalizeAllNodes() {
        this.nodes = this.nodes.map(n => this.normalizeNode(n));
    }

    addNode(type, x, y, params = {}) {
        const node = {
            id: crypto.randomUUID(),
            type,
            x,
            y,
            inputs: this.getDefaultInputsForType(type),
            outputs: this.getDefaultOutputsForType(type),
            params: { 
                label: type,
                freq: 1.0,
                state: false,
                color: '#00f3ff',
                ...params 
            },
            internalState: {
                q: false,
                prevClk: false
            }
        };

        // Make sure any future schema changes are applied consistently
        this.normalizeNode(node);

        this.nodes.push(node);
        return node;
    }

    getDefaultInputsForType(type, count = 2) {
        switch (type) {
            case 'AND': case 'OR': case 'NAND': case 'NOR': case 'XOR': case 'XNOR':
                const inputs = [];
                for (let i = 0; i < count; i++) {
                    inputs.push({ id: String.fromCharCode(65 + i), value: false });
                }
                return inputs;
            case 'NOT': case 'BUFFER': case 'LED':
                return [{ id: 'IN', value: false }];
            case 'JK-FF':
                return [{ id: 'J', value: false }, { id: 'K', value: false }, { id: 'CLK', value: false }];
            case 'SR-LATCH':
                return [{ id: 'S', value: false }, { id: 'R', value: false }];
            case 'D-FF':
                return [{ id: 'D', value: false }, { id: 'CLK', value: false }];
            case 'MUX':
                return [{ id: 'A', value: false }, { id: 'B', value: false }, { id: 'S', value: false }];
            case '7-SEG':
                return ['A','B','C','D','E','F','G'].map(id => ({ id, value: false }));
            case 'BCD-7SEG':
                return [{ id: '8', value: false }, { id: '4', value: false }, { id: '2', value: false }, { id: '1', value: false }];
            case 'BUZZER':
                return [{ id: 'IN', value: false }];
            case 'LDR':
                return [];
            default: return [];
        }
    }

    getDefaultOutputsForType(type) {
        switch (type) {
            case 'LED': case '7-SEG': case 'BUZZER': return [];
            case 'JK-FF': case 'SR-LATCH': case 'D-FF':
                return [{ id: 'Q', value: false }, { id: 'NQ', value: true }];
            case 'DEMUX':
                return [{ id: 'Y0', value: false }, { id: 'Y1', value: false }];
            case 'BCD-7SEG':
                return ['A','B','C','D','E','F','G'].map(id => ({ id, value: false }));
            case 'SWITCH': case 'PUSH-BUTTON': case 'CLOCK': case 'CONST-H': case 'CONST-L': case 'LDR':
                return [{ id: 'OUT', value: false }];
            default: return [{ id: 'OUT', value: false }];
        }
    }

    addWire(fromNodeId, fromPortId, toNodeId, toPortId) {
        // Prevent exact duplicate wires
        const exists = this.wires.some(w => 
            w.from.nodeId === fromNodeId && w.from.portId === fromPortId &&
            w.to.nodeId === toNodeId && w.to.portId === toPortId
        );
        if (exists) return null;

        const wire = {
            id: crypto.randomUUID(),
            from: { nodeId: fromNodeId, portId: fromPortId },
            to: { nodeId: toNodeId, portId: toPortId }
        };
        this.wires.push(wire);
        return wire;
    }

    removeWire(wireId) {
        this.wires = this.wires.filter(w => w.id !== wireId);
    }

    removeNode(id) {
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.wires = this.wires.filter(w => w.from.nodeId !== id && w.to.nodeId !== id);
    }

    /**
     * Automatically build a circuit layout from a simplified SOP string
     * e.g. "AB + C'D"
     */
    buildFromSOP(sop, startX = 100, startY = 100) {
        if (!sop || sop === '0' || sop === '1') return;
        
        const terms = sop.split('+').map(t => t.trim());
        const orNode = terms.length > 1 ? this.addNode('OR', startX + 400, startY + (terms.length * 50), { label: 'Output Sum' }) : null;
        if (orNode) orNode.inputs = this.getDefaultInputsForType('OR', terms.length);

        terms.forEach((term, idx) => {
            // Parse variables in term: A, B', C
            const vars = [];
            let i = 0;
            while (i < term.length) {
                let char = term[i];
                if (/[A-Z]/.test(char)) {
                    let isNegated = term[i+1] === "'";
                    vars.push({ name: char, negated: isNegated });
                    i += isNegated ? 2 : 1;
                } else i++;
            }

            const yPos = startY + (idx * 150);
            const andNode = vars.length > 1 ? this.addNode('AND', startX + 200, yPos, { label: `Term ${idx+1}` }) : null;
            if (andNode) andNode.inputs = this.getDefaultInputsForType('AND', vars.length);

            vars.forEach((v, vIdx) => {
                const source = this.nodes.find(n => n.type === 'SWITCH' && n.params.label === v.name) || 
                             this.addNode('SWITCH', startX, startY + (v.name.charCodeAt(0) - 65) * 80, { label: v.name });
                
                let outId = source.id;
                let outPort = 'OUT';

                if (v.negated) {
                    const notNode = this.addNode('NOT', startX + 100, yPos + (vIdx * 40), { label: `NOT ${v.name}` });
                    this.addWire(source.id, 'OUT', notNode.id, 'IN');
                    outId = notNode.id;
                    outPort = 'OUT';
                }

                if (andNode) {
                    this.addWire(outId, outPort, andNode.id, andNode.inputs[vIdx].id);
                } else if (orNode) {
                    this.addWire(outId, outPort, orNode.id, orNode.inputs[idx].id);
                } else {
                    // Single variable expression
                    const led = this.addNode('LED', startX + 400, startY, { label: 'Result' });
                    this.addWire(outId, outPort, led.id, 'IN');
                }
            });

            if (andNode && orNode) {
                this.addWire(andNode.id, 'OUT', orNode.id, orNode.inputs[idx].id);
            }
        });

        if (orNode) {
            const led = this.addNode('LED', orNode.x + 150, orNode.y, { label: 'Result' });
            this.addWire(orNode.id, 'OUT', led.id, 'IN');
        }
    }

    update(delta) {
        if (this.paused) return;
        this.simTime += delta;

        // Always keep nodes structurally valid before each simulation step
        this.normalizeAllNodes();
        
        // Multi-pass iterative solver for asynchronous loops
        const iterations = 4;
        this.solve(delta, iterations);
    }

    solve(delta, iterations = 4) {
        for (let i = 0; i < iterations; i++) {
            // 1. Gather input values from wires (Aggregated logic: OR all inputs connected to a port)
            this.nodes.forEach(node => {
                if (!Array.isArray(node.inputs)) return;
                node.inputs.forEach(input => {
                    const incoming = this.wires.filter(w => w.to.nodeId === node.id && w.to.portId === input.id);
                    let finalVal = false;
                    for (const wire of incoming) {
                        const source = this.nodes.find(n => n.id === wire.from.nodeId);
                        const port = source?.outputs.find(o => o.id === wire.from.portId);
                        if (port?.value) {
                            finalVal = true;
                            break;
                        }
                    }
                    input.value = finalVal;
                });
            });

            // 2. Process logic
            this.nodes.forEach(node => this.processNode(node, delta));
        }
    }

    processNode(node, delta) {
        // Guard against malformed nodes
        if (!node || !node.type) return;

        const getIn = (id) => node.inputs.find(i => i.id === id)?.value || false;
        const getAllIn = () => node.inputs.map(i => i.value);
        const setOut = (id, val) => {
            const out = node.outputs.find(o => o.id === id);
            if (out) out.value = val;
        };

        switch (node.type) {
            case 'AND': setOut('OUT', getAllIn().every(v => v)); break;
            case 'OR':  setOut('OUT', getAllIn().some(v => v)); break;
            case 'NOT': setOut('OUT', !getIn('IN')); break;
            case 'NAND': setOut('OUT', !getAllIn().every(v => v)); break;
            case 'NOR':  setOut('OUT', !getAllIn().some(v => v)); break;
            case 'XOR':  setOut('OUT', getAllIn().filter(v => v).length % 2 !== 0); break;
            case 'XNOR': setOut('OUT', getAllIn().filter(v => v).length % 2 === 0); break;
            case 'BUFFER': setOut('OUT', getIn('IN')); break;
            
            case 'SWITCH': 
                setOut('OUT', node.params.state); 
                break;
            case 'PUSH-BUTTON':
                setOut('OUT', !!node.params.pressed);
                break;
            case 'LDR':
                setOut('OUT', (node.params.lightLevel || 0) > (node.params.threshold || 50));
                break;
            case 'CONST-H': setOut('OUT', true); break;
            case 'CONST-L': setOut('OUT', false); break;
            case 'CLOCK':
                const period = 1.0 / (node.params.freq || 1);
                setOut('OUT', (this.simTime % period) < (period / 2));
                break;
            
            case 'JK-FF': {
                const j = getIn('J'), k = getIn('K'), clk = getIn('CLK');
                if (clk && !node.internalState.prevClk) { // Rising edge
                    if (j && k) node.internalState.q = !node.internalState.q;
                    else if (j) node.internalState.q = true;
                    else if (k) node.internalState.q = false;
                }
                node.internalState.prevClk = clk;
                setOut('Q', node.internalState.q);
                setOut('NQ', !node.internalState.q);
                break;
            }

            case 'D-FF': {
                const d = getIn('D'), clk = getIn('CLK');
                if (clk && !node.internalState.prevClk) {
                    node.internalState.q = d;
                }
                node.internalState.prevClk = clk;
                setOut('Q', node.internalState.q);
                setOut('NQ', !node.internalState.q);
                break;
            }

            case 'SR-LATCH': {
                const s = getIn('S'), r = getIn('R');
                if (s && r) { /* Invalid state, usually both high or Q=NQ=1 depending on implementation */ }
                else if (s) node.internalState.q = true;
                else if (r) node.internalState.q = false;
                setOut('Q', node.internalState.q);
                setOut('NQ', !node.internalState.q);
                break;
            }

            case 'MUX':
                setOut('OUT', getIn('S') ? getIn('B') : getIn('A'));
                break;
            
            case 'LED':
                node.params.state = getIn('IN');
                break;
            
            case 'BUZZER':
                node.params.active = getIn('IN');
                break;

            case 'BCD-7SEG': {
                const val = (getIn('8') ? 8 : 0) + (getIn('4') ? 4 : 0) + (getIn('2') ? 2 : 0) + (getIn('1') ? 1 : 0);
                const table = [
                    [1,1,1,1,1,1,0], // 0: ABCDEF
                    [0,1,1,0,0,0,0], // 1: BC
                    [1,1,0,1,1,0,1], // 2: ABDEG
                    [1,1,1,1,0,0,1], // 3: ABCDG
                    [0,1,1,0,0,1,1], // 4: BCFG
                    [1,0,1,1,0,1,1], // 5: ACDFG
                    [1,0,1,1,1,1,1], // 6: ACDEFG
                    [1,1,1,0,0,0,0], // 7: ABC
                    [1,1,1,1,1,1,1], // 8: ABCDEFG
                    [1,1,1,1,0,1,1]  // 9: ABCDFG
                ];
                const segments = ['A','B','C','D','E','F','G'];
                const config = table[val] || [0,0,0,0,0,0,0];
                segments.forEach((s, idx) => setOut(s, !!config[idx]));
                break;
            }
            
            case '7-SEG':
                // Purely visual, inputs are handled by drawing logic
                break;
        }
    }
}