"use client";

import { useEffect, useRef } from "react";

interface TrackPoint {
  lat: number;
  lng: number;
  ele?: number;
}

interface Props {
  track: TrackPoint[];
}

export default function ActivityMap({ track }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || track.length === 0 || mapInstanceRef.current) return;

    // Carregar Leaflet dinamicamente (evita SSR issues)
    import("leaflet").then((L) => {
      // Fix ícones Leaflet com Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Traçar percurso
      const latlngs = track.map((p) => [p.lat, p.lng] as [number, number]);

      const polyline = L.polyline(latlngs, {
        color: "#16a34a",
        weight: 4,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(map);

      // Marcadores início e fim
      const startIcon = L.divIcon({
        html: `<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: "",
      });
      const endIcon = L.divIcon({
        html: `<div style="background:#dc2626;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: "",
      });

      L.marker(latlngs[0], { icon: startIcon }).addTo(map).bindPopup("Início");
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map).bindPopup("Fim");

      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    });

    // Carregar CSS do Leaflet
    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [track]);

  return (
    <div className="relative">
      <div ref={mapRef} style={{ height: "400px", width: "100%" }} />
      <div className="absolute bottom-3 left-3 flex gap-2 z-[1000]">
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow text-xs font-medium">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-600" />
          Início
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow text-xs font-medium">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          Fim
        </div>
      </div>
    </div>
  );
}
