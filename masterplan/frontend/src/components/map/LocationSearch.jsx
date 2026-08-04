import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Loader2, MapPin, Navigation } from 'lucide-react';

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete search with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2 || query === selectedName) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(
          `/api/projects/geosearch?q=${encodeURIComponent(query)}`
        );
        setResults(response.data || []);
        setShowDropdown(true);
        setActiveIdx(-1);
      } catch (err) {
        console.error('Location search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250); // 250ms debounce — snappy like Google Maps

    return () => clearTimeout(timer);
  }, [query, selectedName]);

  const handleSelect = useCallback((item) => {
    const name = item.display_name.split(',')[0];
    setSelectedName(item.display_name);
    setQuery(item.display_name);
    onLocationSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
    setResults([]);
    setShowDropdown(false);
    setActiveIdx(-1);
  }, [onLocationSelect]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = activeIdx >= 0 ? activeIdx : 0;
      if (results[idx]) handleSelect(results[idx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIdx(-1);
    }
  };

  // Split display name into primary name + secondary address
  const splitName = (displayName) => {
    const parts = displayName.split(',');
    const primary = parts[0]?.trim() || displayName;
    const secondary = parts.slice(1).join(',').trim();
    return { primary, secondary };
  };

  // Map type to a readable badge label
  const typeLabel = (type) => {
    const map = {
      house: 'Address', street: 'Street', city: 'City',
      town: 'Town', village: 'Village', suburb: 'Area',
      district: 'District', county: 'County', state: 'State',
      country: 'Country', residential: 'Residential',
      commercial: 'Commercial', yes: 'Place',
    };
    return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Place');
  };

  return (
    <div ref={dropdownRef} className="relative w-full max-w-md z-[1000]">
      <div className="relative flex gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedName('');
            }}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search any place, address, POI..."
            autoComplete="off"
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                       text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-all"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 pointer-events-none" size={14} />
          )}
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={() => { if (results.length > 0) handleSelect(results[0]); }}
          disabled={isLoading || results.length === 0}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-40
                     text-white text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap"
        >
          Go
        </button>
      </div>

      {/* Dropdown suggestions */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200
                        rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-[1001]">
          {results.map((item, idx) => {
            const { primary, secondary } = splitName(item.display_name);
            const isActive = idx === activeIdx;
            return (
              <button
                key={`${item.place_id}-${idx}`}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => handleSelect(item)}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors
                            border-b border-slate-50 last:border-b-0
                            ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                {/* Pin icon */}
                <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                                 ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                  <MapPin size={12} className={isActive ? 'text-indigo-600' : 'text-slate-500'} />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {primary}
                    </span>
                    {item.type && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider
                                       bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {typeLabel(item.type)}
                      </span>
                    )}
                  </div>
                  {secondary && (
                    <p className="text-xs text-slate-400 truncate mt-0.5 leading-tight">{secondary}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results feedback */}
      {showDropdown && !isLoading && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200
                        rounded-xl shadow-xl px-4 py-3 text-xs text-slate-400 z-[1001]">
          No results found for "<span className="font-semibold text-slate-600">{query}</span>". Try a more specific name.
        </div>
      )}
    </div>
  );
}
