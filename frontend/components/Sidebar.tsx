'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';

interface SidebarProps {
  onSearchRoads: () => void;
}

export default function Sidebar({ onSearchRoads }: SidebarProps) {
  const { searchFilters, setSearchFilters, dataLoaded, setDataLoaded } = useAppStore();

  const [filepath, setFilepath] = useState('/Users/georgesmith-sweeper/Documents/Programming/B-Road/monaco.msgpack');
  const [loadStatus, setLoadStatus] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  const handleLoadData = async () => {
    setLoadStatus('loading');
    try {
      const result = await apiClient.loadData(filepath);
      setLoadStatus(`success: ${result.message}`);
      setDataLoaded(true);
    } catch (error) {
      setLoadStatus(`error: ${error instanceof Error ? error.message : 'Failed to load data'}`);
      setDataLoaded(false);
    }
  };

  const handleSearch = async () => {
    setSearchStatus('loading');
    try {
      await onSearchRoads();
      setSearchStatus('success');
    } catch (error) {
      setSearchStatus(`error: ${error instanceof Error ? error.message : 'Search failed'}`);
    }
  };

  const getStatusClass = (status: string) => {
    if (status.startsWith('success')) return 'bg-green-100 text-green-800 border-green-300';
    if (status.startsWith('error')) return 'bg-red-100 text-red-800 border-red-300';
    if (status === 'loading') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'hidden';
  };

  return (
    <div className="w-[320px] bg-gray-50 p-4 overflow-y-auto border-r border-gray-300 shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">B-Road</h1>
      <p className="text-sm text-gray-600 mb-4">Find the most twisty roads</p>

      {/* Load Data Section */}
      <div className="bg-white p-3 rounded-lg shadow-sm mb-4">
        <h3 className="text-sm font-semibold mb-2">1. Load Data</h3>
        <input
          type="text"
          value={filepath}
          onChange={(e) => setFilepath(e.target.value)}
          placeholder="/path/to/data.msgpack"
          className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
        />
        <button
          onClick={handleLoadData}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded font-semibold hover:bg-blue-700 transition-colors text-sm"
        >
          Load Data
        </button>
        {loadStatus && (
          <div className={`mt-2 p-2 rounded text-xs border ${getStatusClass(loadStatus)}`}>
            {loadStatus.replace('success: ', '').replace('error: ', '')}
          </div>
        )}
      </div>

      {/* Filter Section */}
      <div className="bg-white p-3 rounded-lg shadow-sm mb-4">
        <h3 className="text-sm font-semibold mb-2">2. Filter Roads</h3>

        <label className="block mt-2 mb-1 text-xs font-semibold text-gray-700">
          Minimum Curvature:
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            value={searchFilters.min_curvature}
            onChange={(e) => setSearchFilters({ min_curvature: parseInt(e.target.value) })}
            className="flex-1"
          />
          <span className="w-12 text-right font-semibold text-blue-600 text-sm">
            {searchFilters.min_curvature}
          </span>
        </div>

        <label className="block mt-3 mb-1 text-xs font-semibold text-gray-700">
          Surface Type:
        </label>
        <select
          value={searchFilters.surface}
          onChange={(e) => setSearchFilters({ surface: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        >
          <option value="">All Surfaces</option>
          <option value="paved">Paved Only</option>
          <option value="unpaved">Unpaved Only</option>
        </select>

        <label className="block mt-3 mb-1 text-xs font-semibold text-gray-700">
          Max Results:
        </label>
        <select
          value={searchFilters.limit}
          onChange={(e) => setSearchFilters({ limit: parseInt(e.target.value) })}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        >
          <option value="25">25 roads</option>
          <option value="50">50 roads</option>
          <option value="100">100 roads</option>
          <option value="200">200 roads</option>
        </select>

        <button
          onClick={handleSearch}
          disabled={!dataLoaded}
          className={`w-full mt-3 py-2 px-4 rounded font-semibold transition-colors text-sm ${
            dataLoaded
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Search Roads
        </button>
        {searchStatus && (
          <div className={`mt-2 p-2 rounded text-xs border ${getStatusClass(searchStatus)}`}>
            {searchStatus === 'loading'
              ? 'Searching...'
              : searchStatus === 'success'
              ? 'Search complete'
              : searchStatus}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white p-3 rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold mb-2">Curvature Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-yellow-400"></span>
            <span>300-600: Pleasant curves</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-orange-500"></span>
            <span>600-1000: Moderately twisty</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-red-500"></span>
            <span>1000-2000: Very curvy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-purple-600"></span>
            <span>2000+: Extremely twisty</span>
          </div>
        </div>
      </div>
    </div>
  );
}
