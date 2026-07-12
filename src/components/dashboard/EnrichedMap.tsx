"use client";
import { useEffect, useRef, useState } from "react";

interface TrackPoint {
  lat: number;
  lng: number;
  ele?: number;
  hr?: number;
  pace?: number; // seconds per km
}

interface Props {
  gpsTrack: TrackPoint[];
  elevationGain?: number | null;
}

type ColorBy = "pace" | "hr";

function interpolateColor(ratio: number): string {
  // 0 = green, 0.5 = yellow, 1 = red
  let r: number, g: number, b: number;
  if (ratio < 0.5) {
    const t = ratio * 2;
    r = Math.round(34 + (234 - 34) * t);
    g = Math.round(197 + (179 - 197) * t);
    b = Math.round(94 + (8 - 94) * t);
  } else {
    const t = (ratio - 0.5) * 2;
    r = Math.round(234 + (239 - 234) * t);
    g = Math.round(179 + (68 - 179) * t);
    b = Math.round(8 + (68 - 8) * t);
  }
  return `rgb(${r},${g},${b})`;
}

function hrToColor(hr: number): string {
  if (hr < 140) return "#3b82f6"; // blue Z1
  if (hr < 155) return "#22c55e"; // green Z2
  if (hr < 165) return "#eab308"; // yellow Z3
  if (hr < 175) return "#f97316"; // orange Z4
  return "#ef4444"; // red Z5
}

export default function EnrichedMap({ gpsTrack, elevationGain }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [colorBy, setColorBy] = useState<ColorBy>("pace");

  useEffect(() => {
    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || gpsTrack.length === 0) return;

    // Remove existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const latlngs = gpsTrack.map((p) => [p.lat, p.lng] as [number, number]);
      const segmentSize = 10;

      // Compute pace quintiles for normalization
      const paces = gpsTrack.map((p) => p.pace ?? 0).filter((p) => p > 0);
      const minPace = paces.length ? Math.min(...paces) : 0;
      const maxPace = paces.length ? Math.max(...paces) : 1;

      for (let i = 0; i < gpsTrack.length - segmentSize; i += segmentSize) {
        const seg = gpsTrack.slice(i, i + segmentSize + 1);
        const segLatLngs = seg.map((p) => [p.lat, p.lng] as [number, number]);

        let color = "#22c55e";
        if (colorBy === "pace") {
          const avgPace = seg.reduce((a, p) => a + (p.pace ?? 0), 0) / seg.length;
          if (maxPace > minPace && avgPace > 0) {
            const ratio = (avgPace - minPace) / (maxPace - minPace);
            color = interpolateColor(ratio);
          }
        } else {
          const avgHR = seg.reduce((a, p) => a + (p.hr ?? 0), 0) / seg.length;
          if (avgHR > 0) color = hrToColor(avgHR);
        }

        L.polyline(segLatLngs, { color, weight: 4, opacity: 0.9, smoothFactor: 1 }).addTo(map);
      }

      // Start / end markers
      const startIcon = L.divIcon({
        html: `<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6], className: "",
      });
      const endIcon = L.divIcon({
        html: `<div style="background:#ef4444;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6], className: "",
      });

      L.marker(latlngs[0], { icon: startIcon }).addTo(map).bindPopup("Início");
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map).bindPopup("Fim");

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [20, 20] });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [gpsTrack, colorBy]);

  // Elevation profile SVG
  const hasElevation = gpsTrack.some((p) => p.ele !== undefined && p.ele !== null);
  const elevations = hasElevation ? gpsTrack.map((p) => p.ele ?? 0) : [];
  const minEle = elevations.length ? Math.min(...elevations) : 0;
  const maxEle = elevations.length ? Math.max(...elevations) : 1;

  const svgWidth = 600;
  const svgHeight = 80;
  const svgPath = elevations.length > 1
    ? elevations.map((ele, i) => {
        const x = (i / (elevations.length - 1)) * svgWidth;
        const y = svgHeight - ((ele - minEle) / (maxEle - minEle || 1)) * (svgHeight - 10);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      }).join(" ")
    : "";
  const svgArea = svgPath
    ? `${svgPath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`
    : "";

  return (
    <div>
      {/* Toggle */}
      <div className="px-5 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
        <span className="text-xs text-zinc-500 mr-1">Colorir por:</span>
        <button
          onClick={() => setColorBy("pace")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            colorBy === "pace" ? "bg-green-500 text-black" : "bg-[#1a1a1a] text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Pace
        </button>
        <button
          onClick={() => setColorBy("hr")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            colorBy === "hr" ? "bg-green-500 text-black" : "bg-[#1a1a1a] text-zinc-400 hover:text-zinc-200"
          }`}
        >
          FC
        </button>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: "380px", width: "100%" }} />

      {/* Legend */}
      <div className="px-5 py-3 bg-[#111] border-t border-[#1a1a1a]">
        {colorBy === "pace" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Rápido</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)" }} />
            <span className="text-xs text-zinc-500">Lento</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { color: "#3b82f6", label: "Z1 <140" },
              { color: "#22c55e", label: "Z2 140-155" },
              { color: "#eab308", label: "Z3 155-165" },
              { color: "#f97316", label: "Z4 165-175" },
              { color: "#ef4444", label: "Z5 >175" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Elevation profile */}
      {hasElevation && elevations.length > 1 && (
        <div className="px-5 py-4 bg-[#111] border-t border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Perfil de Elevação</h3>
            {elevationGain && (
              <span className="text-xs text-zinc-500">+{Math.round(elevationGain)}m ganho</span>
            )}
          </div>
          <div className="relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-16" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path d={svgArea} fill="url(#eleGradient)" />
              <path d={svgPath} fill="none" stroke="#22c55e" strokeWidth="1.5" />
            </svg>
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>{Math.round(minEle)}m</span>
              <span>{Math.round(maxEle)}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
