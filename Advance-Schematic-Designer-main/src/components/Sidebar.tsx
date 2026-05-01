import { COMPONENT_DEFINITIONS } from '../constants';
import { ComponentType } from '../types';
import { Component as ComponentIcon, Cpu, Zap, Activity, ToggleLeft } from 'lucide-react';

interface SidebarProps {
  onAddComponent: (type: ComponentType) => void;
  selectedComponentId: string | null;
  design: any;
  onUpdateProperties: (id: string, props: any) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
}

export default function Sidebar({ onAddComponent, selectedComponentId, design, onUpdateProperties, isSimulating, onToggleSimulation }: SidebarProps) {
  const selectedComponent = design.components.find((c: any) => c.id === selectedComponentId);

  return (
    <div className="flex flex-col border-l border-slate-800 bg-slate-900 w-72 z-10 overflow-y-auto shadow-2xl">
      <div className="p-4 border-b border-slate-800 bg-slate-800/30">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Component Library</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(COMPONENT_DEFINITIONS).map((def) => (
            <button
              key={def.type}
              onClick={() => onAddComponent(def.type)}
              className="flex flex-col items-center justify-center p-3 bg-slate-800/40 border border-slate-700/50 hover:border-indigo-500 hover:bg-slate-800 transition-all rounded-lg group"
              id={`component-${def.type}`}
            >
              <div className="mb-2 text-slate-400 group-hover:text-indigo-400 group-hover:scale-110 transition-transform">
                {def.type === 'RESISTOR' && <Activity size={18} />}
                {def.type === 'BATTERY' && <Zap size={18} />}
                {def.type === 'INTEGRATED_CIRCUIT' && <Cpu size={18} />}
                {def.type === 'SWITCH' && <ToggleLeft size={18} />}
                {def.type === 'DIODE' && <div className="w-4 h-4 border-2 border-slate-400 rotate-45 border-t-0 border-l-0" />}
                {def.type === 'TRANSISTOR' && <div className="flex gap-0.5"><div className="w-1 h-4 bg-slate-400" /><div className="w-3 h-3 border-t-2 border-slate-400" /></div>}
                {def.type === 'OP_AMP' && <div className="w-4 h-4 border-2 border-slate-400 rotate-45 border-r-0 border-b-0" />}
                {def.type === 'LOGIC_AND' && <div className="w-4 h-4 border-2 border-slate-400 rounded-r-lg" />}
                {def.type === 'LOGIC_OR' && <div className="w-4 h-4 border-2 border-slate-400 rounded-r-[100%]" />}
                {def.type === 'LOGIC_NOT' && <div className="flex items-center -space-x-0.5"><div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-slate-400" /><div className="w-2 h-2 border-2 border-slate-400 rounded-full" /></div>}
                {def.type === 'OLED_DISPLAY' && <div className="w-5 h-4 border border-slate-400 rounded-sm bg-slate-700/50" />}
                {def.type === 'SEVEN_SEGMENT' && <div className="w-3 h-4 border border-slate-400 flex flex-col items-center justify-center text-[8px] text-slate-400">8</div>}
                {['CAPACITOR', 'INDUCTOR', 'LED', 'GROUND', 'VOLTAGE_REGULATOR', 'MOSFET', 'BUZZER', 'REED_RELAY', 'SPEAKER', 'MICROPHONE', 'RELAY', 'SOLENOID', 'MOTOR'].includes(def.type) && <ComponentIcon size={18} />}
              </div>
              <span className="text-[10px] font-mono leading-tight text-slate-400 group-hover:text-slate-100">{def.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 bg-slate-950/20">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Properties</h2>
        {selectedComponent ? (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Reference Designator</label>
              <input
                type="text"
                value={selectedComponent.label || ''}
                onChange={(e) => onUpdateProperties(selectedComponent.id, { label: e.target.value })}
                className="bg-slate-950 border border-slate-700 p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 rounded transition-colors"
              />
            </div>
            {Object.entries(selectedComponent.properties).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{key}</label>
                {key === 'state' && selectedComponent.type === 'SWITCH' ? (
                  <div className="grid grid-cols-2 gap-1">
                    {['Open', 'Closed'].map(state => (
                      <button 
                        key={state}
                        onClick={() => {
                          const newProps = { ...selectedComponent.properties, [key]: state };
                          onUpdateProperties(selectedComponent.id, { properties: newProps });
                        }}
                        className={`py-2 rounded text-[10px] border transition-colors ${value === state ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={value as string}
                    onChange={(e) => {
                      const newProps = { ...selectedComponent.properties, [key]: e.target.value };
                      onUpdateProperties(selectedComponent.id, { properties: newProps });
                    }}
                    className="bg-slate-950 border border-slate-700 p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 rounded transition-colors"
                  />
                )}
              </div>
            ))}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rotation (&deg;)</label>
              <div className="grid grid-cols-4 gap-1">
                 {[0, 90, 180, 270].map(deg => (
                    <button 
                      key={deg}
                      onClick={() => onUpdateProperties(selectedComponent.id, { rotation: deg })}
                      className={`py-1 rounded text-[10px] border transition-colors ${selectedComponent.rotation === deg ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {deg}
                    </button>
                 ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3 text-slate-700">
                <Cpu size={24} />
             </div>
             <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Select a Node</div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-800 bg-slate-900">
         <button 
           onClick={onToggleSimulation}
           className={`w-full py-2 ${isSimulating ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500'} text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all shadow-lg active:scale-[0.98]`}
         >
            {isSimulating ? 'Stop Simulation' : 'Simulate Path'}
         </button>
      </div>
    </div>
  );
}
