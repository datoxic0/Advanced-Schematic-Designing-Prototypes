import { useState, useCallback, useMemo } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { Component, Connection, CircuitDesign, ComponentType } from '../types';
import { COMPONENT_DEFINITIONS, GRID_SIZE } from '../constants';

const INITIAL_STATE: CircuitDesign = {
  components: [],
  connections: []
};

export function useCircuit() {
  const [design, setDesign] = useLocalStorageState<CircuitDesign>('circuit-design', {
    defaultValue: INITIAL_STATE
  });

  const [history, setHistory] = useState<CircuitDesign[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushToHistory = useCallback((newState: CircuitDesign) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newState].slice(-50); // Limit history to 50 steps
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setDesign(prevState);
      setHistoryIndex(prev => prev - 1);
    } else if (historyIndex === 0) {
      setDesign(INITIAL_STATE);
      setHistoryIndex(-1);
    }
  }, [history, historyIndex, setDesign]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setDesign(nextState);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex, setDesign]);

  const updateStateAndHistory = useCallback((updater: (prev: CircuitDesign) => CircuitDesign) => {
    setDesign(prev => {
      const next = updater(prev);
      pushToHistory(next);
      return next;
    });
  }, [setDesign, pushToHistory]);

  const addComponent = useCallback((type: ComponentType, x: number, y: number) => {
    const def = COMPONENT_DEFINITIONS[type];
    const newComponent: Component = {
      id: `comp-${Date.now()}`,
      type,
      x: Math.round(x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(y / GRID_SIZE) * GRID_SIZE,
      rotation: 0,
      properties: { ...def.defaultProperties },
      label: `${def.name.slice(0, 1)}${Math.floor(Math.random() * 100)}`
    };

    updateStateAndHistory(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
    }));
  }, [updateStateAndHistory]);

  const updateComponent = useCallback((id: string, updates: Partial<Component>) => {
    updateStateAndHistory(prev => ({
      ...prev,
      components: prev.components.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  }, [updateStateAndHistory]);

  const removeComponent = useCallback((id: string) => {
    updateStateAndHistory(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== id),
      connections: prev.connections.filter(conn => conn.from !== id && conn.to !== id)
    }));
  }, [updateStateAndHistory]);

  const addConnection = useCallback((from: string, fromPin: number, to: string, toPin: number) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      from,
      fromPin,
      to,
      toPin
    };

    updateStateAndHistory(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection]
    }));
  }, [updateStateAndHistory]);

  const removeConnection = useCallback((id: string) => {
    updateStateAndHistory(prev => ({
      ...prev,
      connections: prev.connections.filter(c => c.id !== id)
    }));
  }, [updateStateAndHistory]);

  const clearDesign = useCallback(() => {
    updateStateAndHistory(() => INITIAL_STATE);
  }, [updateStateAndHistory]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    design,
    addComponent,
    updateComponent,
    removeComponent,
    addConnection,
    removeConnection,
    clearDesign,
    setDesign,
    undo,
    redo,
    canUndo,
    canRedo
  };
}
