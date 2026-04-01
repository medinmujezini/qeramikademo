/**
 * Staircase Geometry — Enhanced
 * 
 * Generates 3D geometry data for different staircase types:
 * straight, L-shaped, U-shaped, spiral.
 * Returns arrays of tread/riser/railing/handrail/soffit positions for the 3D component.
 * All geometry is scaled to fit the staircase's declared width/depth bounding box.
 */

import type { Staircase } from '@/types/multiFloor';

export interface TreadGeometry {
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
}

export interface StringerGeometry {
  points: [number, number, number][];
  width: number;
}

export interface RailingPost {
  position: [number, number, number];
  height: number;
}

export interface HandrailSegment {
  start: [number, number, number];
  end: [number, number, number];
}

export interface SoffitData {
  start: [number, number, number];
  end: [number, number, number];
  width: number;
  thickness: number;
}

export interface StaircaseGeometryResult {
  treads: TreadGeometry[];
  risers: TreadGeometry[];
  stringers: StringerGeometry[];
  railingPosts: RailingPost[];
  handrails: HandrailSegment[];
  landingPlatforms: TreadGeometry[];
  soffits: SoffitData[];
}

const CM_TO_M = 0.01;
const TREAD_H = 0.03;
const NOSING = 0.01; // 1cm overhang
const RISER_THICKNESS = 0.02;
const SOFFIT_THICKNESS = 0.03;
const RAILING_HEIGHT = 0.9;

function emptyResult(): StaircaseGeometryResult {
  return { treads: [], risers: [], stringers: [], railingPosts: [], handrails: [], landingPlatforms: [], soffits: [] };
}

function connectPostsWithHandrails(posts: RailingPost[]): HandrailSegment[] {
  const handrails: HandrailSegment[] = [];
  // Group posts by X coordinate (left vs right side)
  const leftPosts: RailingPost[] = [];
  const rightPosts: RailingPost[] = [];
  
  if (posts.length < 2) return handrails;
  
  // Simple: connect consecutive posts
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    // Only connect if on same side (similar X)
    const dx = Math.abs(a.position[0] - b.position[0]);
    const dz = Math.abs(a.position[2] - b.position[2]);
    if (dx < 0.01 || dz < 0.01) {
      handrails.push({
        start: [a.position[0], a.position[1] + a.height, a.position[2]],
        end: [b.position[0], b.position[1] + b.height, b.position[2]],
      });
    }
  }
  return handrails;
}

/** Generate straight staircase geometry, scaled to fit width/depth */
function generateStraight(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  
  const naturalRun = stair.numTreads * stair.treadDepth * CM_TO_M;
  const naturalW = stair.stairWidth * CM_TO_M;
  
  // Scale factors to fit bounding box
  const scaleZ = naturalRun > 0 ? boundD / naturalRun : 1;
  const scaleX = naturalW > 0 ? boundW / naturalW : 1;
  
  const treadW = naturalW * scaleX;
  const treadD = stair.treadDepth * CM_TO_M * scaleZ;
  const riserH = stair.riserHeight * CM_TO_M;

  for (let i = 0; i < stair.numTreads; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD;
    
    // Tread with nosing overhang
    result.treads.push({
      position: [0, y, z],
      size: [treadW, TREAD_H, treadD + NOSING],
      rotation: 0,
    });

    // Riser (vertical face)
    if (i === 0) {
      // First riser at ground level
      result.risers.push({
        position: [0, riserH / 2, -RISER_THICKNESS / 2],
        size: [treadW, riserH, RISER_THICKNESS],
        rotation: 0,
      });
    }
    result.risers.push({
      position: [0, y + riserH / 2, z + treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });

    // Railing posts every 2-3 treads
    if (i % 3 === 0) {
      result.railingPosts.push({ position: [-treadW / 2, y, z], height: RAILING_HEIGHT });
      result.railingPosts.push({ position: [treadW / 2, y, z], height: RAILING_HEIGHT });
    }
  }

  // Last tread railing posts
  const lastY = stair.numTreads * riserH;
  const lastZ = (stair.numTreads - 1) * treadD;
  if (stair.numTreads % 3 !== 0) {
    result.railingPosts.push({ position: [-treadW / 2, lastY, lastZ], height: RAILING_HEIGHT });
    result.railingPosts.push({ position: [treadW / 2, lastY, lastZ], height: RAILING_HEIGHT });
  }

  // Stringers (left and right)
  const totalRise = stair.numTreads * riserH;
  const totalRun = (stair.numTreads - 1) * treadD + treadD;
  result.stringers = [
    { points: [[-treadW / 2, 0, -0.02], [-treadW / 2, totalRise, totalRun]], width: 0.05 },
    { points: [[treadW / 2, 0, -0.02], [treadW / 2, totalRise, totalRun]], width: 0.05 },
  ];

  // Soffit (underside slab)
  result.soffits.push({
    start: [0, -SOFFIT_THICKNESS, -0.02],
    end: [0, totalRise - TREAD_H, totalRun],
    width: treadW,
    thickness: SOFFIT_THICKNESS,
  });

  // Connect railing posts with handrails
  result.handrails = connectPostsWithHandrails(result.railingPosts);

  return result;
}

/** Generate L-shaped staircase geometry */
function generateLShaped(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  const riserH = stair.riserHeight * CM_TO_M;
  
  const landingStep = Math.floor(stair.numTreads * (stair.landingPosition || 0.5));
  const remainingTreads = stair.numTreads - landingStep;
  
  // Natural dimensions
  const naturalTreadW = stair.stairWidth * CM_TO_M;
  const naturalTreadD = stair.treadDepth * CM_TO_M;
  const naturalFirstRun = landingStep * naturalTreadD;
  const naturalSecondRun = remainingTreads * naturalTreadD;
  const naturalTotalW = naturalTreadW + naturalSecondRun;
  const naturalTotalD = naturalFirstRun + naturalTreadW;
  
  const scaleX = naturalTotalW > 0 ? boundW / naturalTotalW : 1;
  const scaleZ = naturalTotalD > 0 ? boundD / naturalTotalD : 1;
  
  const treadW = naturalTreadW * scaleX;
  const treadD = naturalTreadD * scaleZ;
  const landingY = landingStep * riserH;

  // First run (along Z)
  for (let i = 0; i < landingStep; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD;
    result.treads.push({ position: [0, y, z], size: [treadW, TREAD_H, treadD + NOSING], rotation: 0 });
    result.risers.push({
      position: [0, y - riserH / 2 + TREAD_H, z + treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Landing platform
  const landingZ = landingStep * treadD;
  const landingSize = treadW * scaleZ;
  result.landingPlatforms.push({
    position: [treadW / 2, landingY, landingZ + landingSize / 2],
    size: [treadW * 2, TREAD_H, landingSize],
    rotation: 0,
  });

  // Second run (along X, turned 90°)
  const secondTreadD = naturalTreadD * scaleX;
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * riserH;
    const x = treadW + i * secondTreadD;
    result.treads.push({
      position: [x, y, landingZ + landingSize / 2],
      size: [secondTreadD + NOSING, TREAD_H, treadW],
      rotation: 0,
    });
    result.risers.push({
      position: [x - secondTreadD / 2, y - riserH / 2 + TREAD_H, landingZ + landingSize / 2],
      size: [RISER_THICKNESS, riserH, treadW],
      rotation: 0,
    });
  }

  return result;
}

/** Generate U-shaped staircase geometry */
function generateUShaped(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  const riserH = stair.riserHeight * CM_TO_M;
  const gap = 0.10;

  const halfTreads = Math.floor(stair.numTreads / 2);
  const remainingTreads = stair.numTreads - halfTreads;
  
  const naturalTreadW = stair.stairWidth * CM_TO_M;
  const naturalTreadD = stair.treadDepth * CM_TO_M;
  const naturalTotalW = naturalTreadW * 2 + gap;
  const naturalTotalD = Math.max(halfTreads, remainingTreads) * naturalTreadD + naturalTreadW;
  
  const scaleX = naturalTotalW > 0 ? boundW / naturalTotalW : 1;
  const scaleZ = naturalTotalD > 0 ? boundD / naturalTotalD : 1;
  
  const treadW = naturalTreadW * scaleX;
  const treadD = naturalTreadD * scaleZ;
  const scaledGap = gap * scaleX;
  const landingY = halfTreads * riserH;

  // First run (going forward)
  for (let i = 0; i < halfTreads; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD;
    result.treads.push({ position: [0, y, z], size: [treadW, TREAD_H, treadD + NOSING], rotation: 0 });
    result.risers.push({
      position: [0, y - riserH / 2 + TREAD_H, z + treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Landing
  const landingZ = halfTreads * treadD;
  result.landingPlatforms.push({
    position: [treadW / 2 + scaledGap / 2, landingY, landingZ],
    size: [treadW * 2 + scaledGap, TREAD_H, treadW],
    rotation: 0,
  });

  // Second run (coming back)
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * riserH;
    const z = landingZ - (i + 1) * treadD;
    result.treads.push({
      position: [treadW + scaledGap, y, z],
      size: [treadW, TREAD_H, treadD + NOSING],
      rotation: 0,
    });
    result.risers.push({
      position: [treadW + scaledGap, y - riserH / 2 + TREAD_H, z - treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Soffits for both runs
  const totalRise1 = halfTreads * riserH;
  result.soffits.push({
    start: [0, -SOFFIT_THICKNESS, 0],
    end: [0, totalRise1, landingZ],
    width: treadW,
    thickness: SOFFIT_THICKNESS,
  });

  return result;
}

/** Generate spiral staircase geometry */
function generateSpiral(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  const riserH = stair.riserHeight * CM_TO_M;
  
  const centerR = (stair.centerRadius || 20) * CM_TO_M;
  const naturalOuterR = stair.stairWidth * CM_TO_M + centerR;
  
  // Scale to fit bounding box (spiral fits in a circle of diameter 2*outerR)
  const naturalDiameter = naturalOuterR * 2;
  const scaleFactor = Math.min(boundW / naturalDiameter, boundD / naturalDiameter);
  const outerR = naturalOuterR * scaleFactor;
  const scaledCenterR = centerR * scaleFactor;
  
  const anglePerStep = (2 * Math.PI) / Math.max(stair.numTreads, 12) * 1.2;

  // Center post
  result.railingPosts.push({
    position: [0, 0, 0],
    height: stair.numTreads * riserH + RAILING_HEIGHT,
  });

  for (let i = 0; i < stair.numTreads; i++) {
    const angle = i * anglePerStep;
    const y = (i + 1) * riserH;
    const midR = (scaledCenterR + outerR) / 2;
    const x = Math.cos(angle) * midR;
    const z = Math.sin(angle) * midR;

    result.treads.push({
      position: [x, y, z],
      size: [outerR - scaledCenterR, TREAD_H, 0.06],
      rotation: -angle,
    });

    // Outer railing post every 2 steps
    if (i % 2 === 0) {
      result.railingPosts.push({
        position: [Math.cos(angle) * outerR, y, Math.sin(angle) * outerR],
        height: RAILING_HEIGHT,
      });
    }
  }

  result.handrails = connectPostsWithHandrails(result.railingPosts.slice(1)); // skip center post

  return result;
}

/** Generate staircase geometry for any type. */
export function generateStaircaseGeometry(stair: Staircase): StaircaseGeometryResult {
  switch (stair.type) {
    case 'straight': return generateStraight(stair);
    case 'l-shaped': return generateLShaped(stair);
    case 'u-shaped': return generateUShaped(stair);
    case 'spiral': return generateSpiral(stair);
    default: return generateStraight(stair);
  }
}
