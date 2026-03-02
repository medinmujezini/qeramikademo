/**
 * Isometric 3D MEP View
 * 
 * Three.js-based 3D visualization of MEP routing showing pipes, fixtures,
 * and infrastructure nodes in an isometric perspective.
 * 
 * Features:
 * - Realistic pipe fittings (elbows, tees, wyes, reducers)
 * - Drainage uses double 45° elbows instead of 90° (industry standard)
 * - Material-specific rendering (PVC, Copper, PEX)
 */

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { MEPFixture, MEPRoute, MEPNode, MEPSegment, MEPSystemType, FittingType } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';
import type { Wall, Point } from '@/types/floorPlan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// TYPES
// =============================================================================

interface IsometricMEPViewProps {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  roomWidth: number;
  roomHeight: number;
  floorHeight?: number;
  ceilingHeight?: number;  // Actual ceiling height in cm (from floor plan)
  walls?: Wall[];
  points?: Point[];
}

interface ProcessedSegment extends MEPSegment {
  fittingAtEnd?: FittingType;
  fittingRotation?: [number, number, number];
}

interface FittingInfo {
  type: FittingType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  pipeRadius: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// Scale factor to convert from 2D canvas units to 3D units
const SCALE = 0.01; // 1 canvas unit = 0.01 3D units

// Calculate angle between two direction vectors
function calculateAngle(dir1: { x: number; y: number }, dir2: { x: number; y: number }): number {
  const dot = dir1.x * dir2.x + dir1.y * dir2.y;
  const mag1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
  const mag2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// Get material properties based on pipe material type
function getMaterialProps(material: string): { metalness: number; roughness: number; color?: string } {
  switch (material?.toLowerCase()) {
    case 'copper':
      return { metalness: 0.8, roughness: 0.3, color: '#b87333' };
    case 'pex':
      return { metalness: 0.1, roughness: 0.8 };
    case 'cpvc':
      return { metalness: 0.1, roughness: 0.7 };
    case 'cast-iron':
      return { metalness: 0.6, roughness: 0.5, color: '#3a3a3a' };
    case 'pvc':
    default:
      return { metalness: 0.2, roughness: 0.6 };
  }
}

// =============================================================================
// 3D FITTING COMPONENTS
// =============================================================================

interface FittingMeshProps {
  type: FittingType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  pipeRadius: number;
  color: THREE.Color;
  material?: string;
}

/**
 * 45-degree elbow fitting - used in pairs for drainage
 */
function Elbow45Mesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const bendRadius = pipeRadius * 2.5;
  const matProps = getMaterialProps(material || 'pvc');
  
  return (
    <group position={position} rotation={rotation}>
      {/* Torus segment for 45° bend */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[bendRadius, pipeRadius, 12, 8, Math.PI / 4]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Hub ends for realistic look */}
      <mesh position={[bendRadius, 0, 0]}>
        <cylinderGeometry args={[pipeRadius * 1.15, pipeRadius * 1.15, pipeRadius * 0.3, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * 90-degree elbow fitting - used for water lines, NOT drainage
 */
function Elbow90Mesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const bendRadius = pipeRadius * 2;
  const matProps = getMaterialProps(material || 'pvc');
  
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[bendRadius, pipeRadius, 12, 12, Math.PI / 2]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Socket ends */}
      <mesh position={[bendRadius, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.2, pipeRadius * 1.2, pipeRadius * 0.4, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      <mesh position={[0, 0, bendRadius]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[pipeRadius * 1.2, pipeRadius * 1.2, pipeRadius * 0.4, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Tee fitting - for branch connections
 */
function TeeMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  const bodyLength = pipeRadius * 4;
  
  return (
    <group position={position} rotation={rotation}>
      {/* Main run */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.1, pipeRadius * 1.1, bodyLength, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Branch connection (perpendicular) */}
      <mesh position={[0, pipeRadius * 1.5, 0]}>
        <cylinderGeometry args={[pipeRadius * 1.05, pipeRadius * 1.05, pipeRadius * 3, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Wye fitting - 45° branch for drainage (proper sweep for flow)
 */
function WyeMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  const bodyLength = pipeRadius * 5;
  
  return (
    <group position={position} rotation={rotation}>
      {/* Main run */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.1, pipeRadius * 1.1, bodyLength, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* 45° branch */}
      <mesh position={[pipeRadius, pipeRadius * 1.2, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[pipeRadius * 1.0, pipeRadius * 1.0, pipeRadius * 3, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Sanitary Tee - drainage fitting with curved internal sweep
 */
function SanitaryTeeMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  const bodyLength = pipeRadius * 4.5;
  
  return (
    <group position={position} rotation={rotation}>
      {/* Main vertical run */}
      <mesh>
        <cylinderGeometry args={[pipeRadius * 1.15, pipeRadius * 1.15, bodyLength, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Swept branch with curve */}
      <mesh position={[pipeRadius * 1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.0, pipeRadius * 1.0, pipeRadius * 2.5, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Sweep transition */}
      <mesh position={[pipeRadius * 0.5, -pipeRadius * 0.3, 0]} rotation={[0, 0, Math.PI / 6]}>
        <torusGeometry args={[pipeRadius * 0.8, pipeRadius * 0.9, 8, 6, Math.PI / 3]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Reducer fitting - pipe size transition
 */
function ReducerMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'> & { reducedRadius?: number }) {
  const matProps = getMaterialProps(material || 'pvc');
  const reducedRadius = pipeRadius * 0.75;
  
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[reducedRadius, pipeRadius, pipeRadius * 2, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Cleanout fitting - access point for maintenance
 */
function CleanoutMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  
  return (
    <group position={position} rotation={rotation}>
      {/* Tee body */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.1, pipeRadius * 1.1, pipeRadius * 4, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Cleanout plug (brass color) */}
      <mesh position={[0, pipeRadius * 2, 0]}>
        <cylinderGeometry args={[pipeRadius * 0.9, pipeRadius * 1.1, pipeRadius * 1.5, 12]} />
        <meshStandardMaterial 
          color="#c9a227"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      {/* Square nut on top */}
      <mesh position={[0, pipeRadius * 2.8, 0]}>
        <boxGeometry args={[pipeRadius * 1.4, pipeRadius * 0.4, pipeRadius * 1.4]} />
        <meshStandardMaterial 
          color="#c9a227"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * P-Trap fitting
 */
function PTrapMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  
  return (
    <group position={position} rotation={rotation}>
      {/* U-bend using two torus sections */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[pipeRadius * 2, pipeRadius, 12, 12, Math.PI]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Inlet leg */}
      <mesh position={[-pipeRadius * 2, pipeRadius * 1.5, 0]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, pipeRadius * 3, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Outlet leg */}
      <mesh position={[pipeRadius * 2, pipeRadius * 1.5, 0]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, pipeRadius * 3, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Coupling fitting - joins two pipes of same size
 */
function CouplingMesh({ position, rotation, pipeRadius, color, material }: Omit<FittingMeshProps, 'type'>) {
  const matProps = getMaterialProps(material || 'pvc');
  
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[pipeRadius * 1.25, pipeRadius * 1.25, pipeRadius * 2, 12]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
      {/* Center ring detail */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[pipeRadius * 1.3, pipeRadius * 0.1, 8, 16]} />
        <meshStandardMaterial 
          color={matProps.color ? new THREE.Color(matProps.color) : color}
          metalness={matProps.metalness}
          roughness={matProps.roughness}
        />
      </mesh>
    </group>
  );
}

/**
 * Universal fitting renderer
 */
function FittingMesh({ type, position, rotation, pipeRadius, color, material }: FittingMeshProps) {
  const props = { position, rotation, pipeRadius, color, material };
  
  switch (type) {
    case 'elbow-45':
      return <Elbow45Mesh {...props} />;
    case 'elbow-90':
      return <Elbow90Mesh {...props} />;
    case 'tee':
      return <TeeMesh {...props} />;
    case 'wye':
      return <WyeMesh {...props} />;
    case 'sanitary-tee':
      return <SanitaryTeeMesh {...props} />;
    case 'reducer':
      return <ReducerMesh {...props} />;
    case 'cleanout':
      return <CleanoutMesh {...props} />;
    case 'p-trap':
      return <PTrapMesh {...props} />;
    case 'coupling':
      return <CouplingMesh {...props} />;
    default:
      // Fallback sphere for unknown fittings
      return (
        <mesh position={position}>
          <sphereGeometry args={[pipeRadius * 1.4, 12, 12]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
        </mesh>
      );
  }
}

// =============================================================================
// PIPE ROUTE COMPONENT
// =============================================================================

interface PipeRouteProps {
  route: MEPRoute;
  scale: number;
}

/**
 * Detect fitting type based on angle between segments
 */
function detectFittingType(
  prevDir: { x: number; y: number; z: number },
  currDir: { x: number; y: number; z: number },
  systemType: MEPSystemType
): FittingType {
  const angle = calculateAngle(
    { x: prevDir.x, y: prevDir.y },
    { x: currDir.x, y: currDir.y }
  );
  
  // For drainage, always use 45° elbows (rendered as pairs)
  if (systemType === 'drainage' || systemType === 'vent') {
    if (angle >= 80 && angle <= 100) {
      return 'elbow-45'; // Will be rendered as two 45s
    } else if (angle >= 40 && angle <= 50) {
      return 'elbow-45';
    }
  }
  
  // For water and electrical, use 90° elbows
  if (angle >= 80 && angle <= 100) {
    return 'elbow-90';
  } else if (angle >= 40 && angle <= 50) {
    return 'elbow-45';
  }
  
  return 'coupling';
}

/**
 * Calculate rotation for fitting based on pipe directions
 */
function calculateFittingRotation(
  prevDir: { x: number; y: number; z: number },
  currDir: { x: number; y: number; z: number }
): THREE.Euler {
  const angle = Math.atan2(prevDir.y, prevDir.x);
  return new THREE.Euler(0, -angle, 0);
}

function PipeRoute({ route, scale }: PipeRouteProps) {
  const systemColor = hexToThreeColor(SYSTEM_COLORS[route.systemType]);
  const tubeRadius = Math.max(0.015, (route.requiredSize || 2) * scale * 0.4);
  const isDrainage = route.systemType === 'drainage' || route.systemType === 'vent';
  
  // Process segments and detect fittings
  const { segments, fittings } = useMemo(() => {
    const processedSegments: Array<{
      start: THREE.Vector3;
      end: THREE.Vector3;
      material: string;
    }> = [];
    const detectedFittings: FittingInfo[] = [];
    
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      const start = new THREE.Vector3(
        segment.startPoint.x * scale,
        (segment.startPoint.z || 0.1) * scale,
        segment.startPoint.y * scale
      );
      const end = new THREE.Vector3(
        segment.endPoint.x * scale,
        (segment.endPoint.z || 0.1) * scale,
        segment.endPoint.y * scale
      );
      
      processedSegments.push({ start, end, material: segment.material });
      
      // Detect fitting at junction between segments
      if (i > 0) {
        const prevSeg = route.segments[i - 1];
        const prevDir = {
          x: prevSeg.endPoint.x - prevSeg.startPoint.x,
          y: prevSeg.endPoint.y - prevSeg.startPoint.y,
          z: (prevSeg.endPoint.z || 0) - (prevSeg.startPoint.z || 0),
        };
        const currDir = {
          x: segment.endPoint.x - segment.startPoint.x,
          y: segment.endPoint.y - segment.startPoint.y,
          z: (segment.endPoint.z || 0) - (segment.startPoint.z || 0),
        };
        
        const angle = calculateAngle({ x: prevDir.x, y: prevDir.y }, { x: currDir.x, y: currDir.y });
        
        // Only add fitting if there's a significant direction change
        if (angle > 30) {
          const fittingType = detectFittingType(prevDir, currDir, route.systemType);
          const fittingRotation = calculateFittingRotation(prevDir, currDir);
          
          // For drainage 90° turns, add two 45° elbows
          if (isDrainage && angle >= 80 && angle <= 100) {
            // First 45° elbow
            const midpoint1 = start.clone().lerp(end, 0.3);
            detectedFittings.push({
              type: 'elbow-45',
              position: midpoint1,
              rotation: fittingRotation,
              pipeRadius: tubeRadius,
            });
            
            // Second 45° elbow
            const midpoint2 = start.clone().lerp(end, 0.7);
            detectedFittings.push({
              type: 'elbow-45',
              position: midpoint2,
              rotation: new THREE.Euler(fittingRotation.x, fittingRotation.y + Math.PI / 4, fittingRotation.z),
              pipeRadius: tubeRadius,
            });
          } else {
            detectedFittings.push({
              type: fittingType,
              position: start,
              rotation: fittingRotation,
              pipeRadius: tubeRadius,
            });
          }
        }
      }
    }
    
    return { segments: processedSegments, fittings: detectedFittings };
  }, [route.segments, scale, tubeRadius, isDrainage]);

  if (segments.length === 0) return null;

  return (
    <group>
      {/* Render each pipe segment */}
      {segments.map((seg, i) => {
        const direction = seg.end.clone().sub(seg.start);
        const length = direction.length();
        const midpoint = seg.start.clone().add(seg.end).multiplyScalar(0.5);
        
        // Calculate rotation to align cylinder with direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.normalize()
        );
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        
        const matProps = getMaterialProps(seg.material);
        
        return (
          <mesh key={i} position={midpoint} rotation={euler}>
            <cylinderGeometry args={[tubeRadius, tubeRadius, length, 12]} />
            <meshStandardMaterial 
              color={matProps.color ? new THREE.Color(matProps.color) : systemColor}
              metalness={matProps.metalness}
              roughness={matProps.roughness}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}
      
      {/* Render fittings at junctions */}
      {fittings.map((fitting, i) => (
        <FittingMesh
          key={`fitting-${i}`}
          type={fitting.type}
          position={fitting.position}
          rotation={fitting.rotation}
          pipeRadius={fitting.pipeRadius}
          color={systemColor}
          material={segments[0]?.material}
        />
      ))}
      
      {/* End caps */}
      {segments.length > 0 && (
        <>
          <mesh position={segments[0].start}>
            <sphereGeometry args={[tubeRadius * 1.1, 8, 8]} />
            <meshStandardMaterial color={systemColor} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={segments[segments.length - 1].end}>
            <sphereGeometry args={[tubeRadius * 1.1, 8, 8]} />
            <meshStandardMaterial color={systemColor} metalness={0.3} roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

// =============================================================================
// FIXTURE AND NODE COMPONENTS
// =============================================================================

interface FixtureMeshProps {
  fixture: MEPFixture;
  scale: number;
}

function FixtureMesh({ fixture, scale }: FixtureMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const position = new THREE.Vector3(
    fixture.position.x * scale,
    0.15,
    fixture.position.y * scale
  );
  
  const size = {
    width: fixture.dimensions.width * scale,
    height: fixture.dimensions.height * scale,
    depth: fixture.dimensions.depth * scale,
  };

  const getFixtureColor = () => {
    switch (fixture.type) {
      case 'toilet': return '#e8e8e8';
      case 'sink': return '#f0f0f0';
      case 'kitchen-sink': return '#e0e0e0';
      case 'shower': return '#d0e8ff';
      case 'bathtub': return '#ffffff';
      case 'dishwasher': return '#a0a0a0';
      case 'washing-machine': return '#909090';
      case 'floor-drain': return '#606060';
      case 'utility-sink': return '#c0c0c0';
      case 'bidet': return '#f5f5f5';
      case 'garbage-disposal': return '#707070';
      case 'hose-bib': return '#808080';
      default: return '#cccccc';
    }
  };

  return (
    <group position={position} rotation={[0, -fixture.rotation * Math.PI / 180, 0]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[size.width, size.height, size.depth]} />
        <meshStandardMaterial 
          color={getFixtureColor()} 
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {fixture.connections.map((conn, i) => (
        <mesh
          key={i}
          position={[
            conn.localPosition.x * scale,
            conn.localPosition.z * scale || 0,
            conn.localPosition.y * scale
          ]}
        >
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial 
            color={hexToThreeColor(SYSTEM_COLORS[conn.systemType])}
            emissive={hexToThreeColor(SYSTEM_COLORS[conn.systemType])}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      
      <Text
        position={[0, size.height + 0.1, 0]}
        fontSize={0.1}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.005}
        outlineColor="#000000"
      >
        {fixture.name}
      </Text>
    </group>
  );
}

interface NodeMeshProps {
  node: MEPNode;
  scale: number;
  ceilingHeight?: number;
}

/**
 * Vertical Stack Mesh - prominent vertical pipes for drain/vent stacks
 * Enhanced with visible connection hubs, floor penetrations, and better contrast
 * Now uses ceilingHeight for proper stack top elevation
 */
function VerticalStackMesh({ node, scale, ceilingHeight = 280 }: NodeMeshProps) {
  const stackProps = node.stackProperties;
  
  if (!stackProps) {
    // Fallback to regular node rendering if no stack properties
    return <RegularNodeMesh node={node} scale={scale} ceilingHeight={ceilingHeight} />;
  }
  
  const bottomY = stackProps.bottomElevation * scale;
  // Use ceiling height for top if penetrating ceiling
  const actualTopElevation = node.penetratesCeiling 
    ? Math.max(stackProps.topElevation, ceilingHeight + 30)  // Extend 30cm through roof
    : stackProps.topElevation;
  const topY = actualTopElevation * scale;
  const height = topY - bottomY;
  const radius = (stackProps.diameter / 2) * scale * 4; // Increased visual scale for better visibility
  
  const position = new THREE.Vector3(
    node.position.x * scale,
    bottomY + height / 2,
    node.position.y * scale
  );
  
  // Enhanced stack colors based on type - more visible colors
  const isDrainStack = node.type === 'drain-stack' || node.type === 'wet-vent-stack';
  const stackColor = isDrainStack ? '#3d4f5f' : '#5a6b7c'; // Lighter grays for better visibility
  const accentColor = isDrainStack ? SYSTEM_COLORS['drainage'] : SYSTEM_COLORS['vent'];
  const hubColor = isDrainStack ? '#4a6572' : '#607d8b';
  
  // Number of connection hubs based on stack height
  const hubCount = Math.max(2, Math.floor(height / 0.8));
  const hubPositions = Array.from({ length: hubCount }, (_, i) => 
    bottomY + height * ((i + 1) / (hubCount + 1))
  );
  
  return (
    <group>
      {/* Floor/Slab penetration indicator at base */}
      <mesh position={[position.x, bottomY - 0.02, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.8, radius * 2, 32]} />
        <meshStandardMaterial 
          color="#8b5a2b" 
          metalness={0.2} 
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Under-slab pipe extension (going into ground) */}
      <mesh position={[position.x, bottomY - 0.15, position.z]} castShadow>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.3, 24]} />
        <meshStandardMaterial 
          color="#2a3a40"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>
      
      {/* Main stack cylinder with gradient-like sections */}
      <mesh position={position} castShadow>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial 
          color={stackColor}
          metalness={0.15}
          roughness={0.7}
        />
      </mesh>
      
      {/* Stack outer highlight for depth */}
      <mesh position={position}>
        <cylinderGeometry args={[radius * 1.02, radius * 1.02, height, 32, 1, true]} />
        <meshStandardMaterial 
          color={accentColor}
          metalness={0.3}
          roughness={0.5}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Stack base/cleanout (brass color) with more detail */}
      <group position={[position.x, bottomY, position.z]}>
        {/* Base flange */}
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[radius * 1.5, radius * 1.5, 0.04, 24]} />
          <meshStandardMaterial color="#5c4033" metalness={0.3} roughness={0.7} />
        </mesh>
        {/* Cleanout body */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[radius * 1.3, radius * 1.4, 0.08, 24]} />
          <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Square cleanout plug */}
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[radius * 1.8, 0.04, radius * 1.8]} />
          <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      
      {/* Connection hubs along the stack (where branches connect) */}
      {hubPositions.map((hubY, i) => (
        <group key={`hub-${i}`} position={[position.x, hubY, position.z]}>
          {/* Hub ring */}
          <mesh>
            <cylinderGeometry args={[radius * 1.25, radius * 1.25, 0.06, 24]} />
            <meshStandardMaterial 
              color={hubColor}
              metalness={0.2}
              roughness={0.6}
            />
          </mesh>
          {/* Connection stub (sanitary tee inlet) */}
          <mesh position={[radius * 1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius * 0.6, radius * 0.6, radius * 0.6, 16]} />
            <meshStandardMaterial 
              color={hubColor}
              metalness={0.2}
              roughness={0.6}
            />
          </mesh>
          {/* Glowing connection point */}
          <mesh position={[radius * 1.4, 0, 0]}>
            <sphereGeometry args={[radius * 0.4, 12, 12]} />
            <meshStandardMaterial 
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={0.5}
              metalness={0.3}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
      
      {/* Accent rings (floor level indicators) */}
      {[0.25, 0.5, 0.75].map((ratio, i) => (
        <mesh key={`ring-${i}`} position={[position.x, bottomY + height * ratio, position.z]}>
          <torusGeometry args={[radius * 1.08, 0.015, 8, 32]} />
          <meshStandardMaterial 
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={0.3}
            metalness={0.4}
            roughness={0.4}
          />
        </mesh>
      ))}
      
      {/* Vent cap at top (if vent termination) - enhanced */}
      {stackProps.isVentTermination && (
        <group position={[position.x, topY, position.z]}>
          {/* Roof flashing */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[radius * 2, radius * 2.2, 0.04, 32]} />
            <meshStandardMaterial color="#505050" metalness={0.5} roughness={0.6} />
          </mesh>
          {/* Pipe extension through roof */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.16, 24]} />
            <meshStandardMaterial color={stackColor} metalness={0.2} roughness={0.7} />
          </mesh>
          {/* Vent cap base */}
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[radius * 1.3, radius * 1.1, 0.06, 24]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* Rain cap / weather cap */}
          <mesh position={[0, 0.26, 0]}>
            <coneGeometry args={[radius * 1.5, 0.1, 24]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Cap support ring */}
          <mesh position={[0, 0.22, 0]}>
            <torusGeometry args={[radius * 1.2, 0.02, 8, 24]} />
            <meshStandardMaterial color="#4a4a4a" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      )}
      
      {/* Label with background for better readability */}
      <Text
        position={[position.x + radius + 0.2, topY + 0.12, position.z]}
        fontSize={0.1}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
        fontWeight="bold"
      >
        {node.name}
      </Text>
      
      {/* Capacity indicator */}
      {node.capacity && (
        <Text
          position={[position.x + radius + 0.2, topY - 0.02, position.z]}
          fontSize={0.065}
          color="#aaaaaa"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {`${stackProps.diameter}" dia • ${node.capacity} DFU`}
        </Text>
      )}
    </group>
  );
}

/**
 * Regular node mesh for non-stack nodes
 * Now uses ceilingHeight for ceiling-mounted positioning
 */
function RegularNodeMesh({ node, scale, ceilingHeight = 280 }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
  });
  
  // Calculate Y position based on mounting type
  let yPosition: number;
  switch (node.mountingType) {
    case 'ceiling':
      yPosition = (ceilingHeight - (node.heightFromCeiling ?? 0)) * scale;
      break;
    case 'underground':
      yPosition = -0.08; // Below floor
      break;
    case 'wall':
      yPosition = (node.heightFromFloor ?? 150) * scale;
      break;
    case 'floor':
    default:
      yPosition = (node.heightFromFloor ?? node.position.z) * scale || 0.1;
      break;
  }
  
  const position = new THREE.Vector3(
    node.position.x * scale,
    yPosition,
    node.position.y * scale
  );

  const getNodeColor = () => {
    if (node.type.includes('water') && node.type.includes('heater')) return SYSTEM_COLORS['hot-water'];
    if (node.type.includes('water')) return SYSTEM_COLORS['cold-water'];
    if (node.type.includes('drain') || node.type.includes('vent')) return SYSTEM_COLORS['drainage'];
    if (node.type.includes('electric')) return SYSTEM_COLORS['power'];
    return '#888888';
  };

  const getNodeSize = () => {
    if (node.type.includes('heater')) return 0.2;
    if (node.type.includes('panel')) return 0.18;
    return 0.12;
  };

  // Determine if this is a water heater for special rendering
  const isWaterHeater = node.type === 'water-heater';
  const isCeilingMounted = node.mountingType === 'ceiling';
  
  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <cylinderGeometry args={[getNodeSize(), getNodeSize(), 0.3, 16]} />
        <meshStandardMaterial 
          color={hexToThreeColor(getNodeColor())}
          metalness={0.5}
          roughness={0.4}
          emissive={hexToThreeColor(getNodeColor())}
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Direction indicator arrow showing where pipes connect */}
      {isWaterHeater && (
        <mesh 
          position={[0, isCeilingMounted ? -0.25 : 0.25, 0]} 
          rotation={[isCeilingMounted ? Math.PI : 0, 0, 0]}
        >
          <coneGeometry args={[0.06, 0.12, 8]} />
          <meshStandardMaterial 
            color="#4caf50" 
            emissive="#4caf50" 
            emissiveIntensity={0.6}
          />
        </mesh>
      )}
      
      {/* Connection point indicators for ceiling-mounted nodes */}
      {isCeilingMounted && isWaterHeater && (
        <group position={[0, -0.18, 0]}>
          {/* Cold inlet point */}
          <mesh position={[-0.08, 0, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial 
              color={SYSTEM_COLORS['cold-water']}
              emissive={SYSTEM_COLORS['cold-water']}
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Hot outlet point */}
          <mesh position={[0.08, 0, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial 
              color={SYSTEM_COLORS['hot-water']}
              emissive={SYSTEM_COLORS['hot-water']}
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      )}
      
      {/* Ceiling mount bracket visualization */}
      {isCeilingMounted && (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.15, 0.04, 0.15]} />
          <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      
      <Text
        position={[0, 0.35, 0]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.008}
        outlineColor="#000000"
      >
        {node.name}
      </Text>
      
      {/* Mounting type label for ceiling-mounted */}
      {isCeilingMounted && (
        <Text
          position={[0, -0.35, 0]}
          fontSize={0.05}
          color="#ffb74d"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          ↓ Ceiling Mount
        </Text>
      )}
    </group>
  );
}

/**
 * Smart node renderer - uses VerticalStackMesh for stacks, RegularNodeMesh for others
 * Passes ceilingHeight for proper positioning based on mounting type
 */
function NodeMesh({ node, scale, ceilingHeight = 280 }: NodeMeshProps) {
  const isStack = ['drain-stack', 'vent-stack', 'wet-vent-stack'].includes(node.type);
  
  if (isStack) {
    return <VerticalStackMesh node={node} scale={scale} ceilingHeight={ceilingHeight} />;
  }
  
  return <RegularNodeMesh node={node} scale={scale} ceilingHeight={ceilingHeight} />;
}

// =============================================================================
// INFRASTRUCTURE CONNECTORS (Water Main Input / Sewer Output)
// =============================================================================

interface InfrastructureConnectorProps {
  type: 'water-main' | 'sewer-output';
  position: THREE.Vector3;
  rotation?: number; // Y-axis rotation in radians
  scale: number;
  label?: string;
}

/**
 * Water Main Input - Shows where city water enters the building
 */
function WaterMainConnector({ position, rotation = 0, scale, label = 'City Water Main' }: Omit<InfrastructureConnectorProps, 'type'>) {
  const pipeRadius = 0.06;
  const pipeLength = 0.5;
  
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Underground pipe coming from street */}
      <mesh position={[-pipeLength / 2, -0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, pipeLength, 16]} />
        <meshStandardMaterial 
          color="#1565c0"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
      
      {/* Ground penetration ring */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[pipeRadius * 0.8, pipeRadius * 2.5, 24]} />
        <meshStandardMaterial 
          color="#5d4037"
          metalness={0.1}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Vertical riser from ground */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[pipeRadius * 0.9, pipeRadius * 0.9, 0.24, 16]} />
        <meshStandardMaterial 
          color="#2196f3"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      
      {/* Main shutoff valve */}
      <group position={[0, 0.28, 0]}>
        {/* Valve body */}
        <mesh>
          <cylinderGeometry args={[pipeRadius * 1.4, pipeRadius * 1.4, 0.08, 16]} />
          <meshStandardMaterial color="#f9a825" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Valve handle */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.12, 0.02, 0.025]} />
          <meshStandardMaterial color="#d32f2f" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Handle stem */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
          <meshStandardMaterial color="#757575" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      
      {/* Meter */}
      <group position={[0, 0.42, 0]}>
        <mesh>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
          <meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* Meter dial */}
        <mesh position={[0, 0, 0.035]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.2} roughness={0.6} />
        </mesh>
      </group>
      
      {/* Pipe continuing into building */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[pipeRadius * 0.9, pipeRadius * 0.9, 0.2, 16]} />
        <meshStandardMaterial 
          color={SYSTEM_COLORS['cold-water']}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      
      {/* Glowing indicator showing active supply */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[pipeRadius * 0.6, 12, 12]} />
        <meshStandardMaterial 
          color="#2196f3"
          emissive="#2196f3"
          emissiveIntensity={0.8}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Direction arrow showing flow */}
      <mesh position={[0, 0.52, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.025, 0.05, 8]} />
        <meshStandardMaterial color="#4caf50" emissive="#4caf50" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0.15, 0.45, 0]}
        fontSize={0.08}
        color="#2196f3"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#000000"
        fontWeight="bold"
      >
        {label}
      </Text>
      
      <Text
        position={[0.15, 0.38, 0]}
        fontSize={0.05}
        color="#90caf9"
        anchorX="left"
        anchorY="middle"
      >
        WATER IN →
      </Text>
    </group>
  );
}

/**
 * Sewer Output - Shows where drainage exits to city sewer
 */
function SewerOutputConnector({ position, rotation = 0, scale, label = 'To City Sewer' }: Omit<InfrastructureConnectorProps, 'type'>) {
  const pipeRadius = 0.08;
  const pipeLength = 0.6;
  
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Building drain pipe coming from inside */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.2, 16]} />
        <meshStandardMaterial 
          color={SYSTEM_COLORS['drainage']}
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>
      
      {/* Cleanout access at floor level */}
      <group position={[0, 0.05, 0]}>
        <mesh>
          <cylinderGeometry args={[pipeRadius * 1.4, pipeRadius * 1.4, 0.06, 16]} />
          <meshStandardMaterial color="#795548" metalness={0.3} roughness={0.6} />
        </mesh>
        {/* Cleanout plug */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[pipeRadius * 0.9, pipeRadius * 1.1, 0.04, 16]} />
          <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[pipeRadius * 1.4, 0.03, pipeRadius * 1.4]} />
          <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      
      {/* Ground/slab penetration */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[pipeRadius * 0.8, pipeRadius * 2.5, 24]} />
        <meshStandardMaterial 
          color="#5d4037"
          metalness={0.1}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Underground pipe section (angled for gravity) */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.2, 16]} />
        <meshStandardMaterial 
          color="#2a3a40"
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {/* 45-degree elbow going horizontal */}
      <mesh position={[-0.08, -0.22, 0]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[pipeRadius * 1.5, pipeRadius, 12, 12, Math.PI / 2]} />
        <meshStandardMaterial 
          color="#2a3a40"
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {/* Horizontal pipe to street */}
      <mesh position={[-pipeLength / 2 - 0.12, -0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, pipeLength, 16]} />
        <meshStandardMaterial 
          color="#1a2a30"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>
      
      {/* Direction arrow showing flow */}
      <mesh position={[-0.35, -0.34, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.03, 0.06, 8]} />
        <meshStandardMaterial color="#ff9800" emissive="#ff9800" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0.15, 0.08, 0]}
        fontSize={0.08}
        color="#8bc34a"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#000000"
        fontWeight="bold"
      >
        {label}
      </Text>
      
      <Text
        position={[0.15, 0.01, 0]}
        fontSize={0.05}
        color="#c5e1a5"
        anchorX="left"
        anchorY="middle"
      >
        ← DRAIN OUT
      </Text>
    </group>
  );
}

// =============================================================================
// FLOOR AND SCENE
// =============================================================================

interface FloorGridProps {
  width: number;
  height: number;
  scale: number;
}

function FloorGrid({ width, height, scale }: FloorGridProps) {
  return (
    <group position={[width * scale / 2, 0, height * scale / 2]}>
      <Grid
        args={[width * scale, height * scale]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#404040"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#606060"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width * scale, height * scale]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          metalness={0}
          roughness={1}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

interface SceneProps {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  roomWidth: number;
  roomHeight: number;
  ceilingHeight?: number;
  walls?: Wall[];
  points?: Point[];
}

interface WallMeshProps {
  wall: Wall;
  pointMap: Map<string, Point>;
  scale: number;
}

function WallMesh({ wall, pointMap, scale }: WallMeshProps) {
  const startPt = pointMap.get(wall.startPointId);
  const endPt = pointMap.get(wall.endPointId);
  
  if (!startPt || !endPt) return null;
  
  // Calculate wall geometry
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Center position (Y is up in Three.js, Z is canvas Y)
  const centerX = ((startPt.x + endPt.x) / 2) * scale;
  const centerZ = ((startPt.y + endPt.y) / 2) * scale;
  const height = (wall.height || 280) * scale;
  const thickness = (wall.thickness || 15) * scale;
  
  return (
    <mesh
      position={[centerX, height / 2, centerZ]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length * scale, height, thickness]} />
      <meshStandardMaterial 
        color="#505060"
        transparent
        opacity={0.35}
        metalness={0.1}
        roughness={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene({ fixtures, routes, nodes, roomWidth, roomHeight, ceilingHeight = 280, walls, points }: SceneProps) {
  const centerX = roomWidth * SCALE / 2;
  const centerZ = roomHeight * SCALE / 2;
  
  // Create point lookup map for wall rendering
  const pointMap = useMemo(() => 
    new Map(points?.map(p => [p.id, p]) || []),
    [points]
  );

  // Find water main and sewer nodes for connector placement
  const waterMainNode = nodes.find(n => n.type === 'water-main');
  const mainDrainNode = nodes.find(n => n.type === 'drain-stack' || n.type === 'stack-base');
  
  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={[centerX + 5, 4, centerZ + 5]} 
        fov={50}
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />
      <pointLight position={[centerX, 3, centerZ]} intensity={0.5} />
      
      <FloorGrid width={roomWidth} height={roomHeight} scale={SCALE} />
      
      {/* Water Main Input Connector */}
      {waterMainNode && (
        <WaterMainConnector
          position={new THREE.Vector3(
            waterMainNode.position.x * SCALE,
            0,
            waterMainNode.position.y * SCALE
          )}
          rotation={Math.PI / 2}
          scale={SCALE}
          label="City Water Main"
        />
      )}
      
      {/* Sewer Output Connector - position at main drain or offset from center */}
      <SewerOutputConnector
        position={new THREE.Vector3(
          mainDrainNode ? mainDrainNode.position.x * SCALE : centerX - 0.5,
          0,
          mainDrainNode ? mainDrainNode.position.y * SCALE : centerZ + 0.8
        )}
        rotation={Math.PI}
        scale={SCALE}
        label="To City Sewer"
      />
      
      {/* Render floor plan walls */}
      {walls?.map((wall) => (
        <WallMesh key={wall.id} wall={wall} pointMap={pointMap} scale={SCALE} />
      ))}
      
      {routes.map((route) => (
        <PipeRoute key={route.id} route={route} scale={SCALE} />
      ))}
      
      {nodes.map((node) => (
        <NodeMesh key={node.id} node={node} scale={SCALE} ceilingHeight={ceilingHeight} />
      ))}
      
      {fixtures.map((fixture) => (
        <FixtureMesh key={fixture.id} fixture={fixture} scale={SCALE} />
      ))}
      
      <OrbitControls 
        target={[centerX, 0.5, centerZ]}
        minDistance={2}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// =============================================================================
// LEGEND COMPONENT
// =============================================================================

function SystemLegend() {
  const systems: Array<{ label: string; color: string }> = [
    { label: 'Cold Water', color: SYSTEM_COLORS['cold-water'] },
    { label: 'Hot Water', color: SYSTEM_COLORS['hot-water'] },
    { label: 'Drainage', color: SYSTEM_COLORS['drainage'] },
    { label: 'Vent', color: SYSTEM_COLORS['vent'] },
    { label: 'Electrical', color: SYSTEM_COLORS['power'] },
  ];

  const fittings = [
    { label: '90° Elbow (Water)', symbol: '⌐' },
    { label: '2×45° (Drainage)', symbol: '∠∠' },
    { label: 'Sanitary Tee', symbol: '⊥' },
    { label: 'Wye', symbol: 'Y' },
  ];

  const stacks = [
    { label: 'Drain Stack', color: '#3d4f5f' },
    { label: 'Vent Stack', color: '#5a6b7c' },
  ];

  const infrastructure = [
    { label: 'Water Main In', color: '#2196f3', icon: '💧' },
    { label: 'Sewer Out', color: '#8bc34a', icon: '🔽' },
  ];

  return (
    <div className="absolute bottom-4 left-4 bg-black/80 rounded-lg p-3 backdrop-blur-sm max-h-[calc(100%-2rem)] overflow-y-auto">
      <div className="text-xs font-medium text-white mb-2">Systems</div>
      <div className="space-y-1 mb-3">
        {systems.map((sys) => (
          <div key={sys.label} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: sys.color }}
            />
            <span className="text-xs text-gray-300">{sys.label}</span>
          </div>
        ))}
      </div>
      
      <div className="border-t border-gray-700 pt-2 mb-3">
        <div className="text-xs font-medium text-white mb-1">Infrastructure</div>
        <div className="space-y-1">
          {infrastructure.map((inf) => (
            <div key={inf.label} className="flex items-center gap-2">
              <span className="text-xs">{inf.icon}</span>
              <span className="text-xs" style={{ color: inf.color }}>{inf.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-2 mb-3">
        <div className="text-xs font-medium text-white mb-1">Vertical Stacks</div>
        <div className="space-y-1">
          {stacks.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div 
                className="w-3 h-4 rounded-sm" 
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-gray-300">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-2">
        <div className="text-xs font-medium text-white mb-1">Fittings</div>
        <div className="space-y-0.5">
          {fittings.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="text-xs text-green-400 font-mono w-4">{f.symbol}</span>
              <span className="text-xs text-gray-400">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function IsometricMEPView({
  fixtures,
  routes,
  nodes,
  roomWidth,
  roomHeight,
  ceilingHeight = 280,
  walls,
  points,
}: IsometricMEPViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">3D Isometric View</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Drag to rotate • Scroll to zoom • Shift+drag to pan</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        <Canvas
          ref={canvasRef}
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#0a0a14' }}
        >
          <Scene
            fixtures={fixtures}
            routes={routes}
            nodes={nodes}
            roomWidth={roomWidth}
            roomHeight={roomHeight}
            ceilingHeight={ceilingHeight}
            walls={walls}
            points={points}
          />
        </Canvas>
        
        <SystemLegend />
        
        <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-400">Fixtures:</span>
            <span className="text-white font-medium">{fixtures.length}</span>
            <span className="text-gray-400">Routes:</span>
            <span className="text-white font-medium">{routes.length}</span>
            <span className="text-gray-400">Nodes:</span>
            <span className="text-white font-medium">{nodes.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default IsometricMEPView;
