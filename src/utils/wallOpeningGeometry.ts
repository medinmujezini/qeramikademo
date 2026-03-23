import * as THREE from 'three';
import type { Door, Window as FloorPlanWindow } from '@/types/floorPlan';

const EPSILON = 0.001;

interface OpeningRect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface OpeningZone {
  xCenter: number;
  yBottom: number;
  halfWidth: number;
  halfHeight: number;
}

interface WallShapeParams {
  wallLength: number;
  startHeight: number;
  endHeight: number;
  doors?: Door[];
  windows?: FloorPlanWindow[];
  unitScale: number;
}

interface OpeningZoneParams {
  wallLength: number;
  doors?: Door[];
  windows?: FloorPlanWindow[];
  unitScale: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getHeightAtX = (x: number, halfLength: number, startHeight: number, endHeight: number) => {
  const t = clamp((x + halfLength) / (halfLength * 2), 0, 1);
  return startHeight + (endHeight - startHeight) * t;
};

function buildDoorCutouts(
  doors: Door[],
  wallLength: number,
  startHeight: number,
  endHeight: number,
  unitScale: number,
): OpeningRect[] {
  const halfLength = wallLength / 2;

  const cutouts = doors
    .map((door) => {
      const position = clamp(door.position, 0, 1);
      const center = (position - 0.5) * wallLength;
      const halfWidth = (door.width * unitScale) / 2;

      let left = center - halfWidth;
      let right = center + halfWidth;

      left = clamp(left, -halfLength + EPSILON, halfLength - EPSILON);
      right = clamp(right, -halfLength + EPSILON, halfLength - EPSILON);

      if (right - left <= EPSILON) return null;

      const maxTop =
        Math.min(
          getHeightAtX(left, halfLength, startHeight, endHeight),
          getHeightAtX(right, halfLength, startHeight, endHeight),
        ) - EPSILON;
      const desiredTop = door.height * unitScale;
      const top = clamp(desiredTop, EPSILON, maxTop);

      if (top <= EPSILON) return null;

      return { left, right, bottom: 0, top } satisfies OpeningRect;
    })
    .filter((opening): opening is OpeningRect => !!opening)
    .sort((a, b) => a.left - b.left);

  if (cutouts.length <= 1) return cutouts;

  const merged: OpeningRect[] = [cutouts[0]];

  for (let i = 1; i < cutouts.length; i++) {
    const current = cutouts[i];
    const last = merged[merged.length - 1];

    if (current.left <= last.right + EPSILON) {
      last.right = Math.max(last.right, current.right);
      last.top = Math.max(last.top, current.top);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function createWallShapeWithOpenings({
  wallLength,
  startHeight,
  endHeight,
  doors = [],
  windows = [],
  unitScale,
}: WallShapeParams): THREE.Shape {
  const halfLength = wallLength / 2;
  const doorCutouts = buildDoorCutouts(doors, wallLength, startHeight, endHeight, unitScale);

  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, 0);

  let cursor = -halfLength;

  for (const cutout of doorCutouts) {
    if (cutout.left > cursor + EPSILON) {
      shape.lineTo(cutout.left, 0);
    }

    shape.lineTo(cutout.left, cutout.top);
    shape.lineTo(cutout.right, cutout.top);
    shape.lineTo(cutout.right, 0);
    cursor = cutout.right;
  }

  if (cursor < halfLength - EPSILON) {
    shape.lineTo(halfLength, 0);
  }

  shape.lineTo(halfLength, endHeight);
  shape.lineTo(-halfLength, startHeight);
  shape.closePath();

  windows.forEach((window) => {
    const position = clamp(window.position, 0, 1);
    const center = (position - 0.5) * wallLength;
    const halfWidth = (window.width * unitScale) / 2;

    let left = center - halfWidth;
    let right = center + halfWidth;

    left = clamp(left, -halfLength + EPSILON, halfLength - EPSILON);
    right = clamp(right, -halfLength + EPSILON, halfLength - EPSILON);

    if (right - left <= EPSILON) return;

    const maxTop =
      Math.min(
        getHeightAtX(left, halfLength, startHeight, endHeight),
        getHeightAtX(right, halfLength, startHeight, endHeight),
      ) - EPSILON;

    const desiredBottom = window.sillHeight * unitScale;
    const desiredTop = desiredBottom + window.height * unitScale;

    const bottom = clamp(desiredBottom, EPSILON, maxTop - EPSILON);
    const top = clamp(desiredTop, bottom + EPSILON, maxTop);

    if (top - bottom <= EPSILON) return;

    const hole = new THREE.Path();
    hole.moveTo(left, bottom);
    hole.lineTo(right, bottom);
    hole.lineTo(right, top);
    hole.lineTo(left, top);
    hole.closePath();

    shape.holes.push(hole);
  });

  return shape;
}

export function createOpeningZones({
  wallLength,
  doors = [],
  windows = [],
  unitScale,
}: OpeningZoneParams): OpeningZone[] {
  const zones: OpeningZone[] = [];

  doors.forEach((door) => {
    const xCenter = (clamp(door.position, 0, 1) - 0.5) * wallLength;
    zones.push({
      xCenter,
      yBottom: 0,
      halfWidth: (door.width * unitScale) / 2,
      halfHeight: (door.height * unitScale) / 2,
    });
  });

  windows.forEach((window) => {
    const xCenter = (clamp(window.position, 0, 1) - 0.5) * wallLength;
    zones.push({
      xCenter,
      yBottom: window.sillHeight * unitScale,
      halfWidth: (window.width * unitScale) / 2,
      halfHeight: (window.height * unitScale) / 2,
    });
  });

  return zones;
}