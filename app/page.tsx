"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import AirportInput from "@/components/AirportInput";
import Controls from "@/components/Controls";
import { recordCanvas, downloadBlob } from "@/lib/videoExport";
import type { ArcData, PointData, GlobeHandle } from "@/components/Globe";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export default function Home() {
  // Sequential airport list: each consecutive pair = one route
  const [stops, setStops] = useState<Airport[]>([]);

  // Load from localStorage after mount (avoid hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flight-tracker-stops");
      if (saved) setStops(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist stops to localStorage
  useEffect(() => {
    localStorage.setItem("flight-tracker-stops", JSON.stringify(stops));
  }, [stops]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const globeRef = useRef<GlobeHandle>(null);

  // Derive arcs from consecutive stop pairs
  const arcs: ArcData[] = useMemo(
    () =>
      stops.slice(0, -1).map((dep, i) => {
        const arr = stops[i + 1];
        return {
          id: `${dep.iata}-${arr.iata}-${i}`,
          startLat: dep.lat,
          startLng: dep.lng,
          endLat: arr.lat,
          endLng: arr.lng,
        };
      }),
    [stops]
  );

  const points: PointData[] = useMemo(
    () =>
      stops.map((s, i) => ({
        lat: s.lat,
        lng: s.lng,
        label: s.iata,
        color: i === 0 ? "#00ffff" : i === stops.length - 1 ? "#ff00ff" : "#ffff00",
      })),
    [stops]
  );

  const canPlay = arcs.length > 0;

  const handleProgress = useCallback((p: number) => {
    setProgress(p);
    if (p >= 1) setPlaying(false);
  }, []);

  // Add airport to the chain
  const handleAddStop = useCallback(
    (airport: Airport | null) => {
      if (!airport) return;
      setStops((prev) => {
        const next = [...prev, airport];
        // Focus on the new arc if we have at least 2 stops
        if (next.length >= 2) {
          const dep = next[next.length - 2];
          const arr = next[next.length - 1];
          setTimeout(() => {
            globeRef.current?.focusOnArc({
              id: "",
              startLat: dep.lat,
              startLng: dep.lng,
              endLat: arr.lat,
              endLng: arr.lng,
            });
          }, 100);
        }
        return next;
      });
    },
    []
  );

  // Remove last stop
  const handleRemoveLast = useCallback(() => {
    setStops((prev) => prev.slice(0, -1));
  }, []);

  // Clear all
  const handleClearAll = useCallback(() => {
    setStops([]);
    setPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!canPlay) return;
    setPlaying((prev) => !prev);
  }, [canPlay]);

  const handleRecord = useCallback(async () => {
    if (!canPlay || recording) return;

    const renderer = globeRef.current?.getRenderer() as { domElement: HTMLCanvasElement } | null;
    if (!renderer) return;

    const canvas = renderer.domElement as HTMLCanvasElement;

    setRecording(true);
    setRecordProgress(0);
    setPlaying(true);

    const duration = 5000 / speed + 500;

    try {
      const blob = await recordCanvas(canvas, duration, (p) => setRecordProgress(p));
      const routeStr = stops.map((s) => s.iata).join("-");
      downloadBlob(blob, `flight-${routeStr}.webm`);
    } catch (err) {
      console.error("Recording failed:", err);
    } finally {
      setRecording(false);
      setRecordProgress(0);
      setPlaying(false);
    }
  }, [canPlay, recording, speed, stops]);

  return (
    <main className="h-dvh w-full bg-black flex flex-col relative overflow-hidden">
      {/* Globe */}
      <div className="absolute inset-0">
        <Globe
          ref={globeRef}
          arcs={arcs}
          points={points}
          animating={playing}
          speed={speed}
          onAnimationProgress={handleProgress}
        />
      </div>

      {/* Route chain display (top) */}
      {stops.length > 0 && (
        <div className="absolute top-3 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-2.5
                          border border-gray-700/50 flex items-center gap-1.5
                          pointer-events-auto max-w-[90vw] overflow-x-auto">
            {stops.map((s, i) => (
              <div key={`${s.iata}-${i}`} className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`font-mono font-bold text-sm ${
                    i === 0
                      ? "text-cyan-400"
                      : i === stops.length - 1
                        ? "text-fuchsia-400"
                        : "text-yellow-400"
                  }`}
                >
                  {s.iata}
                </span>
                {i < stops.length - 1 && (
                  <svg width="16" height="10" viewBox="0 0 16 10" className="text-gray-500 shrink-0">
                    <path d="M0 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                )}
              </div>
            ))}
            {/* Undo last */}
            <button
              onClick={handleRemoveLast}
              className="ml-1 w-5 h-5 flex items-center justify-center rounded-full
                         text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
              title="마지막 경유지 삭제"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2L2 8M2 2l6 6" />
              </svg>
            </button>
            {/* Clear all */}
            {stops.length > 1 && (
              <button
                onClick={handleClearAll}
                className="ml-0.5 text-[10px] text-gray-500 hover:text-red-400 transition-colors shrink-0"
                title="전체 삭제"
              >
                CLR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recording overlay */}
      {recording && (
        <div className="absolute top-14 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-red-500/20 backdrop-blur-md rounded-full px-4 py-1.5
                          border border-red-500/40 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs">
              REC {Math.round(recordProgress * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10
                      bg-gradient-to-t from-black via-black/90 to-transparent
                      pt-12 pb-6 px-4">
        {/* Single airport input */}
        <div className="flex gap-2 mb-4 items-end">
          <AirportInput
            label={stops.length === 0 ? "출발지" : "다음 경유지"}
            placeholder={stops.length === 0 ? "출발 공항 검색..." : `${stops[stops.length - 1].iata} 다음은?`}
            value={null}
            onChange={handleAddStop}
          />
        </div>

        {/* Controls */}
        <Controls
          playing={playing}
          speed={speed}
          progress={progress}
          canPlay={canPlay}
          onTogglePlay={handleTogglePlay}
          onSpeedChange={setSpeed}
          onRecord={handleRecord}
          recording={recording}
        />
      </div>
    </main>
  );
}
