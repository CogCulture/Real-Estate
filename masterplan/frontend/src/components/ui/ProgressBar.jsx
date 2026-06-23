import React from 'react';

export default function ProgressBar({ value, max = 100, label = '', showPercentage = true }) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-sm font-semibold text-slate-300">
        <span>{label}</span>
        {showPercentage && <span>{percentage}%</span>}
      </div>
      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
        <div 
          className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
