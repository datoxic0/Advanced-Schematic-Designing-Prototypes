import React from 'react';
import { Project } from '../types';
import { FolderOpen, Trash2, Edit3, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface ProjectsViewProps {
  projects: Project[];
  onLoad: (project: Project) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ProjectsView({ projects, onLoad, onDelete, onNew }: ProjectsViewProps) {
  return (
    <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-3">
            <span className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-sm text-slate-900">P</span>
            Project Dashboard
          </h2>
          <button 
            onClick={onNew}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Plus size={14} />
            New Circuit
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="py-20 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500">
            <FolderOpen size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">No saved projects found.</p>
            <p className="text-xs mt-1">Start by creating your first schematic design.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <motion.div 
                key={project.id}
                whileHover={{ y: -5 }}
                className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all p-5 flex flex-col gap-4 shadow-xl"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-slate-100 font-bold text-lg group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                      Modified {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => onDelete(project.id)}
                    className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex-1 bg-slate-950 rounded-lg p-3 min-h-[120px] flex items-center justify-center border border-slate-800/50">
                   <div className="text-[10px] text-slate-600 uppercase tracking-widest font-mono text-center">
                      {project.design.components.length} Components<br/>
                      {project.design.connections.length} Nets
                   </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => onLoad(project)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 transition-all border border-slate-700"
                  >
                    <Edit3 size={14} />
                    Open Editor
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
