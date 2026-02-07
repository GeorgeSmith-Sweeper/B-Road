'use client';

import { useState } from 'react';
import { useRouteStore, RouteSegmentData } from '@/store/useRouteStore';
import SaveRouteDialog from './SaveRouteDialog';
import SavedRoutesList from './SavedRoutesList';

export default function RouteBuilderPanel() {
  const {
    routeSegments,
    removeSegment,
    moveSegment,
    clearRoute,
    getTotalDistance,
    getTotalCurvature,
    getSegmentCount,
  } = useRouteStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);

  const totalDistance = getTotalDistance();
  const totalCurvature = getTotalCurvature();
  const segmentCount = getSegmentCount();

  const handleMoveUp = (index: number) => {
    if (index > 0) moveSegment(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < routeSegments.length - 1) moveSegment(index, index + 1);
  };

  const formatDistance = (meters: number): string => {
    const miles = meters / 1609.34;
    return miles < 0.1 ? `${Math.round(meters)}m` : `${miles.toFixed(1)} mi`;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Route Builder</h3>
        <button
          onClick={() => setShowSavedRoutes(!showSavedRoutes)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showSavedRoutes ? 'Build Route' : 'My Routes'}
        </button>
      </div>

      {showSavedRoutes ? (
        <SavedRoutesList onClose={() => setShowSavedRoutes(false)} />
      ) : (
        <>
          {/* Stats Bar */}
          {segmentCount > 0 && (
            <div className="flex gap-3 mb-3 text-xs">
              <div className="bg-purple-50 px-2 py-1 rounded text-purple-700 font-medium">
                {segmentCount} stop{segmentCount !== 1 ? 's' : ''}
              </div>
              <div className="bg-blue-50 px-2 py-1 rounded text-blue-700 font-medium">
                {totalDistance.toFixed(1)} mi
              </div>
              <div className="bg-orange-50 px-2 py-1 rounded text-orange-700 font-medium">
                {Math.round(totalCurvature).toLocaleString()} curv
              </div>
            </div>
          )}

          {/* Segment List */}
          {segmentCount === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm">Click road segments on the map to start building a route</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto mb-3">
              {routeSegments.map((segment: RouteSegmentData, index: number) => (
                <SegmentItem
                  key={`${segment.way_id}-${index}`}
                  segment={segment}
                  index={index}
                  total={routeSegments.length}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onRemove={() => removeSegment(index)}
                />
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {segmentCount > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex-1 bg-purple-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Save Route
              </button>
              <button
                onClick={clearRoute}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {showSaveDialog && (
        <SaveRouteDialog onClose={() => setShowSaveDialog(false)} />
      )}
    </div>
  );
}

function SegmentItem({
  segment,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  segment: RouteSegmentData;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const lengthMi = segment.length / 1609.34;

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 group">
      {/* Stop number */}
      <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
        {index + 1}
      </div>

      {/* Segment info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {segment.name || 'Unnamed Road'}
        </p>
        <p className="text-xs text-gray-500">
          {Math.round(segment.curvature).toLocaleString()} curv · {lengthMi.toFixed(1)} mi
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          title="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          title="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500"
          title="Remove"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
