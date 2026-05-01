import React, { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva';
import { COMPONENT_DEFINITIONS, GRID_SIZE } from '../constants';
import { Component, Connection } from '../types';

export interface SchematicCanvasRef {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
}

interface SchematicCanvasProps {
  design: { components: Component[]; connections: Connection[] };
  onUpdateComponent: (id: string, updates: Partial<Component>) => void;
  onRemoveComponent: (id: string) => void;
  onAddConnection: (from: string, fromPin: number, to: string, toPin: number) => void;
  onRemoveConnection: (id: string) => void;
  selectedTool: 'SELECT' | 'WIRE' | 'DELETE';
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  undo?: () => void;
  redo?: () => void;
  stageRef?: React.RefObject<any>;
  // Simulation Props
  activeComponentIds?: Set<string>;
  activeConnectionIds?: Set<string>;
  isSimulating?: boolean;
}

export const SchematicCanvas = React.forwardRef<SchematicCanvasRef, SchematicCanvasProps>(({
  design,
  onUpdateComponent,
  onRemoveComponent,
  onAddConnection,
  onRemoveConnection,
  selectedTool,
  selectedComponentId,
  onSelectComponent,
  undo,
  redo,
  stageRef,
  activeComponentIds = new Set(),
  activeConnectionIds = new Set(),
  isSimulating = false
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [wiringState, setWiringState] = useState<{ fromId: string; fromPin: number; x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const zoomCenter = { x: dimensions.width / 2, y: dimensions.height / 2 };
      handleZoom(zoomCenter, 1.2);
    },
    zoomOut: () => {
      const zoomCenter = { x: dimensions.width / 2, y: dimensions.height / 2 };
      handleZoom(zoomCenter, 1 / 1.2);
    },
    zoomFit: () => {
      if (design.components.length === 0) return;
      
      const padding = 50;
      const box = {
        minX: Math.min(...design.components.map(c => c.x)),
        minY: Math.min(...design.components.map(c => c.y)),
        maxX: Math.max(...design.components.map(c => {
          const def = COMPONENT_DEFINITIONS[c.type];
          return c.x + (c.rotation % 180 === 0 ? def.width : def.height);
        })),
        maxY: Math.max(...design.components.map(c => {
          const def = COMPONENT_DEFINITIONS[c.type];
          return c.y + (c.rotation % 180 === 0 ? def.height : def.width);
        })),
      };

      const contentWidth = box.maxX - box.minX;
      const contentHeight = box.maxY - box.minY;
      
      const scaleX = (dimensions.width - padding * 2) / contentWidth;
      const scaleY = (dimensions.height - padding * 2) / contentHeight;
      const newScale = Math.max(0.5, Math.min(scaleX, scaleY, 1.5));

      setScale(newScale);
      setPosition({
        x: (dimensions.width - contentWidth * newScale) / 2 - box.minX * newScale,
        y: (dimensions.height - contentHeight * newScale) / 2 - box.minY * newScale,
      });
    }
  }));

  const handleZoom = (center: { x: number, y: number }, factor: number) => {
    const oldScale = scale;
    const newScale = Math.max(0.5, Math.min(oldScale * factor, 3));
    
    const mousePointTo = {
      x: (center.x - position.x) / oldScale,
      y: (center.y - position.y) / oldScale,
    };

    setScale(newScale);
    setPosition({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId) onRemoveComponent(selectedComponentId);
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) redo?.();
          else undo?.();
        } else if (e.key === 'y') {
          redo?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, onRemoveComponent, undo, redo]);

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const handleDragEnd = (id: string, e: any) => {
    const x = snapToGrid(e.target.x());
    const y = snapToGrid(e.target.y());
    onUpdateComponent(id, { x, y });
    e.target.position({ x, y });
  };

  const handleComponentClick = (id: string) => {
    if (selectedTool === 'SELECT') {
      onSelectComponent(id);
    } else if (selectedTool === 'DELETE') {
      onRemoveComponent(id);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const constrainedScale = Math.max(0.5, Math.min(newScale, 3));

    setScale(constrainedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * constrainedScale,
      y: pointer.y - mousePointTo.y * constrainedScale,
    });
  };

  const calculateOrthogonalPoints = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    // If start and end are almost aligned, return 2 points
    if (Math.abs(start.x - end.x) < 2) return [start.x, start.y, start.x, end.y];
    if (Math.abs(start.y - end.y) < 2) return [start.x, start.y, end.x, start.y];

    // Standard 3-segment (S-shape)
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    if (dx > dy) {
      const midX = start.x + (end.x - start.x) / 2;
      return [start.x, start.y, midX, start.y, midX, end.y, end.x, end.y];
    } else {
      const midY = start.y + (end.y - start.y) / 2;
      return [start.x, start.y, start.x, midY, end.x, midY, end.x, end.y];
    }
  };

  const getRotatedPos = (comp: Component, pin: {x: number, y: number}) => {
    const rad = (comp.rotation * Math.PI) / 180;
    const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
    const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
    return { x: comp.x + rx, y: comp.y + ry };
  };

  const handlePinClick = (compId: string, pinIdx: number, e: any) => {
    if (selectedTool === 'WIRE') {
      e.cancelBubble = true;
      const comp = design.components.find(c => c.id === compId);
      if (!comp) return;
      const def = COMPONENT_DEFINITIONS[comp.type];
      const pinPos = getRotatedPos(comp, def.pins[pinIdx]);
      
      if (!wiringState) {
        setWiringState({ fromId: compId, fromPin: pinIdx, x: pinPos.x, y: pinPos.y });
      } else {
        if (wiringState.fromId !== compId) {
          onAddConnection(wiringState.fromId, wiringState.fromPin, compId, pinIdx);
        }
        setWiringState(null);
      }
    }
  };

  const [hoveredPin, setHoveredPin] = useState<{ compId: string; pinIdx: number } | null>(null);

  const renderComponentShape = (comp: Component) => {
    const def = COMPONENT_DEFINITIONS[comp.type];
    const isSelected = comp.id === selectedComponentId;
    const isActive = activeComponentIds.has(comp.id);
    
    // Theme colors
    const color = isSelected ? '#6366f1' : (isActive ? '#fbbf24' : '#cbd5e1');
    const bgColor = isSelected ? '#1e293b' : '#0f172a';
    const strokeWidth = isActive ? 3 : 2;
    const glowColor = isActive ? 'rgba(251, 191, 36, 0.4)' : (isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent');

    let content: React.ReactNode = null;

    switch (comp.type) {
      case 'RESISTOR':
        content = (
          <Line
            points={[0, 0, 10, 0, 15, -10, 25, 10, 35, -10, 45, 10, 55, -10, 65, 10, 70, 0, 80, 0]}
            stroke={color}
            strokeWidth={2}
          />
        );
        break;
      case 'CAPACITOR':
        content = (
          <Group>
            <Line points={[0, 0, 15, 0]} stroke={color} strokeWidth={2} />
            <Line points={[15, -15, 15, 15]} stroke={color} strokeWidth={3} />
            <Line points={[25, -15, 25, 15]} stroke={color} strokeWidth={3} />
            <Line points={[25, 0, 40, 0]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'BATTERY':
        content = (
          <Group>
            <Line points={[0, 0, 15, 0]} stroke={color} strokeWidth={2} />
            <Line points={[15, -15, 15, 15]} stroke={color} strokeWidth={4} />
            <Line points={[25, -10, 25, 10]} stroke={color} strokeWidth={2} />
            <Line points={[25, 0, 40, 0]} stroke={color} strokeWidth={2} />
            <Text text="+" x={30} y={-15} fontSize={10} fill={color} />
          </Group>
        );
        break;
      case 'GROUND':
        content = (
          <Group>
            <Line points={[15, 0, 15, 10]} stroke={color} strokeWidth={2} />
            <Line points={[0, 10, 30, 10]} stroke={color} strokeWidth={2} />
            <Line points={[5, 15, 25, 15]} stroke={color} strokeWidth={2} />
            <Line points={[10, 20, 20, 20]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'DIODE':
        content = (
          <Group>
            <Line points={[0, 0, 10, 0]} stroke={color} strokeWidth={2} />
            <Line points={[10, -10, 10, 10, 30, 0, 10, -10]} stroke={color} strokeWidth={2} fill={isActive ? '#10b981' : bgColor} />
            <Line points={[30, -10, 30, 10]} stroke={color} strokeWidth={2} />
            <Line points={[30, 0, 40, 0]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'TRANSISTOR':
        content = (
          <Group>
            <Line points={[0, 20, 15, 20]} stroke={color} strokeWidth={2} />
            <Line points={[15, 5, 15, 35]} stroke={color} strokeWidth={3} />
            <Line points={[15, 10, 35, 0, 40, 0]} stroke={color} strokeWidth={2} />
            <Line points={[15, 30, 35, 40, 40, 40]} stroke={color} strokeWidth={2} />
            {/* Arrow for NPN */}
            <Line points={[25, 35, 35, 40, 32, 28]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'LED':
        content = (
          <Group>
            {isActive && <Circle x={20} y={0} radius={15} fill="rgba(16, 185, 129, 0.2)" shadowBlur={10} shadowColor="#10b981" />}
            <Line points={[0, 0, 10, 0]} stroke={color} strokeWidth={2} />
            <Line points={[10, -10, 10, 10, 30, 0, 10, -10]} stroke={color} strokeWidth={2} fill={isActive ? '#10b981' : bgColor} />
            <Line points={[30, -10, 30, 10]} stroke={color} strokeWidth={2} />
            <Line points={[30, 0, 40, 0]} stroke={color} strokeWidth={2} />
            {/* LED arrows */}
            <Line points={[15, -15, 25, -25]} stroke={color} strokeWidth={1} />
            <Line points={[20, -12, 30, -22]} stroke={color} strokeWidth={1} />
          </Group>
        );
        break;
      case 'INTEGRATED_CIRCUIT':
        content = (
          <Group>
            <Rect width={60} height={80} stroke={color} strokeWidth={2} fill={bgColor} cornerRadius={4} />
            <Circle x={30} y={8} radius={4} fill={color} />
            <Text text={comp.properties.model as string || 'IC'} x={10} y={35} fontSize={8} fill={color} fontFamily="monospace" />
          </Group>
        );
        break;
      case 'OP_AMP':
        content = (
          <Group>
            <Line points={[10, -10, 10, 50, 50, 20, 10, -10]} stroke={color} strokeWidth={2} fill={bgColor} />
            <Text text="-" x={15} y={0} fontSize={12} fill={color} />
            <Text text="+" x={15} y={25} fontSize={12} fill={color} />
          </Group>
        );
        break;
      case 'VOLTAGE_REGULATOR':
        content = (
          <Group>
            <Rect width={60} height={40} stroke={color} strokeWidth={2} fill={bgColor} cornerRadius={2} />
            <Text text="IN" x={5} y={15} fontSize={7} fill={color} />
            <Text text="GND" x={20} y={30} fontSize={7} fill={color} />
            <Text text="OUT" x={40} y={15} fontSize={7} fill={color} />
            <Text text={comp.properties.model as string || '7805'} x={15} y={5} fontSize={8} fill={color} fontStyle="bold" />
          </Group>
        );
        break;
      case 'LOGIC_AND':
        content = (
          <Group>
            <Line points={[0, 0, 30, 0]} stroke={color} strokeWidth={2} />
            <Line points={[0, 40, 30, 40]} stroke={color} strokeWidth={2} />
            <Line points={[0, 0, 0, 40]} stroke={color} strokeWidth={2} />
            <Rect x={0} y={0} width={30} height={40} fill={bgColor} />
            <Line points={[30, 0, 30, 40]} stroke={color} strokeWidth={0} />
            {/* The D shape */}
            <Circle x={30} y={20} radius={20} stroke={color} strokeWidth={2} fill={bgColor} />
            <Rect x={10} y={1} width={20} height={38} fill={bgColor} />
            <Line points={[0,0, 30,0]} stroke={color} strokeWidth={2} />
            <Line points={[0,40, 30,40]} stroke={color} strokeWidth={2} />
            <Line points={[0,0, 0,40]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'LOGIC_OR':
        content = (
          <Group>
            <Line points={[0, 0, 20, 0, 50, 20, 20, 40, 0, 40]} stroke={color} strokeWidth={2} />
            <Circle x={-5} y={20} radius={25} stroke={color} strokeWidth={2} fill={bgColor} />
            <Rect x={-30} y={-10} width={30} height={60} fill={bgColor} />
          </Group>
        );
        break;
      case 'LOGIC_NOT':
        content = (
          <Group>
            <Line points={[0, 5, 0, 35, 45, 20, 0, 5]} stroke={color} strokeWidth={2} fill={bgColor} />
            <Circle x={52} y={20} radius={5} stroke={color} strokeWidth={2} fill={bgColor} />
          </Group>
        );
        break;
      case 'BUZZER':
        content = (
          <Group>
            <Rect x={10} y={-10} width={20} height={20} stroke={color} strokeWidth={2} fill={isActive ? 'rgba(251, 191, 36, 0.4)' : bgColor} cornerRadius={10} />
            <Line points={[0, 0, 10, 0]} stroke={color} strokeWidth={2} />
            <Line points={[30, 0, 40, 0]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'SPEAKER':
        content = (
          <Group>
            <Line points={[10, 0, 20, 0, 35, -15, 35, 35, 20, 20, 10, 20, 10, 0]} stroke={color} strokeWidth={2} fill={isActive ? 'rgba(251, 191, 36, 0.2)' : bgColor} />
            <Line points={[0, 10, 10, 10]} stroke={color} strokeWidth={2} />
            <Line points={[0, 30, 22, 30]} stroke={color} strokeWidth={2} />
            {isActive && (
              <Group>
                <Circle x={40} y={10} radius={5} stroke={color} strokeWidth={1} />
                <Circle x={45} y={10} radius={8} stroke={color} strokeWidth={1} />
              </Group>
            )}
          </Group>
        );
        break;
      case 'MICROPHONE':
        content = (
          <Group>
            <Circle x={20} y={20} radius={15} stroke={color} strokeWidth={2} fill={bgColor} />
            <Line points={[10, 12, 30, 12]} stroke={color} strokeWidth={1} />
            <Line points={[10, 16, 30, 16]} stroke={color} strokeWidth={1} />
            <Line points={[0, 10, 5, 10]} stroke={color} strokeWidth={2} />
            <Line points={[0, 30, 5, 30]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'OLED_DISPLAY':
        content = (
          <Group>
            <Rect width={80} height={60} stroke={color} strokeWidth={3} fill="#020617" cornerRadius={2} />
            <Rect x={4} y={4} width={72} height={52} stroke={color} strokeWidth={1} opacity={0.3} />
            <Text text="128x64 OLED" x={10} y={10} fontSize={6} fill={color} opacity={0.5} />
            {isActive && (
              <Group>
                <Rect x={6} y={6} width={68} height={48} fill="rgba(56, 189, 248, 0.1)" />
                <Text text="HDMI SIGNAL LOCK" x={15} y={25} fontSize={6} fill="#38bdf8" fontStyle="bold" />
                <Text text="RES: 1080p ADAPTIVE" x={15} y={35} fontSize={5} fill="#38bdf8" />
              </Group>
            )}
            <Line points={[0, 5, 5, 5]} stroke={color} strokeWidth={2} />
            <Line points={[0, 15, 5, 15]} stroke={color} strokeWidth={2} />
            <Line points={[0, 25, 5, 25]} stroke={color} strokeWidth={2} />
            <Line points={[0, 35, 5, 35]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'SEVEN_SEGMENT':
        content = (
          <Group>
            <Rect width={50} height={60} stroke={color} strokeWidth={2} fill={bgColor} />
            {/* Segments */}
            <Rect x={10} y={5} width={30} height={3} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={42} y={10} width={3} height={18} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={42} y={32} width={3} height={18} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={10} y={52} width={30} height={3} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={5} y={32} width={3} height={18} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={5} y={10} width={3} height={18} fill={isActive ? '#ef4444' : '#1e293b'} />
            <Rect x={10} y={28} width={30} height={3} fill={isActive ? '#ef4444' : '#1e293b'} />
            {isActive && <Text text="8" x={18} y={15} fontSize={30} fill="#ef4444" opacity={0.3} />}
          </Group>
        );
        break;
      case 'MOTOR':
        content = (
          <Group>
            <Circle x={30} y={20} radius={20} stroke={color} strokeWidth={2} fill={bgColor} />
            <Text text="M" x={22} y={12} fontSize={16} fill={color} fontStyle="bold" />
            <Line points={[0, 20, 10, 20]} stroke={color} strokeWidth={2} />
            <Line points={[50, 20, 60, 20]} stroke={color} strokeWidth={2} />
            {isActive && <Circle x={30} y={20} radius={12} stroke="#fbbf24" strokeWidth={1} dash={[5, 5]} />}
          </Group>
        );
        break;
      case 'SOLENOID':
        content = (
          <Group>
            <Rect x={15} y={5} width={30} height={30} stroke={color} strokeWidth={2} fill={bgColor} />
            <Line points={[20, 10, 20, 30, 25, 10, 25, 30, 30, 10, 30, 30, 35, 10, 35, 30, 40, 10, 40, 30]} stroke={color} strokeWidth={1} />
            <Rect x={isActive ? 50 : 40} y={18} width={20} height={4} fill={color} />
            <Line points={[0, 10, 15, 10]} stroke={color} strokeWidth={2} />
            <Line points={[0, 30, 15, 30]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      case 'RELAY':
        content = (
          <Group>
            <Rect width={60} height={40} stroke={color} strokeWidth={2} fill={bgColor} />
            {/* Coil */}
            <Line points={[0, 10, 15, 10]} stroke={color} strokeWidth={2} />
            <Line points={[0, 30, 15, 30]} stroke={color} strokeWidth={2} />
            <Rect x={15} y={10} width={10} height={20} stroke={color} opacity={0.5} />
            {/* Contacts */}
            <Line points={[60, 20, 50, 20]} stroke={color} strokeWidth={2} />
            <Line points={[50, 20, isActive ? 40 : 40, isActive ? 0 : 40]} stroke={color} strokeWidth={2} />
            <Circle x={40} y={0} radius={2} fill={color} />
            <Circle x={40} y={40} radius={2} fill={color} />
          </Group>
        );
        break;
      case 'MOSFET':
        content = (
          <Group>
            <Line points={[0, 20, 15, 20]} stroke={color} strokeWidth={2} />
            <Line points={[15, 5, 15, 35]} stroke={color} strokeWidth={3} />
            <Line points={[20, 5, 20, 15]} stroke={color} strokeWidth={2} />
            <Line points={[20, 15, 20, 25]} stroke={color} strokeWidth={2} />
            <Line points={[20, 25, 20, 35]} stroke={color} strokeWidth={2} />
            <Line points={[20, 10, 40, 0]} stroke={color} strokeWidth={2} />
            <Line points={[20, 30, 40, 40]} stroke={color} strokeWidth={2} />
            <Line points={[20, 20, 16, 20]} stroke={color} strokeWidth={2} />
          </Group>
        );
        break;
      default:
        content = (
          <Rect
            width={def.width}
            height={def.height}
            stroke={color}
            strokeWidth={2}
            fill={bgColor}
            cornerRadius={2}
          />
        );
    }

    return (
      <Group
        key={comp.id}
        x={comp.x}
        y={comp.y}
        rotation={comp.rotation}
        draggable={selectedTool === 'SELECT'}
        onDragEnd={(e) => handleDragEnd(comp.id, e)}
        onClick={() => handleComponentClick(comp.id)}
      >
        {content}
        <Text
          text={comp.label || def.name}
          x={0}
          y={def.height + 8}
          fontSize={10}
          fontFamily="monospace"
          fill={color}
          fontStyle="bold"
        />
        {/* Render Pins */}
        {def.pins.map((pin, i) => {
          const isHovered = hoveredPin?.compId === comp.id && hoveredPin?.pinIdx === i;
          return (
            <Circle
              key={i}
              x={pin.x}
              y={pin.y}
              radius={isHovered ? 6 : (isSelected ? 5 : 3)}
              fill={isHovered ? '#818cf8' : (selectedTool === 'WIRE' ? '#6366f1' : '#1e293b')}
              stroke={color}
              strokeWidth={isHovered ? 2 : 1}
              onClick={(e) => handlePinClick(comp.id, i, e)}
              onTap={(e) => handlePinClick(comp.id, i, e)}
              onMouseEnter={() => setHoveredPin({ compId: comp.id, pinIdx: i })}
              onMouseLeave={() => setHoveredPin(null)}
              shadowBlur={isHovered ? 10 : 0}
              shadowColor="#6366f1"
            />
          );
        })}
      </Group>
    );
  };

  const renderConnection = (conn: Connection) => {
    const fromComp = design.components.find(c => c.id === conn.from);
    const toComp = design.components.find(c => c.id === conn.to);
    if (!fromComp || !toComp) return null;

    const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
    const toDef = COMPONENT_DEFINITIONS[toComp.type];
    
    const start = getRotatedPos(fromComp, fromDef.pins[conn.fromPin]);
    const end = getRotatedPos(toComp, toDef.pins[conn.toPin]);
    const isActive = activeConnectionIds.has(conn.id);
    const wireColor = isActive ? '#fbbf24' : '#6366f1';

    const points = calculateOrthogonalPoints(start, end);

    return (
      <Group key={conn.id}>
        <Line
          points={points}
          stroke={wireColor}
          strokeWidth={isActive ? 3 : 2}
          opacity={isActive ? 1 : 0.8}
          lineJoin="round"
          shadowBlur={isActive ? 8 : 0}
          shadowColor={wireColor}
          onClick={() => selectedTool === 'DELETE' && onRemoveConnection(conn.id)}
        />
        <Circle x={start.x} y={start.y} radius={isActive ? 3 : 2} fill={wireColor} />
        <Circle x={end.x} y={end.y} radius={isActive ? 3 : 2} fill={wireColor} />
      </Group>
    );
  };

  return (
    <div ref={containerRef} className="flex-1 bg-slate-950 relative cursor-crosshair overflow-hidden shadow-inner">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(99,102,241,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.1) 1px, transparent 1px)', 
             backgroundSize: `${GRID_SIZE * 2}px ${GRID_SIZE * 2}px`,
             transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`
           }} 
      />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-10" 
           style={{ 
             backgroundImage: 'radial-gradient(rgba(99,102,241,0.2) 1px, transparent 1px)', 
             backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
             transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`
           }} 
      />
      
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        draggable={selectedTool === 'SELECT' && !selectedComponentId}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        ref={stageRef}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === stageRef.current) {
            onSelectComponent(null);
            setWiringState(null);
          }
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseMove={(e) => {
          const stage = e.target.getStage();
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const stagePos = {
              x: (pointer.x - stage.x()) / stage.scaleX(),
              y: (pointer.y - stage.y()) / stage.scaleY()
            };
            setMousePos(stagePos);
          }
        }}
      >
        <Layer>
          {design.connections.map(renderConnection)}
          {design.components.map(renderComponentShape)}
          
          {selectedTool === 'WIRE' && !hoveredPin && mousePos.x !== 0 && (
            <Circle 
              x={snapToGrid(mousePos.x)} 
              y={snapToGrid(mousePos.y)} 
              radius={2} 
              fill="#6366f1" 
              opacity={0.4}
              pointerEvents="none"
            />
          )}

          {wiringState && (
            <Line
              points={calculateOrthogonalPoints(wiringState, {
                x: snapToGrid(mousePos.x),
                y: snapToGrid(mousePos.y)
              })}
              stroke="#6366f1"
              strokeWidth={2}
              dash={[4, 2]}
              lineJoin="round"
              opacity={0.6}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
});

export default SchematicCanvas;
