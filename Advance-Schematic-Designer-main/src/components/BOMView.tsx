import React from 'react';
import { CircuitDesign, Component } from '../types';
import { COMPONENT_DEFINITIONS } from '../constants';

interface BOMViewProps {
  design: CircuitDesign;
  onDownloadCSV: () => void;
}

export default function BOMView({ design, onDownloadCSV }: BOMViewProps) {
  const getComponentValue = (comp: Component) => {
    if (comp.value) return comp.value;
    
    const props = comp.properties;
    switch (comp.type) {
      case 'RESISTOR': return `${props.resistance}${props.unit || 'Ω'}`;
      case 'CAPACITOR': return `${props.capacitance}${props.unit || 'F'}`;
      case 'INDUCTOR': return `${props.inductance}${props.unit || 'H'}`;
      case 'BATTERY': return `${props.voltage}${props.unit || 'V'}`;
      case 'BUZZER': return props.frequency || '-';
      case 'MOTOR': return `${props.voltage}V DC`;
      case 'SOLENOID': return `${props.voltage}V ${props.force}`;
      case 'RELAY': return `${props.voltage}V Coil`;
      case 'OLED_DISPLAY': return `${props.interface} ${props.address}`;
      case 'SEVEN_SEGMENT': return `${props.type} ${props.color}`;
      case 'SPEAKER': return `${props.impedance} ${props.power}`;
      case 'MICROPHONE': return props.sensitivity || '-';
      case 'TRANSISTOR':
      case 'DIODE':
      case 'INTEGRATED_CIRCUIT':
      case 'OP_AMP':
      case 'VOLTAGE_REGULATOR':
      case 'LOGIC_AND':
      case 'LOGIC_OR':
      case 'LOGIC_NOT':
      case 'MOSFET':
      case 'REED_RELAY':
        return props.model || '-';
      default: return '-';
    }
  };

  return (
    <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-100 mb-6 uppercase tracking-tight flex items-center gap-3">
          <span className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-sm">B</span>
          Bill of Materials
        </h2>
        
        <div className="grid gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Properties</th>
                  <th className="p-4">Value</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {design.components.map((comp) => (
                  <tr key={comp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-indigo-400">{comp.label}</td>
                    <td className="p-4 text-slate-300">
                      {COMPONENT_DEFINITIONS[comp.type]?.name || comp.type}
                    </td>
                    <td className="p-4 text-slate-500 text-xs">
                      {Object.entries(comp.properties).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </td>
                    <td className="p-4 text-slate-300 font-mono">
                      {getComponentValue(comp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Total Components</h3>
              <p className="text-4xl font-bold text-slate-100">{design.components.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Total Nets</h3>
              <p className="text-4xl font-bold text-slate-100">{design.connections.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Export Format</h3>
              <button 
                onClick={onDownloadCSV}
                className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
