'use client';

import { useAppStore } from '@/store/useAppStore';
import { Search } from 'lucide-react';

interface SidebarFiltersProps {
  sourcesLoading: boolean;
}

export default function SidebarFilters({ sourcesLoading }: SidebarFiltersProps) {
  const { curvatureSources, selectedSource, setSelectedSource, searchFilters, setSearchFilters } =
    useAppStore();

  const stops = [
    { value: 0, label: 'ALL' },
    { value: 300, label: 'RELAXED' },
    { value: 600, label: 'SPIRITED' },
    { value: 1000, label: 'ENGAGING' },
    { value: 2000, label: 'TECHNICAL' },
    { value: 5000, label: 'EXPERT' },
    { value: 10000, label: 'LEGENDARY' },
  ];
  const currentIndex = stops.findIndex((s) => s.value === searchFilters.min_curvature);
  const idx = currentIndex >= 0 ? currentIndex : 0;

  return (
    <>
      {/* Source filter as search-like bar */}
      <div className="flex items-center gap-2 h-9 rounded bg-bg-muted border border-border-subtle px-3">
        <Search className="w-3.5 h-3.5 text-text-disabled flex-shrink-0" />
        <select
          value={selectedSource || ''}
          onChange={(e) => setSelectedSource(e.target.value || null)}
          disabled={sourcesLoading}
          className="flex-1 bg-transparent text-sm font-cormorant italic text-text-disabled focus:text-text-secondary focus:outline-none appearance-none cursor-pointer"
        >
          <option value="">
            {sourcesLoading ? 'Loading states...' : 'Filter by state...'}
          </option>
          {curvatureSources.map((source) => (
            <option key={source.id} value={source.name} className="bg-bg-card text-text-primary">
              {source.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({source.segment_count.toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {/* Road Rating slider */}
      <div className="flex items-center gap-3">
        <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled whitespace-nowrap">MIN RATING</span>
        <input
          type="range"
          min="0"
          max={stops.length - 1}
          step="1"
          value={idx}
          onChange={(e) => setSearchFilters({ min_curvature: stops[parseInt(e.target.value)].value })}
          className="flex-1 accent-[#C9A962] h-1"
        />
        <span className="font-bebas text-sm tracking-[1px] text-accent-gold text-right whitespace-nowrap">
          {stops[idx].label}
        </span>
      </div>
    </>
  );
}
