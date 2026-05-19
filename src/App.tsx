/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { TextLoop } from './components/ui/text-loop';
import { Cpu, Network, Shield } from 'lucide-react';

const HexagonGrid = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const innerMeshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Hexagon geometry properties
  const radius = 1;
  const innerRadius = 0.92; // Create a thin frame like a line
  const depth = 0.4;
  const gap = 0.02; // Small gap between hexes
  
  const width = Math.sqrt(3) * (radius + gap);
  const rowHeight = 1.5 * (radius + gap);

  // Grid dimensions (large enough to cover screen)
  const cols = 40;
  const rows = 35;
  const count = cols * rows;

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Custom geometry for a hexagon frame
  const hexGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const hole = new THREE.Path();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = innerRadius * Math.cos(angle);
      const y = innerRadius * Math.sin(angle);
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: false,
    });
    geometry.center();
    return geometry;
  }, [radius, innerRadius, depth]);

  // Custom geometry for the solid black fill
  const innerHexGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      // Make it slightly larger than innerRadius to avoid microscopic gaps
      const x = (innerRadius + 0.005) * Math.cos(angle);
      const y = (innerRadius + 0.005) * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 0.02, // slightly recessed
      bevelEnabled: false,
    });
    geometry.center();
    return geometry;
  }, [innerRadius, depth]);

  // Store positions and current z values for smooth animation
  const hexData = useMemo(() => {
    const data = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col - cols / 2) * width + (row % 2 === 1 ? width / 2 : 0);
        const y = (row - rows / 2) * rowHeight;
        data.push({ x, y, z: 0, targetZ: 0 });
      }
    }
    return data;
  }, [cols, rows, width, rowHeight]);

  // Set initial colors and positions
  useEffect(() => {
    if (!meshRef.current) return;
    const tempColor = new THREE.Color();
    let i = 0;
    
    for (const hex of hexData) {
      // Metallic base colors
      const shade = 0.15 + Math.random() * 0.1;
      tempColor.setScalar(shade);
      meshRef.current.setColorAt(i, tempColor);
      
      dummy.position.set(hex.x, hex.y, hex.z);
      dummy.rotation.set(0, 0, 0); // Flat on XY plane
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (innerMeshRef.current) {
        innerMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      i++;
    }
    
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (innerMeshRef.current) {
      innerMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [hexData, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;

    // We assume the grid is at Z=0. Raycast to find mouse intersection.
    const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.ray.intersectPlane(planeZ0, target);

    if (target) {
      if (lightRef.current) {
        // Move the neon light perfectly behind the hovered hexagon piece
        lightRef.current.position.lerp(new THREE.Vector3(target.x, target.y, -2.5), 0.1);
      }

      // Update hexagons
      let i = 0;
      for (const hex of hexData) {
        const dx = target.x - hex.x;
        const dy = target.y - hex.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Calculate target Z based on distance (gravitational pull effect)
        const maxDist = 8;
        if (dist < maxDist) {
          const intensity = Math.pow(1 - (dist / maxDist), 1.5); 
          hex.targetZ = intensity * 3.5; // Pop up to 3.5 units
        } else {
          hex.targetZ = 0;
        }

        // Lerp current Z to target Z smoothly
        hex.z = THREE.MathUtils.lerp(hex.z, hex.targetZ, 0.1);

        dummy.position.set(hex.x, hex.y, hex.z);
        // keep rotation flat
        dummy.rotation.set(0, 0, 0);
        
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        if (innerMeshRef.current) {
          innerMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        i++;
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (innerMeshRef.current) {
        innerMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <pointLight ref={lightRef} color="#b026ff" intensity={600} distance={20} decay={1.5} />
      
      <ambientLight intensity={0.2} color="#ffffff" />
      <directionalLight position={[10, 20, 15]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-10, -20, 15]} intensity={0.5} color="#b026ff" />
      
      {/* Background plane to catch the neon light */}
      <mesh position={[0, 0, -4]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#17171a" roughness={0.9} />
      </mesh>

      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <primitive object={hexGeometry} attach="geometry" />
        <meshStandardMaterial 
          color="#888899" 
          metalness={0.9} 
          roughness={0.1}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh ref={innerMeshRef} args={[undefined, undefined, count]}>
        <primitive object={innerHexGeometry} attach="geometry" />
        <meshStandardMaterial 
          color="#050508" 
          metalness={0.1} 
          roughness={0.9}
        />
      </instancedMesh>
    </>
  );
};

const FeaturesSection = () => {
  return (
    <div id="features" className="w-full max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 z-10 relative pointer-events-none">
      <div className="flex flex-col items-center text-center mb-16 md:mb-20 pointer-events-auto">
        <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-white drop-shadow-lg">
          Intelligent Infrastructure
        </h2>
        <p className="text-gray-400 max-w-2xl text-lg md:text-xl font-light">
          The Zentra Engine combines distributed networking with advanced predictive scaling to power modern applications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pointer-events-auto">
        <div className="bg-[#1a1a24]/80 border border-purple-500/10 rounded-3xl p-8 backdrop-blur-md hover:border-purple-500/50 hover:bg-[#1f1f2e]/90 transition-all duration-500 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors duration-500"></div>
          <div className="w-14 h-14 bg-purple-500/20 text-purple-400 flex items-center justify-center rounded-2xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(176,38,255,0.15)] group-hover:shadow-[0_0_25px_rgba(176,38,255,0.3)]">
            <Cpu size={28} />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4 tracking-wide group-hover:text-purple-300 transition-colors">Hyper-Scale Compute</h3>
          <p className="text-gray-400 leading-relaxed font-light">
            Automatically provision resources globally based on traffic patterns. Scale from zero to millions of requests in milliseconds without manual intervention.
          </p>
        </div>
        
        <div className="bg-[#1a1a24]/80 border border-fuchsia-500/10 rounded-3xl p-8 backdrop-blur-md hover:border-fuchsia-500/50 hover:bg-[#1f1f2e]/90 transition-all duration-500 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-fuchsia-500/20 transition-colors duration-500"></div>
          <div className="w-14 h-14 bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center rounded-2xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(217,70,239,0.15)] group-hover:shadow-[0_0_25px_rgba(217,70,239,0.3)]">
            <Network size={28} />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4 tracking-wide group-hover:text-fuchsia-300 transition-colors">Resilient Mesh Edge</h3>
          <p className="text-gray-400 leading-relaxed font-light">
            Self-healing network topography routes around outages instantly. Data is replicated automatically at the edge for sub-10ms global latency.
          </p>
        </div>

        <div className="bg-[#1a1a24]/80 border border-indigo-500/10 rounded-3xl p-8 backdrop-blur-md hover:border-indigo-500/50 hover:bg-[#1f1f2e]/90 transition-all duration-500 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors duration-500"></div>
          <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 flex items-center justify-center rounded-2xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.3)]">
            <Shield size={28} />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4 tracking-wide group-hover:text-indigo-300 transition-colors">Zero-Trust Security</h3>
          <p className="text-gray-400 leading-relaxed font-light">
            Hardware-backed enclaves and end-to-end encryption. Every request is isolated, verified, and rate-limited at the absolute boundary.
          </p>
        </div>
      </div>
    </div>
  );
};

const CodeIntegrationSection = () => {
  return (
    <div id="integration" className="w-full max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 z-10 relative pointer-events-none">
      <div className="flex flex-col lg:flex-row items-center gap-12 md:gap-16 pointer-events-auto">
        <div className="flex-1 w-full text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            Developer First
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-white drop-shadow-lg leading-tight">
            Deploy with a single command.
          </h2>
          <p className="text-gray-400 text-lg md:text-xl font-light mb-8 max-w-xl">
            Integrate the Zentra SDK in minutes. Our intelligent runtime handles the complexity of distributed state and global routing automatically.
          </p>
          <ul className="space-y-4 mb-10">
            {['Global state replication', 'Automatic failover routing', 'Edge-optimized computing'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {item}
              </li>
            ))}
          </ul>
          <button className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-full font-medium hover:bg-white/10 transition-colors backdrop-blur-md">
            View Documentation
          </button>
        </div>
        
        <div className="flex-1 w-full max-w-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-fuchsia-600/10 rounded-2xl blur-2xl transform rotate-3"></div>
          <div className="relative bg-[#0d0d12]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl font-mono text-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="ml-2 text-gray-500 text-xs">server.js</span>
            </div>
            
            <div className="space-y-1 overflow-x-auto text-gray-300">
              <div><span className="text-purple-400">import</span> {'{ Zentra }'} <span className="text-purple-400">from</span> <span className="text-green-400">'@zentra/sdk'</span>;</div>
              <div className="h-4"></div>
              <div><span className="text-gray-500">// Initialize cluster</span></div>
              <div><span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> Zentra({'{'}</div>
              <div className="pl-4">apiKey: process.env.<span className="text-blue-300">ZENTRA_KEY</span>,</div>
              <div className="pl-4">region: <span className="text-green-400">'global'</span></div>
              <div>{'});'}</div>
              <div className="h-4"></div>
              <div><span className="text-purple-400">await</span> client.deploy({'{'}</div>
              <div className="pl-4">name: <span className="text-green-400">'api-gateway'</span>,</div>
              <div className="pl-4">scale: <span className="text-orange-400">true</span>,</div>
              <div className="pl-4">regions: [<span className="text-green-400">'us-east'</span>, <span className="text-green-400">'eu-central'</span>, <span className="text-green-400">'ap-south'</span>]</div>
              <div>{'});'}</div>
              <div className="h-4"></div>
              <div>console.<span className="text-blue-300">log</span>(<span className="text-green-400">`🚀 Cluster deployed globally in 1.2s`</span>);</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsSection = () => {
  return (
    <div id="stats" className="w-full max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 z-10 relative pointer-events-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 pointer-events-auto">
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[#1a1a24]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
          <div className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-2">99.99<span className="text-purple-500 font-medium">%</span></div>
          <div className="text-gray-400 text-xs sm:text-sm tracking-wide uppercase mt-2">Uptime SLA</div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[#1a1a24]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
          <div className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-2">&lt;10<span className="text-fuchsia-500 font-medium">ms</span></div>
          <div className="text-gray-400 text-xs sm:text-sm tracking-wide uppercase mt-2">Global Latency</div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[#1a1a24]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
          <div className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-2">150<span className="text-indigo-500 font-medium">+</span></div>
          <div className="text-gray-400 text-xs sm:text-sm tracking-wide uppercase mt-2">Edge Locations</div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[#1a1a24]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
          <div className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-2">0<span className="text-purple-500 font-medium">ops</span></div>
          <div className="text-gray-400 text-xs sm:text-sm tracking-wide uppercase mt-2">Maintenance</div>
        </div>
      </div>
      
      <div className="mt-24 md:mt-40 text-center pointer-events-auto flex flex-col items-center">
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-medium mb-6 md:mb-8 text-white tracking-tight">Ready to scale?</h2>
        <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl font-light mb-8 md:mb-10 px-4 md:px-0">
          Join thousands of developers building fast, reliable applications on the Zentra Engine.
        </p>
        <button className="px-8 sm:px-10 py-3 sm:py-4 bg-white text-black rounded-full font-medium text-base sm:text-lg hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          Start for free
        </button>
      </div>
    </div>
  );
};

const Footer = () => {
  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur-xl mt-20 relative z-10 pointer-events-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-white text-xl tracking-[0.2em] flex items-center">
            <span className="font-light text-gray-400">ZEN</span>
            <span className="font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-fuchsia-500">TRA</span>
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-gray-300 transition-colors">Documentation</a>
          <a href="#" className="hover:text-gray-300 transition-colors">GitHub</a>
        </div>
        <div className="text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Zentra Systems, Inc.
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="w-screen min-h-screen bg-[#17171a] font-sans text-white overflow-x-hidden selection:bg-purple-500/30">
      {/* Background Canvas pinned to viewport */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 25], fov: 40 }} dpr={[1, 2]}>
          <Environment preset="city" />
          <HexagonGrid />
        </Canvas>
      </div>

      {/* Glassmorphism Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="relative w-8 h-8 flex items-center justify-center transition-transform duration-500 group-hover:rotate-90">
            <div className="absolute inset-0 border border-purple-400/50 rounded-sm transform rotate-45 group-hover:border-purple-300 transition-colors"></div>
            <div className="absolute inset-[6px] bg-gradient-to-br from-purple-400 to-fuchsia-600 rounded-sm shadow-[0_0_10px_rgba(176,38,255,0.5)]"></div>
          </div>
          <span className="text-white text-2xl tracking-[0.2em] flex items-center ml-1">
            <span className="font-light text-gray-300">ZEN</span>
            <span className="font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-fuchsia-500">TRA</span>
          </span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Solutions', 'Resources', 'Pricing'].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm text-gray-300 hover:text-purple-400 transition-colors tracking-wide relative group"
            >
              {link}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-purple-400 transition-all duration-300 group-hover:w-full"></span>
            </a>
          ))}
        </div>
        
        <div>
          <button className="px-4 py-1.5 md:px-6 md:py-2 text-sm md:text-base bg-white/5 hover:bg-white/10 text-purple-400 border border-purple-500/50 rounded-full backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_15px_rgba(176,38,255,0.5)] font-medium tracking-wide">
            Get Started
          </button>
        </div>
      </nav>

      {/* Scrollable Content Container */}
      <div className="relative z-10 w-full flex flex-col pt-24 pointer-events-none">
        {/* Hero Section */}
        <div className="min-h-[calc(100vh-6rem)] w-full flex flex-col items-center justify-center text-center px-6 pb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-8 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            Zentra Engine v2.0 is now live
          </div>
          
          <h1 className="font-sans font-normal text-4xl sm:text-5xl md:text-7xl text-white max-w-4xl tracking-tight leading-tight drop-shadow-2xl">
            Architecture for the <br className="hidden md:block" />
            <div className="font-medium h-[1.2em] flex justify-center items-start mt-1">
              <TextLoop interval={3} className="px-2 md:px-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 block pt-1 pb-2">next generation</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 block pt-1 pb-2">infinite scale</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 block pt-1 pb-2">intelligent mesh</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 block pt-1 pb-2">future compute</span>
              </TextLoop>
            </div>
          </h1>
          
          <p className="mt-6 text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl font-sans font-normal leading-relaxed">
            Scale your infrastructure dynamically. The Zentra platform provides a resilient, intelligent mesh network for high-performance applications.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-4 pointer-events-auto w-full sm:w-auto px-4 sm:px-0">
            <button className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white rounded-full font-medium transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(176,38,255,0.4)] w-full sm:w-auto">
              Start Building Free
            </button>
            <button className="px-8 py-3.5 bg-white/5 border border-white/10 text-white rounded-full font-medium hover:bg-white/10 transition-colors backdrop-blur-md w-full sm:w-auto">
              Read the Docs
            </button>
          </div>
        </div>

        {/* Features Overlay Section - Using glassmorphism/gradient overlay for smooth transition */}
        <div className="relative w-full">
          <FeaturesSection />
          <CodeIntegrationSection />
          <StatsSection />
        </div>
        <Footer />
      </div>
    </div>
  );
}
