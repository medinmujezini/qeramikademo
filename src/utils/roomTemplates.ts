import { v4 as uuidv4 } from 'uuid';
import { createDefaultFloorPlan, FloorPlan, Point, Wall } from '@/types/floorPlan';

export function computeScaleForRoom(
  widthCm: number,
  heightCm: number,
  canvasW = 800,
  canvasH = 600,
  marginPx = 60
): { pxPerCm: number; originPx: { x: number; y: number } } {
  const pxPerCm = Math.min(
    (canvasW - 2 * marginPx) / widthCm,
    (canvasH - 2 * marginPx) / heightCm
  );
  const originPx = {
    x: (canvasW - widthCm * pxPerCm) / 2,
    y: (canvasH - heightCm * pxPerCm) / 2,
  };
  return { pxPerCm, originPx };
}

function cmToPx(xCm: number, yCm: number, originPx: { x: number; y: number }, pxPerCm: number) {
  return { x: originPx.x + xCm * pxPerCm, y: originPx.y + yCm * pxPerCm };
}

function makePoint(xCm: number, yCm: number, originPx: { x: number; y: number }, pxPerCm: number): Point {
  const { x, y } = cmToPx(xCm, yCm, originPx, pxPerCm);
  return { id: uuidv4(), x, y };
}

function makeWall(startId: string, endId: string): Wall {
  return {
    id: uuidv4(),
    startPointId: startId,
    endPointId: endId,
    thickness: 15,
    material: 'drywall',
    height: 280,
    heightMode: 'room',
  };
}

export function generateRectangleRoom(widthCm: number, heightCm: number): FloorPlan {
  const base = createDefaultFloorPlan();
  const { pxPerCm, originPx } = computeScaleForRoom(widthCm, heightCm);

  const p1 = makePoint(0, 0, originPx, pxPerCm);
  const p2 = makePoint(widthCm, 0, originPx, pxPerCm);
  const p3 = makePoint(widthCm, heightCm, originPx, pxPerCm);
  const p4 = makePoint(0, heightCm, originPx, pxPerCm);

  const points: Point[] = [p1, p2, p3, p4];
  const walls: Wall[] = [
    makeWall(p1.id, p2.id),
    makeWall(p2.id, p3.id),
    makeWall(p3.id, p4.id),
    makeWall(p4.id, p1.id),
  ];

  return { ...base, points, walls, pxPerCm, originPx, roomWidth: 800, roomHeight: 600 };
}

export function generateLShapeRoom(
  widthCm: number,
  heightCm: number,
  notchWidthCm: number,
  notchHeightCm: number
): FloorPlan {
  const base = createDefaultFloorPlan();
  const { pxPerCm, originPx } = computeScaleForRoom(widthCm, heightCm);

  // P1(0,0) → P2(W,0) → P3(W, H-notchH) → P4(W-notchW, H-notchH) → P5(W-notchW, H) → P6(0, H)
  const p1 = makePoint(0, 0, originPx, pxPerCm);
  const p2 = makePoint(widthCm, 0, originPx, pxPerCm);
  const p3 = makePoint(widthCm, heightCm - notchHeightCm, originPx, pxPerCm);
  const p4 = makePoint(widthCm - notchWidthCm, heightCm - notchHeightCm, originPx, pxPerCm);
  const p5 = makePoint(widthCm - notchWidthCm, heightCm, originPx, pxPerCm);
  const p6 = makePoint(0, heightCm, originPx, pxPerCm);

  const points: Point[] = [p1, p2, p3, p4, p5, p6];
  const walls: Wall[] = [
    makeWall(p1.id, p2.id),
    makeWall(p2.id, p3.id),
    makeWall(p3.id, p4.id),
    makeWall(p4.id, p5.id),
    makeWall(p5.id, p6.id),
    makeWall(p6.id, p1.id),
  ];

  return { ...base, points, walls, pxPerCm, originPx, roomWidth: 800, roomHeight: 600 };
}
