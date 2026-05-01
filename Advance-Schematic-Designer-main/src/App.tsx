/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useEffect, useState } from 'react';
import { useCircuit } from './hooks/useCircuit';
import { useSimulation } from './hooks/useSimulation';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import SchematicCanvas, { SchematicCanvasRef } from './components/SchematicCanvas';
import BOMView from './components/BOMView';
import LayoutView from './components/LayoutView';
import ProjectsView from './components/ProjectsView';
import { useProjects } from './hooks/useProjects';
import { Cpu, HardDrive, Info, Share2, Zap, Layers, Save, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'PROJECTS' | 'DESIGN' | 'SIMULATION' | 'BOM' | 'LAYOUT';

export default function App() {
  const [view, setView] = useState<View>('PROJECTS');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('Untitled Project');
  const stageRef = useRef<any>(null);
  const canvasRef = useRef<SchematicCanvasRef>(null);

  const {
    projects,
    saveProject,
    deleteProject
  } = useProjects();

  const {
    design,
    setDesign,
    addComponent,
    updateComponent,
    removeComponent,
    addConnection,
    removeConnection,
    clearDesign,
    undo,
    redo,
    canUndo,
    canRedo
  } = useCircuit();

  const {
    isSimulating,
    toggleSimulation,
    errors,
    logs,
    activeComponentIds,
    activeConnectionIds
  } = useSimulation(design);

  const [tool, setTool] = useState<'SELECT' | 'WIRE' | 'DELETE'>('SELECT');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleExport = () => {
    if (stageRef.current) {
      const dataURL = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = `${projectName}-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSave = () => {
    const savedId = saveProject(design, projectName, currentProjectId || undefined);
    if (!currentProjectId) setCurrentProjectId(savedId);
  };

  const handleLoadProject = (project: any) => {
    setDesign(project.design);
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setView('DESIGN');
  };

  const handleNewProject = () => {
    setDesign({ components: [], connections: [] });
    setCurrentProjectId(null);
    setProjectName(`Project ${Date.now().toString().slice(-4)}`);
    setView('DESIGN');
  };

  const handleDownloadBOMCsv = () => {
    const headers = ['Designator', 'Category', 'Specs', 'Value'];
    const rows = design.components.map(comp => {
      let value = comp.value || '-';
      if (!comp.value) {
        const props = comp.properties;
        if (props.resistance) value = `${props.resistance}${props.unit || 'Ω'}`;
        else if (props.capacitance) value = `${props.capacitance}${props.unit || 'F'}`;
        else if (props.inductance) value = `${props.inductance}${props.unit || 'H'}`;
        else if (props.voltage) value = `${props.voltage}${props.unit || 'V'}`;
        else if (props.model) value = props.model as string;
      }
      
      return [
        comp.label,
        comp.type,
        Object.entries(comp.properties).map(([k, v]) => `${k}:${v}`).join(';'),
        value
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_BOM.csv`;
    link.click();
  };

  useEffect(() => {
    if (currentProjectId && view !== 'PROJECTS') {
      const timeout = setTimeout(() => {
        saveProject(design, projectName, currentProjectId);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [design, projectName, currentProjectId, view, saveProject]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [design, projectName, currentProjectId]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500 selection:text-white overflow-hidden border-4 border-slate-900">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900/80 backdrop-blur-xl z-20 shadow-2xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setView('PROJECTS')}
              className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] cursor-pointer hover:scale-105 transition-transform"
            >
               <Cpu size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <input 
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-transparent border-none text-slate-100 font-black uppercase text-sm focus:ring-0 w-32 sm:w-48 hover:bg-white/5 rounded px-1 transition-all"
              />
              <span className="text-[8px] text-slate-500 uppercase tracking-[0.3em] font-medium leading-none ml-1">Advanced EDA Suite v2.4</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-[0.2em] pt-1">
            {(['PROJECTS', 'DESIGN', 'SIMULATION', 'BOM', 'LAYOUT'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`pb-2 transition-all border-b-2 hover:text-indigo-300 ${
                  view === v ? 'text-indigo-400 border-indigo-400' : 'text-slate-600 border-transparent'
                }`}
              >
                {v}
              </button>
            ))}
          </nav>

          {/* Mobile View Switcher Dropdown */}
          <div className="lg:hidden relative">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              <Menu size={14} />
              <span>{view}</span>
              <ChevronDown size={12} className={isMobileMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1 overflow-hidden"
                >
                  {(['PROJECTS', 'DESIGN', 'SIMULATION', 'BOM', 'LAYOUT'] as View[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        setView(v);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                        view === v 
                          ? 'bg-indigo-600/10 text-indigo-400' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 bg-slate-950/50 px-4 py-1.5 rounded-full border border-slate-800 shadow-inner group">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] group-hover:animate-ping" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Security Module Enabled</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave}
              className="px-3 sm:px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] text-white text-[10px] font-black uppercase tracking-widest rounded-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Commit</span>
            </button>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <button className="text-slate-500 hover:text-indigo-400 transition-colors hidden sm:block">
              <Share2 size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600/50 flex items-center justify-center text-[11px] font-black text-white shadow-lg ring-1 ring-white/10 shrink-0">
               SP
            </div>
          </div>
        </div>
      </header>

      {/* Main UI */}
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'PROJECTS' ? (
             <motion.div
               key="projects-view"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="flex-1"
             >
               <ProjectsView 
                 projects={projects}
                 onLoad={handleLoadProject}
                 onDelete={deleteProject}
                 onNew={handleNewProject}
               />
             </motion.div>
          ) : view === 'DESIGN' || view === 'SIMULATION' ? (
            <motion.div 
              key="design-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-1 overflow-hidden"
            >
              <Toolbar 
                tool={tool} 
                setTool={setTool} 
                onClear={clearDesign}
                onExport={handleExport}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                onZoomIn={() => canvasRef.current?.zoomIn()}
                onZoomOut={() => canvasRef.current?.zoomOut()}
                onZoomFit={() => canvasRef.current?.zoomFit()}
              />
              
              <main className="flex-1 flex flex-col relative">
                {view === 'SIMULATION' && (
                  <>
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                      <motion.div 
                        initial={{ y: -100 }}
                        animate={{ y: ['0%', '100%'] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="h-20 w-full bg-indigo-500/5 blur-xl shadow-[0_0_50px_rgba(99,102,241,0.2)]"
                      />
                      <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
                    </div>
                    
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-3 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[.25em]">Siyabonga Engine Active</span>
                    </div>
                    
                    <motion.div 
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      className="absolute bottom-4 left-4 right-4 h-32 bg-slate-900/90 border border-slate-700/50 rounded-lg overflow-hidden flex flex-col z-20 backdrop-blur-xl shadow-2xl"
                    >
                      <div className="px-3 py-1 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Simulation Console</span>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-slate-600" />
                          <div className="w-2 h-2 rounded-full bg-slate-600" />
                        </div>
                      </div>
                      <div className="flex-1 p-3 font-mono text-[10px] text-emerald-500/80 overflow-y-auto space-y-1">
                        {logs.map((log, i) => (
                           <div key={i}>{log}</div>
                        ))}
                        {errors.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-slate-800 mt-2">
                            {errors.map((err, i) => (
                              <div key={i} className={err.type === 'SHORT_CIRCUIT' ? 'text-rose-500 font-bold' : 'text-amber-500'}>
                                [{err.type}] {err.message}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="animate-pulse text-slate-500">_</div>
                      </div>
                    </motion.div>
                  </>
                )}
                <SchematicCanvas 
                  ref={canvasRef}
                  design={design}
                  selectedTool={tool}
                  selectedComponentId={selectedId}
                  onSelectComponent={setSelectedId}
                  onUpdateComponent={updateComponent}
                  onRemoveComponent={removeComponent}
                  onAddConnection={addConnection}
                  onRemoveConnection={removeConnection}
                  undo={undo}
                  redo={redo}
                  stageRef={stageRef}
                  isSimulating={isSimulating || view === 'SIMULATION'}
                  activeComponentIds={activeComponentIds}
                  activeConnectionIds={activeConnectionIds}
                />
              </main>

              <Sidebar 
                onAddComponent={(type) => {
                  const x = stageRef.current ? (-stageRef.current.x() + stageRef.current.width() / 2) / stageRef.current.scaleX() : 100;
                  const y = stageRef.current ? (-stageRef.current.y() + stageRef.current.height() / 2) / stageRef.current.scaleY() : 100;
                  addComponent(type, x, y);
                }}
                selectedComponentId={selectedId}
                design={design}
                onUpdateProperties={updateComponent}
                isSimulating={isSimulating || view === 'SIMULATION'}
                onToggleSimulation={toggleSimulation}
              />
            </motion.div>
          ) : view === 'BOM' ? (
            <motion.div
              key="bom-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1"
            >
              <BOMView 
                design={design} 
                onDownloadCSV={handleDownloadBOMCsv}
              />
            </motion.div>
          ) : (
            <motion.div
              key="layout-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1"
            >
              <LayoutView 
                design={design} 
                onUpdateComponent={updateComponent}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-6 justify-between text-[10px] font-mono tracking-wider shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <div className="hidden sm:flex items-center gap-3 text-slate-500 pr-4 border-r border-slate-800">
            <span className="text-[8px] font-black uppercase text-slate-600">Voice and Eye of Bhambatha Inc.</span>
            <span className="text-emerald-500 font-bold bg-emerald-500/5 px-2 py-0.5 rounded animate-pulse border border-emerald-500/20">Siyabonga B Phakathi</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-slate-500">
              <span className="text-[8px] text-slate-600 uppercase font-black">Coords</span>
              <span className="text-indigo-400 font-bold min-w-[100px]">
                {stageRef.current?.getPointerPosition() 
                  ? `X: ${Math.round((stageRef.current.getPointerPosition().x - stageRef.current.x()) / stageRef.current.scaleX())} Y: ${Math.round((stageRef.current.getPointerPosition().y - stageRef.current.y()) / stageRef.current.scaleY())}` 
                  : 'X: AUTO Y: AUTO'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-slate-600 uppercase font-black">Nets</span>
              <span className="text-slate-300 font-bold">{design.connections.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-slate-600 uppercase font-black">DRC</span>
              <span className={`${errors.length > 0 ? 'text-rose-500' : 'text-emerald-500'} font-bold uppercase transition-colors`}>
                {errors.length > 0 ? `${errors.length} ERR` : 'PASS'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden xl:flex items-center gap-2 text-slate-600 mr-4">
             <span className="text-[8px] uppercase tracking-tighter">&copy; 2026 THE VOICE AND EYE OF BHAMBATHA INC.</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-500">
             <Layers size={14} className={currentProjectId ? 'text-indigo-400 animate-pulse' : 'text-slate-700'} />
             <span className="text-[8px] uppercase font-black">Matrix: {currentProjectId ? 'Committed' : 'Volatile'}</span>
          </div>
          <div className="bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="font-black text-[9px] tracking-widest uppercase">Bhambatha-v2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
