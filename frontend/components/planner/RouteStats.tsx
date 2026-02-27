'use client';

import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';

export default function RouteStats() {
  const { calculatedRoute, getTotalDistance, getTotalDuration, getWaypointCount, getRoadRating } =
    useWaypointRouteStore();

  const totalDistance = getTotalDistance();
  const totalDuration = getTotalDuration();
  const waypointCount = getWaypointCount();
  const roadRating = getRoadRating();

  const hours = Math.floor(totalDuration / 60);
  const minutes = Math.round(totalDuration % 60);
  const durationStr = hours > 0 ? `${hours}H ${minutes}M` : `${minutes}M`;

  return (
    <div className="flex items-center justify-between bg-bg-muted px-5 py-4 border-t border-border-subtle cursor-pointer md:cursor-default">
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">
          {calculatedRoute ? totalDistance.toFixed(1) : '0.0'}
        </span>
        <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">TOTAL MI</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">
          {calculatedRoute ? durationStr : '0M'}
        </span>
        <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">EST. TIME</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">{waypointCount}</span>
        <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">STOPS</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">{roadRating}</span>
        <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">ROAD RATING</span>
      </div>
    </div>
  );
}
