import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { DiagnosticSession, SingleTestResult } from '../types';
import { Globe as GlobeIcon, Activity, RefreshCw } from 'lucide-react';

interface TelemetryGlobeProps {
  session?: DiagnosticSession | null;
  tests?: Record<string, SingleTestResult>;
  height?: number | string;
  title?: string;
  subtitle?: string;
}

interface TelemetryEndpoint {
  id: string;
  name: string;
  target: string;
  lat: number;
  lng: number;
  type: 'client' | 'gateway' | 'dns' | 'wan' | 'cloud';
}

const ENDPOINTS: TelemetryEndpoint[] = [
  { id: 'client', name: 'Home Client Host', target: '127.0.0.1 (Local Node)', lat: 28.6139, lng: 77.2090, type: 'client' },
  { id: 'gateway', name: 'Default Gateway (LAN)', target: '192.168.1.1', lat: 24.5854, lng: 73.7125, type: 'gateway' },
  { id: 'dns', name: 'System DNS Resolver', target: 'Regional Edge (8.8.8.8)', lat: 19.0760, lng: 72.8777, type: 'dns' },
  { id: 'external_icmp', name: 'Cloudflare Transit Core', target: '1.1.1.1 (ICMP WAN)', lat: 1.3521, lng: 103.8198, type: 'wan' },
  { id: 'external_http', name: 'HTTP Web Connectivity Edge', target: 'connectivitycheck.gstatic.com', lat: 37.7749, lng: -122.4194, type: 'cloud' },
  { id: 'mild_load', name: 'Bufferbloat Workload Target', target: 'Cloud CDN Testbed', lat: 51.5074, lng: -0.1278, type: 'cloud' },
];

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function createCurvedArcPoints(p1: THREE.Vector3, p2: THREE.Vector3, radius: number): THREE.Vector3[] {
  const distance = p1.distanceTo(p2);
  const mid = p1.clone().add(p2).multiplyScalar(0.5);
  const midLen = mid.length();
  if (midLen > 0.001) {
    mid.normalize();
    const altitude = radius + Math.min(distance * 0.35, 1.8);
    mid.multiplyScalar(altitude);
  }
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
  return curve.getPoints(40);
}

export const TelemetryGlobe: React.FC<TelemetryGlobeProps> = ({
  session,
  tests,
  height = 340,
  title = 'Global Telemetry Diagnostic Orbit',
  subtitle = 'Real-time 3D telemetry propagation between local client and target endpoints',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Compute live test states
  const activeTests = useMemo(() => {
    return tests || session?.tests || {};
  }, [tests, session]);

  const isRunning = session?.status === 'running' || Object.values(activeTests).some((t) => t.status === 'running');

  // Derive status colors
  const getStatusColor = (testId: string) => {
    const t = activeTests[testId];
    if (!t) return 0x94a3b8; // Slate 400 (Idle)
    if (t.status === 'running') return 0x0284c7; // Sky 600 (Testing / In-Flight)
    if (t.status === 'pass') return 0x10b981; // Emerald 500 (Healthy)
    if (t.status === 'fail') return 0xef4444; // Red 500 (Failed / Packet Loss)
    if (t.status === 'warning') return 0xf59e0b; // Amber 500 (Warning)
    return 0x94a3b8;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const computedHeight = typeof height === 'number' ? height : parseInt(height, 10) || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / computedHeight, 0.1, 1000);
    camera.position.set(0, 0, 10.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, computedHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Clean previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Globe Group
    const globeGroup = new THREE.Group();
    // Default pleasant tilt
    globeGroup.rotation.x = 0.3;
    globeGroup.rotation.y = -0.5;
    scene.add(globeGroup);

    const GLOBE_RADIUS = 3.8;

    // Inner sphere (Light canvas off-white / light slate)
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 48);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0xf8fafc,
      emissive: 0x0f172a,
      emissiveIntensity: 0.04,
      transparent: true,
      opacity: 0.95,
      shininess: 15,
    });
    const baseSphere = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(baseSphere);

    // Atmosphere Glow Layer
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    globeGroup.add(atmosphere);

    // Latitude & Longitude Coordinate Wireframe
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.14,
    });
    const wireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, 24, 16));
    const wireframe = new THREE.LineSegments(wireGeo, wireframeMat);
    globeGroup.add(wireframe);

    // Procedural Landmass Particle Points
    const dotCount = 1200;
    const dotPositions: number[] = [];
    const dotColors: number[] = [];

    for (let i = 0; i < dotCount; i++) {
      // Fibonacci sphere distribution
      const k = i + 0.5;
      const phi = Math.acos(1 - (2 * k) / dotCount);
      const theta = Math.PI * (1 + 5 ** 0.5) * k;

      const r = GLOBE_RADIUS * 1.005;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      dotPositions.push(x, y, z);
      // Subtle cyan/slate tint
      dotColors.push(0.08, 0.45, 0.72);
    }

    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
    dotGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dotColors, 3));

    const dotMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const pointCloud = new THREE.Points(dotGeometry, dotMaterial);
    globeGroup.add(pointCloud);

    // 3. Telemetry Nodes (Spheres + Pulse Rings)
    const clientNode = ENDPOINTS[0];
    const clientPos = latLngToVector3(clientNode.lat, clientNode.lng, GLOBE_RADIUS * 1.01);

    const endpointMeshes: { id: string; mesh: THREE.Mesh; ring: THREE.Mesh }[] = [];

    ENDPOINTS.forEach((ep) => {
      const pos = latLngToVector3(ep.lat, ep.lng, GLOBE_RADIUS * 1.01);
      const isClient = ep.id === 'client';

      // Node Marker
      const nodeGeo = new THREE.SphereGeometry(isClient ? 0.12 : 0.09, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: isClient ? 0x0284c7 : getStatusColor(ep.id),
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.copy(pos);
      globeGroup.add(nodeMesh);

      // Node Pulse Ring
      const ringGeo = new THREE.RingGeometry(isClient ? 0.15 : 0.11, isClient ? 0.22 : 0.16, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isClient ? 0x38bdf8 : getStatusColor(ep.id),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.01));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      globeGroup.add(ringMesh);

      endpointMeshes.push({ id: ep.id, mesh: nodeMesh, ring: ringMesh });
    });

    // 4. Telemetry Arcs (Client -> Targets)
    interface ArcData {
      id: string;
      line: THREE.Line;
      particles: THREE.Points;
      particlePositions: THREE.Vector3[];
      particleProgress: number;
    }

    const arcList: ArcData[] = [];

    ENDPOINTS.slice(1).forEach((target) => {
      const targetPos = latLngToVector3(target.lat, target.lng, GLOBE_RADIUS * 1.01);
      const curvePoints = createCurvedArcPoints(clientPos, targetPos, GLOBE_RADIUS);

      // Static Arc line
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: getStatusColor(target.id),
        transparent: true,
        opacity: 0.35,
        linewidth: 1.5,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      globeGroup.add(line);

      // Animated traveling pulse particle along the arc
      const pGeo = new THREE.BufferGeometry();
      const pPositions = new Float32Array([curvePoints[0].x, curvePoints[0].y, curvePoints[0].z]);
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

      const pMat = new THREE.PointsMaterial({
        color: getStatusColor(target.id),
        size: 0.16,
        transparent: true,
        opacity: 0.95,
      });
      const particles = new THREE.Points(pGeo, pMat);
      globeGroup.add(particles);

      arcList.push({
        id: target.id,
        line,
        particles,
        particlePositions: curvePoints,
        particleProgress: Math.random(),
      });
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(5, 7, 6);
    scene.add(dirLight);

    // Mouse Interaction (Click & Drag Rotation)
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      globeGroup.rotation.y += deltaX * 0.006;
      globeGroup.rotation.x += deltaY * 0.006;
      // Clamp vertical tilt
      globeGroup.rotation.x = Math.max(-0.9, Math.min(0.9, globeGroup.rotation.x));

      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Slow Idle Auto-Rotation
      if (autoRotate && !isDragging) {
        globeGroup.rotation.y += delta * 0.14;
      }

      // Pulse Node Rings
      endpointMeshes.forEach((ep, idx) => {
        const pulse = 1 + Math.sin(elapsed * 3.5 + idx) * 0.22;
        ep.ring.scale.set(pulse, pulse, pulse);
      });

      // Advance Arc Stream Pulses
      arcList.forEach((arc) => {
        const speed = isRunning ? 0.6 : 0.25;
        arc.particleProgress = (arc.particleProgress + delta * speed) % 1;

        const totalPts = arc.particlePositions.length;
        const currentIdx = Math.floor(arc.particleProgress * (totalPts - 1));
        const nextIdx = Math.min(currentIdx + 1, totalPts - 1);
        const subProgress = (arc.particleProgress * (totalPts - 1)) - currentIdx;

        const p1 = arc.particlePositions[currentIdx];
        const p2 = arc.particlePositions[nextIdx];
        const currentPos = p1.clone().lerp(p2, subProgress);

        const posAttr = arc.particles.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(0, currentPos.x, currentPos.y, currentPos.z);
        posAttr.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / computedHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, computedHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [height, autoRotate, isRunning, activeTests]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 relative overflow-hidden">
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
            <GlobeIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{title}</span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 animate-pulse">
                  <Activity className="h-3 w-3" />
                  Live Telemetry Active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${autoRotate ? 'animate-spin' : ''}`} />
            <span>{autoRotate ? 'Rotating' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full relative cursor-grab active:cursor-grabbing select-none"
        style={{ height }}
      />

      {/* Bottom Live Endpoints Legend / Status Pills */}
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {ENDPOINTS.map((ep) => {
          const testData = activeTests[ep.id];
          const st = ep.id === 'client' ? 'client' : testData?.status || 'idle';

          return (
            <div
              key={ep.id}
              onClick={() => setActiveNode(ep.id)}
              className={`p-2 rounded-lg border text-[11px] transition-all cursor-pointer ${
                activeNode === ep.id
                  ? 'border-sky-500 bg-sky-50/50 shadow-2xs'
                  : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-semibold text-slate-800 truncate">{ep.name}</span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    st === 'client'
                      ? 'bg-sky-600 ring-2 ring-sky-200'
                      : st === 'running'
                      ? 'bg-sky-500 animate-ping'
                      : st === 'pass'
                      ? 'bg-emerald-500'
                      : st === 'fail'
                      ? 'bg-rose-500'
                      : st === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="font-mono text-[10px] text-slate-500 truncate">{ep.target}</div>
              {testData?.duration_ms !== undefined && (
                <div className="mt-1 text-[10px] font-mono text-slate-700 font-semibold">
                  {testData.duration_ms}ms
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
