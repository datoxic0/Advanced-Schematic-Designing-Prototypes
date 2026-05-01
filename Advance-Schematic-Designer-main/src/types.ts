export type ComponentType = 
  | 'RESISTOR' 
  | 'CAPACITOR' 
  | 'INDUCTOR' 
  | 'BATTERY' 
  | 'LED' 
  | 'GROUND' 
  | 'SWITCH' 
  | 'INTEGRATED_CIRCUIT'
  | 'DIODE'
  | 'TRANSISTOR'
  | 'OP_AMP'
  | 'VOLTAGE_REGULATOR'
  | 'LOGIC_AND'
  | 'LOGIC_OR'
  | 'LOGIC_NOT'
  | 'MOSFET'
  | 'BUZZER'
  | 'SPEAKER'
  | 'MICROPHONE'
  | 'OLED_DISPLAY'
  | 'SEVEN_SEGMENT'
  | 'RELAY'
  | 'SOLENOID'
  | 'MOTOR'
  | 'REED_RELAY';

export interface Component {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation: number;
  value?: string;
  label?: string;
  properties: Record<string, string | number>;
  layoutX?: number;
  layoutY?: number;
  // Simulation State
  voltage?: number;
  isActive?: boolean;
}

export interface Connection {
  id: string;
  from: string; // componentId
  fromPin: number;
  to: string; // componentId
  toPin: number;
  points?: number[]; // [x1, y1, x2, y2, ...]
  // Simulation State
  isActive?: boolean;
}

export interface CircuitDesign {
  components: Component[];
  connections: Connection[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  design: CircuitDesign;
}
