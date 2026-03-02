import { vec3, Vec3 } from 'wgpu-matrix';

function reciprocal(v: Vec3) {
  const s = 1 / vec3.lenSq(v);
  return vec3.mul(vec3.fromValues(s, s, s), v);
}

interface Quad {
  center: Vec3;
  right: Vec3;
  up: Vec3;
  color: Vec3;
  emissive?: number;
}

enum CubeFace {
  PositiveX, PositiveY, PositiveZ, NegativeX, NegativeY, NegativeZ,
}

function box(params: {
  center: Vec3;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  color: Vec3 | Vec3[];
  type: 'convex' | 'concave';
}): Quad[] {
  const x = vec3.fromValues(
    Math.cos(params.rotation) * (params.width / 2), 0,
    Math.sin(params.rotation) * (params.depth / 2)
  );
  const y = vec3.fromValues(0, params.height / 2, 0);
  const z = vec3.fromValues(
    Math.sin(params.rotation) * (params.width / 2), 0,
    -Math.cos(params.rotation) * (params.depth / 2)
  );
  const colors = params.color instanceof Array ? params.color : new Array(6).fill(params.color);
  const sign = (v: Vec3) => params.type === 'concave' ? v : vec3.negate(v);
  return [
    { center: vec3.add(params.center, x), right: sign(vec3.negate(z)), up: y, color: colors[CubeFace.PositiveX] },
    { center: vec3.add(params.center, y), right: sign(x), up: vec3.negate(z), color: colors[CubeFace.PositiveY] },
    { center: vec3.add(params.center, z), right: sign(x), up: y, color: colors[CubeFace.PositiveZ] },
    { center: vec3.sub(params.center, x), right: sign(z), up: y, color: colors[CubeFace.NegativeX] },
    { center: vec3.sub(params.center, y), right: sign(x), up: z, color: colors[CubeFace.NegativeY] },
    { center: vec3.sub(params.center, z), right: sign(vec3.negate(x)), up: y, color: colors[CubeFace.NegativeZ] },
  ];
}

export interface FurnitureData {
  name: string;
  dimensions: { width: number; depth: number; height: number };
  color: string;
  modelUrl?: string;
  hasTriangles?: boolean; // Flag indicating triangles are loaded separately
}

function hexToVec3(hex: string): Vec3 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return vec3.fromValues(r, g, b);
}

export default class Scene {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly vertices: GPUBuffer;
  readonly indices: GPUBuffer;
  readonly vertexBufferLayout: GPUVertexBufferLayout[];
  readonly quadBuffer: GPUBuffer;
  readonly quads: Quad[];
  readonly lightCenter: Vec3;
  readonly lightWidth: number;
  readonly lightHeight: number;

  constructor(device: GPUDevice, furnitureData?: FurnitureData) {
    // Calculate room size based on furniture (convert cm to scene units, ~10cm = 1 unit)
    const scale = 0.1;
    const furnitureW = furnitureData ? furnitureData.dimensions.width * scale : 3;
    const furnitureD = furnitureData ? furnitureData.dimensions.depth * scale : 3;
    const furnitureH = furnitureData ? furnitureData.dimensions.height * scale : 3;
    const furnitureColor = furnitureData ? hexToVec3(furnitureData.color) : vec3.fromValues(0.8, 0.8, 0.8);
    
    // Room proportional to furniture with some padding
    const roomSize = Math.max(furnitureW, furnitureD, furnitureH) * 2.5;
    const roomHeight = Math.max(roomSize, furnitureH * 2);

    const light: Quad = {
      center: vec3.fromValues(0, roomHeight - 0.05, 0),
      right: vec3.fromValues(roomSize * 0.2, 0, 0),
      up: vec3.fromValues(0, 0, roomSize * 0.2),
      color: vec3.fromValues(5.0, 5.0, 5.0),
      emissive: 1.0,
    };

    // Build quads array
    const quads: Quad[] = [
      // Room (Cornell Box style)
      ...box({
        center: vec3.fromValues(0, roomHeight / 2, 0),
        width: roomSize, height: roomHeight, depth: roomSize,
        rotation: 0,
        color: [
          vec3.fromValues(0.0, 0.5, 0.0), // Green wall
          vec3.fromValues(0.5, 0.5, 0.5), // Ceiling
          vec3.fromValues(0.5, 0.5, 0.5), // Back wall
          vec3.fromValues(0.5, 0.0, 0.0), // Red wall
          vec3.fromValues(0.5, 0.5, 0.5), // Floor
          vec3.fromValues(0.5, 0.5, 0.5), // Front wall
        ],
        type: 'concave',
      }),
    ];

    // Only add furniture box if we don't have triangles loaded
    if (!furnitureData?.hasTriangles) {
      quads.push(...box({
        center: vec3.fromValues(0, furnitureH / 2, 0),
        width: furnitureW, height: furnitureH, depth: furnitureD,
        rotation: 0.15,
        color: furnitureColor,
        type: 'convex',
      }));
    }

    // Add light
    quads.push(light);

    this.quads = quads;

    this.lightCenter = light.center;
    this.lightWidth = vec3.len(light.right) * 2;
    this.lightHeight = vec3.len(light.up) * 2;

    // Build GPU buffers
    const quadStride = 16 * 4;
    const quadBuffer = device.createBuffer({
      size: quadStride * this.quads.length,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    const quadData = new Float32Array(quadBuffer.getMappedRange());
    const vertexStride = 4 * 10;
    const vertexData = new Float32Array(this.quads.length * vertexStride);
    const indexData = new Uint32Array(this.quads.length * 9);
    let vertexCount = 0, indexCount = 0, quadDataOffset = 0, vertexDataOffset = 0, indexDataOffset = 0;

    for (let quadIdx = 0; quadIdx < this.quads.length; quadIdx++) {
      const quad = this.quads[quadIdx];
      const normal = vec3.normalize(vec3.cross(quad.right, quad.up));
      quadData[quadDataOffset++] = normal[0]; quadData[quadDataOffset++] = normal[1];
      quadData[quadDataOffset++] = normal[2]; quadData[quadDataOffset++] = -vec3.dot(normal, quad.center);
      const invRight = reciprocal(quad.right);
      quadData[quadDataOffset++] = invRight[0]; quadData[quadDataOffset++] = invRight[1];
      quadData[quadDataOffset++] = invRight[2]; quadData[quadDataOffset++] = -vec3.dot(invRight, quad.center);
      const invUp = reciprocal(quad.up);
      quadData[quadDataOffset++] = invUp[0]; quadData[quadDataOffset++] = invUp[1];
      quadData[quadDataOffset++] = invUp[2]; quadData[quadDataOffset++] = -vec3.dot(invUp, quad.center);
      quadData[quadDataOffset++] = quad.color[0]; quadData[quadDataOffset++] = quad.color[1];
      quadData[quadDataOffset++] = quad.color[2]; quadData[quadDataOffset++] = quad.emissive ?? 0;

      const a = vec3.add(vec3.sub(quad.center, quad.right), quad.up);
      const b = vec3.add(vec3.add(quad.center, quad.right), quad.up);
      const c = vec3.sub(vec3.sub(quad.center, quad.right), quad.up);
      const d = vec3.sub(vec3.add(quad.center, quad.right), quad.up);

      [[a, 0, 1], [b, 1, 1], [c, 0, 0], [d, 1, 0]].forEach(([pos, uvx, uvy]) => {
        vertexData[vertexDataOffset++] = (pos as Vec3)[0]; vertexData[vertexDataOffset++] = (pos as Vec3)[1];
        vertexData[vertexDataOffset++] = (pos as Vec3)[2]; vertexData[vertexDataOffset++] = 1;
        vertexData[vertexDataOffset++] = uvx as number; vertexData[vertexDataOffset++] = uvy as number;
        vertexData[vertexDataOffset++] = quadIdx;
        vertexData[vertexDataOffset++] = quad.color[0] * (quad.emissive ?? 0);
        vertexData[vertexDataOffset++] = quad.color[1] * (quad.emissive ?? 0);
        vertexData[vertexDataOffset++] = quad.color[2] * (quad.emissive ?? 0);
      });

      indexData[indexDataOffset++] = vertexCount; indexData[indexDataOffset++] = vertexCount + 2;
      indexData[indexDataOffset++] = vertexCount + 1; indexData[indexDataOffset++] = vertexCount + 1;
      indexData[indexDataOffset++] = vertexCount + 2; indexData[indexDataOffset++] = vertexCount + 3;
      indexCount += 6; vertexCount += 4;
    }
    quadBuffer.unmap();

    const vertices = device.createBuffer({ size: vertexData.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(vertices.getMappedRange()).set(vertexData);
    vertices.unmap();

    const indices = device.createBuffer({ size: indexData.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint16Array(indices.getMappedRange()).set(indexData);
    indices.unmap();

    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
    this.vertices = vertices;
    this.indices = indices;
    this.quadBuffer = quadBuffer;
    this.vertexBufferLayout = [{
      arrayStride: vertexStride,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x4' },
        { shaderLocation: 1, offset: 16, format: 'float32x3' },
        { shaderLocation: 2, offset: 28, format: 'float32x3' },
      ],
    }];
  }
}
