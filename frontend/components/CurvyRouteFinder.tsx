'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCurvyRouteStore } from '@/store/useCurvyRouteStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { findCurvyRoute } from '@/lib/routing-api';
import type { CurvySegmentInfo } from '@/types/routing';

interface CurvyRouteFinderProps {
  onSwitchToWaypoints: () => void;
}

export default function CurvyRouteFinder({ onSwitchToWaypoints }: CurvyRouteFinderProps) {
  const {
    startPoint,
    endPoint,
    pickingMode,
    options,
    result,
    isCalculating,
    error,
    setPickingMode,
    setOptions,
    clearAll,
    setResult,
    setIsCalculating,
    setError,
  } = useCurvyRouteStore();

  const [showOptions, setShowOptions] = useState(false);

  const handleFindRoute = async () => {
    if (!startPoint || !endPoint) return;

    setIsCalculating(true);
    setError(null);
    try {
      const routeResult = await findCurvyRoute({
        start: startPoint,
        end: endPoint,
        options,
      });
      setResult(routeResult);
      toast.success(
        `Found route with ${routeResult.curvy_segments.length} curvy segments!`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to find curvy route';
      setError(message);
      toast.error(message);
    }
  };

  const handleConvertToWaypoints = () => {
    if (!result) return;

    const store = useWaypointRouteStore.getState();
    store.clearWaypoints();

    // Add start + generated waypoints + end as individual waypoints
    const allPoints = [
      { ...startPoint!, name: 'Start' },
      ...result.generated_waypoints.map((pt, i) => ({ ...pt, name: `Waypoint ${i + 1}` })),
      { ...endPoint!, name: 'End' },
    ];

    allPoints.forEach((pt) => {
      store.addWaypoint(pt.lng, pt.lat, pt.name);
    });

    toast.success('Waypoints loaded! Switching to waypoint mode.');
    onSwitchToWaypoints();
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-amber-800">Curvy Route Finder</h3>
        {isCalculating && (
          <span className="text-xs text-amber-600 animate-pulse">Calculating...</span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Start/End Point Pickers */}
      <div className="space-y-2 mb-3">
        <PointPicker
          label="Start"
          color="green"
          point={startPoint}
          isActive={pickingMode === 'start'}
          onPick={() => setPickingMode(pickingMode === 'start' ? null : 'start')}
          onClear={() => useCurvyRouteStore.setState({ startPoint: null })}
        />
        <PointPicker
          label="End"
          color="red"
          point={endPoint}
          isActive={pickingMode === 'end'}
          onPick={() => setPickingMode(pickingMode === 'end' ? null : 'end')}
          onClear={() => useCurvyRouteStore.setState({ endPoint: null })}
        />
      </div>

      {/* Options Panel (collapsible) */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="w-full text-left text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Options
      </button>

      {showOptions && (
        <div className="mb-3 p-3 bg-amber-50 rounded border border-amber-200 space-y-3">
          <SliderOption
            label="Corridor Width"
            value={options.corridor_width / 1000}
            min={1}
            max={50}
            step={1}
            unit="km"
            onChange={(v) => setOptions({ corridor_width: v * 1000 })}
          />
          <SliderOption
            label="Min Curvature"
            value={options.min_curvature}
            min={300}
            max={5000}
            step={100}
            onChange={(v) => setOptions({ min_curvature: v })}
          />
          <SliderOption
            label="Max Waypoints"
            value={options.max_waypoints}
            min={5}
            max={25}
            step={1}
            onChange={(v) => setOptions({ max_waypoints: v })}
          />
          <SliderOption
            label="Max Detour Ratio"
            value={options.max_detour_ratio}
            min={1.1}
            max={5.0}
            step={0.1}
            unit="x"
            onChange={(v) => setOptions({ max_detour_ratio: v })}
          />
        </div>
      )}

      {/* Find Route Button */}
      <button
        onClick={handleFindRoute}
        disabled={!startPoint || !endPoint || isCalculating}
        className="w-full px-3 py-2 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors mb-2"
      >
        {isCalculating ? 'Finding Curvy Route...' : 'Find Curvy Route'}
      </button>

      {/* Results */}
      {result && (
        <div className="mt-3 space-y-3">
          {/* Stats */}
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="bg-amber-50 px-2 py-1 rounded text-amber-700 font-medium">
              {(result.distance / 1609.34).toFixed(1)} mi
            </div>
            <div className="bg-amber-50 px-2 py-1 rounded text-amber-700 font-medium">
              {(result.duration / 60).toFixed(0)} min
            </div>
            <div className="bg-blue-50 px-2 py-1 rounded text-blue-700 font-medium">
              {result.detour_ratio.toFixed(1)}x detour
            </div>
            <div className="bg-purple-50 px-2 py-1 rounded text-purple-700 font-medium">
              Score: {result.total_curvature_score.toLocaleString()}
            </div>
          </div>

          {/* Baseline comparison */}
          <div className="text-xs text-gray-500">
            Baseline: {(result.baseline_distance / 1609.34).toFixed(1)} mi / {(result.baseline_duration / 60).toFixed(0)} min direct
          </div>

          {/* Curvy segments list */}
          {result.curvy_segments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Curvy Segments ({result.curvy_segments.length}):
              </p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {result.curvy_segments.map((seg: CurvySegmentInfo) => (
                  <div
                    key={seg.id}
                    className="flex items-center gap-2 p-1.5 bg-amber-50 rounded text-xs"
                  >
                    <div className="flex-1 min-w-0 truncate text-gray-700">
                      {seg.name || 'Unnamed Road'}
                    </div>
                    <span className="text-amber-600 font-medium flex-shrink-0">
                      {seg.curvature.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={handleConvertToWaypoints}
              className="w-full px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Convert to Waypoints
            </button>
            <button
              onClick={clearAll}
              className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!startPoint && !endPoint && !result && (
        <div className="text-center py-4 text-gray-400">
          <p className="text-sm">
            Click &quot;Set Start&quot; then click the map to set your start and end points
          </p>
        </div>
      )}
    </div>
  );
}

function PointPicker({
  label,
  color,
  point,
  isActive,
  onPick,
  onClear,
}: {
  label: string;
  color: 'green' | 'red';
  point: { lng: number; lat: number } | null;
  isActive: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const dotColor = color === 'green' ? 'bg-green-500' : 'bg-red-500';
  const activeRing = color === 'green' ? 'ring-green-400' : 'ring-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0`} />
      {point ? (
        <>
          <span className="text-xs text-gray-600 flex-1">
            {point.lng.toFixed(4)}, {point.lat.toFixed(4)}
          </span>
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500"
            title={`Clear ${label.toLowerCase()}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : (
        <button
          onClick={onPick}
          className={`flex-1 px-2 py-1.5 text-xs rounded border transition-all ${
            isActive
              ? `border-${color === 'green' ? 'green' : 'red'}-400 ring-2 ${activeRing} bg-${color === 'green' ? 'green' : 'red'}-50 text-${color === 'green' ? 'green' : 'red'}-700 font-medium`
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {isActive ? `Click map to set ${label.toLowerCase()}...` : `Set ${label}`}
        </button>
      )}
    </div>
  );
}

function SliderOption({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-amber-700">
          {step < 1 ? value.toFixed(1) : value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-amber-600"
      />
    </div>
  );
}
