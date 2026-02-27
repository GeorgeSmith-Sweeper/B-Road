'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useGeocoderStore } from '@/store/useGeocoderStore';
import { useGeocode } from '@/hooks/useGeocode';

export default function AddressSearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = useGeocoderStore((s) => s.query);
  const suggestions = useGeocoderStore((s) => s.suggestions);
  const isLoading = useGeocoderStore((s) => s.isLoading);
  const isOpen = useGeocoderStore((s) => s.isOpen);
  const selectedResult = useGeocoderStore((s) => s.selectedResult);
  const setQuery = useGeocoderStore((s) => s.setQuery);
  const selectResult = useGeocoderStore((s) => s.selectResult);
  const clearResult = useGeocoderStore((s) => s.clearResult);
  const setIsOpen = useGeocoderStore((s) => s.setIsOpen);

  const { search } = useGeocode();

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setActiveIndex(-1);
      search(value);
    },
    [setQuery, search]
  );

  const handleSelect = useCallback(
    (index: number) => {
      const result = suggestions[index];
      if (result) {
        selectResult(result);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    },
    [suggestions, selectResult]
  );

  const handleClear = useCallback(() => {
    clearResult();
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [clearResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) {
        if (e.key === 'Escape') {
          inputRef.current?.blur();
          setIsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0) {
            handleSelect(activeIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, suggestions.length, activeIndex, handleSelect, setIsOpen]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  return (
    <div
      ref={containerRef}
      className="absolute top-16 md:top-3 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-2rem)] sm:w-96"
    >
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && !selectedResult) {
              setIsOpen(true);
            }
          }}
          placeholder="Search for an address..."
          className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-lg bg-gray-900/90 text-white text-sm placeholder-gray-400 border border-gray-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 backdrop-blur-sm shadow-lg"
        />

        {/* Loading spinner or clear button */}
        {isLoading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-500 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : query ? (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && suggestions.length > 0 && (
        <ul className="mt-1 rounded-lg bg-gray-900/95 border border-gray-700 backdrop-blur-sm shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              onMouseDown={() => handleSelect(i)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-4 py-2.5 min-h-[44px] text-sm cursor-pointer ${
                i === activeIndex
                  ? 'bg-cyan-600/30 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-xs text-gray-500 truncate">{s.full_address}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
