export type GraphNodeType = 'node' | 'building_entry' | 'gate' | 'path_start' | 'path_middle' | 'path_end';
export type TransportMode = 'walking' | 'driving';

export interface MapNode {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  type: GraphNodeType;
  building_ids?: string[];
  floor_level?: number;

  is_closed?: boolean;
  closed_until_toggled?: boolean;
  closed_from?: string;
  closed_until?: string;
  closure_reason?: string;
  
  // Recurring closure
  closure_recurring_start?: string; // "HH:MM" 24h format
  closure_recurring_end?: string;   // "HH:MM" 24h format
  closure_recurring_days?: number[]; // 0=Sunday, 1=Monday, ...

  // Advanced daily schedule
  closure_daily_schedule?: Record<number, { start: string, end: string }>; // key: 0-6

  group_id?: string;
}

export interface MapEdge {
  id: string;
  source_id: string;
  target_id: string;
  weight: number;
  bidirectional: boolean;
  
  type: 'road' | 'walkway'; 
  
  access?: TransportMode[]; 

  is_closed?: boolean;
  closed_until_toggled?: boolean;
  closed_from?: string;
  closed_until?: string;
  closure_reason?: string;
  
  // Recurring closure (e.g. closed every night 10PM-6AM)
  closure_recurring_start?: string; // "HH:MM" 24h format
  closure_recurring_end?: string;   // "HH:MM" 24h format
  closure_recurring_days?: number[]; // 0=Sunday, 1=Monday, ...

  // Advanced daily schedule (different times per day)
  closure_daily_schedule?: Record<number, { start: string, end: string }>; // key: 0-6
}

export interface PathResult {
  path: MapNode[];
  totalDistance: number;
  estimatedTime?: number;
}
