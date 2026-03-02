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
  useMaterial?: boolean;
}

enum CubeFace {
  PositiveX,
  PositiveY,
  PositiveZ,
  NegativeX,
  NegativeY,
  NegativeZ,
}

function createWallQuad(params: {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  height: number;
  color: Vec3;
  useMaterial?: boolean;
}): Quad {
  const { startX, startZ, endX, endZ, height, color, useMaterial } = params;
  
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  
  if (length < 0.001) {
    return {
      center: vec3.fromValues(startX, height / 2, startZ),
      right: vec3.fromValues(0.001, 0, 0),
      up: vec3.fromValues(0, height / 2, 0),
      color: color,
      useMaterial: false,
    };
  }
  
  const centerX = (startX + endX) / 2;
  const centerY = height / 2;
  const centerZ = (startZ + endZ) / 2;
  
  const rightX = dx / 2;
  const rightZ = dz / 2;
  const upY = height / 2;
  
  return {
    center: vec3.fromValues(centerX, centerY, centerZ),
    right: vec3.fromValues(rightX, 0, rightZ),
    up: vec3.fromValues(0, upY, 0),
    color: color,
    useMaterial: useMaterial ?? false,
  };
}

export interface WallData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  height: number;
  thickness: number;
}

export interface FloorPlanData {
  walls: WallData[];
  roomWidth: number;
  roomHeight: number;
}

export interface MaterialData {
  albedo?: string;
  normal?: string;
  roughness?: string;
  metallic?: string;
  ao?: string;
  arm?: string;       // Combined AO/Roughness/Metallic texture
  height?: string;    // Displacement/height map
}

// PBR texture collection for the raytracer
export interface PBRTextures {
  albedoView: GPUTextureView;
  normalView: GPUTextureView;
  armView: GPUTextureView;  // Combined AO(R), Roughness(G), Metallic(B)
  heightView: GPUTextureView;
  hasMaterial: boolean;
}

/**
 * Scene holds the scene geometry - walls from floor plan with proper coordinate mapping.
 */
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
  readonly hasMaterial: boolean = false;

  constructor(device: GPUDevice, floorPlanData?: FloorPlanData, materialData?: MaterialData) {
    const scale = 0.01;
    
    this.hasMaterial = !!(materialData?.albedo);
    this.quads = this.buildSceneQuads(floorPlanData, scale, this.hasMaterial);

    const bounds = this.calculateBounds(floorPlanData, scale);

    const light: Quad = {
      center: vec3.fromValues(bounds.centerX, bounds.ceilingHeight - 0.02, bounds.centerZ),
      right: vec3.fromValues(Math.min(bounds.halfWidth, 1.5), 0, 0),
      up: vec3.fromValues(0, 0, Math.min(bounds.halfDepth, 1.5)),
      color: vec3.fromValues(8.0, 7.5, 6.5),
      emissive: 1.0,
      useMaterial: false,
    };
    this.quads.push(light);
    this.lightCenter = light.center;
    this.lightWidth = vec3.len(light.right) * 2;
    this.lightHeight = vec3.len(light.up) * 2;

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
    let vertexCount = 0;
    let indexCount = 0;
    let quadDataOffset = 0;
    let vertexDataOffset = 0;
    let indexDataOffset = 0;

    for (let quadIdx = 0; quadIdx < this.quads.length; quadIdx++) {
      const quad = this.quads[quadIdx];
      const normal = vec3.normalize(vec3.cross(quad.right, quad.up));
      quadData[quadDataOffset++] = normal[0];
      quadData[quadDataOffset++] = normal[1];
      quadData[quadDataOffset++] = normal[2];
      quadData[quadDataOffset++] = -vec3.dot(normal, quad.center);

      const invRight = reciprocal(quad.right);
      quadData[quadDataOffset++] = invRight[0];
      quadData[quadDataOffset++] = invRight[1];
      quadData[quadDataOffset++] = invRight[2];
      quadData[quadDataOffset++] = -vec3.dot(invRight, quad.center);

      const invUp = reciprocal(quad.up);
      quadData[quadDataOffset++] = invUp[0];
      quadData[quadDataOffset++] = invUp[1];
      quadData[quadDataOffset++] = invUp[2];
      quadData[quadDataOffset++] = -vec3.dot(invUp, quad.center);

      quadData[quadDataOffset++] = quad.color[0];
      quadData[quadDataOffset++] = quad.color[1];
      quadData[quadDataOffset++] = quad.color[2];
      const emissiveValue = quad.emissive ?? 0;
      quadData[quadDataOffset++] = quad.useMaterial ? (emissiveValue + 0.001) : (-emissiveValue - 0.001);

      const a = vec3.add(vec3.sub(quad.center, quad.right), quad.up);
      const b = vec3.add(vec3.add(quad.center, quad.right), quad.up);
      const c = vec3.sub(vec3.sub(quad.center, quad.right), quad.up);
      const d = vec3.sub(vec3.add(quad.center, quad.right), quad.up);

      const emissive = quad.emissive ?? 0;
      [a, b, c, d].forEach((pos, i) => {
        vertexData[vertexDataOffset++] = pos[0];
        vertexData[vertexDataOffset++] = pos[1];
        vertexData[vertexDataOffset++] = pos[2];
        vertexData[vertexDataOffset++] = 1;
        vertexData[vertexDataOffset++] = i % 2;
        vertexData[vertexDataOffset++] = i < 2 ? 1 : 0;
        vertexData[vertexDataOffset++] = quadIdx;
        vertexData[vertexDataOffset++] = quad.color[0] * emissive;
        vertexData[vertexDataOffset++] = quad.color[1] * emissive;
        vertexData[vertexDataOffset++] = quad.color[2] * emissive;
      });

      indexData[indexDataOffset++] = vertexCount + 0;
      indexData[indexDataOffset++] = vertexCount + 2;
      indexData[indexDataOffset++] = vertexCount + 1;
      indexData[indexDataOffset++] = vertexCount + 1;
      indexData[indexDataOffset++] = vertexCount + 2;
      indexData[indexDataOffset++] = vertexCount + 3;
      indexCount += 6;
      vertexCount += 4;
    }

    quadBuffer.unmap();

    const vertices = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertices.getMappedRange()).set(vertexData);
    vertices.unmap();

    const indices = device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint16Array(indices.getMappedRange()).set(indexData);
    indices.unmap();

    const vertexBufferLayout: GPUVertexBufferLayout[] = [
      {
        arrayStride: vertexStride,
        attributes: [
          { shaderLocation: 0, offset: 0 * 4, format: 'float32x4' },
          { shaderLocation: 1, offset: 4 * 4, format: 'float32x3' },
          { shaderLocation: 2, offset: 7 * 4, format: 'float32x3' },
        ],
      },
    ];

    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
    this.vertices = vertices;
    this.indices = indices;
    this.vertexBufferLayout = vertexBufferLayout;
    this.quadBuffer = quadBuffer;
  }

  /**
   * Load all PBR textures asynchronously
   * Returns texture views for albedo, normal, ARM (combined), and height
   */
  async loadPBRTextures(device: GPUDevice, materialData: MaterialData): Promise<PBRTextures> {
    // Create fallback textures
    const createFallbackTexture = (color: ArrayBuffer) => {
      const tex = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      device.queue.writeTexture({ texture: tex }, color, { bytesPerRow: 4 }, [1, 1, 1]);
      return tex.createView();
    };

    // Default fallback values:
    const fallbackAlbedo = createFallbackTexture(new Uint8Array([255, 255, 255, 255]).buffer);
    const fallbackNormal = createFallbackTexture(new Uint8Array([128, 128, 255, 255]).buffer);
    const fallbackARM = createFallbackTexture(new Uint8Array([255, 128, 0, 255]).buffer);
    const fallbackHeight = createFallbackTexture(new Uint8Array([128, 128, 128, 255]).buffer);

    const loadTexture = async (url: string | undefined): Promise<GPUTextureView | null> => {
      if (!url) return null;
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);

        const texture = device.createTexture({
          size: [imageBitmap.width, imageBitmap.height, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
          { source: imageBitmap },
          { texture },
          [imageBitmap.width, imageBitmap.height]
        );

        return texture.createView();
      } catch (error) {
        console.error('Failed to load texture:', url, error);
        return null;
      }
    };

    // Load all textures in parallel
    const [albedoView, normalView, armView, roughnessView, metallicView, aoView, heightView] = await Promise.all([
      loadTexture(materialData.albedo),
      loadTexture(materialData.normal),
      loadTexture(materialData.arm),
      loadTexture(materialData.roughness),
      loadTexture(materialData.metallic),
      loadTexture(materialData.ao),
      loadTexture(materialData.height),
    ]);

    // If no ARM texture but we have individual roughness/metallic/ao, we still use them
    // The shader will handle this by sampling ARM where:
    // R = AO, G = Roughness, B = Metallic
    // For now, if ARM is not provided, create a combined texture or use fallbacks
    
    let finalARMView = armView;
    if (!armView) {
      // If we don't have ARM but have individual maps, we'll just use the fallback
      // In a more advanced implementation, we could combine them on the GPU
      // For now, if we have roughness, use a gray ARM with that roughness
      finalARMView = fallbackARM;
    }

    const hasMaterial = !!(albedoView || normalView || armView || roughnessView || metallicView || aoView || heightView);

    return {
      albedoView: albedoView || fallbackAlbedo,
      normalView: normalView || fallbackNormal,
      armView: finalARMView,
      heightView: heightView || fallbackHeight,
      hasMaterial,
    };
  }

  private calculateBounds(data: FloorPlanData | undefined, scale: number): {
    centerX: number;
    centerZ: number;
    halfWidth: number;
    halfDepth: number;
    ceilingHeight: number;
  } {
    if (!data || data.walls.length === 0) {
      return {
        centerX: 0,
        centerZ: 0,
        halfWidth: 4,
        halfDepth: 3,
        ceilingHeight: 2.8,
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let maxHeight = 280;

    for (const wall of data.walls) {
      minX = Math.min(minX, wall.startX, wall.endX);
      maxX = Math.max(maxX, wall.startX, wall.endX);
      minY = Math.min(minY, wall.startY, wall.endY);
      maxY = Math.max(maxY, wall.startY, wall.endY);
      maxHeight = Math.max(maxHeight, wall.height);
    }

    return {
      centerX: ((minX + maxX) / 2) * scale,
      centerZ: -((minY + maxY) / 2) * scale,
      halfWidth: ((maxX - minX) / 2) * scale,
      halfDepth: ((maxY - minY) / 2) * scale,
      ceilingHeight: maxHeight * scale,
    };
  }

  private buildSceneQuads(data: FloorPlanData | undefined, scale: number, useMaterial: boolean): Quad[] {
    const quads: Quad[] = [];
    
    const wallColor = vec3.fromValues(0.85, 0.82, 0.78);
    const floorColor = vec3.fromValues(0.55, 0.45, 0.35);
    const ceilingColor = vec3.fromValues(0.95, 0.95, 0.95);

    const bounds = this.calculateBounds(data, scale);
    const { centerX, centerZ, halfWidth, halfDepth, ceilingHeight } = bounds;
    
    const floorPadding = 0.1;
    const extHalfWidth = halfWidth + floorPadding;
    const extHalfDepth = halfDepth + floorPadding;

    // Floor quad
    quads.push({
      center: vec3.fromValues(centerX, 0, centerZ),
      right: vec3.fromValues(extHalfWidth, 0, 0),
      up: vec3.fromValues(0, 0, -extHalfDepth),
      color: floorColor,
      useMaterial: useMaterial,
    });

    // Ceiling quad
    quads.push({
      center: vec3.fromValues(centerX, ceilingHeight, centerZ),
      right: vec3.fromValues(-extHalfWidth, 0, 0),
      up: vec3.fromValues(0, 0, -extHalfDepth),
      color: ceilingColor,
      useMaterial: false,
    });

    if (!data || data.walls.length === 0) {
      const roomSize = 4;
      const roomHeight = 2.8;
      
      quads.push(createWallQuad({
        startX: -roomSize/2, startZ: -roomSize/2,
        endX: roomSize/2, endZ: -roomSize/2,
        height: roomHeight, color: wallColor,
        useMaterial: useMaterial,
      }));
      quads.push(createWallQuad({
        startX: roomSize/2, startZ: roomSize/2,
        endX: -roomSize/2, endZ: roomSize/2,
        height: roomHeight, color: wallColor,
        useMaterial: useMaterial,
      }));
      quads.push(createWallQuad({
        startX: -roomSize/2, startZ: roomSize/2,
        endX: -roomSize/2, endZ: -roomSize/2,
        height: roomHeight, color: vec3.fromValues(0.8, 0.2, 0.2),
        useMaterial: false,
      }));
      quads.push(createWallQuad({
        startX: roomSize/2, startZ: -roomSize/2,
        endX: roomSize/2, endZ: roomSize/2,
        height: roomHeight, color: vec3.fromValues(0.2, 0.8, 0.2),
        useMaterial: false,
      }));
      
      return quads;
    }

    for (const wall of data.walls) {
      const startX = wall.startX * scale;
      const startZ = -wall.startY * scale;
      const endX = wall.endX * scale;
      const endZ = -wall.endY * scale;
      const height = wall.height * scale;

      const length = Math.sqrt((endX - startX) ** 2 + (endZ - startZ) ** 2);
      if (length < 0.001) continue;

      const wallQuad = createWallQuad({
        startX, startZ, endX, endZ, height, color: wallColor,
        useMaterial: useMaterial,
      });
      quads.push(wallQuad);

      const backQuad = createWallQuad({
        startX: endX, startZ: endZ,
        endX: startX, endZ: startZ,
        height, color: wallColor,
        useMaterial: useMaterial,
      });
      quads.push(backQuad);
    }

    return quads;
  }
}
