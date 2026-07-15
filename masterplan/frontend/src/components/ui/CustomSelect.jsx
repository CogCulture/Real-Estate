import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-400 text-[11px] font-semibold text-left shadow-sm hover:bg-slate-50 transition-colors ${className}`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={12} className="text-slate-400 flex-shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-[110] max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-all hover:bg-slate-50 ${
                option.value === value
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-650'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
