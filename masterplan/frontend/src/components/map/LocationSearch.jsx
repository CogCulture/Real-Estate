import React, { useState } from 'react';
import axios from 'axios';
import { Search, Loader2 } from 'lucide-react';
import Button from '../ui/Button';

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        {
          headers: { 'User-Agent': 'MasterPlanTool/1.0' }
        }
      );
      setResults(response.data);
      setShowDropdown(true);
    } catch (err) {
      console.error("Nominatim search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md z-[1000]">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, district, address..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm text-slate-800 placeholder-slate-400 shadow-sm"
          />
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>
        <Button type="submit" disabled={isLoading} className="px-3">
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Search"}
        </Button>
      </form>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.place_id}
              onClick={() => {
                onLocationSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
                setShowDropdown(false);
                setQuery(item.display_name);
              }}
              className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors truncate block"
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
