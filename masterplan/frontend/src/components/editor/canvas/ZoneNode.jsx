import React from 'react';
import { Group, Line, Arc, Shape, Circle, Text } from 'react-konva';

export default function ZoneNode({
  zone,
  isSelected,
  isClusterSelected,
  activeTool,
  scale,
  roads,
  selectedCluster,
  meta,
  clippedZonesPoints,
  getZonePoints,
  updateZone,
  deleteZone,
  setSelectedElementId,
  handleContextMenu,
  handleClusterDragStart,
  handleClusterDragMove,
  handleClusterDragEnd,
  handleTransformEnd,
  snapValue,
  getLegendNumber,
  getClippedZonePolygons,
  clipZoneGeometryAgainstRoads,
  calculatePolygonArea,
  getPolygonBoundingBox,
  pxToM,
  rotatePoint
}) {
  const originalPts = getZonePoints(zone);
  const pts = clippedZonesPoints[zone.id] || originalPts;
  const flatPts = pts.flat();
  if (flatPts.length === 0 || flatPts.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
  const bbox = getPolygonBoundingBox(pts);
  const isBuilding = ['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(zone.type);

  // localPts: pts are world-space rotated coordinates. We un-rotate by -rad
  // here so that the outer Group's rotation={zone.rotation_deg} (+rad) cancels
  // it out, producing the correct visual at the correct world position.
  // Without this un-rotation the shape would be double-rotated and the
  // Konva hit area would be misaligned from the visual (breaking single-click
  // selection after drag/rotate).
  const rad = ((zone.rotation_deg || 0) * Math.PI) / 180;
  const localPts = pts.map(p => {
    const lx = p[0] - bbox.cx;
    const ly = p[1] - bbox.cy;
    return [
      lx * Math.cos(-rad) - ly * Math.sin(-rad),
      lx * Math.sin(-rad) + ly * Math.cos(-rad)
    ];
  });
  const localFlatPts = localPts.flat();

  // shapeW / shapeH: original (unrotated) zone dimensions for footprint shapes.
  // bbox.width/height are AABB dims of the rotated polygon and GROW with
  // rotation (a 100x100 rect at 45° has AABB ~141x141), making the courtyard
  // gap and other footprint proportions change. Un-rotate originalPts to get
  // stable dims that are invariant to rotation_deg.
  const origPts = originalPts; // getZonePoints(zone) - already computed above
  const origCx = origPts.reduce((s, p) => s + p[0], 0) / origPts.length;
  const origCy = origPts.reduce((s, p) => s + p[1], 0) / origPts.length;
  const unrotOrigPts = origPts.map(p => {
    const lx = p[0] - origCx;
    const ly = p[1] - origCy;
    return [
      lx * Math.cos(-rad) - ly * Math.sin(-rad),
      lx * Math.sin(-rad) + ly * Math.cos(-rad)
    ];
  });
  const unrotXs = unrotOrigPts.map(p => p[0]);
  const unrotYs = unrotOrigPts.map(p => p[1]);
  const shapeW = Math.max(...unrotXs) - Math.min(...unrotXs);
  const shapeH = Math.max(...unrotYs) - Math.min(...unrotYs);

  return (
    <Group
      key={zone.id}
      id={zone.id}
      x={bbox.cx}
      y={bbox.cy}
      scaleX={1}
      scaleY={1}
      rotation={zone.rotation_deg || 0}
      width={bbox.width}
      height={bbox.height}
      draggable={activeTool === 'SELECT'}
      onContextMenu={(e) => handleContextMenu(e, 'zone', zone)}
      onDragStart={(e) => {
        e.cancelBubble = true;
        if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
          handleClusterDragStart(e, zone.id);
        }
      }}
      onDragMove={(e) => {
        if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
          handleClusterDragMove(e, zone.id);
        }
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (selectedCluster && selectedCluster.zoneIds && selectedCluster.zoneIds.includes(zone.id)) {
          handleClusterDragEnd(e, zone.id);
          return;
        }
        const dx = e.currentTarget.x() - bbox.cx;
        const dy = e.currentTarget.y() - bbox.cy;
        e.currentTarget.x(bbox.cx);
        e.currentTarget.y(bbox.cy);
        
        const updates = {};
        if (zone.points_px && zone.points_px.length > 0) {
          const updatedPointsPx = zone.points_px.map(p => [p[0] + dx, p[1] + dy]);
          const updatedPointsM = updatedPointsPx.map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
          const newBbox = getPolygonBoundingBox(updatedPointsPx);
          
          updates.points_px = updatedPointsPx;
          updates.points_m = updatedPointsM;
          updates.x_px = newBbox.minX;
          updates.y_px = newBbox.minY;
          updates.width_px = newBbox.width;
          updates.height_px = newBbox.height;
          updates.x_m = pxToM(newBbox.minX, scale);
          updates.y_m = pxToM(newBbox.minY, scale);
          updates.width_m = pxToM(newBbox.width, scale);
          updates.height_m = pxToM(newBbox.height, scale);
        } else {
          const newX = zone.x_px + dx;
          const newY = zone.y_px + dy;
          updates.x_px = newX;
          updates.y_px = newY;
          updates.x_m = pxToM(newX, scale);
          updates.y_m = pxToM(newY, scale);
        }

        let zonePtsM = zone.points_m;
        if (!zonePtsM || zonePtsM.length < 3) {
          const x = updates.x_m !== undefined ? updates.x_m : zone.x_m;
          const y = updates.y_m !== undefined ? updates.y_m : zone.y_m;
          const w = zone.width_m;
          const h = zone.height_m;
          const cx = x + w / 2;
          const cy = y + h / 2;
          const pts = [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h]
          ];
          if (zone.rotation_deg) {
            const rad = (zone.rotation_deg * Math.PI) / 180;
            zonePtsM = pts.map(p => {
              const dx = p[0] - cx;
              const dy = p[1] - cy;
              return [
                dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
                dx * Math.sin(rad) + dy * Math.cos(rad) + cy
              ];
            });
          } else {
            zonePtsM = pts;
          }
        } else {
          zonePtsM = updates.points_m;
        }

        const clippedPointsM = clipZoneGeometryAgainstRoads(zonePtsM, roads);
        const areaSqm = calculatePolygonArea(clippedPointsM);
        updates['properties.plot_size_sqm'] = areaSqm;
        
        updateZone(zone.id, updates);
      }}
      onTransformEnd={(e) => handleTransformEnd(e, zone)}
      onMouseDown={(e) => {
        if (activeTool === 'SELECT') {
          setSelectedElementId(zone.id);
          e.cancelBubble = true;
        }
      }}
      onClick={(e) => {
        if (activeTool === 'ERASER') {
          deleteZone(zone.id);
          e.cancelBubble = true;
        } else if (activeTool === 'SELECT') {
          setSelectedElementId(zone.id);
          e.cancelBubble = true;
        }
      }}
      onDblClick={(e) => {
        if (activeTool === 'SELECT') {
          setSelectedElementId(zone.id);
          e.cancelBubble = true;
        }
      }}
    >
      {/* Visuals Group (Clipped by clipFunc to keep outside roads) */}
      <Group
        clipFunc={(ctx) => {
          const clippedPolys = getClippedZonePolygons(zone, roads, scale);
          ctx.beginPath();
          clippedPolys.forEach(([outerRing, ...holes]) => {
            if (outerRing && outerRing.length > 0) {
              // clipFunc runs in the outer Group's rotated canvas context.
              // To clip against world-space polygon coordinates we must undo
              // the outer Group's transform: translate by -bbox.cx,-bbox.cy
              // then rotate by -rotation_deg.
              const radClip = rad; // same rad computed above
              const localOuterRing = outerRing.map(p => {
                const lx = p[0] - bbox.cx;
                const ly = p[1] - bbox.cy;
                return [
                  lx * Math.cos(-radClip) - ly * Math.sin(-radClip),
                  lx * Math.sin(-radClip) + ly * Math.cos(-radClip)
                ];
              });
              ctx.moveTo(localOuterRing[0][0], localOuterRing[0][1]);
              for (let i = 1; i < localOuterRing.length; i++) {
                ctx.lineTo(localOuterRing[i][0], localOuterRing[i][1]);
              }
              ctx.closePath();
              
              holes.forEach(hole => {
                if (hole && hole.length > 0) {
                  const localHole = hole.map(p => {
                    const lx = p[0] - bbox.cx;
                    const ly = p[1] - bbox.cy;
                    return [
                      lx * Math.cos(-radClip) - ly * Math.sin(-radClip),
                      lx * Math.sin(-radClip) + ly * Math.cos(-radClip)
                    ];
                  });
                  ctx.moveTo(localHole[0][0], localHole[0][1]);
                  for (let i = 1; i < localHole.length; i++) {
                    ctx.lineTo(localHole[i][0], localHole[i][1]);
                  }
                  ctx.closePath();
                }
              });
            }
          });
        }}
        clipRule="evenodd"
      >
        {/* Drop shadow for depth */}
        {isBuilding && (
          <Line
            points={localFlatPts}
            closed={true}
            x={3}
            y={5}
            fill="rgba(0,0,0,0.18)"
            listening={false}
          />
        )}

        {/* Arrival Plaza */}
        {zone.has_arrival_plaza && (
          <Arc
            x={0}
            y={-bbox.height / 2 - 5}
            innerRadius={0}
            outerRadius={12}
            angle={180}
            rotation={180}
            fill="#E67E22"
            listening={false}
          />
        )}

        {/* Plain coloured polygon / footprint */}
        {zone.footprint === 'cruciform' ? (
          <Shape
            sceneFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const tW = w / 3, tH = h / 3;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.moveTo(ox + tW, oy); ctx.lineTo(ox + 2*tW, oy); ctx.lineTo(ox + 2*tW, oy + tH);
              ctx.lineTo(ox + w, oy + tH); ctx.lineTo(ox + w, oy + 2*tH); ctx.lineTo(ox + 2*tW, oy + 2*tH);
              ctx.lineTo(ox + 2*tW, oy + h); ctx.lineTo(ox + tW, oy + h); ctx.lineTo(ox + tW, oy + 2*tH);
              ctx.lineTo(ox, oy + 2*tH); ctx.lineTo(ox, oy + tH); ctx.lineTo(ox + tW, oy + tH);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            hitFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.rect(ox, oy, w, h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            x={0} y={0}
            fill={zone.color} opacity={zone.opacity || 1}
            stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
            dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
            listening={activeTool === 'SELECT'}
          />
        ) : zone.footprint === 'h_shaped' ? (
          <Shape
            sceneFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const tW = w / 3, tH = h / 3;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.moveTo(ox, oy); ctx.lineTo(ox + tW, oy); ctx.lineTo(ox + tW, oy + tH); ctx.lineTo(ox + 2*tW, oy + tH);
              ctx.lineTo(ox + 2*tW, oy); ctx.lineTo(ox + w, oy); ctx.lineTo(ox + w, oy + h); ctx.lineTo(ox + 2*tW, oy + h);
              ctx.lineTo(ox + 2*tW, oy + 2*tH); ctx.lineTo(ox + tW, oy + 2*tH); ctx.lineTo(ox + tW, oy + h); ctx.lineTo(ox, oy + h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            hitFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.rect(ox, oy, w, h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            x={0} y={0}
            fill={zone.color} opacity={zone.opacity || 1}
            stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
            dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
            listening={activeTool === 'SELECT'}
          />
        ) : zone.footprint === 'u_shaped' ? (
          <Shape
            sceneFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const tW = w / 3, tH = h / 3;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.moveTo(ox, oy); ctx.lineTo(ox + w, oy); ctx.lineTo(ox + w, oy + h); ctx.lineTo(ox + 2*tW, oy + h);
              ctx.lineTo(ox + 2*tW, oy + tH); ctx.lineTo(ox + tW, oy + tH); ctx.lineTo(ox + tW, oy + h); ctx.lineTo(ox, oy + h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            hitFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.rect(ox, oy, w, h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            x={0} y={0}
            fill={zone.color} opacity={zone.opacity || 1}
            stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
            dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
            listening={activeTool === 'SELECT'}
          />
        ) : zone.footprint === 'courtyard' ? (
          <Shape
            sceneFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const tW = w / 4, tH = h / 4;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.rect(ox, oy, w, h);
              ctx.rect(ox + w - tW, oy + tH, -(w - 2*tW), h - 2*tH);
              ctx.fillStrokeShape(shape);
            }}
            hitFunc={(ctx, shape) => {
              const w = shapeW, h = shapeH;
              const ox = -w/2, oy = -h/2;
              ctx.beginPath();
              ctx.rect(ox, oy, w, h);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fillRule="evenodd"
            x={0} y={0}
            fill={zone.color} opacity={zone.opacity || 1}
            stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'} strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
            dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
            listening={activeTool === 'SELECT'}
          />
        ) : (
          <Line
            points={localFlatPts}
            closed={true}
            fill={zone.color}
            opacity={zone.opacity || 1}
            stroke={(isSelected || isClusterSelected) ? '#4f46e5' : isBuilding ? '#0f172a' : '#374151'}
            strokeWidth={(isSelected || isClusterSelected) ? 2.5 : 1.2}
            dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
            listening={activeTool === 'SELECT'}
          />
        )}

        {/* Inside Block Size Label */}
        {(() => {
          if (meta.showNumberLegend) {
            const legendNum = !meta.hideNumbersOnBlocks ? getLegendNumber(zone.label) : null;
            if (legendNum) {
              return (
                <Group x={0} y={0} listening={false}>
                  <Circle radius={13} fill="#ffffff" shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffset={{x:0, y:2}} />
                  <Text text={legendNum.toString()} fontSize={14} fontStyle="bold" fill="#0f172a" align="center" verticalAlign="middle" x={-13} y={-13} width={26} height={26} />
                </Group>
              );
            }
            return null;
          }

          const clippedPtsM = (clippedZonesPoints[zone.id] || originalPts).map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
          const areaSqm = calculatePolygonArea(clippedPtsM);
          const labelText = `${zone.label || 'Zone'}\n(${zone.type.toUpperCase()})\n${zone.floors ? zone.floors + ' Floors' : ''}\n${Math.round(areaSqm).toLocaleString()} m²`;
          return (
            <Text
              x={-bbox.width / 2}
              y={-bbox.height / 2}
              width={bbox.width}
              height={bbox.height}
              text={labelText}
              fontSize={9}
              fontStyle="bold"
              fill="#0f172a"
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          );
        })()}
      </Group>
    </Group>
  );
}
