import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM, BRAND_COLORS } from "@/lib/constants";
import type { Station } from "@shared/schema";

// Cache icons per brand to avoid recreating
const iconCache = new Map<string, L.DivIcon>();

function getStationIcon(brand: string) {
  if (iconCache.has(brand)) return iconCache.get(brand)!;
  const color = BRAND_COLORS[brand] || BRAND_COLORS["อื่นๆ"];
  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width:24px;height:24px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    "><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17"/><path d="M13 7h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6"/><path d="M13 11h4"/><path d="M13 15h4"/></svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
  iconCache.set(brand, icon);
  return icon;
}

interface StationMapProps {
  stations: Station[];
  onStationClick: (station: Station) => void;
}

export default function StationMap({ stations, onStationClick }: StationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      minZoom: 5,
      maxZoom: 19,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control bottom-right (above locate button)
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Create marker cluster group
    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 15,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = "small";
        let dim = 36;
        if (count > 100) { size = "large"; dim = 48; }
        else if (count > 30) { size = "medium"; dim = 42; }
        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}"><span>${count}</span></div>`,
          className: "custom-cluster",
          iconSize: L.point(dim, dim),
        });
      },
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  // Update markers when stations change
  useEffect(() => {
    if (!clusterRef.current) return;

    clusterRef.current.clearLayers();

    const markers = stations.map((station) => {
      const marker = L.marker([station.lat, station.lng], {
        icon: getStationIcon(station.brand),
      });

      marker.on("click", () => {
        onStationClick(station);
      });

      marker.bindTooltip(station.name, {
        direction: "top",
        offset: [0, -12],
        className: "station-tooltip",
      });

      return marker;
    });

    clusterRef.current.addLayers(markers);
  }, [stations, onStationClick]);

  const handleLocate = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 14 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={handleLocate}
        data-testid="btn-locate"
        className="absolute bottom-20 right-3 z-[1000] bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
        aria-label="หาตำแหน่งของฉัน"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
    </div>
  );
}
