import { mat4, vec3 } from 'wgpu-matrix';
import commonWGSL from './common.wgsl?raw';

/**
 * Common holds the shared WGSL between the shaders, including the common uniform buffer.
 */
export default class Common {
  /** The WGSL of the common shader */
  readonly wgsl = commonWGSL;
  /** The common uniform buffer bind group and layout */
  readonly uniforms: {
    bindGroupLayout: GPUBindGroupLayout;
    bindGroup: GPUBindGroup;
  };

  private readonly device: GPUDevice;
  private readonly uniformBuffer: GPUBuffer;

  private frame = 0;

  // Camera control state
  private cameraTheta = 0; // Horizontal angle (azimuth)
  private cameraPhi = 0.3; // Vertical angle (elevation) - slightly above center
  private cameraDistance = 15; // Distance from target
  private targetY = 5; // Look-at target Y position

  constructor(device: GPUDevice, quads: GPUBuffer, triangles: GPUBuffer, triangleCount: number) {
    this.device = device;
    this.uniformBuffer = device.createBuffer({
      label: 'Common.uniformBuffer',
      size:
        0 + //
        4 * 16 + // mvp
        4 * 16 + // inv_mvp
        4 * 4, // seed (vec3u) + triangle_count (u32)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      label: 'Common.bindGroupLayout',
      entries: [
        {
          // common_uniforms
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          // quads
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        {
          // triangles
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    const bindGroup = device.createBindGroup({
      label: 'Common.bindGroup',
      layout: bindGroupLayout,
      entries: [
        {
          // common_uniforms
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
            offset: 0,
            size: this.uniformBuffer.size,
          },
        },
        {
          // quads
          binding: 1,
          resource: {
            buffer: quads,
            offset: 0,
            size: quads.size,
          },
        },
        {
          // triangles
          binding: 2,
          resource: {
            buffer: triangles,
            offset: 0,
            size: triangles.size,
          },
        },
      ],
    });

    this.uniforms = { bindGroupLayout, bindGroup };
    this.triangleCount = triangleCount;
  }

  private triangleCount: number;

  /** Update camera angles from orbit controls */
  updateCamera(deltaTheta: number, deltaPhi: number, deltaZoom: number) {
    this.cameraTheta += deltaTheta;
    this.cameraPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPhi + deltaPhi));
    this.cameraDistance = Math.max(5, Math.min(30, this.cameraDistance + deltaZoom));
  }

  /** Reset camera to default position */
  resetCamera() {
    this.cameraTheta = 0;
    this.cameraPhi = 0.3;
    this.cameraDistance = 15;
  }

  /** Updates the uniform buffer data */
  update(params: { rotateCamera: boolean; aspect: number }) {
    const projectionMatrix = mat4.perspective(
      (2 * Math.PI) / 8,
      params.aspect,
      0.5,
      100
    );

    // Auto-rotate if enabled, otherwise use orbit controls
    const viewRotation = params.rotateCamera ? this.frame / 1000 : this.cameraTheta;
    const elevation = params.rotateCamera ? 0 : this.cameraPhi;
    const distance = params.rotateCamera ? 15 : this.cameraDistance;

    const viewMatrix = mat4.lookAt(
      vec3.fromValues(
        Math.sin(viewRotation) * Math.cos(elevation) * distance,
        this.targetY + Math.sin(elevation) * distance,
        Math.cos(viewRotation) * Math.cos(elevation) * distance
      ),
      vec3.fromValues(0, this.targetY, 0),
      vec3.fromValues(0, 1, 0)
    );
    const mvp = mat4.multiply(projectionMatrix, viewMatrix);
    const invMVP = mat4.invert(mvp);

    const uniformDataF32 = new Float32Array(this.uniformBuffer.size / 4);
    const uniformDataU32 = new Uint32Array(uniformDataF32.buffer);
    for (let i = 0; i < 16; i++) {
      uniformDataF32[i] = mvp[i];
    }
    for (let i = 0; i < 16; i++) {
      uniformDataF32[i + 16] = invMVP[i];
    }
    uniformDataU32[32] = 0xffffffff * Math.random();
    uniformDataU32[33] = 0xffffffff * Math.random();
    uniformDataU32[34] = 0xffffffff * Math.random();
    uniformDataU32[35] = this.triangleCount; // triangle_count

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      uniformDataF32.buffer,
      uniformDataF32.byteOffset,
      uniformDataF32.byteLength
    );

    this.frame++;
  }
}
