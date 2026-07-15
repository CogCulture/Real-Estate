import React from 'react';
import { Group, Line } from 'react-konva';

interface Props {
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
}

export const InfiniteGrid: React.FC<Props> = ({ width, height, scale, x, y }) => {
  const gridSize = 50;
  const majorGridSize = 250;
  
  // Calculate visible bounds in world coordinates
  const startX = Math.floor(-x / scale / gridSize) * gridSize;
  const endX = Math.ceil((width - x) / scale / gridSize) * gridSize;
  const startY = Math.floor(-y / scale / gridSize) * gridSize;
  const endY = Math.ceil((height - y) / scale / gridSize) * gridSize;

  const lines = [];

  // Vertical lines
  for (let i = startX; i <= endX; i += gridSize) {
    const isMajor = i % majorGridSize === 0;
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i, startY, i, endY]}
        stroke={isMajor ? '#444' : '#222'}
        strokeWidth={isMajor ? 2 / scale : 1 / scale}
      />
    );
  }

  // Horizontal lines
  for (let j = startY; j <= endY; j += gridSize) {
    const isMajor = j % majorGridSize === 0;
    lines.push(
      <Line
        key={`h-${j}`}
        points={[startX, j, endX, j]}
        stroke={isMajor ? '#444' : '#222'}
        strokeWidth={isMajor ? 2 / scale : 1 / scale}
      />
    );
  }

  return <Group>{lines}</Group>;
};
