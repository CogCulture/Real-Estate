                    e.cancelBubble = true;
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'SELECT') {
                    setSelectedElementId(amenity.id);
                    e.cancelBubble = true;
                  }
                }}
              >
                {/* Shadow */}
                {!isSpecialPoint && ['amenity', 'institutional', 'parking'].includes(amenity.type) && (
                  <Line
                    x={bbox.minX + 4}
                    y={bbox.minY + 6}
                    points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                    closed={true}
                    fill="rgba(40, 25, 10, 0.22)"
                    listening={false}
                  />
                )}

                 {isLawnOrPark ? (
                  amenity.shape === 'ellipse' ? (
                    <>
                      {/* Light soil-colored walking path */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width / 2}
                        radiusY={bbox.height / 2}
                        stroke="#f5eedc"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.2}
                        listening={false}
                      />
                      {/* Textured Grass lawn */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width / 2}
                        radiusY={bbox.height / 2}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#578a34'}
                        stroke="#3a4f2e"
                        strokeWidth={1.2}
                        dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                        visible={!isSpecialPoint}
                        listening={activeTool === 'SELECT'}
                      />
                    </>
                  ) : (
                    <>
                      {/* Light soil-colored walking path */}
                      <Line
                        x={bbox.minX}
                        y={bbox.minY}
                        points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                        closed={true}
                        stroke="#f5eedc"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.2}
                        lineJoin="round"
                        lineCap="round"
                        listening={false}
                        tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      />
                      {/* Textured Grass lawn */}
                      <Line
                        x={bbox.minX}
                        y={bbox.minY}
                        points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                        closed={true}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#578a34'}
                        stroke="#3a4f2e"
                        strokeWidth={1.2}
                        lineJoin="round"
                        lineCap="round"
                        dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                        visible={!isSpecialPoint}
                        listening={activeTool === 'SELECT'}
                        tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      />
                    </>
                  )
                ) : isDecoration ? (
                  amenity.properties?.variant === 'fountain_plaza' ? (
                    <>
                      {/* Base plaza */}
                      <Rect
                        x={bbox.minX}
                        y={bbox.minY}
                        width={bbox.width}
                        height={bbox.height}
                        fill="#cfd8dc"
                        stroke="#90a4ae"
                        strokeWidth={3}
                        listening={activeTool === 'SELECT'}
                      />
                      {/* Paving lines */}
                      <Line
                        points={[bbox.minX, bbox.minY, bbox.maxX, bbox.maxY]}
                        stroke="#b0bec5"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      <Line
                        points={[bbox.maxX, bbox.minY, bbox.minX, bbox.maxY]}
                        stroke="#b0bec5"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      {/* Corner flower beds */}
                      <Circle
                        x={bbox.minX + bbox.width * 0.15}
                        y={bbox.minY + bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#e91e63"
                        stroke="#880e4f"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.maxX - bbox.width * 0.15}
                        y={bbox.minY + bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#ffeb3b"
                        stroke="#f57f17"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.minX + bbox.width * 0.15}
                        y={bbox.maxY - bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#ffeb3b"
                        stroke="#f57f17"
                        strokeWidth={1}
                        listening={false}
                      />
                      <Circle
                        x={bbox.maxX - bbox.width * 0.15}
                        y={bbox.maxY - bbox.height * 0.15}
                        radius={Math.min(bbox.width, bbox.height) * 0.08}
                        fill="#e91e63"
                        stroke="#880e4f"
                        strokeWidth={1}
                        listening={false}
                      />
                      {/* Central fountain pool */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.28}
                        radiusY={bbox.height * 0.28}
                        fill="#29b6f6"
                        stroke="#0288d1"
                        strokeWidth={2.5}
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.14}
                        radiusY={bbox.height * 0.14}
                        fill="rgba(255,255,255,0.8)"
                        stroke="none"
                        listening={false}
                      />
                    </>
                  ) : amenity.properties?.variant === 'gazebo' ? (
                    <>
                      {/* Base shadow */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.45}
                        radiusY={bbox.height * 0.45}
                        fill="rgba(0,0,0,0.1)"
                        listening={activeTool === 'SELECT'}
                      />
                      {/* Gazebo Roof (Octagon) */}
                      <Line
                        points={[
                          bbox.cx, bbox.minY,
                          bbox.maxX - bbox.width*0.15, bbox.minY + bbox.height*0.15,
                          bbox.maxX, bbox.cy,
                          bbox.maxX - bbox.width*0.15, bbox.maxY - bbox.height*0.15,
                          bbox.cx, bbox.maxY,
                          bbox.minX + bbox.width*0.15, bbox.maxY - bbox.height*0.15,
                          bbox.minX, bbox.cy,
                          bbox.minX + bbox.width*0.15, bbox.minY + bbox.height*0.15
                        ]}
                        closed={true}
                        fill="#8d6e63"
                        stroke="#5d4037"
                        strokeWidth={2}
                        listening={false}
                      />
                      {/* Roof struts */}
                      <Line points={[bbox.minX, bbox.cy, bbox.maxX, bbox.cy]} stroke="#a1887f" strokeWidth={1.5} listening={false} />
                      <Line points={[bbox.cx, bbox.minY, bbox.cx, bbox.maxY]} stroke="#a1887f" strokeWidth={1.5} listening={false} />
                      <Line points={[bbox.minX + bbox.width*0.15, bbox.minY + bbox.height*0.15, bbox.maxX - bbox.width*0.15, bbox.maxY - bbox.height*0.15]} stroke="#a1887f" strokeWidth={1.5} listening={false} />
                      <Line points={[bbox.maxX - bbox.width*0.15, bbox.minY + bbox.height*0.15, bbox.minX + bbox.width*0.15, bbox.maxY - bbox.height*0.15]} stroke="#a1887f" strokeWidth={1.5} listening={false} />
                      {/* Center finial */}
                      <Circle cx={bbox.cx} cy={bbox.cy} radius={Math.min(bbox.width, bbox.height)*0.1} fill="#8d6e63" stroke="#5d4037" strokeWidth={1.5} listening={false} />
                    </>
                  ) : amenity.properties?.variant === 'bench_row' ? (
                    <>
                      {/* Paved path underneath */}
                      <Line
                        points={[bbox.minX, bbox.cy, bbox.maxX, bbox.cy]}
                        stroke="#e2c99f"
                        strokeWidth={bbox.height * 0.4}
                        lineCap="round"
                        listening={activeTool === 'SELECT'}
                      />
                      {/* 3 Benches */}
                      {[0.15, 0.5, 0.85].map((pos, i) => (
                        <Group key={`bench-${i}`} x={bbox.minX + bbox.width * pos} y={bbox.minY + bbox.height * 0.25} listening={false}>
                          <Rect x={-bbox.width*0.08} y={0} width={bbox.width*0.16} height={bbox.height*0.3} fill="#8d6e63" stroke="#5d4037" strokeWidth={1} cornerRadius={2} />
                          <Rect x={-bbox.width*0.08} y={-bbox.height*0.1} width={bbox.width*0.16} height={bbox.height*0.15} fill="#a1887f" cornerRadius={1} />
                        </Group>
                      ))}
                    </>
                  ) : amenity.properties?.variant === 'lamp_row' ? (
                    <>
                      {/* Path */}
                      <Line
                        points={[bbox.minX, bbox.cy + bbox.height*0.2, bbox.maxX, bbox.cy + bbox.height*0.2]}
                        stroke="#bdbdbd"
                        strokeWidth={bbox.height * 0.15}
                        lineCap="round"
                        listening={activeTool === 'SELECT'}
                      />
                      {/* 3 Lamps */}
                      {[0.2, 0.5, 0.8].map((pos, i) => (
                        <Group key={`lamp-${i}`} x={bbox.minX + bbox.width * pos} y={bbox.minY} listening={false}>
                          {/* Pole */}
                          <Line points={[0, bbox.height*0.7, 0, bbox.height*0.2]} stroke="#757575" strokeWidth={2} />
                          {/* Light glow */}
                          <Circle cx={0} cy={bbox.height*0.2} radius={bbox.height*0.4} fill="rgba(253, 224, 71, 0.3)" />
                          {/* Lamp head */}
                          <Circle cx={0} cy={bbox.height*0.2} radius={bbox.height*0.15} fill="#ffee58" stroke="#f9a825" strokeWidth={1} />
                        </Group>
                      ))}
                    </>
                  ) : amenity.properties?.variant === 'hedge_maze' ? (
                    <>
                      {/* Base */}
                      <Rect x={bbox.minX} y={bbox.minY} width={bbox.width} height={bbox.height} fill="#e8f5e9" stroke="#2e7d32" strokeWidth={3} listening={activeTool === 'SELECT'} />
                      {/* Maze walls */}
                      <Rect x={bbox.minX + bbox.width*0.15} y={bbox.minY + bbox.height*0.15} width={bbox.width*0.7} height={bbox.height*0.7} fill="none" stroke="#43a047" strokeWidth={2.5} listening={false} />
                      <Rect x={bbox.minX + bbox.width*0.3} y={bbox.minY + bbox.height*0.3} width={bbox.width*0.4} height={bbox.height*0.4} fill="none" stroke="#66bb6a" strokeWidth={2} listening={false} />
                      <Rect x={bbox.cx - bbox.width*0.05} y={bbox.cy - bbox.height*0.05} width={bbox.width*0.1} height={bbox.height*0.1} fill="#81c784" listening={false} />
                      {/* Openings */}
                      <Line points={[bbox.cx, bbox.minY, bbox.cx, bbox.minY + bbox.height*0.15]} stroke="#e8f5e9" strokeWidth={4} listening={false} />
                      <Line points={[bbox.cx, bbox.maxY, bbox.cx, bbox.maxY - bbox.height*0.15]} stroke="#e8f5e9" strokeWidth={4} listening={false} />
                      <Line points={[bbox.minX, bbox.cy, bbox.minX + bbox.width*0.15, bbox.cy]} stroke="#e8f5e9" strokeWidth={4} listening={false} />
                      <Line points={[bbox.maxX, bbox.cy, bbox.maxX - bbox.width*0.15, bbox.cy]} stroke="#e8f5e9" strokeWidth={4} listening={false} />
                      <Line points={[bbox.minX + bbox.width*0.15, bbox.cy - bbox.height*0.15, bbox.minX + bbox.width*0.3, bbox.cy - bbox.height*0.15]} stroke="#e8f5e9" strokeWidth={3} listening={false} />
                    </>
                  ) : amenity.properties?.variant === 'flower_bed' ? (
                    <>
                      {/* Bed */}
                      <Ellipse x={bbox.cx} y={bbox.cy} radiusX={bbox.width/2} radiusY={bbox.height/2} fill="#4caf50" stroke="#2e7d32" strokeWidth={2} listening={activeTool === 'SELECT'} />
                      {/* Flowers */}
                      <Group listening={false}>
                        <Circle cx={bbox.minX + bbox.width*0.3} cy={bbox.minY + bbox.height*0.3} radius={bbox.width*0.12} fill="#e91e63" />
                        <Circle cx={bbox.minX + bbox.width*0.7} cy={bbox.minY + bbox.height*0.3} radius={bbox.width*0.1} fill="#ff9800" />
                        <Circle cx={bbox.minX + bbox.width*0.8} cy={bbox.minY + bbox.height*0.6} radius={bbox.width*0.12} fill="#e91e63" />
                        <Circle cx={bbox.minX + bbox.width*0.5} cy={bbox.minY + bbox.height*0.7} radius={bbox.width*0.1} fill="#ffeb3b" />
                        <Circle cx={bbox.minX + bbox.width*0.7} cy={bbox.minY + bbox.height*0.8} radius={bbox.width*0.08} fill="#ff5722" />
                        <Circle cx={bbox.minX + bbox.width*0.2} cy={bbox.minY + bbox.height*0.6} radius={bbox.width*0.09} fill="#9c27b0" />
                        <Circle cx={bbox.minX + bbox.width*0.5} cy={bbox.minY + bbox.height*0.4} radius={bbox.width*0.1} fill="#ffeb3b" />
                      </Group>
                    </>
                  ) : amenity.properties?.variant === 'sculpture' ? (
                    <>
                      {/* Base pad */}
                      <Rect x={bbox.minX} y={bbox.minY} width={bbox.width} height={bbox.height} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} cornerRadius={2} listening={activeTool === 'SELECT'} />
                      {/* Pedestal */}
                      <Rect x={bbox.minX + bbox.width*0.2} y={bbox.minY + bbox.height*0.2} width={bbox.width*0.6} height={bbox.height*0.6} fill="#b0bec5" stroke="#78909c" strokeWidth={1.5} cornerRadius={1} listening={false} />
                      {/* Statue shadow */}
                      <Ellipse x={bbox.cx} y={bbox.cy} radiusX={bbox.width*0.25} radiusY={bbox.height*0.25} fill="rgba(0,0,0,0.15)" listening={false} />
                      {/* Statue */}
                      <Circle cx={bbox.cx} cy={bbox.cy} radius={bbox.width*0.25} fill="#90a4ae" stroke="#607d8b" strokeWidth={1.5} listening={false} />
                      <Circle cx={bbox.cx} cy={bbox.cy} radius={bbox.width*0.1} fill="#b0bec5" listening={false} />
                    </>
                  ) : (
                    <>
                      {/* Grand Roundabout (fallback for all other or missing variants) */}
                      {/* Outer paved ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.46}
                        radiusY={bbox.height * 0.46}
                        fill="#eae4d8"
                        stroke="#a19786"
                        strokeWidth={2}
                        listening={activeTool === 'SELECT'}
                      />
                      {/* Inner asphalt ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.38}
                        radiusY={bbox.height * 0.38}
                        fill="#546e7a"
                        stroke="#cfc3a9"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.1}
                        listening={false}
                      />
                      {/* Green hedge ring */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.28}
                        radiusY={bbox.height * 0.28}
                        fillPatternImage={assets?.grassTile || undefined}
                        fillPatternScale={{ x: 0.2, y: 0.2 }}
                        fill={assets?.grassTile ? undefined : '#2e7d32'}
                        stroke="#1b5e20"
                        strokeWidth={Math.min(bbox.width, bbox.height) * 0.08}
                        listening={false}
                      />
                      {/* Paved walk */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.18}
                        radiusY={bbox.height * 0.18}
                        fill="#eae4d8"
                        stroke="#a19786"
                        strokeWidth={1}
                        listening={false}
                      />
                      {/* Central fountain */}
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.13}
                        radiusY={bbox.height * 0.13}
                        fill="#29b6f6"
                        stroke="#0288d1"
                        strokeWidth={2}
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.07}
                        radiusY={bbox.height * 0.07}
                        fill="rgba(255,255,255,0.75)"
                        stroke="none"
                        listening={false}
                      />
                      <Ellipse
                        x={bbox.cx}
                        y={bbox.cy}
                        radiusX={bbox.width * 0.03}
                        radiusY={bbox.height * 0.03}
                        fill="#ffffff"
                        stroke="none"
                        listening={false}
                      />
                    </>
                  )
                ) : assets && getAmenityTextureKey(amenity) && assets[getAmenityTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      if (amenity.shape === 'ellipse') {
                        context.ellipse(bbox.width / 2, bbox.height / 2, bbox.width / 2, bbox.height / 2, 0, 0, Math.PI * 2);
                      } else {
                        const relPts = pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]);
                        context.moveTo(relPts[0][0], relPts[0][1]);
                        for (let i = 1; i < relPts.length; i++) {
                          context.lineTo(relPts[i][0], relPts[i][1]);
                        }
                        context.closePath();
                      }
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getAmenityTextureKey(amenity)], 0, 0, bbox.width, bbox.height);
                      context.restore();
                      context.fillStrokeShape(shape);
                    }}
                    x={bbox.minX}
                    y={bbox.minY}
                    fill="transparent"
                    stroke={(isSelected || isClusterSelected) ? '#4f46e5' : '#b8a888'}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1.2}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : assets && isWater ? (
                  amenity.shape === 'ellipse' ? (
                    <Ellipse
                      x={bbox.cx}
                      y={bbox.cy}
                      radiusX={bbox.width / 2}
                      radiusY={bbox.height / 2}
                      fill="#81d4fa"
                      stroke="#29b6f6"
                      strokeWidth={1.5}
                      visible={!isSpecialPoint}
                      listening={activeTool === 'SELECT'}
                    />
                  ) : (
                    <Line
                      x={bbox.minX}
                      y={bbox.minY}
                      points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                      closed={true}
                      fill="#81d4fa"
                      stroke="#29b6f6"
                      strokeWidth={1.5}
                      lineJoin="round"
                      lineCap="round"
                      tension={['organic', 'fluid_organic', 'serpentine_wave', 'crescent', 'bowtie_geometric', 'circular', 'oval'].includes(amenity.shape) ? 0.35 : 0}
                      visible={!isSpecialPoint}
                      listening={activeTool === 'SELECT'}
                    />
                  )
                ) : false && isBuilding && assets?.[getBuildingTextureKey(amenity)] ? (
                  <Shape
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      const relPts = pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]);
                      context.moveTo(relPts[0][0], relPts[0][1]);
                      for (let i = 1; i < relPts.length; i++) {
                        context.lineTo(relPts[i][0], relPts[i][1]);
                      }
                      context.closePath();
                      context.save();
                      context.clip();
                      drawImageCover(context, assets[getBuildingTextureKey(amenity)], 0, 0, bbox.width, bbox.height);
                      context.restore();
                      context.fillStrokeShape(shape);
                    }}
                    x={bbox.minX}
                    y={bbox.minY}
                    fill="transparent"
                    stroke={(isSelected || isClusterSelected) ? '#4f46e5' : '#b8a888'}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1.2}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : amenity.shape === 'ellipse' ? (
                  <Ellipse
                    x={bbox.cx}
                    y={bbox.cy}
                    radiusX={bbox.width / 2}
                    radiusY={bbox.height / 2}
                    fill={amenity.type === 'tree_cluster' ? 'rgba(0,0,0,0.01)' : (ZONE_COLORS[amenity.type] || '#2ECC71')}
                    opacity={amenity.type === 'park' ? 0.35 : 0.75}
                    stroke={(isSelected || isClusterSelected) ? "#4f46e5" : (amenity.type === 'tree_cluster' ? 'transparent' : "#0f172a")}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                ) : (
                  <Line
                    x={bbox.minX}
                    y={bbox.minY}
                    points={pts.map(p => [p[0] - bbox.minX, p[1] - bbox.minY]).flat()}
                    closed={true}
                    fill={amenity.type === 'tree_cluster' ? 'rgba(0,0,0,0.01)' : (ZONE_COLORS[amenity.type] || '#2ECC71')}
                    opacity={amenity.type === 'park' ? 0.35 : 0.75}
                    stroke={(isSelected || isClusterSelected) ? "#4f46e5" : (amenity.type === 'tree_cluster' ? 'transparent' : "#0f172a")}
                    strokeWidth={(isSelected || isClusterSelected) ? 2 : 1}
                    dash={(isClusterSelected && !isSelected) ? [4, 4] : []}
                    visible={!isSpecialPoint}
                    listening={activeTool === 'SELECT'}
                  />
                )}

                {isSpecialPoint && (() => {
                  const w = amenity.width_px || bbox.width;
                  const h = amenity.height_px || bbox.height;
                  const tw = Math.max(w, 20);
                  const th = Math.max(h, 20);
                  let angleDeg = 0;
                  if (flatPts.length >= 4) {
                    angleDeg = Math.atan2(flatPts[3] - flatPts[1], flatPts[2] - flatPts[0]) * 180 / Math.PI;
                  }

                  return (
                  <>
                    <Rect
                      x={bbox.cx}
                      y={bbox.cy}
                      offsetX={tw/2}
                      offsetY={th/2}
                      width={tw}
                      height={th}
                      rotation={angleDeg}
                      fill="rgba(0,0,0,0.01)"
                      listening={true}
                    />
                    {(isSelected || isClusterSelected) && (
                      <Circle
                        x={bbox.cx}
                        y={bbox.cy}
                        radius={Math.max(tw, th) * 0.55}
                        stroke="#4f46e5"
                        strokeWidth={1.5}
                        dash={(isClusterSelected && !isSelected) ? [3, 2] : []}
                        listening={false}
                      />
                    )}
                    <Group listening={false} x={bbox.cx} y={bbox.cy} rotation={angleDeg}>
                    {amenity.type === 'tree' ? (
                      <Shape
                        sceneFunc={(context) => {
                          const texKey = getAmenityTextureKey(amenity);
                          const img = texKey && assets?.[texKey] ? assets[texKey] : (amenity.tree_variant === 'tree_row' ? assets?.treePlan2 : assets?.treePlan1);
                          if (!img) return;
                          
                          context.save();
                          context.fillStyle = 'rgba(0,0,0,0.18)';
                          context.beginPath();
                          context.ellipse(tw * 0.05, th * 0.08, tw * 0.3, th * 0.15, 0, 0, Math.PI * 2);
                          context.fill();
                          context.restore();

                          context.save();
                          context.beginPath();
                          context.arc(0, 0, Math.min(tw, th) * 0.28, 0, Math.PI * 2);
                          context.clip();
                          drawImageContain(context, img, -tw/2, -th/2, tw, th);
                          context.restore();
                        }}
                      />
                    ) : (
                      <>
                        <Shape
                          sceneFunc={(context) => {
                            context.beginPath();
                            context.rect(-w/2, -h/2, w, h);
                            context.fillStyle = '#ffffff';
                            context.fill();
                            context.lineWidth = 1.5;
                            context.strokeStyle = '#475569';
                            context.stroke();
                            
                            // Draw architectural gate lines depending on variant
                            context.beginPath();
                            if (amenity.access_variant === 'access_large' || amenity.access_variant === 'access_multi') {
                              // Grand gate: dual lanes with central pillar
                              context.moveTo(-w/6, -h/2); context.lineTo(-w/6, h/2);
                              context.moveTo(w/6, -h/2); context.lineTo(w/6, h/2);
                              context.rect(-w/12, -h/2, w/6, h);
                              context.fillStyle = '#94a3b8';
                              context.fill();
                            } else if (amenity.access_variant === 'access_modern') {
                              // Modern gate: sleek lines
                              context.moveTo(-w/2.5, -h/2); context.lineTo(-w/2.5, h/2);
                              context.moveTo(w/2.5, -h/2); context.lineTo(w/2.5, h/2);
                            } else {
                              // Minimal gate: simple divider
                              context.moveTo(0, -h/2); context.lineTo(0, h/2);
                            }
                            context.stroke();
                          }}
                        />
                        {/* Rubicon Red Triangle Logo at Main Entrance */}
                        <Line
                          points={[
                            0, -h/2 - 10,
                            -6, -h/2 - 2,
                            6, -h/2 - 2
                          ]}
                          fill="#b91c1c"
                          stroke="#ffffff"
                          strokeWidth={1}
                          closed={true}
                          shadowColor="rgba(0,0,0,0.3)"
                          shadowBlur={2.5}
                          shadowOffset={{ x: 0, y: 1 }}
                        />
                        <Rect
                          x={-w/2 + 6}
                          y={-h/2 + 6}
                          width={Math.max(10, w - 12)}
                          height={3}
                          fill="rgba(30,41,59,0.45)"
                          cornerRadius={2}
                        />
                        {!meta.showNumberLegend && (
                          <Text
                            x={-w/2}
                            y={-h/2 + 4}
                            width={w}
                            height={h}
                            text={accessLabel}
                            fontSize={8}
                            fontStyle="bold"
                            fill="#1e293b"
                            align="center"
                            verticalAlign="middle"
                            listening={false}
                          />
                        )}
                      </>
                    )}
                    </Group>
                  </>
                  );
                })()}

