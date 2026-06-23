import React, { useState } from 'react';
import Button from '../ui/Button';

export default function ManualInput({ onSubmit }) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(300);
  const [unit, setUnit] = useState('m'); // m, ft, acres

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    let wM = parseFloat(width);
    let hM = parseFloat(height);
    let areaSqm = wM * hM;

    if (unit === 'ft') {
      wM = wM / 3.28084;
      hM = hM / 3.28084;
      areaSqm = wM * hM;
    } else if (unit === 'acres') {
      // In case of acres, width is assumed as square root of total acres
      const totalSqm = wM * 4046.86;
      wM = Math.sqrt(totalSqm * 1.5); // 1.5 aspect ratio
      hM = totalSqm / wM;
      areaSqm = totalSqm;
    }

    onSubmit({
      name,
      width: parseFloat(wM.toFixed(2)),
      height: parseFloat(hM.toFixed(2)),
      area: parseFloat(areaSqm.toFixed(2)),
      location_name: "Manual Input Site",
      boundary_geojson: null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Site Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="E.g., Sector 45 Layout"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm text-slate-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {unit === 'acres' ? 'Total Acres' : `Width (${unit})`}
          </label>
          <input
            type="number"
            min="10"
            required
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm text-slate-800"
          />
        </div>
        
        {unit !== 'acres' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Height ({unit})</label>
            <input
              type="number"
              min="10"
              required
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm text-slate-800"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Dimension Unit</label>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm text-slate-700"
        >
          <option value="m">Meters (m)</option>
          <option value="ft">Feet (ft)</option>
          <option value="acres">Acres</option>
        </select>
      </div>

      <Button type="submit" variant="primary" className="w-full">
        Create Site Plan
      </Button>
    </form>
  );
}
