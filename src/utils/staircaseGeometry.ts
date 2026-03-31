/**
 * Staircase Geometry — Step 7
 * 
 * Generates 3D geometry data for different staircase types:
 * straight, L-shaped, U-shaped, spiral.
 * Returns arrays of tread/railing positions for the 3D component.
 */

import type { Staircase, StaircaseType } from '@/types/multiFloor';

export interface TreadGeometry {
  position: [number, number, number]; // [x, y, z] in meters
  size: [number, number, number]; // [width, height, depth]
  rotation: number; // radians
}

export interface StringerGeometry {
  points: [number, number, number][]; // polyline in meters
  width: number; // meters
}

export interface RailingPost {
  position: [number, number, number];
  height: number; // meters
}

export interface StaircaseGeometryResult {
  treads: TreadGeometry[];
  stringers: StringerGeometry[];
  railingPosts: RailingPost[];
  landingPlatforms: TreadGeometry[];
}

const CM_TO_M = 0.01;

/**
 * Generate straight staircase geometry
 */
function generateStraight(stair: Staircase): StaircaseGeometryResult {
  const treads: TreadGeometry[] = [];
  const railingPosts: RailingPost[] = [];
  const treadW = stair.stairWidth * CM_TO_M;
  const treadD = stair.treadDepth * CM_TO_M;
  const treadH = 0.03; // 3cm thick treads

  for (let i = 0; i < stair.numTreads; i++) {
    const y = (i + 1) * stair.riserHeight * CM_TO_M;
    const z = i * treadD;
    treads.push({
      position: [0, y, z],
      size: [treadW, treadH, treadD],
      rotation: 0,
    });

    // Railing posts every 3 treads
    if (i % 3 === 0) {
      railingPosts.push({
        position: [-treadW / 2, y, z],
        height: 0.9,
      });
      railingPosts.push({
        position: [treadW / 2, y, z],
        height: 0.9,
      });
    }
  }

  // Stringers (left and right)
  const totalRise = stair.numTreads * stair.riserHeight * CM_TO_M;
  const totalRun = stair.numTreads * treadD;
  const stringers: StringerGeometry[] = [
    {
      points: [[- treadW / 2, 0, 0], [-treadW / 2, totalRise, totalRun]],
      width: 0.04,
    },
    {
      points: [[treadW / 2, 0, 0], [treadW / 2, totalRise, totalRun]],
      width: 0.04,
    },
  ];

  return { treads, stringers, railingPosts, landingPlatforms: [] };
}

/**
 * Generate L-shaped staircase geometry
 */
function generateLShaped(stair: Staircase): StaircaseGeometryResult {
  const treads: TreadGeometry[] = [];
  const railingPosts: RailingPost[] = [];
  const landingPlatforms: TreadGeometry[] = [];
  const treadW = stair.stairWidth * CM_TO_M;
  const treadD = stair.treadDepth * CM_TO_M;
  const treadH = 0.03;

  const landingStep = Math.floor(stair.numTreads * (stair.landingPosition || 0.5));
  const landingY = landingStep * stair.riserHeight * CM_TO_M;

  // First run (along Z)
  for (let i = 0; i < landingStep; i++) {
    const y = (i + 1) * stair.riserHeight * CM_TO_M;
    const z = i * treadD;
    treads.push({ position: [0, y, z], size: [treadW, treadH, treadD], rotation: 0 });
  }

  // Landing platform
  const landingZ = landingStep * treadD;
  landingPlatforms.push({
    position: [treadW / 2, landingY, landingZ + treadW / 2],
    size: [treadW, treadH, treadW],
    rotation: 0,
  });

  // Second run (along X, turned 90°)
  const remainingTreads = stair.numTreads - landingStep;
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * stair.riserHeight * CM_TO_M;
    const x = treadW + i * treadD;
    treads.push({
      position: [x, y, landingZ + treadW / 2],
      size: [treadD, treadH, treadW],
      rotation: 0,
    });
  }

  return { treads, stringers: [], railingPosts, landingPlatforms };
}

/**
 * Generate U-shaped staircase geometry
 */
function generateUShaped(stair: Staircase): StaircaseGeometryResult {
  const treads: TreadGeometry[] = [];
  const landingPlatforms: TreadGeometry[] = [];
  const treadW = stair.stairWidth * CM_TO_M;
  const treadD = stair.treadDepth * CM_TO_M;
  const treadH = 0.03;
  const gap = 0.10; // 10cm gap between runs

  const halfTreads = Math.floor(stair.numTreads / 2);
  const landingY = halfTreads * stair.riserHeight * CM_TO_M;

  // First run (going forward)
  for (let i = 0; i < halfTreads; i++) {
    const y = (i + 1) * stair.riserHeight * CM_TO_M;
    treads.push({ position: [0, y, i * treadD], size: [treadW, treadH, treadD], rotation: 0 });
  }

  // Landing
  const landingZ = halfTreads * treadD;
  landingPlatforms.push({
    position: [treadW / 2 + gap / 2, landingY, landingZ],
    size: [treadW * 2 + gap, treadH, treadW],
    rotation: 0,
  });

  // Second run (coming back)
  const remainingTreads = stair.numTreads - halfTreads;
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * stair.riserHeight * CM_TO_M;
    const z = landingZ - (i + 1) * treadD;
    treads.push({
      position: [treadW + gap, y, z],
      size: [treadW, treadH, treadD],
      rotation: 0,
    });
  }

  return { treads, stringers: [], railingPosts: [], landingPlatforms };
}

/**
 * Generate spiral staircase geometry
 */
function generateSpiral(stair: Staircase): StaircaseGeometryResult {
  const treads: TreadGeometry[] = [];
  const railingPosts: RailingPost[] = [];
  const treadH = 0.03;
  const centerR = (stair.centerRadius || 20) * CM_TO_M;
  const outerR = stair.stairWidth * CM_TO_M + centerR;
  const anglePerStep = (2 * Math.PI) / Math.max(stair.numTreads, 12) * 1.2; // ~1.2 turns

  for (let i = 0; i < stair.numTreads; i++) {
    const angle = i * anglePerStep;
    const y = (i + 1) * stair.riserHeight * CM_TO_M;
    const midR = (centerR + outerR) / 2;
    const x = Math.cos(angle) * midR;
    const z = Math.sin(angle) * midR;

    treads.push({
      position: [x, y, z],
      size: [outerR - centerR, treadH, 0.05], // wedge approximated
      rotation: -angle,
    });

    if (i % 2 === 0) {
      railingPosts.push({
        position: [Math.cos(angle) * outerR, y, Math.sin(angle) * outerR],
        height: 0.9,
      });
    }
  }

  return { treads, stringers: [], railingPosts, landingPlatforms: [] };
}

/**
 * Generate staircase geometry for any type.
 * All positions are relative to the staircase origin (bottom-left).
 */
export function generateStaircaseGeometry(stair: Staircase): StaircaseGeometryResult {
  switch (stair.type) {
    case 'straight': return generateStraight(stair);
    case 'l-shaped': return generateLShaped(stair);
    case 'u-shaped': return generateUShaped(stair);
    case 'spiral': return generateSpiral(stair);
    default: return generateStraight(stair);
  }
}
