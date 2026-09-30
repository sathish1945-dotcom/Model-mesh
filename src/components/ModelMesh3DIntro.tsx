import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ModelMesh3DIntroProps {
  onComplete: () => void;
  reducedMotion?: boolean;
}

export const ModelMesh3DIntro: React.FC<ModelMesh3DIntroProps> = ({
  onComplete,
  reducedMotion = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGLError, setHasWebGLError] = useState(false);
  const [phase, setPhase] = useState<'assembling' | 'settled' | 'fading'>('assembling');

  useEffect(() => {
    if (reducedMotion) {
      onComplete();
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let animId: number = 0;
    let isDisposed = false;

    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        100
      );
      camera.position.set(0, 0, 14);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);

      // Node target positions that form the woven ModelMesh "M" shape in 3D
      // Left pillar, left diagonal, central nexus, right diagonal, right pillar
      const targetPoints = [
        // Left pillar (bottom to top)
        new THREE.Vector3(-3.2, -2.4, 0),
        new THREE.Vector3(-3.2, -0.8, 0.2),
        new THREE.Vector3(-3.2, 0.8, 0.4),
        new THREE.Vector3(-3.2, 2.4, 0.6),

        // Left diagonal down to nexus
        new THREE.Vector3(-2.2, 1.2, 0.8),
        new THREE.Vector3(-1.1, -0.2, 1.0),
        new THREE.Vector3(0, -1.4, 1.2), // Central Nexus point

        // Right diagonal up from nexus
        new THREE.Vector3(1.1, -0.2, 1.0),
        new THREE.Vector3(2.2, 1.2, 0.8),

        // Right pillar (top to bottom)
        new THREE.Vector3(3.2, 2.4, 0.6),
        new THREE.Vector3(3.2, 0.8, 0.4),
        new THREE.Vector3(3.2, -0.8, 0.2),
        new THREE.Vector3(3.2, -2.4, 0),

        // Floating accent satellite nodes that weave through
        new THREE.Vector3(-1.8, 2.4, 0.3),
        new THREE.Vector3(1.8, 2.4, 0.3),
      ];

      // Create random scattered spawn positions in depth (Z range -12 to 10)
      const startPoints = targetPoints.map((_, i) => {
        const angle = (i / targetPoints.length) * Math.PI * 2;
        const radius = 6 + (i % 3) * 2;
        return new THREE.Vector3(
          Math.cos(angle) * radius * 1.5,
          Math.sin(angle) * radius * 1.2,
          -10 + (i % 5) * 4
        );
      });

      // Group holding the entire mesh
      const meshGroup = new THREE.Group();
      scene.add(meshGroup);

      // Node geometry & luminous materials
      const sphereGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const nexusGeo = new THREE.SphereGeometry(0.32, 24, 24);

      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1, // Indigo
        emissive: 0x4338ca,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
      });

      const nexusMat = new THREE.MeshStandardMaterial({
        color: 0x818cf8, // Bright violet-indigo nexus
        emissive: 0x6366f1,
        emissiveIntensity: 1.4,
        roughness: 0.1,
        metalness: 0.9,
      });

      const accentMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8, // Sky cyan accent
        emissive: 0x0284c7,
        emissiveIntensity: 1.0,
        roughness: 0.2,
        metalness: 0.8,
      });

      const nodeMeshes: THREE.Mesh[] = [];
      targetPoints.forEach((_, i) => {
        const isNexus = i === 6;
        const isAccent = i >= 13;
        const geo = isNexus ? nexusGeo : sphereGeo;
        const mat = isNexus ? nexusMat : isAccent ? accentMat : nodeMat;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(startPoints[i]);
        meshGroup.add(mesh);
        nodeMeshes.push(mesh);
      });

      // Dynamic Connecting Lines
      const lineIndices = [
        [0, 1], [1, 2], [2, 3], // Left pillar
        [3, 4], [4, 5], [5, 6], // Left diagonal to nexus
        [6, 7], [7, 8], [8, 9], // Right diagonal from nexus
        [9, 10], [10, 11], [11, 12], // Right pillar
        [3, 13], [13, 8], // Upper weave bridges
        [9, 14], [14, 4],
        [0, 6], [12, 6], // Ground stability ties
      ];

      const lineMat = new THREE.LineBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0,
        linewidth: 1,
      });

      const lineGeos: THREE.BufferGeometry[] = [];
      const lines: THREE.Line[] = [];

      lineIndices.forEach(([fromIdx, toIdx]) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
          startPoints[fromIdx],
          startPoints[toIdx],
        ]);
        const line = new THREE.Line(geo, lineMat.clone());
        meshGroup.add(line);
        lineGeos.push(geo);
        lines.push(line);
      });

      // Lighting: Key, fill, and a dramatic moving specular light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xa5b4fc, 1.2);
      dirLight.position.set(5, 5, 8);
      scene.add(dirLight);

      // Sweeping specular point light
      const sweepLight = new THREE.PointLight(0x38bdf8, 2.5, 20);
      sweepLight.position.set(-10, 2, 4);
      scene.add(sweepLight);

      // Animation parameters
      const startTime = performance.now();
      const assembleDuration = 1400; // ms
      let lightSweepStarted = false;

      const animate = (now: number) => {
        if (isDisposed) return;
        animId = requestAnimationFrame(animate);

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / assembleDuration, 1);

        // Smooth cubic ease-out for node travel
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Interpolate node positions from startPoints to targetPoints
        nodeMeshes.forEach((mesh, i) => {
          mesh.position.lerpVectors(startPoints[i], targetPoints[i], easeOut);
        });

        // Update line geometries and opacity
        const lineOpacity = Math.max(0, (progress - 0.25) / 0.75) * 0.75;
        lines.forEach((line, i) => {
          const [fromIdx, toIdx] = lineIndices[i];
          const positions = line.geometry.attributes.position.array as Float32Array;
          positions[0] = nodeMeshes[fromIdx].position.x;
          positions[1] = nodeMeshes[fromIdx].position.y;
          positions[2] = nodeMeshes[fromIdx].position.z;
          positions[3] = nodeMeshes[toIdx].position.x;
          positions[4] = nodeMeshes[toIdx].position.y;
          positions[5] = nodeMeshes[toIdx].position.z;
          line.geometry.attributes.position.needsUpdate = true;
          (line.material as THREE.LineBasicMaterial).opacity = lineOpacity;
        });

        // When assembled, settle into gentle 3D rotation and sweep specular light across
        if (progress >= 1) {
          if (!lightSweepStarted) {
            lightSweepStarted = true;
            setPhase('settled');
          }
          const postElapsed = (elapsed - assembleDuration) * 0.001;
          meshGroup.rotation.y = Math.sin(postElapsed * 1.2) * 0.18;
          meshGroup.rotation.x = Math.cos(postElapsed * 0.9) * 0.08;

          // Sweeping specular beam across the assembled logo
          sweepLight.position.x = -6 + postElapsed * 7.5;
          sweepLight.position.y = Math.sin(postElapsed * 2) * 1.5;
        } else {
          meshGroup.rotation.y = (1 - easeOut) * 0.6;
          meshGroup.rotation.x = (1 - easeOut) * 0.3;
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };

      animId = requestAnimationFrame(animate);

      // Handle window resize
      const handleResize = () => {
        if (!container || !camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', handleResize);

      // Stage progression timers
      // 1800ms: Begin subtle camera pull/fade
      // 2500ms: Complete and hand over to app
      const tFade = setTimeout(() => {
        setPhase('fading');
      }, 1900);

      const tDone = setTimeout(() => {
        onComplete();
      }, 2500);

      return () => {
        isDisposed = true;
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', handleResize);
        clearTimeout(tFade);
        clearTimeout(tDone);
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
        lineGeos.forEach((geo) => geo.dispose());
        sphereGeo.dispose();
        nexusGeo.dispose();
        nodeMat.dispose();
        nexusMat.dispose();
        accentMat.dispose();
      };
    } catch (err) {
      console.warn('[ModelMesh 3D Intro] WebGL context unavailable, using CSS fallback:', err);
      setHasWebGLError(true);
    }
  }, [onComplete, reducedMotion]);

  if (hasWebGLError) {
    return null; // Fallback will render parent's high-fidelity CSS logo
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-600 ease-out ${
        phase === 'fading' ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    />
  );
};
