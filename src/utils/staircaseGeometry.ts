/**
 * Staircase Geometry — Realistic
 * 
 * Generates 3D geometry for straight, L-shaped, U-shaped, and spiral staircases.
 * All geometry scaled to fit the staircase's declared width × depth bounding box.
 */

import type { Staircase } from '@/types/multiFloor';

export interface TreadGeometry {
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
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
  railingPosts: RailingPost[];
  handrails: HandrailSegment[];
  landingPlatforms: TreadGeometry[];
  soffits: SoffitData[];
}

const CM_TO_M = 0.01;
const TREAD_H = 0.04; // 4cm thick treads for visible solidity
const NOSING = 0.015; // 1.5cm nosing overhang
const RISER_THICKNESS = 0.025;
const SOFFIT_THICKNESS = 0.04;
const RAILING_HEIGHT = 0.9;

function emptyResult(): StaircaseGeometryResult {
  return { treads: [], risers: [], railingPosts: [], handrails: [], landingPlatforms: [], soffits: [] };
}

/** Build handrail segments from separated left/right post arrays */
function buildHandrails(leftPosts: RailingPost[], rightPosts: RailingPost[]): HandrailSegment[] {
  const segments: HandrailSegment[] = [];
  for (const posts of [leftPosts, rightPosts]) {
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i];
      const b = posts[i + 1];
      segments.push({
        start: [a.position[0], a.position[1] + a.height, a.position[2]],
        end: [b.position[0], b.position[1] + b.height, b.position[2]],
      });
    }
  }
  return segments;
}

/** Generate straight staircase geometry */
function generateStraight(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  const riserH = stair.riserHeight * CM_TO_M;
  const numTreads = stair.numTreads;

  // Tread dimensions scaled to fit bounding box
  const treadW = boundW;
  const treadD = boundD / numTreads;

  const leftPosts: RailingPost[] = [];
  const rightPosts: RailingPost[] = [];

  for (let i = 0; i < numTreads; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD + treadD / 2; // center of tread slot

    // Tread
    result.treads.push({
      position: [boundW / 2, y, z],
      size: [treadW, TREAD_H, treadD + NOSING],
      rotation: 0,
    });

    // Riser (vertical face between this tread and the one above)
    result.risers.push({
      position: [boundW / 2, y - riserH / 2 + TREAD_H / 2, z - treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });

    // Railing posts — one on each side, every other tread + first + last
    if (i === 0 || i === numTreads - 1 || i % 2 === 0) {
      leftPosts.push({ position: [0.03, y, z], height: RAILING_HEIGHT });
      rightPosts.push({ position: [boundW - 0.03, y, z], height: RAILING_HEIGHT });
    }
  }

  // Final riser at the top
  const topY = numTreads * riserH;
  const topZ = (numTreads - 1) * treadD + treadD / 2 + treadD / 2;
  result.risers.push({
    position: [boundW / 2, topY + riserH / 2 - TREAD_H / 2, topZ],
    size: [treadW, riserH, RISER_THICKNESS],
    rotation: 0,
  });

  // Soffit — single angled slab underneath
  result.soffits.push({
    start: [boundW / 2, 0, 0],
    end: [boundW / 2, numTreads * riserH, boundD],
    width: treadW - 0.02, // slightly inset from edges
    thickness: SOFFIT_THICKNESS,
  });

  // Handrails
  result.railingPosts.push(...leftPosts, ...rightPosts);
  result.handrails = buildHandrails(leftPosts, rightPosts);

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

  // Split bounding box: first run uses ~60% of depth, landing square, second run uses rest of width
  const treadW = boundW * 0.5;
  const firstRunDepth = boundD * 0.7;
  const treadD1 = landingStep > 0 ? firstRunDepth / landingStep : firstRunDepth;
  const landingSize = treadW;
  const landingY = landingStep * riserH;

  // First run (along Z)
  for (let i = 0; i < landingStep; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD1 + treadD1 / 2;
    result.treads.push({ position: [treadW / 2, y, z], size: [treadW, TREAD_H, treadD1 + NOSING], rotation: 0 });
    result.risers.push({
      position: [treadW / 2, y - riserH / 2 + TREAD_H / 2, z - treadD1 / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Landing platform
  const landingZ = firstRunDepth;
  result.landingPlatforms.push({
    position: [treadW / 2 + landingSize / 4, landingY, landingZ + landingSize / 2],
    size: [treadW + landingSize / 2, TREAD_H * 1.5, landingSize],
    rotation: 0,
  });

  // Second run (along X)
  const secondRunWidth = boundW - treadW;
  const treadD2 = remainingTreads > 0 ? secondRunWidth / remainingTreads : secondRunWidth;
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * riserH;
    const x = treadW + i * treadD2 + treadD2 / 2;
    result.treads.push({
      position: [x, y, landingZ + landingSize / 2],
      size: [treadD2 + NOSING, TREAD_H, treadW],
      rotation: 0,
    });
    result.risers.push({
      position: [x - treadD2 / 2, y - riserH / 2 + TREAD_H / 2, landingZ + landingSize / 2],
      size: [RISER_THICKNESS, riserH, treadW],
      rotation: 0,
    });
  }

  // Soffits for first run
  result.soffits.push({
    start: [treadW / 2, 0, 0],
    end: [treadW / 2, landingY, firstRunDepth],
    width: treadW - 0.02,
    thickness: SOFFIT_THICKNESS,
  });

  return result;
}

/** Generate U-shaped staircase geometry */
function generateUShaped(stair: Staircase): StaircaseGeometryResult {
  const result = emptyResult();
  const boundW = stair.width * CM_TO_M;
  const boundD = stair.depth * CM_TO_M;
  const riserH = stair.riserHeight * CM_TO_M;
  const gap = 0.08;

  const halfTreads = Math.floor(stair.numTreads / 2);
  const remainingTreads = stair.numTreads - halfTreads;

  const treadW = (boundW - gap) / 2;
  const treadD = halfTreads > 0 ? (boundD - treadW) / halfTreads : boundD;
  const landingY = halfTreads * riserH;

  // First run (going forward along Z)
  for (let i = 0; i < halfTreads; i++) {
    const y = (i + 1) * riserH;
    const z = i * treadD + treadD / 2;
    result.treads.push({ position: [treadW / 2, y, z], size: [treadW, TREAD_H, treadD + NOSING], rotation: 0 });
    result.risers.push({
      position: [treadW / 2, y - riserH / 2 + TREAD_H / 2, z - treadD / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Landing
  const landingZ = halfTreads * treadD;
  result.landingPlatforms.push({
    position: [boundW / 2, landingY, landingZ + treadW / 2],
    size: [boundW, TREAD_H * 1.5, treadW],
    rotation: 0,
  });

  // Second run (coming back along -Z)
  const treadD2 = remainingTreads > 0 ? (boundD - treadW) / remainingTreads : treadD;
  for (let i = 0; i < remainingTreads; i++) {
    const y = landingY + (i + 1) * riserH;
    const z = landingZ - (i + 1) * treadD2 + treadD2 / 2 + treadW;
    result.treads.push({
      position: [treadW + gap + treadW / 2, y, z],
      size: [treadW, TREAD_H, treadD2 + NOSING],
      rotation: 0,
    });
    result.risers.push({
      position: [treadW + gap + treadW / 2, y - riserH / 2 + TREAD_H / 2, z - treadD2 / 2],
      size: [treadW, riserH, RISER_THICKNESS],
      rotation: 0,
    });
  }

  // Soffits
  result.soffits.push({
    start: [treadW / 2, 0, 0],
    end: [treadW / 2, landingY, landingZ],
    width: treadW - 0.02,
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

  const centerR = 0.08; // 8cm center pole
  const outerR = Math.min(boundW, boundD) / 2;
  const treadWidth = outerR - centerR;
  const anglePerStep = (2 * Math.PI * 1.1) / Math.max(stair.numTreads, 8);

  const cx = boundW / 2;
  const cz = boundD / 2;

  // Center pole
  const totalH = stair.numTreads * riserH;
  result.railingPosts.push({
    position: [cx, totalH / 2, cz],
    height: totalH + RAILING_HEIGHT,
  });

  const outerPosts: RailingPost[] = [];

  for (let i = 0; i < stair.numTreads; i++) {
    const angle = i * anglePerStep;
    const y = (i + 1) * riserH;
    const midR = (centerR + outerR) / 2;
    const x = cx + Math.cos(angle) * midR;
    const z = cz + Math.sin(angle) * midR;

    result.treads.push({
      position: [x, y, z],
      size: [treadWidth, TREAD_H, 0.08],
      rotation: -angle,
    });

    // Outer post every 3 steps
    if (i % 3 === 0 || i === stair.numTreads - 1) {
      const post: RailingPost = {
        position: [cx + Math.cos(angle) * (outerR - 0.03), y, cz + Math.sin(angle) * (outerR - 0.03)],
        height: RAILING_HEIGHT,
      };
      outerPosts.push(post);
      result.railingPosts.push(post);
    }
  }

  result.handrails = buildHandrails(outerPosts, []);

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
