'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useAppStore } from '@/store/useAppStore';
import { RoadFeature } from '@/types';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { mapboxToken, currentData } = useAppStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-72.7, 44.0],
      zoom: 8,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Add/update roads layer when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentData) return;

    const mapInstance = map.current;

    // Remove existing layer and source
    if (mapInstance.getLayer('roads-layer')) {
      mapInstance.removeLayer('roads-layer');
    }
    if (mapInstance.getSource('roads')) {
      mapInstance.removeSource('roads');
    }

    // Add roads source
    mapInstance.addSource('roads', {
      type: 'geojson',
      data: currentData,
    });

    // Add roads layer with curvature-based coloring
    mapInstance.addLayer({
      id: 'roads-layer',
      type: 'line',
      source: 'roads',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': [
          'case',
          ['<', ['get', 'curvature'], 600],
          '#FFC107', // Yellow - mild curves
          ['<', ['get', 'curvature'], 1000],
          '#FF9800', // Orange - moderate curves
          ['<', ['get', 'curvature'], 2000],
          '#F44336', // Red - very curvy
          '#9C27B0', // Purple - extremely curvy
        ],
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });

    // Add click handler for popups
    mapInstance.on('click', 'roads-layer', (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0] as unknown as RoadFeature;
      const props = feature.properties;

      const curvatureClass =
        props.curvature < 600
          ? 'bg-yellow-400 text-black'
          : props.curvature < 1000
          ? 'bg-orange-500 text-white'
          : props.curvature < 2000
          ? 'bg-red-500 text-white'
          : 'bg-purple-600 text-white';

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `
          <div class="p-2">
            <h3 class="font-bold text-lg mb-2">${props.name || 'Unnamed Road'}</h3>
            <table class="text-sm">
              <tr>
                <td class="font-semibold pr-2">Curvature:</td>
                <td>
                  <span class="px-2 py-1 rounded ${curvatureClass}">
                    ${Math.round(props.curvature)}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="font-semibold pr-2">Length:</td>
                <td>${props.length_mi.toFixed(2)} mi (${props.length_km.toFixed(2)} km)</td>
              </tr>
              <tr>
                <td class="font-semibold pr-2">Surface:</td>
                <td>${props.surface}</td>
              </tr>
            </table>
          </div>
        `
        )
        .addTo(mapInstance);
    });

    // Change cursor on hover
    mapInstance.on('mouseenter', 'roads-layer', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });

    mapInstance.on('mouseleave', 'roads-layer', () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    // Fit bounds to show all roads
    if (currentData.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      currentData.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      });
      mapInstance.fitBounds(bounds, { padding: 50 });
    }
  }, [mapLoaded, currentData]);

  return (
    <div className="relative w-full h-full bg-gray-300">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      {!mapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <p className="text-gray-600">Loading map configuration...</p>
        </div>
      )}
    </div>
  );
}
