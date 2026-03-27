"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react";
import * as THREE from "three";

export interface ArcData {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface PointData {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

export interface GlobeHandle {
  getRenderer: () => unknown;
  resetCamera: () => void;
  focusOnArc: (arc: ArcData) => void;
  focusOnAllArcs: (arcs: ArcData[]) => void;
}

// Great circle interpolation → [lat, lng]
function interpolate(
  lat1: number, lng1: number, lat2: number, lng2: number, t: number
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2);
  const d = Math.acos(
    Math.max(-1, Math.min(1,
      Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
    ))
  );
  if (d < 1e-6) return [lat1, lng1];
  const a = Math.sin((1 - t) * d) / Math.sin(d);
  const b = Math.sin(t * d) / Math.sin(d);
  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);
  return [toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))];
}

// Angular distance (radians)
function angularDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  return Math.acos(
    Math.max(-1, Math.min(1,
      Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    ))
  );
}

// Arc altitude at t (parabolic, matching globe.gl arcAltitudeAutoScale)
const ARC_SCALE = 0.4;
function getArcAlt(t: number, sLat: number, sLng: number, eLat: number, eLng: number): number {
  const d = angularDist(sLat, sLng, eLat, eLng);
  return (ARC_SCALE * d / 2) * Math.sin(Math.PI * t);
}

// Bearing A→B (degrees, 0=north, clockwise)
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Create airplane 3D mesh (a simple cone + wings)
function createPlaneMesh(): THREE.Group {
  const group = new THREE.Group();

  // Fuselage (cone pointing +Z)
  const fuselage = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.8, 4),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x00cccc, emissiveIntensity: 0.4 })
  );
  fuselage.rotation.x = Math.PI / 2; // point forward (+Z → +Y visual)
  group.add(fuselage);

  // Wings
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.04, 0.2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x00aaaa, emissiveIntensity: 0.3 })
  );
  wing.position.z = -0.05;
  group.add(wing);

  // Glow point
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 })
  );
  group.add(glow);

  return group;
}

// Convert lat/lng/altitude to 3D position on globe (globe radius = 100 in globe.gl)
const GLOBE_RADIUS = 100;
function latLngAltToXYZ(lat: number, lng: number, alt: number): THREE.Vector3 {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ = toRad(lat);
  const λ = toRad(lng);
  const r = GLOBE_RADIUS * (1 + alt);
  return new THREE.Vector3(
    r * Math.cos(φ) * Math.sin(λ),
    r * Math.sin(φ),
    r * Math.cos(φ) * Math.cos(λ)
  );
}

const Globe = forwardRef<
  GlobeHandle,
  {
    arcs: ArcData[];
    points: PointData[];
    animating: boolean;
    speed: number;
    onAnimationProgress?: (progress: number) => void;
  }
>(function Globe({ arcs, points, animating, speed, onAnimationProgress }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const animatingRef = useRef(animating);
  const arcsRef = useRef(arcs);
  const speedRef = useRef(speed);
  const onProgressRef = useRef(onAnimationProgress);
  const planeMeshRef = useRef<THREE.Group | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  animatingRef.current = animating;
  arcsRef.current = arcs;
  speedRef.current = speed;
  onProgressRef.current = onAnimationProgress;

  const getRenderer = useCallback(() => {
    if (!globeRef.current) return null;
    return globeRef.current.renderer();
  }, []);

  const focusOnArc = useCallback((arc: ArcData) => {
    if (!globeRef.current) return;
    const midLat = (arc.startLat + arc.endLat) / 2;
    const midLng = (arc.startLng + arc.endLng) / 2;
    globeRef.current.pointOfView({ lat: midLat, lng: midLng, altitude: 1.4 }, 1500);
  }, []);

  const focusOnAllArcs = useCallback((allArcs: ArcData[]) => {
    if (!globeRef.current || allArcs.length === 0) return;
    const avgLat = allArcs.reduce((s, a) => s + (a.startLat + a.endLat) / 2, 0) / allArcs.length;
    const avgLng = allArcs.reduce((s, a) => s + (a.startLng + a.endLng) / 2, 0) / allArcs.length;
    const alt = allArcs.length === 1 ? 1.4 : Math.min(2.2, 1.0 + allArcs.length * 0.2);
    globeRef.current.pointOfView({ lat: avgLat, lng: avgLng, altitude: alt }, 1500);
  }, []);

  const resetCamera = useCallback(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 30, lng: 0, altitude: 2.0 }, 1000);
  }, []);

  useImperativeHandle(ref, () => ({ getRenderer, resetCamera, focusOnArc, focusOnAllArcs }), [
    getRenderer, resetCamera, focusOnArc, focusOnAllArcs,
  ]);

  // Init globe
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    import("globe.gl").then((mod) => {
      if (destroyed || !containerRef.current) return;

      const GlobeFactory = mod.default;
      const globe = new GlobeFactory(containerRef.current, { animateIn: true });

      globe
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .showAtmosphere(true)
        .atmosphereColor("#3a8ee6")
        .atmosphereAltitude(0.25)
        .pointOfView({ lat: 30, lng: 126, altitude: 1.8 });

      globe
        .arcColor(() => ["#00ffff", "#ff00ff"])
        .arcDashLength(0.5)
        .arcDashGap(0.2)
        .arcDashAnimateTime(2000)
        .arcStroke(0.8)
        .arcAltitudeAutoScale(ARC_SCALE);

      globe
        .pointColor((d: object) => (d as PointData).color)
        .pointAltitude(0.01)
        .pointRadius(0.4)
        .pointLabel((d: object) => (d as PointData).label);

      const handleResize = () => {
        if (containerRef.current) {
          globe.width(containerRef.current.clientWidth);
          globe.height(containerRef.current.clientHeight);
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      globeRef.current = globe;
      setGlobeReady(true);
    });

    return () => {
      destroyed = true;
      if (globeRef.current) {
        globeRef.current._destructor?.();
        globeRef.current = null;
      }
    };
  }, []);

  // Update arcs (wait for globe to be ready)
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    globeRef.current.arcsData(arcs);
  }, [arcs, globeReady]);

  // Update points
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    globeRef.current.pointsData(points);
  }, [points, globeReady]);

  // Update speed
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    globeRef.current.arcDashAnimateTime(Math.max(500, 3000 / speed));
  }, [speed, globeReady]);

  // === Animation: 3D plane mesh on arc + jitter-free camera ===
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    if (!animating || arcs.length === 0) {
      if (planeMeshRef.current) {
        globe.scene().remove(planeMeshRef.current);
        planeMeshRef.current = null;
      }
      onAnimationProgress?.(0);
      return;
    }

    // Create plane mesh
    const plane = createPlaneMesh();
    plane.scale.setScalar(2.0);
    globe.scene().add(plane);
    planeMeshRef.current = plane;

    const allArcs = arcsRef.current;
    const numLegs = allArcs.length;

    // === KEY FIX: Disable OrbitControls to stop damping from fighting camera ===
    const camera = globe.camera() as THREE.PerspectiveCamera;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = globe.controls() as any;
    controls.enabled = false;

    // Init camera to first arc start, 30% closer (altitude 0.7 → GLOBE_RADIUS * 1.7)
    const CAM_DIST = GLOBE_RADIUS * 1.85;
    const initNormal = latLngAltToXYZ(allArcs[0].startLat, allArcs[0].startLng, 0).normalize();
    camera.position.copy(initNormal.multiplyScalar(CAM_DIST));
    camera.lookAt(0, 0, 0);

    const startTime = Date.now();

    const tick = () => {
      if (!animatingRef.current || !globeRef.current) {
        controls.enabled = true;
        return;
      }

      const elapsed = Date.now() - startTime;
      const spd = speedRef.current;
      const legDuration = 5000 / spd;
      const totalDuration = legDuration * numLegs;
      const globalT = Math.min(1, elapsed / totalDuration);

      onProgressRef.current?.(globalT);

      const currentLeg = Math.min(numLegs - 1, Math.floor(elapsed / legDuration));
      const legElapsed = elapsed - currentLeg * legDuration;
      const t = Math.min(1, legElapsed / legDuration);

      const arc = arcsRef.current[currentLeg];
      if (!arc) {
        onProgressRef.current?.(1);
        controls.enabled = true;
        return;
      }

      // Current position
      const [lat, lng] = interpolate(arc.startLat, arc.startLng, arc.endLat, arc.endLng, t);
      const alt = getArcAlt(t, arc.startLat, arc.startLng, arc.endLat, arc.endLng);

      // Next position for orientation
      const tN = Math.min(1, t + 0.02);
      const [latN, lngN] = interpolate(arc.startLat, arc.startLng, arc.endLat, arc.endLng, tN);
      const altN = getArcAlt(tN, arc.startLat, arc.startLng, arc.endLat, arc.endLng);

      // Position & orient plane
      const pos = latLngAltToXYZ(lat, lng, alt);
      plane.position.copy(pos);

      const nextPos = latLngAltToXYZ(latN, lngN, altN);
      const up = pos.clone().normalize();
      plane.up.copy(up);
      plane.lookAt(nextPos);

      // === Jitter-free camera: directly lerp Three.js camera, no pointOfView() ===
      const surfaceNormal = latLngAltToXYZ(lat, lng, 0).normalize();
      const desiredCamPos = surfaceNormal.multiplyScalar(CAM_DIST);
      camera.position.lerp(desiredCamPos, 0.05);
      camera.lookAt(0, 0, 0);

      if (globalT < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        onProgressRef.current?.(1);
        controls.enabled = true;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      controls.enabled = true;
      if (planeMeshRef.current) {
        globe.scene().remove(planeMeshRef.current);
        planeMeshRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating, arcs.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
});

export default Globe;
