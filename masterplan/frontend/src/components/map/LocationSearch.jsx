import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Loader2, MapPin } from 'lucide-react';
import Button from '../ui/Button';

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete search with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 3 || query === selectedName) {
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
        setResults(response.data);
        setShowDropdown(true);
      } catch (err) {
        console.error("Nominatim search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query, selectedName]);

  const handleSelect = (item) => {
    setSelectedName(item.display_name);
    setQuery(item.display_name);
    onLocationSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
    setResults([]);
    setShowDropdown(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Manual search override if they click Search button / press Enter
    if (results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full max-w-md z-[1000]">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            placeholder="Search city, street, location..."
            className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-800 text-sm text-slate-800 placeholder-slate-400 shadow-sm"
          />
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          {isLoading && (
            <Loader2 className="absolute right-3 top-2.5 animate-spin text-slate-400" size={16} />
          )}
        </div>
        <Button type="submit" variant="dark" disabled={isLoading} className="px-4">
          Search
        </Button>
      </form>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-4 py-3 text-left text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-start gap-2.5"
            >
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="truncate leading-normal text-left">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
