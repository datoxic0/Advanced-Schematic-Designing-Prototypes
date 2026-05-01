/**
 * Advanced Logic Solver Utility
 * Handles Boolean Expression Parsing, Truth Tables, and K-Map logic
 */

export class LogicSolver {
    static parseExpression(expr) {
        // Simple tokenizer for Boolean Algebra
        // Supports: A, B, C, ( ), +, *, ! or ', ^
        expr = expr.replace(/\s+/g, '').toUpperCase();
        
        let processed = "";
        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            const next = expr[i+1];
            processed += char;
            
            if (/[A-Z]/.test(char) && (/[A-Z\(]/.test(next))) {
                processed += '*';
            }
            if (char === ')' && /[A-Z\(]/.test(next)) {
                processed += '*';
            }
        }
        processed = processed.replace(/([A-Z\)])'/g, '!$1');

        return processed;
    }

    static evaluate(expression, values) {
        let jsExpr = expression
            .replace(/\*/g, ' && ')
            .replace(/\+/g, ' || ')
            .replace(/!/g, ' ! ')
            .replace(/\^/g, ' !== ');
        
        const sortedKeys = Object.keys(values).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            jsExpr = jsExpr.replace(regex, values[key] ? 'true' : 'false');
        }

        try {
            return Function(`"use strict"; return (${jsExpr})`)();
        } catch (e) {
            return null;
        }
    }

    static generateTruthTable(variables) {
        const rows = Math.pow(2, variables.length);
        const table = [];
        for (let i = 0; i < rows; i++) {
            const state = {};
            variables.forEach((v, idx) => {
                state[v] = !!((i >> (variables.length - 1 - idx)) & 1);
            });
            table.push(state);
        }
        return table;
    }

    static getKMapIndices(varCount) {
        if (varCount === 3) return [0, 1, 3, 2, 4, 5, 7, 6];
        if (varCount === 4) return [0, 1, 3, 2, 4, 5, 7, 6, 12, 13, 15, 14, 8, 9, 11, 10];
        return Array.from({length: Math.pow(2, varCount)}, (_, i) => i);
    }

    static extractVariables(expr) {
        const matches = expr.match(/[A-Z]/g) || [];
        return Array.from(new Set(matches)).sort();
    }

    /**
     * Minimize a boolean function and provide structural steps
     */
    static solveFull(expr) {
        const variables = this.extractVariables(expr);
        if (!variables.length) return null;

        const table = this.generateTruthTable(variables);
        const minterms = [];
        const results = table.map(row => {
            const val = this.evaluate(expr, row);
            if (val) minterms.push(table.indexOf(row));
            return val;
        });

        const sop = this.minimizeSOP(variables, minterms);
        
        // Generate pseudo-steps based on standard laws
        const steps = [
            { title: "Initial Expression", content: expr },
            { title: "Canonical Form (Minterms)", content: `Σm(${minterms.join(', ')})` },
            { title: "Quine–McCluskey Reduction", content: "Identifying prime implicants and essential components via binary grouping." },
            { title: "Simplified SOP", content: sop }
        ];

        return { variables, table, results, minterms, sop, steps };
    }

    static minimizeSOP(variables, minterms) {
        if (!minterms.length) return '0';
        const varCount = variables.length;
        if (varCount === 0) return minterms.length ? '1' : '0';

        // QM Implementation (Simplified version for small sets)
        const implicants = new Map(); 
        const termKey = (bits, mask) => `${bits}|${mask}`;

        const makeImplicant = (bits, mask, mins) => {
            const key = termKey(bits, mask);
            if (!implicants.has(key)) {
                implicants.set(key, { bits, mask, mins: new Set(mins), used: false });
            } else {
                mins.forEach(m => implicants.get(key).mins.add(m));
            }
            return key;
        };

        minterms.forEach(m => makeImplicant(m, (1 << varCount) - 1, [m]));

        let newCombos = true;
        while (newCombos) {
            newCombos = false;
            const currentKeys = Array.from(implicants.keys()).filter(k => !implicants.get(k).used);
            for (let i = 0; i < currentKeys.length; i++) {
                for (let j = i + 1; j < currentKeys.length; j++) {
                    const a = implicants.get(currentKeys[i]);
                    const b = implicants.get(currentKeys[j]);
                    if (a.mask !== b.mask) continue;
                    const diff = a.bits ^ b.bits;
                    if ((diff & (diff - 1)) === 0 && (diff & a.mask)) {
                        newCombos = true;
                        const newMask = a.mask & ~diff;
                        const newBits = a.bits & newMask;
                        makeImplicant(newBits, newMask, [...a.mins, ...b.mins]);
                        a.used = true;
                        b.used = true;
                    }
                }
            }
        }

        const primes = Array.from(implicants.values()).filter(im => !im.used);
        const covered = new Set();
        const chosen = [];
        
        // Greedy coverage
        const sortedPrimes = primes.sort((a, b) => b.mins.size - a.mins.size);
        for (const p of sortedPrimes) {
            let hasNew = false;
            for (const m of p.mins) {
                if (!covered.has(m)) { hasNew = true; break; }
            }
            if (hasNew) {
                chosen.push(p);
                for (const m of p.mins) covered.add(m);
            }
        }

        return chosen.map(p => {
            let term = '';
            for (let i = 0; i < varCount; i++) {
                const bit = varCount - 1 - i;
                if (p.mask & (1 << bit)) {
                    term += (p.bits & (1 << bit)) ? variables[i] : `${variables[i]}'`;
                }
            }
            return term || '1';
        }).join(' + ');
    }
}