'use client';

import { useRef, useState } from 'react';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import type { Waypoint } from '@/types/routing';
import { GripVertical, MousePointerClick, X } from 'lucide-react';

export default function WaypointList() {
  const { waypoints, removeWaypoint, reorderWaypoints, getWaypointCount } =
    useWaypointRouteStore();

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const waypointCount = getWaypointCount();

  if (waypointCount === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
          <MousePointerClick className="w-8 h-8 text-text-disabled" />
          <p className="font-cormorant text-sm italic text-text-disabled leading-relaxed">
            Click on road segments on the map to add waypoints and build your route
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {waypoints.map((wp: Waypoint, index: number) => (
        <div
          key={wp.id}
          draggable
          onDragStart={() => {
            dragIndexRef.current = index;
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverIndex(index);
          }}
          onDragLeave={() => {
            setDragOverIndex((prev) => (prev === index ? null : prev));
          }}
          onDrop={() => {
            const from = dragIndexRef.current;
            if (from !== null && from !== index) {
              reorderWaypoints(from, index);
            }
            dragIndexRef.current = null;
            setDragOverIndex(null);
          }}
          onDragEnd={() => {
            dragIndexRef.current = null;
            setDragOverIndex(null);
          }}
          className={`flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle group hover:bg-bg-muted/50 transition cursor-grab active:cursor-grabbing ${
            index === 0 ? 'bg-bg-muted' : ''
          } ${dragOverIndex === index ? 'border-t-2 border-t-accent-gold' : ''}`}
        >
          <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0" />
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bebas text-sm flex-shrink-0 ${
              index < 3
                ? 'bg-accent-gold text-bg-primary'
                : 'border-2 border-accent-gold text-accent-gold'
            }`}
          >
            {index + 1}
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="font-bebas text-[15px] tracking-[1px] text-text-primary truncate">
              {wp.segmentName?.toUpperCase() || 'WAYPOINT'}
            </span>
            <span className="font-cormorant text-[13px] italic text-text-secondary">
              {wp.lng.toFixed(4)}, {wp.lat.toFixed(4)}
            </span>
          </div>
          <button
            onClick={() => removeWaypoint(wp.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-disabled hover:text-accent-gold"
            title="Remove waypoint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
