import React from 'react';
import { Line, Circle, Text } from 'react-konva';
import type { RenderPrimitive, RenderPolygon, RenderCircle, RenderText } from '../types';
import { resolveTheme, type StyleToken } from '../themes';

interface Props {
  primitive: RenderPrimitive;
  onClick?: () => void;
  isSelected?: boolean;
}

export const PrimitiveRenderer: React.FC<Props> = ({ primitive, onClick, isSelected }) => {
  const theme = resolveTheme(primitive.style as StyleToken);
  
  // Highlighting stroke if selected
  const stroke = isSelected ? '#ffcc00' : theme.stroke;
  const strokeWidth = isSelected ? theme.strokeWidth * 2 : theme.strokeWidth;
  
  switch (primitive.type) {
    case 'Polygon': {
      const poly = primitive as RenderPolygon;
      // Flat array for Konva
      const flatPoints = poly.points.flatMap(p => [p.x, p.y]);
      return (
        <Line 
          points={flatPoints} 
          fill={theme.fill} 
          stroke={stroke} 
          strokeWidth={strokeWidth} 
          closed 
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'Circle': {
      const circle = primitive as RenderCircle;
      return (
        <Circle 
          x={circle.center.x} 
          y={circle.center.y} 
          radius={circle.radius} 
          fill={theme.fill} 
          stroke={stroke} 
          strokeWidth={strokeWidth}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'Text': {
      const text = primitive as RenderText;
      if (text.hidden) return null;
      return (
        <Text 
          x={text.anchor.x} 
          y={text.anchor.y} 
          text={text.text} 
          fill={theme.fill} 
          fontSize={text.fontSize || 12}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    default:
      return null;
  }
};
