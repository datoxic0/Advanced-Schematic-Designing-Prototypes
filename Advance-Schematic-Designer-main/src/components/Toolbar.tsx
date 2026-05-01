import { MousePointer2, GitCommit, Trash2, Download, RefreshCw, Undo2, Redo2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ToolbarProps {
  tool: 'SELECT' | 'WIRE' | 'DELETE';
  setTool: (tool: 'SELECT' | 'WIRE' | 'DELETE') => void;
  onClear: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
}

export default function Toolbar({ 
  tool, setTool, onClear, onExport, onUndo, onRedo, canUndo, canRedo,
  onZoomIn, onZoomOut, onZoomFit
}: ToolbarProps) {
  return (
    <div className="flex flex-col border-r border-slate-800 bg-slate-900/90 backdrop-blur-md w-12 items-center py-4 gap-4 z-10 shadow-[5px_0_15px_-5px_rgba(0,0,0,0.5)] overflow-y-auto ring-1 ring-white/5">
      <div className="text-[8px] font-black text-slate-700 tracking-tighter mb-2 -rotate-90">ENGINE-V2</div>
      <button
        onClick={() => setTool('SELECT')}
        className={`p-2 rounded transition-all duration-200 ${tool === 'SELECT' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:bg-slate-800'}`}
        title="Select Tool"
        id="btn-select"
      >
        <MousePointer2 size={20} />
      </button>
      <button
        onClick={() => setTool('WIRE')}
        className={`p-2 rounded transition-all duration-200 ${tool === 'WIRE' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:bg-slate-800'}`}
        title="Wire Tool"
        id="btn-wire"
      >
        <GitCommit size={20} />
      </button>
      <button
        onClick={() => setTool('DELETE')}
        className={`p-2 rounded transition-all duration-200 ${tool === 'DELETE' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'text-slate-400 hover:bg-slate-800 hover:text-red-400'}`}
        title="Delete Tool"
        id="btn-delete"
      >
        <Trash2 size={20} />
      </button>

      <div className="w-px h-8 bg-slate-800 my-1 mx-auto opacity-50" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2 rounded transition-colors ${canUndo ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-700 pointer-events-none'}`}
        title="Undo (Ctrl+Z)"
        id="btn-undo"
      >
        <Undo2 size={20} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-2 rounded transition-colors ${canRedo ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-700 pointer-events-none'}`}
        title="Redo (Ctrl+Y)"
        id="btn-redo"
      >
        <Redo2 size={20} />
      </button>

      <div className="w-px h-8 bg-slate-800 my-1 mx-auto opacity-50" />

      <button
        onClick={onZoomIn}
        className="p-2 rounded transition-colors text-slate-400 hover:bg-slate-800 hover:text-indigo-400 font-mono text-xs items-center justify-center flex"
        title="Zoom In"
      >
        <ZoomIn size={20} />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 rounded transition-colors text-slate-400 hover:bg-slate-800 hover:text-indigo-400 font-mono text-xs items-center justify-center flex"
        title="Zoom Out"
      >
        <ZoomOut size={20} />
      </button>
      <button
        onClick={onZoomFit}
        className="p-2 rounded transition-colors text-slate-400 hover:bg-slate-800 hover:text-indigo-400 font-mono text-xs items-center justify-center flex"
        title="Zoom to Fit"
      >
        <Maximize size={18} />
      </button>

      <div className="flex-1 w-px bg-slate-800 my-2 mx-auto" />
      
      <button
        onClick={onClear}
        className="p-2 rounded transition-colors hover:bg-red-900/20 text-red-500/70 hover:text-red-500"
        title="Clear Design"
        id="btn-clear"
      >
        <RefreshCw size={20} />
      </button>
      <button
        onClick={onExport}
        className="p-2 rounded transition-colors text-slate-400 hover:bg-slate-800 hover:text-indigo-400"
        title="Export PNG"
        id="btn-export"
      >
        <Download size={20} />
      </button>
    </div>
  );
}
