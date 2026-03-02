import { type ReactNode } from 'react';
import { type RouteResponse } from '@/lib/routes-api';

interface RouteCardProps {
  route: RouteResponse;
  actions?: ReactNode;
}

const RATING_COLORS: Record<string, string> = {
  RELAXED: 'bg-green-700',
  SPIRITED: 'bg-blue-700',
  ENGAGING: 'bg-yellow-600',
  TECHNICAL: 'bg-orange-600',
  EXPERT: 'bg-red-600',
  LEGENDARY: 'bg-purple-600',
};

export default function RouteCard({ route, actions }: RouteCardProps) {
  const miles = route.total_length_mi.toFixed(1);
  const date = new Date(route.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="border border-border-subtle bg-bg-card flex flex-col">
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bebas text-[22px] tracking-[1px] leading-[0.95] text-text-primary">
            {route.route_name}
          </h3>
          {route.road_rating && (
            <span
              className={`flex-shrink-0 font-bebas text-[11px] tracking-[1px] px-2.5 py-1 text-white ${
                RATING_COLORS[route.road_rating] || 'bg-gray-600'
              }`}
            >
              {route.road_rating}
            </span>
          )}
        </div>

        {/* Description */}
        {route.description && (
          <p className="font-cormorant text-sm italic text-text-secondary leading-relaxed line-clamp-2">
            {route.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-5 mt-auto pt-2">
          <span className="font-bebas text-[13px] tracking-[1px] text-accent-gold">
            {miles} MI
          </span>
          <span className="font-bebas text-[13px] tracking-[1px] text-text-muted">
            {route.segment_count} {route.route_type === 'waypoint' ? 'waypoints' : 'segments'}
          </span>
          <span className="font-cormorant text-[13px] italic text-text-disabled ml-auto">
            {date}
          </span>
        </div>
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="px-5 pb-4 flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
