import React, { useState, useEffect, useMemo } from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { Trash2, BarChart3, Sliders, Settings, Plus } from 'lucide-react';
import Button from '../ui/Button';
import { ZONE_COLORS, ROAD_COLORS } from '../../utils/colorMap';
import BoundaryGeneratorModal from './BoundaryGeneratorModal';

export default function PropertiesPanel() {
  const {
    zones,
    roads,
    amenities,
    labels,
    selectedElementId,
    updateZone,
    deleteZone,
    updateRoad,
    deleteRoad,
    updateLabel,
    deleteLabel,
    updateAmenity,
    deleteAmenity,
    meta,
    setMeta,
    setActiveTool,
    setSelectedElementId
  } = useLayoutStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);
  
  // Quick Actions percentages: default or custom from meta
  // URDPFI/Municipal planning norms (used as RERA disclosure benchmarks)
  const landAllocationTargets = useMemo(() => {
    return meta.land_allocation || {
      residential: 50, // 45–55% per URDPFI guidelines
      commercial: 5,   // 3–5%
      green: 15,       // 10–15% mandatory open/green space
      roads: 20,       // 15–20% roads & circulation
      amenities: 10    // 5–10% public/civic amenities
    };
  }, [meta.land_allocation]);

  const [tempTargets, setTempTargets] = useState(landAllocationTargets);

  // Sync temp targets when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTempTargets(landAllocationTargets);
    }
  }, [isModalOpen, landAllocationTargets]);

  // Total percentage check
  const tempTotal = useMemo(() => {
    return Object.values(tempTargets).reduce((a, b) => a + b, 0);
  }, [tempTargets]);

  // Switch to properties tab when element is selected
  useEffect(() => {
    if (selectedElementId) {
      setActiveTab('properties');
    } else {
      setActiveTab('dashboard');
    }
  }, [selectedElementId]);

  // Find selected item
  const selectedZone = zones.find(z => z.id === selectedElementId);
  const selectedRoad = roads.find(r => r.id === selectedElementId);
  const selectedLabel = labels.find(l => l.id === selectedElementId);
  const selectedAmenity = amenities.find(a => a.id === selectedElementId);

  // Land statistics calculation
  const stats = useMemo(() => {
    const totalArea = meta.total_area_sqm || 150000;
    const areas = {
      residential: 0,
      commercial: 0,
      green: 0,
      roads: 0,
      amenities: 0
    };

    const getZoneArea = (z) => {
      if (z.points_m && z.points_m.length > 2) {
        let area = 0;
        const n = z.points_m.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          area += z.points_m[i][0] * z.points_m[j][1] - z.points_m[j][0] * z.points_m[i][1];
        }
        return Math.abs(area / 2);
      }
      if (z.properties && z.properties.plot_size_sqm) {
        return z.properties.plot_size_sqm;
      }
      return z.width_m * z.height_m;
    };

    const getAmenityArea = (a) => {
      if (a.points_m && a.points_m.length > 2) {
        let area = 0;
        const n = a.points_m.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          area += a.points_m[i][0] * a.points_m[j][1] - a.points_m[j][0] * a.points_m[i][1];
        }
        return Math.abs(area / 2);
      }
      return a.width_m * a.height_m;
    };

    zones.forEach(z => {
      const area = getZoneArea(z);
      if (z.type === 'residential') areas.residential += area;
      else if (['commercial', 'mixed_use', 'industrial'].includes(z.type)) areas.commercial += area;
      else if (['green_belt', 'water_body', 'park', 'open_space'].includes(z.type)) areas.green += area;
      else if (['amenity', 'institutional', 'parking'].includes(z.type)) areas.amenities += area;
    });

    amenities.forEach(a => {
      const area = getAmenityArea(a);
      if (['park', 'green_belt', 'water_body', 'open_space'].includes(a.type)) areas.green += area;
      else areas.amenities += area;
    });

    roads.forEach(r => {
      let length = 0;
      if (r.type?.startsWith('ring') && r.radius_m) {
        length = 2 * Math.PI * r.radius_m;
      } else if (r.points_m?.length > 1) {
        for (let i = 0; i < r.points_m.length - 1; i++) {
          const p1 = r.points_m[i];
          const p2 = r.points_m[i+1];
          length += Math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2);
        }
      }
      areas.roads += length * (r.width_m || 6);
    });

    const percentages = {
      residential: parseFloat(((areas.residential / totalArea) * 100).toFixed(1)),
      commercial: parseFloat(((areas.commercial / totalArea) * 100).toFixed(1)),
      green: parseFloat(((areas.green / totalArea) * 100).toFixed(1)),
      roads: parseFloat(((areas.roads / totalArea) * 100).toFixed(1)),
      amenities: parseFloat(((areas.amenities / totalArea) * 100).toFixed(1))
    };

    return { areas, percentages, totalArea };
  }, [zones, roads, amenities, meta.total_area_sqm]);

  const handleDragStart = (e, roadType) => {
    e.dataTransfer.setData('application/react-flow', roadType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRoadPresetClick = (roadType) => {
    setMeta({ activeRoadType: roadType });
    setActiveTool(roadType?.startsWith('ring') ? 'RING' : 'LINE');
  };

  const handlePlacementPresetClick = (category, variant) => {
    setMeta({
      activePlacementCategory: category,
      activePlacementVariant: variant
    });
    setActiveTool('SELECT');
    setSelectedElementId(null);
  };

  const roadOptions = [
    { value: 'primary', label: 'Primary (6m, Median)' },
    { value: 'secondary', label: 'Secondary (4m)' },
    { value: 'tertiary', label: 'Tertiary (3m)' },
    { value: 'service', label: 'Service Lane (2.5m)' },
    { value: 'pedestrian', label: 'Pedestrian Walkway (2m)' },
    { value: 'cycle_track', label: 'Cycle Track (2m)' },
    { value: 'ring_primary', label: 'Outer Ring Road (6m)' },
    { value: 'ring_secondary', label: 'Inner Ring Road (4m)' }
  ];

  const roadCards = [
    { value: 'primary', title: 'Grand Boulevard (6m)', badge: 'Primary', tone: 'bg-slate-700', bar: 'h-6', strip: 'border-white/85' },
    { value: 'secondary', title: 'Secondary Avenue (4m)', badge: 'Secondary', tone: 'bg-slate-600', bar: 'h-5', strip: 'border-slate-400' },
    { value: 'tertiary', title: 'Local Access Road (3m)', badge: 'Local', tone: 'bg-slate-500', bar: 'h-4', strip: 'border-slate-300' },
    { value: 'service', title: 'Service Lane (2.5m)', badge: 'Service', tone: 'bg-slate-400', bar: 'h-3.5', strip: 'border-slate-200' },
    { value: 'pedestrian', title: 'Pedestrian Walkway (2m)', badge: 'Walkway', tone: 'bg-stone-300', bar: 'h-3', strip: 'border-stone-300' },
    { value: 'cycle_track', title: 'Cycle Track (2m)', badge: 'Cycle', tone: 'bg-emerald-300', bar: 'h-3', strip: 'border-emerald-200' },
    { value: 'ring_primary', title: 'Outer Ring Road (6m)', badge: 'Ring', tone: 'bg-violet-50', bar: 'h-10', strip: 'border-violet-200' },
    { value: 'ring_secondary', title: 'Inner Ring Road (4m)', badge: 'Ring', tone: 'bg-indigo-50', bar: 'h-10', strip: 'border-indigo-200' }
  ];

  const buildingOptions = [
    { value: 'building_residential', label: 'Residential Block', badge: 'Homes', desc: 'Soft warm facade', tone: 'from-blue-50 to-slate-50' },
    { value: 'building_commercial', label: 'Commercial Block', badge: 'Office', desc: 'Glass tower massing', tone: 'from-amber-50 to-slate-50' },
    { value: 'building_mixed_use', label: 'Mixed Use Block', badge: 'Mixed', desc: 'Podium with upper floors', tone: 'from-violet-50 to-slate-50' },
    { value: 'building_institutional', label: 'Institutional Block', badge: 'Civic', desc: 'Clean civic block', tone: 'from-emerald-50 to-slate-50' },
    { value: 'building_industrial', label: 'Industrial Block', badge: 'Works', desc: 'Utility style massing', tone: 'from-slate-100 to-slate-50' },
    { value: 'building_minimal', label: 'Minimal Block', badge: 'Slim', desc: 'Compact low-rise block', tone: 'from-sky-50 to-slate-50' }
  ];

  const gateOptions = [
    { value: 'access_single', label: 'Single Entry / Exit', badge: 'Minimal', desc: 'Clean compact gate', tone: 'from-slate-50 to-slate-100' },
    { value: 'access_minimal', label: 'Minimal Gate', badge: 'Minimal', desc: 'Thin modern entry', tone: 'from-slate-50 to-slate-100' },
    { value: 'access_modern', label: 'Modern Gate', badge: 'Modern', desc: 'Refined contemporary gate', tone: 'from-indigo-50 to-slate-50' },
    { value: 'access_large', label: 'Large Gate', badge: 'Grand', desc: 'Wide statement gateway', tone: 'from-violet-50 to-slate-50' },
    { value: 'access_multi', label: 'Multiple Entry / Exit', badge: 'Multi', desc: 'Dual lane access gate', tone: 'from-emerald-50 to-slate-50' }
  ];

  const treeOptions = [
    { value: 'tree_single', label: 'Single Canopy Tree', badge: '1.6m', desc: 'A single top-down landscape tree.', tone: 'from-emerald-50 to-green-100 border-green-200' },
    { value: 'tree_cluster', label: 'Dense Tree Cluster', badge: '2.0m', desc: 'A dense cluster of multiple trees.', tone: 'from-green-50 to-emerald-100 border-emerald-250' },
    { value: 'tree_row', label: 'Avenue / Tree Row', badge: '2.2m', desc: 'A linear avenue or row of trees.', tone: 'from-teal-50 to-emerald-100 border-teal-200' }
  ];

  const handleZoneChange = (key, value) => {
    updateZone(selectedElementId, { [key]: value });
  };

  const handleZoneNestedChange = (key, value) => {
    updateZone(selectedElementId, {
      properties: {
        ...selectedZone.properties,
        [key]: value
      }
    });
  };

  const handleRoadChange = (key, value) => {
    updateRoad(selectedElementId, { [key]: value });
  };

  const handleAmenityChange = (key, value) => {
    updateAmenity(selectedElementId, { [key]: value });
  };

  const getZonePolygonArea = (zone) => {
    if (zone.points_m && zone.points_m.length > 2) {
      let area = 0;
      const n = zone.points_m.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += zone.points_m[i][0] * zone.points_m[j][1] - zone.points_m[j][0] * zone.points_m[i][1];
      }
      return Math.abs(area / 2);
    }
    return (zone.properties?.plot_size_sqm) || (zone.width_m * zone.height_m);
  };

  const getZonePerimeter = (zone) => {
    if (zone.points_m && zone.points_m.length > 1) {
      let perim = 0;
      const n = zone.points_m.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const dx = zone.points_m[j][0] - zone.points_m[i][0];
        const dy = zone.points_m[j][1] - zone.points_m[i][1];
        perim += Math.sqrt(dx * dx + dy * dy);
      }
      return perim;
    }
    return 2 * (zone.width_m + zone.height_m);
  };

  const getZoneSegmentLengths = (zone) => {
    if (!zone.points_m || zone.points_m.length < 2) return [];
    const n = zone.points_m.length;
    return Array.from({ length: n }, (_, i) => {
      const j = (i + 1) % n;
      const dx = zone.points_m[j][0] - zone.points_m[i][0];
      const dy = zone.points_m[j][1] - zone.points_m[i][1];
      return parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
    });
  };

  const getRoadLength = (road) => {
    if (!road.points_m || road.points_m.length < 2) return 0;
    let len = 0;
    for (let i = 0; i < road.points_m.length - 1; i++) {
      const dx = road.points_m[i+1][0] - road.points_m[i][0];
      const dy = road.points_m[i+1][1] - road.points_m[i][1];
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  };

  const StatBox = ({ label, value, unit = '', accent = false, sub }) => (
    <div className={`flex flex-col gap-0.5 p-2 rounded-lg border ${accent ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className="text-[8px] font-bold tracking-wider uppercase text-slate-400">{label}</span>
      <span className={`text-xs font-bold ${accent ? 'text-indigo-700' : 'text-slate-800'}`}>
        {value}<span className="text-[9px] font-semibold ml-0.5 text-slate-400">{unit}</span>
      </span>
      {sub && <span className="text-[8px] text-slate-400 leading-tight">{sub}</span>}
    </div>
  );

  const SectionHeader = ({ title }) => (
    <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 mt-3 mb-2">
      <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">{title}</span>
    </div>
  );

  const FieldRow = ({ label, children }) => (
    <div>
      <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">{label}</label>
      {children}
    </div>
  );

  const inputCls = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 text-[11px] font-semibold transition-all";
  const selectCls = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-400 text-[11px] font-semibold";

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm w-[280px] flex flex-col gap-4 text-xs h-full min-h-[500px]">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-[11px] font-bold border-b-2 transition-all ${
            activeTab === 'dashboard'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart3 size={13} />
          Design Dashboard
        </button>
        <button
          onClick={() => {
            if (selectedElementId) setActiveTab('properties');
          }}
          disabled={!selectedElementId}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-[11px] font-bold border-b-2 transition-all ${
            !selectedElementId
              ? 'text-slate-300 cursor-not-allowed border-transparent'
              : activeTab === 'properties'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Sliders size={13} />
          Properties
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Project Site Dimensions</span>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase font-sans">Length</span>
                  <span className="text-xs font-bold text-slate-700">{Math.round(meta.site_width_m || 500).toLocaleString()} m</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase font-sans">Width</span>
                  <span className="text-xs font-bold text-slate-700">{Math.round(meta.site_height_m || 300).toLocaleString()} m</span>
                </div>
                <div className="flex flex-col col-span-1">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase font-sans">Area</span>
                  <span className="text-xs font-bold text-indigo-600">{Math.round(meta.total_area_sqm || 150000).toLocaleString()} m²</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Land Use Targets</span>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold text-[10px]"
                >
                  <Settings size={10} />
                  Configure
                </button>
              </div>

              <div className="space-y-2.5">
                {Object.keys(landAllocationTargets).map(category => {
                  const target = landAllocationTargets[category];
                  const actual = stats.percentages[category] || 0;
                  const ratio = Math.min(100, (actual / target) * 100);
                  
                  let barColor = 'bg-indigo-600';
                  if (actual > target + 5) barColor = 'bg-rose-500';
                  else if (actual >= target - 5 && actual <= target + 5) barColor = 'bg-emerald-500';
                  
                  const labelMap = {
                    residential: 'Residential',
                    commercial: 'Commercial / Ind.',
                    green: 'Parks & Green',
                    roads: 'Roads / Paths',
                    amenities: 'Public Amenities'
                  };

                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                        <span>{labelMap[category]}</span>
                        <span>{actual}% <span className="text-slate-400">/ {target}%</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-150" />

            <div className="mb-4">
              <button
                onClick={() => setIsBoundaryModalOpen(true)}
                className="w-full p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">✨</span>
                <span className="font-bold text-sm">Auto-Generate Boundaries</span>
              </button>
            </div>

            <details open className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Roads Library
              </summary>
              <div className="p-3 space-y-3 bg-white/70">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Road Type Dropdown</label>
                <select
                  value={meta.activeRoadType || 'secondary'}
                  onChange={(e) => handleRoadPresetClick(e.target.value)}
                  className={selectCls}
                >
                  {roadOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'primary')}
                  onClick={() => handleRoadPresetClick('primary')}
                  className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 text-[10px]">Grand Boulevard (6m)</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">Primary</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded relative overflow-hidden flex items-center justify-center border border-slate-800">
                    <div className="absolute inset-x-0 h-0.5 border-t border-dashed border-white opacity-85" />
                    <span className="text-[8px] text-slate-300 font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity">Drag / Click</span>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'secondary')}
                  onClick={() => handleRoadPresetClick('secondary')}
                  className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 text-[10px]">Secondary Avenue (4m)</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">Secondary</span>
                  </div>
                  <div className="w-full h-5 bg-slate-600 rounded relative overflow-hidden flex items-center justify-center border border-slate-750">
                    <div className="absolute inset-x-0 h-0.5 border-t border-dashed border-slate-400 opacity-60" />
                    <span className="text-[8px] text-slate-300 font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity">Drag / Click</span>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'tertiary')}
                  onClick={() => handleRoadPresetClick('tertiary')}
                  className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 text-[10px]">Local Access Road (4m)</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">Local</span>
                  </div>
                  <div className="w-full h-4 bg-slate-550 rounded relative overflow-hidden flex items-center justify-center border border-slate-700">
                    <span className="text-[8px] text-slate-300 font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity">Drag / Click</span>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'pedestrian')}
                  onClick={() => handleRoadPresetClick('pedestrian')}
                  className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 text-[10px]">Pedestrian Pathway (2m)</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">Walkway</span>
                  </div>
                  <div className="w-full h-3 bg-stone-300 rounded relative overflow-hidden flex items-center justify-center border border-stone-400">
                    <span className="text-[8px] text-slate-600 font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity">Drag / Click</span>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'ring_primary')}
                  onClick={() => { setMeta({ activeRoadType: 'ring_primary' }); setActiveTool('RING'); }}
                  className="p-2 border border-violet-200 bg-violet-50/40 rounded-lg hover:border-violet-400 hover:bg-violet-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-violet-700 text-[10px]">Outer Ring Road (6m)</span>
                    <span className="text-[8px] bg-violet-100 text-violet-600 font-bold px-1 py-0.5 rounded uppercase">⭐ Ring</span>
                  </div>
                  <div className="w-full h-10 bg-slate-100 rounded relative flex items-center justify-center border border-violet-200 overflow-hidden">
                    <div className="w-8 h-8 rounded-full border-[5px] border-slate-700" />
                    <span className="absolute text-[8px] text-violet-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 px-1 rounded">Click to place</span>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'ring_secondary')}
                  onClick={() => { setMeta({ activeRoadType: 'ring_secondary' }); setActiveTool('RING'); }}
                  className="p-2 border border-indigo-200 bg-indigo-50/30 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-grab active:cursor-grabbing transition-all select-none group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-indigo-700 text-[10px]">Inner Ring Road (4m)</span>
                    <span className="text-[8px] bg-indigo-100 text-indigo-600 font-bold px-1 py-0.5 rounded uppercase">⭐ Ring</span>
                  </div>
                  <div className="w-full h-10 bg-slate-100 rounded relative flex items-center justify-center border border-indigo-200 overflow-hidden">
                    <div className="w-6 h-6 rounded-full border-[4px] border-slate-600" />
                    <span className="absolute text-[8px] text-indigo-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 px-1 rounded">Click to place</span>
                  </div>
                </div>
              </div>
            </div>
          </details>

            <details open className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Building Blocks
              </summary>
              <div className="p-3 space-y-3 bg-white/70">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Building Block Type</label>
                  <select
                    value={meta.activePlacementCategory === 'building' ? (meta.activePlacementVariant || '') : ''}
                    onChange={(e) => handlePlacementPresetClick('building', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select Building Block</option>
                    {buildingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  {buildingOptions.map((building) => (
                    <div
                      key={building.value}
                      draggable
                      onDragStart={(e) => handleDragStart(e, building.value)}
                      onClick={() => handlePlacementPresetClick('building', building.value)}
                      className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[10px]">{building.label}</span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">{building.badge}</span>
                      </div>
                      <div className={`w-full h-10 rounded border border-slate-200 bg-gradient-to-br ${building.tone} flex items-center justify-center overflow-hidden relative`}>
                        <div className="w-[72%] h-[72%] rounded-md border border-slate-300 bg-white/60 shadow-sm flex items-center justify-center">
                          <div className="grid grid-cols-3 gap-1 w-[68%]">
                            <span className="h-2 bg-slate-500/40 rounded-sm" />
                            <span className="h-2 bg-slate-500/60 rounded-sm" />
                            <span className="h-2 bg-slate-500/40 rounded-sm" />
                          </div>
                        </div>
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">{building.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

                <div className="space-y-3 pt-1">
                  <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Landscape & Access</span>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Trees & Foliage</label>
                    <select
                      value={meta.activePlacementCategory === 'tree' ? (meta.activePlacementVariant || '') : ''}
                      onChange={(e) => handlePlacementPresetClick('tree', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select Tree Type</option>
                      <option value="tree_single">Single Tree</option>
                      <option value="tree_cluster">Tree Cluster</option>
                      <option value="tree_row">Tree Row / Avenue</option>
                    </select>
                  </div>

                  {/* Paint Brush Mode Toggle */}
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-lg my-1.5 select-none">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-800">Continuous Placement</span>
                      <span className="text-[8px] text-emerald-600 font-medium">Click & drag on canvas to place consecutively</span>
                    </div>
                    <button
                      onClick={() => setMeta({ treeBrushActive: !meta.treeBrushActive })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        meta.treeBrushActive ? 'bg-emerald-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          meta.treeBrushActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Tree Type Cards */}
                  <div className="grid gap-2">
                    {treeOptions.map((tree) => (
                      <div
                        key={tree.value}
                        onClick={() => handlePlacementPresetClick('tree', tree.value)}
                        className={`p-2 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-pointer transition-all select-none group bg-white ${
                          meta.activePlacementCategory === 'tree' && meta.activePlacementVariant === tree.value
                            ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-700 text-[10px]">{tree.label}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">{tree.badge}</span>
                        </div>
                        <div className={`w-full h-8 rounded border ${tree.tone} flex items-center justify-center overflow-hidden relative`}>
                          {/* Tree icon dots - no text */}
                          <div className="flex gap-1 items-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                            {tree.value !== 'tree_single' && <span className="w-2 h-2 rounded-full bg-green-500/60" />}
                            {tree.value === 'tree_row' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />}
                            {tree.value === 'tree_row' && <span className="w-2 h-2 rounded-full bg-green-500/60" />}
                          </div>
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500">{tree.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Entry / Exit Dropdown</label>
                    <select
                      value={meta.activePlacementCategory === 'access' ? (meta.activePlacementVariant || '') : ''}
                      onChange={(e) => handlePlacementPresetClick('access', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select Gate Type</option>
                      {gateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    {gateOptions.map((gate) => (
                      <div
                        key={gate.value}
                        draggable
                        onDragStart={(e) => handleDragStart(e, gate.value)}
                        onClick={() => handlePlacementPresetClick('access', gate.value)}
                        className="p-2 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white border-slate-200"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-700 text-[10px]">{gate.label}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">{gate.badge}</span>
                        </div>
                        <div className={`w-full h-8 rounded border border-slate-200 bg-gradient-to-br ${gate.tone} flex items-center justify-center overflow-hidden relative`}>
                          <span className="text-[9px] font-bold text-slate-700">{gate.value === 'access_large' ? 'GRAND' : gate.value === 'access_modern' ? 'MODERN' : gate.value === 'access_minimal' ? 'MINIMAL' : gate.value === 'access_multi' ? 'MULTI' : 'ENTRY / EXIT'}</span>
                          <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 px-1 rounded">Drag / Click</span>
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500">{gate.desc}</div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Pick a feature, then click or drag onto the canvas to place it.
                  </p>
                </div>
              </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-2 pb-4">
            {selectedZone && (() => {
              const areaSqm     = getZonePolygonArea(selectedZone);
              const perimM      = getZonePerimeter(selectedZone);
              const segLengths  = getZoneSegmentLengths(selectedZone);
              const bboxW       = selectedZone.width_m  || 0;
              const bboxH       = selectedZone.height_m || 0;
              const floors      = selectedZone.floors   || 1;
              const fsi         = selectedZone.properties?.fsi || 1.5;
              const coverage    = selectedZone.properties?.ground_coverage_pct || 60;
              const builtUpArea = areaSqm * fsi;
              const groundFloor = areaSqm * (coverage / 100);
              const heightM     = floors * 3.0; 
              const volume      = groundFloor * heightM;

              const typeLabels = {
                residential: '🏠 Residential',  commercial: '🏢 Commercial',
                mixed_use: '🔀 Mixed Use',      industrial: '🏭 Industrial',
                green_belt: '🌿 Green Belt',    water_body: '💧 Water Body',
                park: '🌳 Park',                parking: '🅿️ Parking',
                amenity: '🏛️ Amenity',          institutional: '🏫 Institutional',
                open_space: '☀️ Open Space'
              };

              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-indigo-50 to-slate-50 rounded-xl border border-indigo-100">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-indigo-200" style={{ backgroundColor: selectedZone.color + '99' }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-700 truncate">{selectedZone.label || 'Unnamed Zone'}</p>
                      <p className="text-[9px] text-indigo-500 font-semibold">{typeLabels[selectedZone.type] || selectedZone.type}</p>
                    </div>
                  </div>

                  <SectionHeader title="🏷️ Identity" />
                  <FieldRow label="Zone Type">
                    <select
                      value={selectedZone.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        updateZone(selectedZone.id, {
                          type: newType,
                          color: ZONE_COLORS[newType] || '#7F8C8D',
                          floors: newType === 'residential' ? 4 : newType === 'commercial' ? 6 : newType === 'mixed_use' ? 5 : newType === 'industrial' ? 3 : ['park', 'green_belt', 'water_body', 'open_space', 'parking'].includes(newType) ? 1 : 2
                        });
                      }}
                      className={selectCls}
                    >
                      <option value="residential">🏠 Residential</option>
                      <option value="commercial">🏢 Commercial</option>
                      <option value="mixed_use">🔀 Mixed Use</option>
                      <option value="industrial">🏭 Industrial</option>
                      <option value="green_belt">🌿 Green Belt</option>
                      <option value="water_body">💧 Water Body</option>
                      <option value="park">🌳 Park</option>
                      <option value="parking">🅿️ Parking</option>
                      <option value="amenity">🏛️ Amenity</option>
                      <option value="institutional">🏫 Institutional</option>
                      <option value="open_space">☀️ Open Space</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="Label / Name">
                    <input type="text" value={selectedZone.label} onChange={(e) => handleZoneChange('label', e.target.value)} className={inputCls} />
                  </FieldRow>

                  <FieldRow label="Zone Color">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={selectedZone.color} onChange={(e) => handleZoneChange('color', e.target.value)} className="h-8 w-12 px-1 py-0.5 bg-white border border-slate-200 rounded cursor-pointer flex-shrink-0" />
                      <span className="text-[10px] text-slate-500 font-mono">{selectedZone.color}</span>
                    </div>
                  </FieldRow>

                  <SectionHeader title="📐 All Dimensions" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="Length (bbox)" value={bboxW.toFixed(1)} unit="m" />
                    <StatBox label="Breadth (bbox)" value={bboxH.toFixed(1)} unit="m" />
                    <StatBox label="Polygon Area" value={areaSqm >= 10000 ? (areaSqm/10000).toFixed(3)+' ha' : Math.round(areaSqm).toLocaleString()} unit={areaSqm >= 10000 ? '' : 'm²'} accent />
                    <StatBox label="Perimeter" value={perimM.toFixed(1)} unit="m" />
                    <StatBox label="Est. Height" value={(floors * 3).toFixed(0)} unit="m" sub={`${floors} floors × 3m`} />
                    <StatBox label="Diagonal" value={Math.sqrt(bboxW*bboxW + bboxH*bboxH).toFixed(1)} unit="m" />
                  </div>

                  {segLengths.length > 0 && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[8px] font-bold tracking-wider uppercase text-slate-400 block mb-1.5">Side Lengths</span>
                      <div className="flex flex-wrap gap-1">
                        {segLengths.map((len, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600">
                            S{i+1}: {len}m
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <SectionHeader title="🏗️ Building Specs" />
                  <FieldRow label="Number of Floors">
                    <input type="number" min="1" max="150" value={selectedZone.floors || 1} onChange={(e) => handleZoneChange('floors', parseInt(e.target.value) || 1)} className={inputCls} />
                  </FieldRow>

                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="Approx. Height" value={(floors * 3).toFixed(0)} unit="m" sub={`${floors} × 3m/floor`} />
                    <StatBox label="Volume (est.)" value={volume >= 1000 ? (volume/1000).toFixed(1)+'k' : Math.round(volume)} unit="m³" />
                    <StatBox label="Total Built-Up" value={builtUpArea >= 10000 ? (builtUpArea/10000).toFixed(2)+'ha' : Math.round(builtUpArea).toLocaleString()} unit={builtUpArea >= 10000 ? '' : 'm²'} accent />
                    <StatBox label="Gnd Floor Area" value={Math.round(groundFloor).toLocaleString()} unit="m²" />
                  </div>

                  <SectionHeader title="📋 Planning Norms" />
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="FSI / FAR">
                      <input type="number" step="0.1" min="0.1" max="15" value={selectedZone.properties?.fsi || 1.5} onChange={(e) => handleZoneNestedChange('fsi', parseFloat(e.target.value) || 1.5)} className={inputCls} />
                    </FieldRow>
                    <FieldRow label="Gnd Cover %">
                      <input type="number" min="10" max="100" value={selectedZone.properties?.ground_coverage_pct || 60} onChange={(e) => handleZoneNestedChange('ground_coverage_pct', parseInt(e.target.value) || 60)} className={inputCls} />
                    </FieldRow>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Front Setback (m)">
                      <input type="number" step="0.5" value={selectedZone.properties?.setback_front_m || 3.0} onChange={(e) => handleZoneNestedChange('setback_front_m', parseFloat(e.target.value) || 0)} className={inputCls} />
                    </FieldRow>
                    <FieldRow label="Side Setback (m)">
                      <input type="number" step="0.5" value={selectedZone.properties?.setback_side_m || 1.5} onChange={(e) => handleZoneNestedChange('setback_side_m', parseFloat(e.target.value) || 0)} className={inputCls} />
                    </FieldRow>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Rear Setback (m)">
                      <input type="number" step="0.5" value={selectedZone.properties?.setback_rear_m || 2.0} onChange={(e) => handleZoneNestedChange('setback_rear_m', parseFloat(e.target.value) || 0)} className={inputCls} />
                    </FieldRow>
                    <FieldRow label="Max Height (m)">
                      <input type="number" step="1" min="3" max="500" value={selectedZone.properties?.max_height_m || floors * 3} onChange={(e) => handleZoneNestedChange('max_height_m', parseFloat(e.target.value) || 12)} className={inputCls} />
                    </FieldRow>
                  </div>

                  <SectionHeader title="📊 Computed Metrics" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="Plot Size" value={areaSqm >= 10000 ? (areaSqm/10000).toFixed(3) : Math.round(areaSqm).toLocaleString()} unit={areaSqm >= 10000 ? 'ha' : 'm²'} />
                    <StatBox label="Net Buildable" value={Math.round(groundFloor).toLocaleString()} unit="m²" />
                    <StatBox label="Total BUA" value={Math.round(builtUpArea).toLocaleString()} unit="m²" accent />
                    <StatBox label="Eff. Coverage" value={coverage} unit="%" />
                  </div>

                  <SectionHeader title="📍 Position & Orientation" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="X offset" value={(selectedZone.x_m || 0).toFixed(1)} unit="m" />
                    <StatBox label="Y offset" value={(selectedZone.y_m || 0).toFixed(1)} unit="m" />
                  </div>
                  {selectedZone.rotation_deg !== undefined && selectedZone.rotation_deg !== 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatBox label="Rotation" value={Math.round(selectedZone.rotation_deg)} unit="°" />
                      <StatBox label="Vertices" value={selectedZone.points_px?.length || 4} />
                    </div>
                  )}

                  <Button onClick={() => deleteZone(selectedZone.id)} variant="danger" className="w-full mt-3 py-1.5 flex items-center justify-center gap-2">
                    <Trash2 size={12} />
                    <span>Delete Zone</span>
                  </Button>
                </div>
              );
            })()}

            {selectedRoad && (() => {
              const isRing = selectedRoad.type?.startsWith('ring');
              const roadLengthM = isRing
                ? parseFloat((2 * Math.PI * (selectedRoad.radius_m || 0)).toFixed(1))
                : parseFloat(getRoadLength(selectedRoad).toFixed(1));
              const roadAreaSqm = roadLengthM * (selectedRoad.width_m || 6);
              const diameterM  = isRing ? ((selectedRoad.radius_m || 0) * 2) : null;

              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 border-2 border-white/20" style={{ backgroundColor: selectedRoad.color + 'aa' }} />
                    <div>
                      <p className="text-[10px] font-bold text-white truncate">{selectedRoad.label || 'Road'}</p>
                      <p className="text-[9px] text-slate-300 font-semibold capitalize">{isRing ? '⭕ Ring Road' : '📏 Linear Road'} · {selectedRoad.type}</p>
                    </div>
                  </div>

                  <SectionHeader title="🏷️ Identity" />
                  <FieldRow label="Label">
                    <input type="text" value={selectedRoad.label} onChange={(e) => handleRoadChange('label', e.target.value)} className={inputCls} />
                  </FieldRow>

                  <FieldRow label="Road Class">
                    <select
                      value={selectedRoad.type}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        const scaleLocal = meta.scale_px_per_m || 2.4;
                        const widthMap = { primary: 6, secondary: 4, tertiary: 3, service: 2.5, pedestrian: 2, cycle_track: 2, ring_primary: 6, ring_secondary: 4 };
                        const widthM = widthMap[newClass] || 6;
                        updateRoad(selectedRoad.id, {
                          type: newClass,
                          width_m: widthM,
                          width_px: widthM * scaleLocal,
                          color: ROAD_COLORS[newClass] || '#7F8C8D',
                          has_median: newClass === 'primary' || newClass === 'ring_primary'
                        });
                      }}
                      className={selectCls}
                    >
                      <option value="primary">Primary (6m, Median)</option>
                      <option value="secondary">Secondary (4m)</option>
                      <option value="tertiary">Tertiary (3m)</option>
                      <option value="service">Service Lane (2.5m)</option>
                      <option value="pedestrian">Pedestrian Walkway (2m)</option>
                      <option value="cycle_track">Cycle Track (2m)</option>
                      <option value="ring_primary">⭐ Outer Ring Road (6m)</option>
                      <option value="ring_secondary">⭐ Inner Ring Road (4m)</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="Road Color">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={selectedRoad.color} onChange={(e) => handleRoadChange('color', e.target.value)} className="h-8 w-12 px-1 py-0.5 bg-white border border-slate-200 rounded cursor-pointer flex-shrink-0" />
                      <span className="text-[10px] text-slate-500 font-mono">{selectedRoad.color}</span>
                    </div>
                  </FieldRow>

                  <SectionHeader title="📐 All Dimensions" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="Road Width" value={(selectedRoad.width_m || 0).toFixed(1)} unit="m" />
                    <StatBox label={isRing ? 'Circumference' : 'Road Length'} value={roadLengthM.toLocaleString()} unit="m" accent />
                    {isRing && <>
                      <StatBox label="Radius" value={(selectedRoad.radius_m || 0).toFixed(1)} unit="m" />
                      <StatBox label="Diameter" value={(diameterM || 0).toFixed(1)} unit="m" />
                    </>}
                    <StatBox label="Road Area" value={Math.round(roadAreaSqm).toLocaleString()} unit="m²" />
                    {!isRing && <StatBox label="Waypoints" value={selectedRoad.points_m?.length || 0} />}
                  </div>

                  {!isRing && (
                    <FieldRow label="Road Curvature">
                      <input
                        type="range" min="0" max="1" step="0.1"
                        value={selectedRoad.tension || 0}
                        onChange={(e) => handleRoadChange('tension', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                        <span>Straight</span><span>{selectedRoad.tension || 0}</span><span>Curved</span>
                      </div>
                    </FieldRow>
                  )}

                  <div className="flex items-center gap-2 mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <input
                      type="checkbox" id="median_chk"
                      checked={!!selectedRoad.has_median}
                      onChange={(e) => handleRoadChange('has_median', e.target.checked)}
                      className="bg-white border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="median_chk" className="text-[10px] font-semibold text-slate-600">Has Central Median</label>
                  </div>

                  <Button onClick={() => deleteRoad(selectedRoad.id)} variant="danger" className="w-full mt-3 py-1.5 flex items-center justify-center gap-2">
                    <Trash2 size={12} />
                    <span>Delete Road</span>
                  </Button>
                </div>
              );
            })()}

            {selectedAmenity && (() => {
              const areaSqm  = selectedAmenity.points_m?.length > 2
                ? (() => { let a = 0; const n = selectedAmenity.points_m.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += selectedAmenity.points_m[i][0] * selectedAmenity.points_m[j][1] - selectedAmenity.points_m[j][0] * selectedAmenity.points_m[i][1]; } return Math.abs(a / 2); })()
                : selectedAmenity.width_m * selectedAmenity.height_m;
              const perimM = 2 * (selectedAmenity.width_m + selectedAmenity.height_m);

              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-emerald-50 to-slate-50 rounded-xl border border-emerald-100">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-emerald-200 bg-emerald-100 flex items-center justify-center text-base">
                      {selectedAmenity.type === 'tree' || selectedAmenity.type === 'park' ? '🌳' : selectedAmenity.type === 'water_body' ? '💧' : selectedAmenity.type === 'parking' ? '🅿️' : '🏛️'}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-700">{selectedAmenity.label || 'Amenity'}</p>
                      <p className="text-[9px] text-emerald-600 font-semibold capitalize">{selectedAmenity.type?.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {selectedAmenity.type === 'tree' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                      <span className="block text-[8px] font-bold text-emerald-800 uppercase tracking-wider">Drag & Drop Painter</span>
                      <p className="text-[9px] text-emerald-700">Activate, then click & drag on canvas to paint trees along a path. Release to stop.</p>
                      <button
                        onClick={() => {
                          const variant = selectedAmenity.tree_variant || 'tree_single';
                          setMeta({
                            activePlacementCategory: 'tree',
                            activePlacementVariant: variant,
                            treeBrushActive: true
                          });
                          setSelectedElementId(null);
                        }}
                        className={`w-full p-2 rounded-md font-bold text-[10px] transition-all select-none flex items-center justify-center gap-2 ${
                          meta.treeBrushActive && meta.activePlacementCategory === 'tree' && meta.activePlacementVariant === (selectedAmenity.tree_variant || 'tree_single')
                            ? 'bg-emerald-600 text-white border border-emerald-700 shadow-md'
                            : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <span>{meta.treeBrushActive && meta.activePlacementCategory === 'tree' ? '🎨 Painting Active' : '🌳 Activate Drag & Drop'}</span>
                        <span className="text-[8px] bg-emerald-100/50 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase">
                          {selectedAmenity.tree_variant?.replace('tree_', '') || 'single'}
                        </span>
                      </button>
                    </div>
                  )}

                  <SectionHeader title="🏷️ Identity" />
                  <FieldRow label="Amenity Type">
                    <select value={selectedAmenity.type} onChange={(e) => handleAmenityChange('type', e.target.value)} className={selectCls}>
                      <option value="park">🌳 Park</option>
                      <option value="green_belt">🌿 Green Belt</option>
                      <option value="water_body">💧 Water Body</option>
                      <option value="amenity">🏛️ General Amenity</option>
                      <option value="institutional">🏫 Institutional</option>
                      <option value="parking">🅿️ Parking Space</option>
                      <option value="open_space">☀️ Open Space</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="Label / Name">
                    <input type="text" value={selectedAmenity.label} onChange={(e) => handleAmenityChange('label', e.target.value)} className={inputCls} />
                  </FieldRow>

                  <SectionHeader title="📐 All Dimensions" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="Width (Breadth)" value={(selectedAmenity.width_m || 0).toFixed(1)} unit="m" />
                    <StatBox label="Height (Length)" value={(selectedAmenity.height_m || 0).toFixed(1)} unit="m" />
                    <StatBox label="Area" value={areaSqm >= 10000 ? (areaSqm/10000).toFixed(3) : Math.round(areaSqm).toLocaleString()} unit={areaSqm >= 10000 ? 'ha' : 'm²'} accent />
                    <StatBox label="Perimeter" value={perimM.toFixed(1)} unit="m" />
                    <StatBox label="Diagonal" value={Math.sqrt((selectedAmenity.width_m||0)**2+(selectedAmenity.height_m||0)**2).toFixed(1)} unit="m" />
                    <StatBox label="Vertices" value={selectedAmenity.points_px?.length || 4} />
                  </div>

                  <SectionHeader title="📍 Position" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatBox label="X offset" value={((selectedAmenity.x_px || 0) / (meta.scale_px_per_m || 2.4)).toFixed(1)} unit="m" />
                    <StatBox label="Y offset" value={((selectedAmenity.y_px || 0) / (meta.scale_px_per_m || 2.4)).toFixed(1)} unit="m" />
                  </div>

                  <Button onClick={() => deleteAmenity(selectedAmenity.id)} variant="danger" className="w-full mt-3 py-1.5 flex items-center justify-center gap-2">
                    <Trash2 size={12} />
                    <span>Delete Amenity</span>
                  </Button>
                </div>
              );
            })()}

            {selectedLabel && (
              <div className="space-y-2">
                <SectionHeader title="✏️ Text Label" />

                <FieldRow label="Label Text">
                  <input type="text" value={selectedLabel.text} onChange={(e) => updateLabel(selectedLabel.id, { text: e.target.value })} className={inputCls} />
                </FieldRow>

                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Font Size (px)">
                    <input type="number" min="8" max="72" value={selectedLabel.font_size} onChange={(e) => updateLabel(selectedLabel.id, { font_size: parseInt(e.target.value) || 12 })} className={inputCls} />
                  </FieldRow>
                  <FieldRow label="Text Color">
                    <input type="color" value={selectedLabel.color} onChange={(e) => updateLabel(selectedLabel.id, { color: e.target.value })} className="w-full h-9 px-1 py-0.5 bg-white border border-slate-200 rounded cursor-pointer" />
                  </FieldRow>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <StatBox label="X Position" value={(selectedLabel.x_px || 0).toFixed(0)} unit="px" />
                  <StatBox label="Y Position" value={(selectedLabel.y_px || 0).toFixed(0)} unit="px" />
                </div>

                <Button onClick={() => deleteLabel(selectedLabel.id)} variant="danger" className="w-full mt-3 py-1.5 flex items-center justify-center gap-2">
                  <Trash2 size={12} />
                  <span>Delete Label</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] border border-slate-100 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">Target Land Use Allocation</h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Configure target percentage of total land area ({stats.totalArea.toLocaleString()} m²) for planning limits.
              </p>
            </div>

            <div className="space-y-3">
              {Object.keys(tempTargets).map(key => {
                const labelMap = {
                  residential: 'Residential',
                  commercial: 'Commercial / Industrial',
                  green: 'Parks & Green Space',
                  roads: 'Roads / Paths',
                  amenities: 'Public Amenities'
                };
                return (
                  <div key={key} className="flex justify-between items-center gap-4">
                    <span className="text-xs font-semibold text-slate-750">{labelMap[key]} (%)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempTargets[key]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setTempTargets(prev => ({ ...prev, [key]: val }));
                        }}
                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs font-bold text-center"
                      />
                      <span className="text-[10px] text-slate-400 w-24 text-right">
                        {Math.round((tempTargets[key] / 100) * stats.totalArea).toLocaleString()} m²
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-2">
              <span className="text-xs font-bold">
                Total: <span className={tempTotal === 100 ? 'text-emerald-600' : 'text-rose-500'}>{tempTotal}%</span>
              </span>
              <div className="flex gap-2">
                <Button onClick={() => setIsModalOpen(false)} variant="secondary" className="py-1 px-3 text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (tempTotal !== 100) {
                      alert("Total percentage must equal exactly 100%!");
                      return;
                    }
                    setMeta({ land_allocation: tempTargets });
                    setIsModalOpen(false);
                  }}
                  variant="primary"
                  className="py-1 px-3 text-xs font-bold"
                >
                  Apply Targets ✨
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Boundary Generator Modal */}
      <BoundaryGeneratorModal 
        isOpen={isBoundaryModalOpen}
        onClose={() => setIsBoundaryModalOpen(false)}
        onGenerate={(options) => {
          if (options.road) {
            window.dispatchEvent(new CustomEvent('generateBoundaryRoad'));
          }
          if (options.trees) {
            window.dispatchEvent(new CustomEvent('generateBoundaryTrees'));
          }
          if (options.path) {
            window.dispatchEvent(new CustomEvent('generateBoundaryPath'));
          }
        }}
      />
    </div>
  );
}
