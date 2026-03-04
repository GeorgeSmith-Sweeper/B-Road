'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Route, ArrowLeft, Trash2, Navigation } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import AuthButton from '@/components/AuthButton';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { useClaimRoutes } from '@/hooks/useClaimRoutes';
import { listRoutes, deleteRoute, type RouteResponse } from '@/lib/routes-api';
import RouteCard from '@/components/RouteCard';

export default function MyRoutesPage() {
  const sessionId = useWaypointRouteStore((s) => s.sessionId);
  const { getToken } = useAuth();
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Auto-claim anonymous routes on sign-in
  useClaimRoutes();

  const fetchRoutes = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      const data = await listRoutes(sessionId || undefined, token || undefined);
      setRoutes(data.routes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, [sessionId, getToken]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleDelete = async (routeId: number) => {
    setDeletingId(routeId);
    try {
      const token = await getToken();
      await deleteRoute(routeId, sessionId || undefined, token || undefined);
      setRoutes((prev) => prev.filter((r) => r.route_id !== routeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete route');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-cormorant">
      {/* Header */}
      <header className="bg-[#0D0D0DCC] backdrop-blur-sm border-b border-border-subtle">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-6 md:px-12 lg:px-[120px] py-5">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Route className="w-6 h-6 text-accent-gold" />
              <span className="font-bebas text-[22px] tracking-[3px] text-text-primary">MY ROUTES</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AuthButton />
            <Link
              href="/planner"
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-6 py-2.5 hover:brightness-110 transition"
            >
              NEW ROUTE
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-10 lg:py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="font-bebas text-lg tracking-[2px] text-text-secondary animate-pulse">
              LOADING ROUTES...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="font-cormorant text-lg italic text-red-400">{error}</p>
            <button
              onClick={fetchRoutes}
              className="font-bebas text-sm tracking-[2px] border border-accent-gold text-accent-gold px-6 py-2.5 hover:bg-accent-gold hover:text-bg-primary transition"
            >
              RETRY
            </button>
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-20">
            <Navigation className="w-12 h-12 text-text-disabled" />
            <h2 className="font-bebas text-2xl tracking-[2px] text-text-secondary">NO ROUTES YET</h2>
            <p className="font-cormorant text-lg italic text-text-secondary text-center max-w-md">
              Plan your first driving route and it will appear here.
            </p>
            <Link
              href="/planner"
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-8 py-3 hover:brightness-110 transition"
            >
              START PLANNING
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routes.map((route) => (
              <RouteCard
                key={route.route_id}
                route={route}
                actions={
                  <button
                    onClick={() => handleDelete(route.route_id)}
                    disabled={deletingId === route.route_id}
                    className="flex items-center gap-2 font-bebas text-[12px] tracking-[1px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === route.route_id ? 'DELETING...' : 'DELETE'}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
