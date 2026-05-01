import React, { useState, useEffect } from 'react';
import { CircuitDesign, Component } from '../types';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';

interface LayoutViewProps {
  design: CircuitDesign;
  onUpdateComponent: (id: string, updates: Partial<Component>) => void;
}

export default function LayoutView({ design, onUpdateComponent }: LayoutViewProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
    }
  }, []);

  const getCompPos = (comp: Component, idx: number) => {
    return {
      x: comp.layoutX ?? (100 + (idx % 4) * 150),
      y: comp.layoutY ?? (100 + Math.floor(idx / 4) * 120)
    };
  };

  const handleAutoroute = () => {
    design.components.forEach((comp, idx) => {
      onUpdateComponent(comp.id, {
        layoutX: 100 + (idx % 4) * 160,
        layoutY: 100 + Math.floor(idx / 4) * 120
      });
    });
  };

  const handleGenerateGerber = () => {
    const manifest = {
      project: 'PCB Export v1.0',
      boardSize: '160mm x 100mm',
      exportDate: new Date().toISOString(),
      layers: {
        top_copper: design.components.map(c => ({ 
          designator: c.label, 
          footprint: c.type, 
          posX: c.layoutX || 0, 
          posY: c.layoutY || 0 
        })),
        drill_guide: design.connections
      }
    };
    
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gerber_export_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef} className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-8 left-8 z-10">
        <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-3">
          <span className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-sm">L</span>
          PCB Layout Editor
        </h2>
        <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mt-2">Interactive Footprint Placement</p>
      </div>

      <div className="bg-slate-900 border-2 border-emerald-500/20 rounded shadow-[0_0_50px_rgba(16,185,129,0.1)] overflow-hidden">
        <Stage width={dimensions.width || 800} height={dimensions.height || 500}>
          <Layer>
            {/* PCB Board */}
            <Rect 
              x={0} 
              y={0} 
              width={dimensions.width || 800} 
              height={dimensions.height || 500} 
              fill="#064e3b" 
              cornerRadius={8}
            />
            {/* Grid */}
            {[...Array(60)].map((_, i) => (
              <React.Fragment key={i}>
                <Rect x={i * 20} y={0} width={1} height={dimensions.height || 500} fill="rgba(16, 185, 129, 0.05)" />
                <Rect x={0} y={i * 20} width={dimensions.width || 800} height={1} fill="rgba(16, 185, 129, 0.05)" />
              </React.Fragment>
            ))}

            {/* Ratsnest Lines */}
            {design.connections.map((conn, idx) => {
              const fromIdx = design.components.findIndex(c => c.id === conn.from);
              const toIdx = design.components.findIndex(c => c.id === conn.to);
              if (fromIdx === -1 || toIdx === -1) return null;

              const fromPos = getCompPos(design.components[fromIdx], fromIdx);
              const toPos = getCompPos(design.components[toIdx], toIdx);

              // Center of footprints for simplicity
              return (
                <Line
                  key={`ratsnest-${idx}`}
                  points={[fromPos.x + 40, fromPos.y + 30, toPos.x + 40, toPos.y + 30]}
                  stroke="#fbbf24"
                  strokeWidth={0.5}
                  dash={[5, 5]}
                  opacity={0.3}
                />
              );
            })}

            {/* Components as Footprints */}
            {design.components.map((comp, idx) => {
              const pos = getCompPos(comp, idx);
              return (
                <Group 
                  key={comp.id} 
                  x={pos.x} 
                  y={pos.y}
                  draggable
                  onDragMove={(e) => {
                    const stage = e.target.getStage();
                    if (!stage) return;
                    
                    // Grid Snapping (20px)
                    const grid = 20;
                    const x = Math.round(e.target.x() / grid) * grid;
                    const y = Math.round(e.target.y() / grid) * grid;
                    e.target.setAttrs({ x, y });
                  }}
                  onDragEnd={(e) => {
                    onUpdateComponent(comp.id, {
                      layoutX: e.target.x(),
                      layoutY: e.target.y()
                    });
                  }}
                >
                  <Rect 
                    width={80} 
                    height={60} 
                    fill="#1e293b" 
                    stroke="#10b981" 
                    strokeWidth={1}
                    cornerRadius={2}
                    shadowBlur={5}
                    shadowOpacity={0.5}
                  />
                  {/* Pads */}
                  <Rect x={5} y={5} width={8} height={12} fill="#fbbf24" cornerRadius={1} />
                  <Rect x={5} y={43} width={8} height={12} fill="#fbbf24" cornerRadius={1} />
                  <Rect x={67} y={5} width={8} height={12} fill="#fbbf24" cornerRadius={1} />
                  <Rect x={67} y={43} width={8} height={12} fill="#fbbf24" cornerRadius={1} />
                  
                  <Text 
                    text={comp.label} 
                    fill="#10b981" 
                    fontSize={10} 
                    fontStyle="bold" 
                    width={80}
                    align="center"
                    y={25}
                  />
                  <Text 
                    text={comp.type} 
                    fill="#64748b" 
                    fontSize={7} 
                    width={80}
                    align="center"
                    y={38}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      <div className="absolute bottom-8 right-8 flex gap-4">
        <div className="flex flex-col items-end mr-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Board Size</span>
          <span className="text-sm font-mono text-emerald-500">160mm x 100mm</span>
        </div>
        <button 
          onClick={handleGenerateGerber}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded border border-slate-700 transition-all"
        >
          Generate Gerber
        </button>
        <button 
          onClick={handleAutoroute}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all shadow-lg"
        >
          Autoroute Nets
        </button>
      </div>
    </div>
  );
}
