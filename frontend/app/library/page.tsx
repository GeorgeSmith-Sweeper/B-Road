'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Route, ArrowLeft, Download, BookOpen, MapPin } from 'lucide-react';
import { listPublicRoutes, getGpxExportUrl, getKmlExportUrl, type RouteResponse } from '@/lib/routes-api';
import RouteCard from '@/components/RouteCard';

export default function LibraryPage() {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await listPublicRoutes();
      setRoutes(data.routes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

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
              <span className="font-bebas text-[22px] tracking-[3px] text-text-primary">LIBRARY</span>
            </div>
          </div>
          <Link
            href="/planner"
            className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-6 py-2.5 hover:brightness-110 transition"
          >
            PLAN YOUR TRIP
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-[120px] py-10 lg:py-16">
        <div className="flex flex-col gap-4 mb-10">
          <h1 className="font-bebas text-3xl md:text-4xl tracking-tight text-text-primary">
            PUBLIC ROUTE LIBRARY
          </h1>
          <p className="font-cormorant text-lg italic text-text-secondary max-w-xl">
            Browse routes shared by the community. Download any route as GPX or KML for your GPS device.
          </p>
        </div>

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
            <BookOpen className="w-12 h-12 text-text-disabled" />
            <h2 className="font-bebas text-2xl tracking-[2px] text-text-secondary">NO PUBLIC ROUTES YET</h2>
            <p className="font-cormorant text-lg italic text-text-secondary text-center max-w-md">
              Be the first to share a route with the community.
            </p>
            <Link
              href="/planner"
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-8 py-3 hover:brightness-110 transition"
            >
              CREATE A ROUTE
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routes.map((route) => (
              <RouteCard
                key={route.route_id}
                route={route}
                actions={
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/planner?route=${route.route_id}`}
                      className="flex items-center gap-1.5 font-bebas text-[12px] tracking-[1px] text-accent-gold hover:brightness-110 transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      VIEW ON MAP
                    </Link>
                    <a
                      href={getGpxExportUrl(route.url_slug)}
                      download
                      className="flex items-center gap-1.5 font-bebas text-[12px] tracking-[1px] text-accent-gold hover:brightness-110 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      GPX
                    </a>
                    <a
                      href={getKmlExportUrl(route.url_slug)}
                      download
                      className="flex items-center gap-1.5 font-bebas text-[12px] tracking-[1px] text-accent-gold hover:brightness-110 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      KML
                    </a>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
