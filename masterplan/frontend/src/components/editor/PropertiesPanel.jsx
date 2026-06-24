import React, { useState, useEffect, useMemo } from 'react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { Trash2, BarChart3, Sliders, Settings, Plus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
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
  const [dropdownsOpen, setDropdownsOpen] = useState(true);
  
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
    const dedicatedTabs = ['lawn_park', 'swimming_pool', 'trees_foliage', 'entry_exit', 'roads_library', 'buildings', 'decoration'];
    if (selectedElementId) {
      if (!dedicatedTabs.includes(activeTab)) {
        setActiveTab('properties');
      }
    } else {
      if (activeTab === 'properties') {
        setActiveTab('dashboard');
      }
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
    if (meta.activePlacementCategory === category && meta.activePlacementVariant === variant) {
      setMeta({
        activePlacementCategory: null,
        activePlacementVariant: null,
        activePlacementFootprint: null,
        treeBrushActive: false
      });
      setActiveTool('SELECT');
    } else {
      const defaultFootprint = category === 'building'
        ? (buildingOptions.find(b => b.value === variant)?.footprint || 'rectangular')
        : null;
      setMeta({
        activePlacementCategory: category,
        activePlacementVariant: variant,
        activePlacementFootprint: defaultFootprint
      });
      setActiveTool('SELECT');
      setSelectedElementId(null);
    }
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
    { value: 'building_residential', label: 'Residential Block', badge: 'Homes', desc: 'Soft warm facade', tone: 'from-blue-50 to-slate-50', footprint: 'cruciform', color: '#4A90D9' },
    { value: 'building_commercial', label: 'Commercial Block', badge: 'Office', desc: 'Glass tower massing', tone: 'from-amber-50 to-slate-50', footprint: 'h_shaped', color: '#F5A623' },
    { value: 'building_mixed_use', label: 'Mixed Use Block', badge: 'Mixed', desc: 'Podium with upper floors', tone: 'from-violet-50 to-slate-50', footprint: 'u_shaped', color: '#9B59B6' },
    { value: 'building_institutional', label: 'Institutional Block', badge: 'Civic', desc: 'Clean civic block', tone: 'from-emerald-50 to-slate-50', footprint: 'courtyard', color: '#F39C12' },
    { value: 'building_industrial', label: 'Industrial Block', badge: 'Works', desc: 'Utility style massing', tone: 'from-slate-100 to-slate-50', footprint: 'rectangular', color: '#95A5A6' },
    { value: 'building_minimal', label: 'Minimal Block', badge: 'Slim', desc: 'Compact low-rise block', tone: 'from-sky-50 to-slate-50', footprint: 'rectangular', color: '#E74C3C' },
    { value: 'building_clubhouse', label: 'Clubhouse', badge: 'Social', desc: 'Recreation & community center', tone: 'from-rose-50 to-slate-50', footprint: 'courtyard', color: '#E74C3C' },
    { value: 'building_school', label: 'School Block', badge: 'Education', desc: 'Learning & activity spaces', tone: 'from-indigo-50 to-slate-50', footprint: 'h_shaped', color: '#F39C12' },
    { value: 'building_hospital', label: 'Healthcare Block', badge: 'Medical', desc: 'Emergency & wellness center', tone: 'from-teal-50 to-slate-50', footprint: 'cruciform', color: '#F39C12' },
    { value: 'building_retail', label: 'Retail Block', badge: 'Shopping', desc: 'High street / shopping arcade', tone: 'from-amber-50 to-slate-50', footprint: 'u_shaped', color: '#F5A623' },
    { value: 'building_parking_structure', label: 'Parking Structure', badge: 'Parking', desc: 'Dedicated parking building', tone: 'from-slate-200 to-slate-50', footprint: 'rectangular', color: '#BDC3C7' },
    { value: 'building_hotel', label: 'Hotel & Resort', badge: 'Hospitality', desc: 'Luxury accommodation', tone: 'from-sky-50 to-slate-50', footprint: 'u_shaped', color: '#F5A623' },
    { value: 'building_sports_arena', label: 'Sports Arena', badge: 'Sports', desc: 'Stadium & indoor sports', tone: 'from-red-50 to-slate-50', footprint: 'oval', color: '#E74C3C' },
    { value: 'building_cultural', label: 'Cultural Center', badge: 'Arts', desc: 'Museum, gallery or theater', tone: 'from-purple-50 to-slate-50', footprint: 'circular', color: '#F39C12' },
    { value: 'building_civic', label: 'Civic Center', badge: 'Public', desc: 'Library, city hall or police', tone: 'from-blue-50 to-slate-50', footprint: 'l_shaped', color: '#F39C12' },
    { value: 'building_warehouse', label: 'Logistics Center', badge: 'Industrial', desc: 'Warehouse and fulfillment', tone: 'from-gray-100 to-slate-50', footprint: 'rectangular', color: '#95A5A6' },
    { value: 'building_transport_hub', label: 'Transit Hub', badge: 'Transport', desc: 'Station and transport links', tone: 'from-indigo-50 to-slate-50', footprint: 'rectangular', color: '#9B59B6' }
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
    <div className="flex flex-col gap-4 text-xs h-full">
      {!['lawn_park','swimming_pool','trees_foliage','entry_exit','roads_library','buildings','decoration'].includes(activeTab) && (
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
      )}

      <div className="flex-1 flex flex-col overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-5">

            <div className="space-y-2">
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

            <div className="mb-4 space-y-3">
              {meta.treeBrushActive && (
                <button
                  onClick={() => {
                    const event = new CustomEvent('place-painted-trees');
                    window.dispatchEvent(event);
                    setMeta({ treeBrushActive: false });
                  }}
                  className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg shadow border border-emerald-500 hover:shadow-md transition-all flex items-center justify-center gap-2 group"
                >
                  <span className="text-sm group-hover:scale-110 transition-transform">🌳</span>
                  <span className="font-bold text-xs uppercase tracking-wide">Place Painted Trees</span>
                </button>
              )}
              <button
                onClick={() => setIsBoundaryModalOpen(true)}
                className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg shadow border border-indigo-500 hover:shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <span className="text-sm group-hover:scale-110 transition-transform">✨</span>
                <span className="font-bold text-xs uppercase tracking-wide">Auto-Generate Boundaries</span>
              </button>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Numbered Legend Mode</span>
                  {meta.showNumberLegend && (
                    <button
                      title={meta.hideNumbersOnBlocks ? 'Show numbers on blocks' : 'Hide numbers on blocks'}
                      onClick={() => setMeta({ ...meta, hideNumbersOnBlocks: !meta.hideNumbersOnBlocks })}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {meta.hideNumbersOnBlocks ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setMeta({ ...meta, showNumberLegend: !meta.showNumberLegend })}
                  className={`w-9 h-5 rounded-full relative transition-colors ${meta.showNumberLegend ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${meta.showNumberLegend ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Placement Tools</span>

              <button
                onClick={() => setActiveTab('roads_library')}
                className="w-full py-2 px-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white rounded-lg border border-slate-600 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🛣️ Roads Library</span>
                <span className="text-[10px] text-slate-300 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('buildings')}
                className="w-full py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 rounded-lg border border-amber-200 hover:border-amber-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🏢 Building Blocks</span>
                <span className="text-[10px] text-amber-700 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('lawn_park')}
                className="w-full py-2 px-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 rounded-lg border border-emerald-200 hover:border-emerald-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🏞️ Lawn / Park Shapes</span>
                <span className="text-[10px] text-emerald-600 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('swimming_pool')}
                className="w-full py-2 px-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-blue-800 rounded-lg border border-blue-200 hover:border-blue-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🏊 Swimming Pool Shapes</span>
                <span className="text-[10px] text-blue-600 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('trees_foliage')}
                className="w-full py-2 px-3 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-green-800 rounded-lg border border-green-200 hover:border-green-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🌳 Trees & Foliage</span>
                <span className="text-[10px] text-green-600 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('entry_exit')}
                className="w-full py-2 px-3 bg-gradient-to-r from-slate-50 to-indigo-50 hover:from-slate-100 hover:to-indigo-100 text-slate-800 rounded-lg border border-slate-200 hover:border-slate-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">⛩️ Gates & Access</span>
                <span className="text-[10px] text-slate-600 font-bold">Configure ➔</span>
              </button>

              <button
                onClick={() => setActiveTab('decoration')}
                className="w-full py-2 px-3 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 text-amber-900 rounded-lg border border-amber-200 hover:border-amber-300 font-bold text-[11px] flex items-center justify-between shadow-sm transition-all"
              >
                <span className="flex items-center gap-1.5">🎪 Landscape Ornaments</span>
                <span className="text-[10px] text-amber-700 font-bold">Configure ➔</span>
              </button>
            </div>
          </div>
        )}


        {activeTab === 'roads_library' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Roads Library</span>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Road Types</span>
              <p className="text-[9px] text-slate-500 leading-relaxed">Click a road type to activate, then draw on the canvas. Drag to drop.</p>
              <div className="space-y-2">
                {[
                  { value: 'primary', label: 'Grand Boulevard', badge: 'Primary 6m', bg: 'bg-slate-700', preview: <><div className="absolute inset-x-0 h-0.5 border-t border-dashed border-white opacity-85" /></>, h: 'h-6' },
                  { value: 'secondary', label: 'Secondary Avenue', badge: 'Secondary 4m', bg: 'bg-slate-600', preview: <><div className="absolute inset-x-0 h-0.5 border-t border-dashed border-slate-400 opacity-60" /></>, h: 'h-5' },
                  { value: 'tertiary', label: 'Local Access Road', badge: 'Local 3m', bg: 'bg-slate-500', preview: null, h: 'h-4' },
                  { value: 'service', label: 'Service Lane', badge: 'Service 2.5m', bg: 'bg-slate-400', preview: null, h: 'h-3.5' },
                  { value: 'pedestrian', label: 'Pedestrian Pathway', badge: 'Walkway 2m', bg: 'bg-stone-300', preview: null, h: 'h-3' },
                  { value: 'cycle_track', label: 'Cycle Track', badge: 'Cycle 2m', bg: 'bg-emerald-300', preview: null, h: 'h-3' },
                  { value: 'ring_primary', label: 'Outer Ring Road', badge: '⭐ Ring 6m', bg: 'bg-slate-100', ringStyle: 'border-[5px] border-slate-700 w-8 h-8', isRing: true },
                  { value: 'ring_secondary', label: 'Inner Ring Road', badge: '⭐ Ring 4m', bg: 'bg-slate-100', ringStyle: 'border-[4px] border-slate-600 w-6 h-6', isRing: true }
                ].map((road) => (
                  <div
                    key={road.value}
                    draggable
                    onDragStart={(e) => handleDragStart(e, road.value)}
                    onClick={() => {
                      if (road.isRing) { setMeta({ activeRoadType: road.value }); setActiveTool('RING'); }
                      else handleRoadPresetClick(road.value);
                    }}
                    className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                      meta.activeRoadType === road.value ? 'border-indigo-500 ring-1 ring-indigo-400' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700 text-[9px]">{road.label}</span>
                      <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">{road.badge}</span>
                    </div>
                    <div className={`w-full ${road.isRing ? 'h-10' : road.h} ${road.bg} rounded relative overflow-hidden flex items-center justify-center border border-slate-300`}>
                      {road.isRing ? <div className={`rounded-full ${road.ringStyle}`} /> : road.preview}
                      <span className="absolute text-[8px] text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 px-1 rounded">Drag / Click</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'buildings' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Building Blocks</span>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Block Types</span>
              <p className="text-[9px] text-slate-500 leading-relaxed">Click or drag a block type onto the canvas to place it.</p>
              <div className="grid grid-cols-2 gap-2">
                {buildingOptions.map((building) => (
                  <div
                    key={building.value}
                    draggable
                    onDragStart={(e) => handleDragStart(e, building.value)}
                    onClick={() => handlePlacementPresetClick('building', building.value)}
                    className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                      meta.activePlacementCategory === 'building' && meta.activePlacementVariant === building.value
                        ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700 text-[9px] truncate">{building.label}</span>
                    </div>
                    <div className={`w-full h-10 rounded border border-slate-200 bg-gradient-to-br ${building.tone} flex items-center justify-center overflow-hidden relative`}>
                      <svg viewBox="0 0 100 100" className="w-7 h-7" style={{ fill: building.color || '#4f46e5', opacity: 0.75 }}>
                        {building.footprint === 'rectangular' && <rect x="15" y="25" width="70" height="50" rx="4" />}
                        {building.footprint === 'cruciform' && <polygon points="35,15 65,15 65,35 85,35 85,65 65,65 65,85 35,85 35,65 15,65 15,35 35,35" />}
                        {building.footprint === 'h_shaped' && <polygon points="15,15 35,15 35,40 65,40 65,15 85,15 85,85 65,85 65,60 35,60 35,85 15,85" />}
                        {building.footprint === 'u_shaped' && <polygon points="15,15 35,15 35,65 65,65 65,15 85,15 85,85 15,85" />}
                        {building.footprint === 'courtyard' && <path d="M15,15 L85,15 L85,85 L15,85 Z M35,35 L35,65 L65,65 L65,35 Z" fillRule="evenodd" />}
                        {building.footprint === 'circular' && <circle cx="50" cy="50" r="30" />}
                        {building.footprint === 'oval' && <ellipse cx="50" cy="50" rx="35" ry="25" />}
                        {building.footprint === 'l_shaped' && <polygon points="25,15 50,15 50,55 75,55 75,85 25,85" />}
                      </svg>
                      <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                    </div>
                  </div>
                ))}
              </div>
              {meta.activePlacementCategory === 'building' && (
                <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 text-[9px] tracking-wider uppercase">Choose Footprint Shape</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold uppercase animate-pulse">
                      {buildingOptions.find(b => b.value === meta.activePlacementVariant)?.label || 'Building'}
                    </span>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-relaxed">Select a footprint shape to place on the canvas:</p>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { value: 'rectangular', label: 'Rect' },
                      { value: 'cruciform', label: 'Cross' },
                      { value: 'h_shaped', label: 'H-Shp' },
                      { value: 'u_shaped', label: 'U-Shp' },
                      { value: 'courtyard', label: 'Court' }
                    ].map((shape) => {
                      const isActive = (meta.activePlacementFootprint || 'rectangular') === shape.value;
                      return (
                        <button
                          key={shape.value}
                          onClick={() => setMeta({ activePlacementFootprint: shape.value })}
                          className={`p-1 border rounded flex flex-col items-center justify-center transition-all ${
                            isActive
                              ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 ring-1 ring-indigo-400 font-bold'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:bg-slate-50'
                          }`}
                          title={shape.label}
                        >
                          <svg viewBox="0 0 100 100" className="w-4 h-4 mb-0.5" style={{ fill: 'currentColor' }}>
                            {shape.value === 'rectangular' && <rect x="15" y="25" width="70" height="50" rx="4" />}
                            {shape.value === 'cruciform' && <polygon points="35,15 65,15 65,35 85,35 85,65 65,65 65,85 35,85 35,65 15,65 15,35 35,35" />}
                            {shape.value === 'h_shaped' && <polygon points="15,15 35,15 35,40 65,40 65,15 85,15 85,85 65,85 65,60 35,60 35,85 15,85" />}
                            {shape.value === 'u_shaped' && <polygon points="15,15 35,15 35,65 65,65 65,15 85,15 85,85 15,85" />}
                            {shape.value === 'courtyard' && <path d="M15,15 L85,15 L85,85 L15,85 Z M35,35 L35,65 L65,65 L65,35 Z" fillRule="evenodd" />}
                          </svg>
                          <span className="text-[7px] font-medium leading-none truncate w-full text-center">{shape.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'lawn_park' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => {
                  setMeta({ activePlacementCategory: null, activePlacementVariant: null });
                  setActiveTab('dashboard');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Lawn & Parks</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Lawn Shapes</span>
                <p className="text-[9px] text-slate-500 leading-relaxed">Drag & drop, or click a shape and click on the canvas.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'rectangular', label: 'Rectangular Lawn' },
                    { value: 'l_shape', label: 'L-Shape Lawn' },
                    { value: 'oval', label: 'Oval Lawn' },
                    { value: 'circular', label: 'Circular Lawn' },
                    { value: 'triangular', label: 'Triangular Lawn' },
                    { value: 'organic', label: 'Organic Freeform' },
                    { value: 'fluid_organic', label: 'Fluid Organic Lawn' },
                    { value: 'serpentine_wave', label: 'Serpentine Wave' },
                    { value: 'crescent', label: 'Crescent Lawn' },
                    { value: 'bowtie_geometric', label: 'Hourglass Lawn' },
                    { value: 'rounded_parallelogram', label: 'Modern Angled Lawn' },
                    { value: 'pebble', label: 'Pebble Lawn' },
                    { value: 'kidney', label: 'Kidney Lawn' },
                    { value: 'teardrop', label: 'Teardrop Lawn' },
                    { value: 'courtyard_curved', label: 'Courtyard-Curved Lawn' }
                  ].map((shape) => (
                    <div
                      key={shape.value}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/react-flow', `lawn_${shape.value}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => handlePlacementPresetClick('lawn', shape.value)}
                      className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                        meta.activePlacementCategory === 'lawn' && meta.activePlacementVariant === shape.value
                          ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[9px] truncate">{shape.label}</span>
                      </div>
                      <div className="w-full h-10 rounded border bg-emerald-50/20 border-emerald-200 flex items-center justify-center overflow-hidden relative">
                        <svg viewBox="0 0 100 100" className="w-7 h-7" style={{ fill: '#10b981', opacity: 0.65 }}>
                          {shape.value === 'rectangular' && <rect x="15" y="25" width="70" height="50" />}
                          {shape.value === 'l_shape' && <polygon points="25,25 50,25 50,55 75,55 75,75 25,75" />}
                          {shape.value === 'oval' && <ellipse cx="50" cy="50" rx="42" ry="22" />}
                          {shape.value === 'circular' && <circle cx="50" cy="50" r="32" />}
                          {shape.value === 'triangular' && <polygon points="50,18 88,82 12,82" />}
                          {shape.value === 'organic' && <path d="M50,15 C75,18 85,30 80,52 C75,74 65,85 45,80 C25,75 18,60 22,42 C26,24 30,12 50,15 Z" />}
                          {shape.value === 'fluid_organic' && <path d="M50,15 C75,18 85,30 80,52 C75,74 65,85 45,80 C25,75 18,60 22,42 C26,24 30,12 50,15 Z" />}
                          {shape.value === 'serpentine_wave' && <path d="M20,30 C35,15 65,45 80,30 C90,20 90,55 75,70 C60,85 35,55 20,70 C10,80 5,45 20,30 Z" />}
                          {shape.value === 'crescent' && <path d="M30,20 C55,10 85,35 80,60 C75,85 45,90 35,80 C50,75 60,60 58,45 C56,30 40,25 30,20 Z" />}
                          {shape.value === 'bowtie_geometric' && <path d="M25,25 L75,25 C65,45 65,55 75,75 L25,75 C35,55 35,45 25,25 Z" />}
                          {shape.value === 'rounded_parallelogram' && <polygon points="35,20 85,20 65,80 15,80" />}
                          {shape.value === 'pebble' && <path d="M50,18 C70,14 85,30 82,50 C79,70 65,82 48,82 C30,82 18,65 22,48 C26,30 30,22 50,18 Z" />}
                          {shape.value === 'kidney' && <path d="M50,22 C72,22 82,38 78,52 C74,66 58,80 48,80 C30,80 22,68 25,50 C28,32 30,22 50,22 Z" />}
                          {shape.value === 'teardrop' && <path d="M50,18 C55,18 80,50 80,62 C80,78 68,82 50,82 C32,82 20,78 20,62 C20,50 45,18 50,18 Z" />}
                          {shape.value === 'courtyard_curved' && <path d="M30,20 C50,12 80,18 78,35 C76,52 50,55 52,68 C54,80 80,75 75,85 C70,95 25,90 28,70 C30,50 58,45 58,35 C58,25 25,26 30,20 Z" />}
                        </svg>
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'swimming_pool' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => {
                  setMeta({ activePlacementCategory: null, activePlacementVariant: null });
                  setActiveTab('dashboard');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Swimming Pools</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Pool Shapes</span>
                <p className="text-[9px] text-slate-500 leading-relaxed">Drag & drop, or click a shape and click on the canvas.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'rectangular', label: 'Rectangular Pool' },
                    { value: 'l_shape', label: 'L-Shape Pool' },
                    { value: 'oval', label: 'Oval Pool' },
                    { value: 'circular', label: 'Circular Pool' },
                    { value: 'triangular', label: 'Triangular Pool' },
                    { value: 'organic', label: 'Organic Pool' }
                  ].map((shape) => (
                    <div
                      key={shape.value}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/react-flow', `pool_${shape.value}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => handlePlacementPresetClick('pool', shape.value)}
                      className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                        meta.activePlacementCategory === 'pool' && meta.activePlacementVariant === shape.value
                          ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[9px] truncate">{shape.label}</span>
                      </div>
                      <div className="w-full h-10 rounded border bg-blue-50/20 border-blue-200 flex items-center justify-center overflow-hidden relative">
                        <svg viewBox="0 0 100 100" className="w-7 h-7" style={{ fill: '#3b82f6', opacity: 0.65 }}>
                          {shape.value === 'rectangular' && <rect x="15" y="25" width="70" height="50" />}
                          {shape.value === 'l_shape' && <polygon points="25,25 50,25 50,55 75,55 75,75 25,75" />}
                          {shape.value === 'oval' && <ellipse cx="50" cy="50" rx="42" ry="22" />}
                          {shape.value === 'circular' && <circle cx="50" cy="50" r="32" />}
                          {shape.value === 'triangular' && <polygon points="50,18 88,82 12,82" />}
                          {shape.value === 'organic' && <path d="M20,50 C20,25 45,15 70,30 C90,42 95,65 75,80 C55,92 45,75 35,70 C25,65 20,60 20,50 Z" />}
                        </svg>
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trees_foliage' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => {
                  setMeta({ activePlacementCategory: null, activePlacementVariant: null });
                  setActiveTab('dashboard');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Trees & Foliage</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Placement Mode</span>
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
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Tree Variants</span>
                <div className="grid grid-cols-2 gap-2">
                  {treeOptions.map((tree) => (
                    <div
                      key={tree.value}
                      onClick={() => handlePlacementPresetClick('tree', tree.value)}
                      className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-pointer transition-all select-none group bg-white ${
                        meta.activePlacementCategory === 'tree' && meta.activePlacementVariant === tree.value
                          ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[9px] truncate">{tree.label}</span>
                      </div>
                      <div className={`w-full h-10 rounded border border-emerald-200 bg-emerald-50/20 flex items-center justify-center overflow-hidden relative`}>
                        <div className="flex gap-1 items-center">
                          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                          {tree.value !== 'tree_single' && <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />}
                          {tree.value === 'tree_row' && <span className="w-3 h-3 rounded-full bg-emerald-500/80" />}
                          {tree.value === 'tree_row' && <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />}
                        </div>
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Click</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'entry_exit' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => {
                  setMeta({ activePlacementCategory: null, activePlacementVariant: null });
                  setActiveTab('dashboard');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Gates & Access</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Gate Variants</span>
                <div className="grid grid-cols-2 gap-2">
                  {gateOptions.map((gate) => (
                    <div
                      key={gate.value}
                      draggable
                      onDragStart={(e) => handleDragStart(e, gate.value)}
                      onClick={() => handlePlacementPresetClick('access', gate.value)}
                      className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                        meta.activePlacementCategory === 'access' && meta.activePlacementVariant === gate.value
                          ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[9px] truncate">{gate.label}</span>
                      </div>
                      <div className={`w-full h-10 rounded border border-slate-200 bg-gradient-to-br ${gate.tone} flex items-center justify-center overflow-hidden relative`}>
                        <span className="text-[9px] font-bold text-slate-700">
                          {gate.value === 'access_large' ? 'GRAND' : gate.value === 'access_modern' ? 'MODERN' : gate.value === 'access_minimal' ? 'MINIMAL' : gate.value === 'access_multi' ? 'MULTI' : 'ENTRY'}
                        </span>
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decoration' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <button
                onClick={() => {
                  setMeta({ activePlacementCategory: null, activePlacementVariant: null });
                  setActiveTab('dashboard');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 flex items-center gap-1 font-bold text-[11px]"
              >
                <ArrowLeft size={13} className="text-slate-600" />
                <span>Back</span>
              </button>
              <span className="font-bold text-slate-800 text-[11px] ml-auto uppercase tracking-wider">Landscape Ornaments</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[10px] tracking-wider uppercase">Decorations</span>
                <p className="text-[9px] text-slate-500 leading-relaxed">Drag & drop, or click a decoration preset and place on the canvas.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'roundabout', label: 'Grand Roundabout', tone: 'from-amber-50 to-orange-100 border-amber-200' },
                    { value: 'fountain_plaza', label: 'Fountain Plaza', tone: 'from-cyan-50 to-blue-100 border-cyan-200' }
                  ].map((preset) => (
                    <div
                      key={preset.value}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/react-flow', `decoration_${preset.value}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => handlePlacementPresetClick('decoration', preset.value)}
                      className={`p-1.5 border rounded-lg hover:border-indigo-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-all select-none group bg-white ${
                        meta.activePlacementCategory === 'decoration' && meta.activePlacementVariant === preset.value
                          ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-[9px] truncate">{preset.label}</span>
                      </div>
                      <div className={`w-full h-12 rounded border flex items-center justify-center overflow-hidden relative bg-gradient-to-br ${preset.tone}`}>
                        {preset.value === 'roundabout' ? (
                          <svg viewBox="0 0 100 100" className="w-8 h-8">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#cfc3a9" strokeWidth="6" />
                            <circle cx="50" cy="50" r="30" fill="none" stroke="#2e7d32" strokeWidth="8" />
                            <circle cx="50" cy="50" r="16" fill="#29b6f6" stroke="#0288d1" strokeWidth="3" />
                            <circle cx="50" cy="50" r="6" fill="#ffffff" opacity="0.8" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 100 100" className="w-8 h-8">
                            <rect x="15" y="15" width="70" height="70" fill="none" stroke="#b0bec5" strokeWidth="4" />
                            <circle cx="50" cy="50" r="22" fill="#29b6f6" stroke="#0288d1" strokeWidth="3" />
                            <circle cx="50" cy="50" r="8" fill="#ffffff" opacity="0.8" />
                            <rect x="22" y="22" width="10" height="10" fill="#e91e63" />
                            <rect x="68" y="22" width="10" height="10" fill="#ffeb3b" />
                            <rect x="22" y="68" width="10" height="10" fill="#ffeb3b" />
                            <rect x="68" y="68" width="10" height="10" fill="#e91e63" />
                          </svg>
                        )}
                        <span className="absolute text-[8px] text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Drag / Click</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

                  {['residential', 'commercial', 'mixed_use', 'industrial', 'institutional', 'amenity'].includes(selectedZone.type) && (
                    <>
                      <FieldRow label="Footprint Shape">
                        <div className="grid grid-cols-5 gap-1 mt-1">
                          {[
                            { value: 'rectangular', label: 'Rect' },
                            { value: 'cruciform', label: 'Cross' },
                            { value: 'h_shaped', label: 'H-Shp' },
                            { value: 'u_shaped', label: 'U-Shp' },
                            { value: 'courtyard', label: 'Court' }
                          ].map((shape) => {
                            const isActive = (selectedZone.footprint || 'rectangular') === shape.value;
                            return (
                              <button
                                key={shape.value}
                                onClick={() => handleZoneChange('footprint', shape.value)}
                                className={`p-1 border rounded flex flex-col items-center justify-center transition-all ${
                                  isActive
                                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 ring-1 ring-indigo-400 font-bold'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:bg-slate-50'
                                }`}
                                title={shape.label}
                              >
                                <svg viewBox="0 0 100 100" className="w-4 h-4 mb-0.5" style={{ fill: 'currentColor' }}>
                                  {shape.value === 'rectangular' && <rect x="15" y="25" width="70" height="50" rx="4" />}
                                  {shape.value === 'cruciform' && <polygon points="35,15 65,15 65,35 85,35 85,65 65,65 65,85 35,85 35,65 15,65 15,35 35,35" />}
                                  {shape.value === 'h_shaped' && <polygon points="15,15 35,15 35,40 65,40 65,15 85,15 85,85 65,85 65,60 35,60 35,85 15,85" />}
                                  {shape.value === 'u_shaped' && <polygon points="15,15 35,15 35,65 65,65 65,15 85,15 85,85 15,85" />}
                                  {shape.value === 'courtyard' && <path d="M15,15 L85,15 L85,85 L15,85 Z M35,35 L35,65 L65,65 L65,35 Z" fillRule="evenodd" />}
                                </svg>
                                <span className="text-[7px] font-medium leading-none truncate w-full text-center">{shape.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </FieldRow>

                      <FieldRow label="Building Variant">
                        <select
                          value={selectedZone.building_variant || 'modern'}
                          onChange={(e) => handleZoneChange('building_variant', e.target.value)}
                          className={selectCls}
                        >
                          <option value="warm">Warm Facade</option>
                          <option value="glass">Glass Tower</option>
                          <option value="modern">Modern Podium</option>
                          <option value="minimal">Minimal</option>
                        </select>
                      </FieldRow>

                      <div className="grid grid-cols-2 gap-2">
                        <FieldRow label="Width (m)">
                          <input
                            type="number"
                            min="2"
                            max="500"
                            value={selectedZone.width_m || 10}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 10;
                              const scaleLocal = meta.scale_px_per_m || 2.4;
                              const wPx = selectedZone.width_px || (selectedZone.width_m * scaleLocal);
                              const cx = selectedZone.x_px + wPx / 2;
                              const newWPx = val * scaleLocal;
                              const newXPx = cx - newWPx / 2;
                              updateZone(selectedZone.id, {
                                width_m: val,
                                width_px: newWPx,
                                x_px: newXPx,
                                x_m: newXPx / scaleLocal,
                                points_px: null,
                                points_m: null
                              });
                            }}
                            className={inputCls}
                          />
                        </FieldRow>
                        <FieldRow label="Height (m)">
                          <input
                            type="number"
                            min="2"
                            max="500"
                            value={selectedZone.height_m || 10}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 10;
                              const scaleLocal = meta.scale_px_per_m || 2.4;
                              const hPx = selectedZone.height_px || (selectedZone.height_m * scaleLocal);
                              const cy = selectedZone.y_px + hPx / 2;
                              const newHPx = val * scaleLocal;
                              const newYPx = cy - newHPx / 2;
                              updateZone(selectedZone.id, {
                                height_m: val,
                                height_px: newHPx,
                                y_px: newYPx,
                                y_m: newYPx / scaleLocal,
                                points_px: null,
                                points_m: null
                              });
                            }}
                            className={inputCls}
                          />
                        </FieldRow>
                      </div>

                      <FieldRow label="Rotation (deg)">
                        <div className="flex gap-2 items-center w-full">
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={selectedZone.rotation_deg || 0}
                            onChange={(e) => handleZoneChange('rotation_deg', parseInt(e.target.value) || 0)}
                            className="w-full accent-indigo-600"
                          />
                          <input
                            type="number"
                            min="0"
                            max="360"
                            value={selectedZone.rotation_deg || 0}
                            onChange={(e) => handleZoneChange('rotation_deg', parseInt(e.target.value) || 0)}
                            className="w-12 text-center p-1 bg-white border border-slate-200 rounded text-[10px]"
                          />
                        </div>
                      </FieldRow>
                    </>
                  )}

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

                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => deleteZone(selectedZone.id)} variant="danger" className="w-full py-1.5 flex items-center justify-center gap-2">
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </Button>
                    <Button onClick={() => {
                      zones.filter(z => z.type === selectedZone.type).forEach(z => deleteZone(z.id));
                      setSelectedElementId(null);
                    }} variant="secondary" className="w-full py-1.5 flex items-center justify-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Trash2 size={12} />
                      <span className="truncate">Delete All</span>
                    </Button>
                  </div>
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


                  <div className="flex items-center gap-2 mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <input
                      type="checkbox" id="median_chk"
                      checked={!!selectedRoad.has_median}
                      onChange={(e) => handleRoadChange('has_median', e.target.checked)}
                      className="bg-white border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="median_chk" className="text-[10px] font-semibold text-slate-600">Has Central Median</label>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => deleteRoad(selectedRoad.id)} variant="danger" className="w-full py-1.5 flex items-center justify-center gap-2">
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </Button>
                    <Button onClick={() => {
                      roads.filter(r => r.type === selectedRoad.type).forEach(r => deleteRoad(r.id));
                      setSelectedElementId(null);
                    }} variant="secondary" className="w-full py-1.5 flex items-center justify-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Trash2 size={12} />
                      <span className="truncate">Delete All</span>
                    </Button>
                  </div>
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

                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => deleteAmenity(selectedAmenity.id)} variant="danger" className="w-full py-1.5 flex items-center justify-center gap-2">
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </Button>
                    <Button onClick={() => {
                      amenities.filter(a => a.type === selectedAmenity.type && a.tree_variant === selectedAmenity.tree_variant && a.access_variant === selectedAmenity.access_variant && a.building_variant === selectedAmenity.building_variant).forEach(a => deleteAmenity(a.id));
                      setSelectedElementId(null);
                    }} variant="secondary" className="w-full py-1.5 flex items-center justify-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Trash2 size={12} />
                      <span className="truncate">Delete All</span>
                    </Button>
                  </div>
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
        onGenerate={(layers) => {
          window.dispatchEvent(new CustomEvent('reserveBoundaryLayers', { detail: { layers } }));
        }}
      />
    </div>
  );
}
