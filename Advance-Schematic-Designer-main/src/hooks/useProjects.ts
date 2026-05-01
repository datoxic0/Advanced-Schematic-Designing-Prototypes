import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { Project, CircuitDesign } from '../types';

export function useProjects() {
  const [projects, setProjects] = useLocalStorageState<Project[]>('circuit-projects', {
    defaultValue: []
  });

  const saveProject = useCallback((design: CircuitDesign, name: string, id?: string) => {
    const newId = id || `proj-${Date.now()}`;
    setProjects(prev => {
      const existingIdx = id ? prev.findIndex(p => p.id === id) : -1;
      
      const newProject: Project = {
        id: newId,
        name,
        createdAt: existingIdx !== -1 ? prev[existingIdx].createdAt : Date.now(),
        updatedAt: Date.now(),
        design
      };

      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = newProject;
        return next;
      }
      return [newProject, ...prev];
    });
    return newId;
  }, [setProjects]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [setProjects]);

  return {
    projects,
    saveProject,
    deleteProject
  };
}
