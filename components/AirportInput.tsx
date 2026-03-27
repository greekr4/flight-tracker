"use client";

import { useState, useRef, useEffect } from "react";
import airportsData from "@/data/airports.json";

interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

const airports: Airport[] = airportsData;

interface AirportInputProps {
  label: string;
  placeholder: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
}

export default function AirportInput({
  label,
  placeholder,
  value,
  onChange,
}: AirportInputProps) {
  const [query, setQuery] = useState(value ? `${value.iata} - ${value.city}` : "");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync query when value is cleared externally
  useEffect(() => {
    if (!value) setQuery("");
    else setQuery(`${value.iata} - ${value.city}`);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (q.length === 0) {
      setResults([]);
      onChange(null);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = airports
      .filter(
        (a) =>
          a.iata.toLowerCase().includes(lower) ||
          a.city.toLowerCase().includes(lower) ||
          a.name.toLowerCase().includes(lower) ||
          a.country.toLowerCase().includes(lower)
      )
      .slice(0, 8);
    setResults(filtered);
    setOpen(filtered.length > 0);
  };

  const select = (airport: Airport) => {
    onChange(airport);
    // Clear input after selection so user can immediately add next stop
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => query.length > 0 && results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5
                   text-white text-sm placeholder-gray-500 outline-none
                   focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30
                   transition-colors"
      />
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700
                       rounded-lg overflow-hidden shadow-xl max-h-48 overflow-y-auto">
          {results.map((a) => (
            <li
              key={a.iata}
              onClick={() => select(a)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-800
                         transition-colors flex justify-between items-center"
            >
              <span>
                <span className="text-cyan-400 font-mono font-bold">{a.iata}</span>
                <span className="text-gray-300 ml-2">{a.city}</span>
              </span>
              <span className="text-gray-500 text-xs">{a.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
