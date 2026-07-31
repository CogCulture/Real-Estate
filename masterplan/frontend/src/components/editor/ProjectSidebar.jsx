import React, { useState, useMemo } from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useProjectStore } from '../../store/useProjectStore';
import { Layers, PieChart, Info, Map, Sparkles, X, ChevronDown, Sliders, Settings, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as turf from '@turf/turf';

export default function ProjectSidebar({
  showSetbacks, setShowSetbacks,
  showDimensions, setShowDimensions,
  showTicks, setShowTicks,
  dimensionUnit, setDimensionUnit,
  showCompass, setShowCompass
}) {
  const { meta, setMeta, zones, roads, amenities } = useLayoutStore();
  const { currentProject } = useProjectStore();
  const [activeCategory, setActiveCategory] = useState('design');
  const [boundarySelections, setBoundarySelections] = useState({
    roads: true,
    paths: true,
    trees: true
  });
  const masterplan = meta?.masterplan_ai;

  const getZonePoints = (zone) => {
    if (zone.points_px && zone.points_px.length > 0) return zone.points_px;
    const x = zone.x_px;
    const y = zone.y_px;
    const w = zone.width_px;
    const h = zone.height_px;
    if (zone.rotation_deg) {
      const rad = (zone.rotation_deg * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rotate = (px, py) => {
        const dx = px - cx;
        const dy = py - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      };
      return [rotate(x, y), rotate(x + w, y), rotate(x + w, y + h), rotate(x, y + h)];
    }
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  };

  const getAmenityPoints = (amenity) => {
    if (amenity.points_px && amenity.points_px.length > 0) return amenity.points_px;
    const x = amenity.x_px;
    const y = amenity.y_px;
    const w = amenity.width_px;
    const h = amenity.height_px;
    if (amenity.rotation_deg) {
      const rad = (amenity.rotation_deg * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rotate = (px, py) => {
        const dx = px - cx;
        const dy = py - cy;
        return [
          dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
          dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        ];
      };
      return [rotate(x, y), rotate(x + w, y), rotate(x + w, y + h), rotate(x, y + h)];
    }
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  };

  const filteredAmenities = useMemo(() => {
    return (amenities || []).filter(a => a.type !== 'tree' && a.type !== 'entry_exit');
  }, [amenities]);

  const pxToM = (val, scale) => val / scale;

  // Overlap Detection Memo
  const overlappingPairs = useMemo(() => {
    const scale = meta.scale_px_per_m || 2.4;
    const DEG_TO_M = 111320;
    
    const items = [];

    // Zones
    (zones || []).forEach(zone => {
      const pts = getZonePoints(zone).map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
      if (pts.length < 3) return;
      const closed = [...pts];
      if (closed[0][0] !== closed[closed.length-1][0] || closed[0][1] !== closed[closed.length-1][1]) {
        closed.push(closed[0]);
      }
      const coords = closed.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
      try {
        let poly = turf.polygon([coords]);
        poly = turf.rewind(poly, { mutate: true });
        const cleaned = turf.buffer(poly, 0);
        items.push({
          id: zone.id,
          name: zone.label || `Zone (${zone.type.toUpperCase()})`,
          type: 'zone',
          feature: cleaned || poly,
          raw: zone
        });
      } catch (e) {}
    });

    // Amenities (filtered)
    filteredAmenities.forEach(amenity => {
      const pts = getAmenityPoints(amenity).map(p => [pxToM(p[0], scale), pxToM(p[1], scale)]);
      if (pts.length < 3) return;
      const closed = [...pts];
      if (closed[0][0] !== closed[closed.length-1][0] || closed[0][1] !== closed[closed.length-1][1]) {
        closed.push(closed[0]);
      }
      const coords = closed.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
      try {
        let poly = turf.polygon([coords]);
        poly = turf.rewind(poly, { mutate: true });
        const cleaned = turf.buffer(poly, 0);
        items.push({
          id: amenity.id,
          name: amenity.label || `Amenity (${amenity.type.toUpperCase()})`,
          type: 'amenity',
          feature: cleaned || poly,
          raw: amenity
        });
      } catch (e) {}
    });

    // Roads
    (roads || []).forEach(road => {
      if (!road.points_m || road.points_m.length < 2) return;
      const roadPtsNorm = road.points_m.map(p => [p[0] / DEG_TO_M, p[1] / DEG_TO_M]);
      try {
        const roadLine = turf.lineString(roadPtsNorm);
        const isMajor = road.type === 'primary' || road.type === 'ring_primary' || road.type === 'ring_secondary';
        const sidewalkM = isMajor ? 2.0 : 1.0;
        const totalBufferM = (road.width_m / 2) + sidewalkM;
        const bufferDist = totalBufferM / DEG_TO_M;
        let roadPoly = turf.buffer(roadLine, bufferDist, { units: 'degrees' });
        roadPoly = turf.rewind(roadPoly, { mutate: true });
        const cleaned = turf.buffer(roadPoly, 0);
        items.push({
          id: road.id,
          name: road.name || `Road (${road.type.toUpperCase()})`,
          type: 'road',
          feature: cleaned || roadPoly,
          raw: road
        });
      } catch (e) {}
    });

    const pairs = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i];
        const item2 = items[j];
        
        if (item1.type === 'road' && item2.type === 'road') continue;

        try {
          const intersect = turf.intersect(turf.featureCollection([item1.feature, item2.feature]));
          if (intersect) {
            const area = turf.area(intersect);
            if (area > 0.00000001) {
              const idA = item1.id < item2.id ? item1.id : item2.id;
              const idB = item1.id < item2.id ? item2.id : item1.id;
              const pairKey = `${idA}_${idB}`;
              
              pairs.push({
                key: pairKey,
                item1,
                item2,
                areaSqm: area * (DEG_TO_M ** 2)
              });
            }
          }
        } catch (e) {}
      }
    }
    return pairs;
  }, [zones, roads, filteredAmenities, meta.scale_px_per_m]);

  // Calculate number of boundary edges
  let uniquePtsCount = 0;
  if (currentProject?.boundary_geojson?.coordinates?.[0]) {
    const coords = currentProject.boundary_geojson.coordinates[0];
    const unique = [];
    coords.forEach(pt => {
      if (unique.length === 0) {
        unique.push(pt);
      } else {
        const last = unique[unique.length - 1];
        if (Math.abs(pt[0] - last[0]) > 0.00001 || Math.abs(pt[1] - last[1]) > 0.00001) {
          unique.push(pt);
        }
      }
    });
    if (unique.length > 2) {
      const first = unique[0];
      const last = unique[unique.length - 1];
      if (Math.abs(last[0] - first[0]) < 0.00001 && Math.abs(last[1] - first[1]) < 0.00001) {
        unique.pop();
      }
    }
    uniquePtsCount = unique.length;
  }

  const frontEdgeIndex = meta?.front_edge_index !== undefined ? meta.front_edge_index : 0;

  if (!masterplan) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center text-neutral-500 h-full">
        <Map className="w-10 h-10 text-neutral-300 mb-3" />
        <p className="text-xs font-semibold text-neutral-700">No Masterplan Data</p>
        <p className="text-[10px] text-neutral-400 mt-1 max-w-[180px] leading-relaxed">Use the "Suggest Layout" button to generate an AI masterplan.</p>
      </div>
    );
  }

  const { project, land_use, legend } = masterplan;

  return (
    <div className="w-full h-full flex flex-col bg-[#fafafa]">
      {/* Header */}
      <div className="p-4 bg-white border-b border-neutral-100 shrink-0">
        <h2 className="text-sm font-bold text-neutral-900 truncate" title={project?.name}>{project?.name || "Project Overview"}</h2>
        <p className="text-[10px] text-neutral-500 truncate mt-0.5" title={project?.location}>{project?.location || "Location not specified"}</p>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-neutral-100 bg-white shrink-0 p-2 gap-1 z-10">
        {[
          { id: 'design', label: 'Design', icon: Sliders },
          { id: 'analytics', label: 'Analytics', icon: PieChart },
          { id: 'diagnostics', label: 'Diagnostics', icon: AlertTriangle, badge: overlappingPairs.length },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all overflow-hidden ${
                isActive 
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              <Icon size={12} className={`shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span className="truncate">{tab.label}</span>
              {tab.badge > 0 && (
                <span className={`shrink-0 text-[9px] font-bold px-1.5 rounded-full ${
                  isActive ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500 border border-rose-100'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeCategory === 'design' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Workspace Settings */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Display Settings</h3>
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 space-y-4 shadow-sm text-[11px]">
              {/* Setbacks Toggle */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={meta.showSetback !== false} 
                    onChange={(e) => setMeta({ showSetback: e.target.checked })}
                    className="rounded border-neutral-300 text-black focus:ring-black w-3.5 h-3.5"
                  />
                  Show Setback Lines
                </label>
                <p className="text-[9.5px] text-neutral-400 pl-5 leading-relaxed">
                  Toggle setback boundaries. Click any property edge in select mode to assign it as front setback.
                </p>
                
                {showSetbacks && uniquePtsCount > 0 && (
                  <div className="pl-5 pt-2 flex items-center justify-between gap-2 border-t border-neutral-100 mt-2">
                    <span className="text-[9.5px] text-neutral-500 font-bold uppercase shrink-0">Front Edge:</span>
                    <select 
                      value={frontEdgeIndex} 
                      onChange={(e) => {
                        const index = parseInt(e.target.value);
                        setMeta({ front_edge_index: index });
                        toast.success(`Front property line set to Edge #${index + 1}!`);
                      }}
                      className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[10px] text-neutral-700 focus:outline-none focus:ring-1 focus:ring-black font-semibold"
                    >
                      {Array.from({ length: uniquePtsCount }).map((_, idx) => (
                        <option key={idx} value={idx}>Edge #{idx + 1}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <hr className="border-neutral-100" />

              {/* Dimensions Toggle */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showDimensions} 
                    onChange={(e) => setShowDimensions(e.target.checked)}
                    className="rounded border-neutral-300 text-black focus:ring-black w-3.5 h-3.5"
                  />
                  Show Dimensions
                </label>
                {showDimensions && (
                  <div className="pl-5 space-y-2.5">
                    <label className="flex items-center gap-2 font-medium text-neutral-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showTicks} 
                        onChange={(e) => setShowTicks(e.target.checked)}
                        className="rounded border-neutral-300 text-black focus:ring-black w-3.5 h-3.5"
                      />
                      Show Outer Scale Lines
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase">Unit:</span>
                      <select 
                        value={dimensionUnit} 
                        onChange={(e) => setDimensionUnit(e.target.value)}
                        className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[10px] text-neutral-700 focus:outline-none focus:ring-1 focus:ring-black font-semibold"
                      >
                        <option value="m">meters (m)</option>
                        <option value="km">kilometers (km)</option>
                        <option value="ft">feet (ft)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-neutral-100" />

              {/* Compass Toggle */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showCompass} 
                    onChange={(e) => setShowCompass(e.target.checked)}
                    className="rounded border-neutral-300 text-black focus:ring-black w-3.5 h-3.5"
                  />
                  Show HUD Compass
                </label>
                <p className="text-[9.5px] text-neutral-400 pl-5 leading-normal">
                  Toggle North-pointing indicator.
                </p>
              </div>
            </div>
          </div>

          {/* Perimeter Features inline */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Site Boundaries</h3>
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 space-y-3.5 shadow-sm">
              <p className="text-[10px] text-neutral-450 leading-relaxed">Generate key architectural segments automatically around the boundary perimeter lines.</p>
              <div className="space-y-2">
                {[
                  { id: 'roads', label: 'Boundary Ring Road', desc: 'Perimeter road enclosing the site' },
                  { id: 'trees', label: 'Perimeter Trees', desc: 'Foliage buffer around the site' },
                  { id: 'paths', label: 'Jogging / Pedestrian Path', desc: 'Walking trail inside boundary' },
                ].map(item => (
                  <label key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 w-3.5 h-3.5 text-black rounded border-neutral-300 focus:ring-black"
                      checked={boundarySelections[item.id]}
                      onChange={(e) => setBoundarySelections(s => ({ ...s, [item.id]: e.target.checked }))}
                    />
                    <div>
                      <div className="text-[10.5px] font-semibold text-neutral-700">{item.label}</div>
                      <div className="text-[9px] text-neutral-400 leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  if (boundarySelections.roads) window.dispatchEvent(new Event('generateBoundaryRoad'));
                  if (boundarySelections.paths) window.dispatchEvent(new Event('generateBoundaryPath'));
                  if (boundarySelections.trees) window.dispatchEvent(new Event('generateBoundaryTrees'));
                  toast.success('Boundary features generated!');
                }}
                className="w-full flex items-center justify-center gap-1.5 bg-neutral-950 hover:bg-neutral-850 text-white text-[11px] font-bold py-2 rounded-lg transition-colors mt-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-200" />
                Generate Boundaries
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCategory === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Details Section */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Project Specifications</h3>
            <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 space-y-2.5 text-[11px] shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Total Area</span>
                <span className="font-semibold text-neutral-900">{project?.total_area_acres || "-"} Acres</span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-neutral-100">
                <span className="text-neutral-500">Total Towers</span>
                <span className="font-semibold text-neutral-900">{project?.total_towers || "-"}</span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-neutral-100">
                <span className="text-neutral-500">Design Theme</span>
                <span className="font-semibold text-neutral-900 truncate max-w-[130px] text-right" title={project?.theme}>{project?.theme || "-"}</span>
              </div>
            </div>
          </div>

          {/* Land Use Section */}
          {land_use && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Land Allocation</h3>
              <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 space-y-3.5 shadow-sm">
                {Object.entries(land_use).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="capitalize text-neutral-600 font-medium truncate max-w-[140px]" title={key}>{key.replace('_pct', '').replace('_', ' ')}</span>
                      <span className="font-bold text-neutral-950">{value}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-neutral-800 h-full rounded-full" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit Mix Section */}
          {project?.unit_mix && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Target Unit Mix</h3>
              <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 space-y-3.5 shadow-sm">
                {Object.entries(project.unit_mix).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="capitalize text-neutral-600 font-medium" title={key}>{key.replace('_pct', '').replace('_', ' ')}</span>
                      <span className="font-bold text-neutral-950">{value}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-neutral-950 h-full rounded-full" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend Section */}
          {legend && legend.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Zone Map Legend</h3>
              <div className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-sm">
                <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-600">
                  {legend.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-neutral-350" style={{ backgroundColor: item.color || '#e5e7eb' }} />
                      <span className="truncate text-neutral-700 font-medium" title={item.label}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeCategory === 'diagnostics' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest">Overlap Priority Manager</h3>
            <div className="space-y-3">
              {overlappingPairs.length === 0 ? (
                <div className="p-3.5 bg-white border border-neutral-200 rounded-xl text-[10.5px] text-emerald-600 font-semibold leading-relaxed shadow-sm flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <div>
                    <div className="text-emerald-800 font-bold">Clear Geometry</div>
                    <div className="text-[9.5px] text-neutral-450 font-normal mt-0.5 leading-normal">No overlapping structures detected! All blocks, roads, and amenities are geometrically clean.</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-[10px] text-amber-800 leading-normal mb-1">
                    ⚠️ <strong>{overlappingPairs.length} conflict{overlappingPairs.length > 1 ? 's' : ''} detected.</strong> Set priority to designate which item remains intact, and the other will automatically slice.
                  </div>
                  <div className="space-y-3">
                    {overlappingPairs.map((pair) => {
                      const priorities = meta.overlap_priorities || {};
                      const currentPriority = priorities[pair.key] || 'default';
                      
                      return (
                        <div key={pair.key} className="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-sm space-y-2.5 min-w-0">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <div className="font-bold text-neutral-800 text-[10.5px] leading-snug min-w-0 flex-1">
                              {pair.item1.name} <span className="text-[8.5px] font-normal text-neutral-450">({pair.item1.type})</span>
                              <span className="text-neutral-400 font-normal mx-1">↔</span>
                              {pair.item2.name} <span className="text-[8.5px] font-normal text-neutral-450">({pair.item2.type})</span>
                            </div>
                            <span className="text-[8.5px] font-bold text-rose-500 bg-rose-50 border border-rose-100/50 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                              {Math.round(pair.areaSqm)} m²
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-1 pt-2 border-t border-neutral-100">
                            <span className="text-[8.5px] font-bold text-neutral-450 uppercase">Resolution:</span>
                            <select
                              value={currentPriority}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updatedPriorities = { ...priorities };
                                if (val === 'default') {
                                  delete updatedPriorities[pair.key];
                                } else {
                                  updatedPriorities[pair.key] = val;
                                }
                                setMeta({ overlap_priorities: updatedPriorities });
                                toast.success('Overlap priority updated!');
                              }}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-[10px] text-neutral-700 focus:outline-none focus:ring-1 focus:ring-black font-semibold"
                            >
                              <option value="default">Default (Auto)</option>
                              <option value={pair.item1.id}>Keep {pair.item1.name}</option>
                              <option value={pair.item2.id}>Keep {pair.item2.name}</option>
                              <option value="none">No Cut (Allow overlap)</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
