export type StyleToken = 
  | 'Road.Primary' | 'Road.Secondary'
  | 'Building.Residential' | 'Building.Commercial'
  | 'Landscape.Grass' | 'Landscape.Water'
  | 'Parking.Surface' | 'Amenity.Clubhouse'
  | 'Pedestrian.Path'
  | 'Annotation.Primary' | 'Annotation.Secondary'
  | 'Symbol.Tree';

export interface ThemeColors {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const DarkTheme: Record<StyleToken, ThemeColors> = {
  'Road.Primary': { fill: '#2a2a2a', stroke: '#333333', strokeWidth: 1 },
  'Road.Secondary': { fill: '#242424', stroke: '#2c2c2c', strokeWidth: 1 },
  'Building.Residential': { fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 1 },
  'Building.Commercial': { fill: '#f59e0b', stroke: '#d97706', strokeWidth: 1 },
  'Landscape.Grass': { fill: '#064e3b', stroke: '#065f46', strokeWidth: 0 },
  'Landscape.Water': { fill: '#1e3a8a', stroke: '#1e40af', strokeWidth: 0 },
  'Parking.Surface': { fill: '#3f3f46', stroke: '#52525b', strokeWidth: 1 },
  'Amenity.Clubhouse': { fill: '#8b5cf6', stroke: '#7c3aed', strokeWidth: 1 },
  'Pedestrian.Path': { fill: '#d4d4d8', stroke: '#a1a1aa', strokeWidth: 1 },
  'Annotation.Primary': { fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  'Annotation.Secondary': { fill: '#000000', stroke: 'transparent', strokeWidth: 0 }, // Shadows
  'Symbol.Tree': { fill: '#10b981', stroke: '#059669', strokeWidth: 1 }
};

// Expose current theme (expandable to Zustand later)
export const resolveTheme = (token: StyleToken): ThemeColors => {
  return DarkTheme[token] || { fill: '#ff00ff', stroke: '#000000', strokeWidth: 1 };
};
