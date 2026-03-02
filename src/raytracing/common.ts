import { mat4, vec3 } from 'wgpu-matrix';
import commonWGSL from './common.wgsl?raw';
import { FloorPlanData } from './scene';

/**
 * Common holds the shared WGSL between the shaders, including the common uniform buffer.
 * Now supports FPS-style camera controls with WASD movement and mouse look.
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

  // FPS Camera state
  private posX = 0;
  private posY = 1.7; // Eye height (~170cm)
  private posZ = 0;
  private yaw = 0; // Horizontal rotation (radians)
  private pitch = 0; // Vertical rotation (radians)
  
  // Movement state
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveSpeed = 3.0; // Units per second
  private lastTime = performance.now();
  
  // Mouse sensitivity
  private mouseSensitivity = 0.002;
  
  // Pointer lock state
  private isPointerLocked = false;

  constructor(device: GPUDevice, quads: GPUBuffer, floorPlanData?: FloorPlanData) {
    this.device = device;
    this.uniformBuffer = device.createBuffer({
      label: 'Common.uniformBuffer',
      size:
        0 + //
        4 * 16 + // mvp
        4 * 16 + // inv_mvp
        4 * 4, // seed
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Calculate spawn position from floor plan center
    if (floorPlanData && floorPlanData.walls.length > 0) {
      const scale = 0.01;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let maxHeight = 280;

      for (const wall of floorPlanData.walls) {
        minX = Math.min(minX, wall.startX, wall.endX);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxY = Math.max(maxY, wall.startY, wall.endY);
        maxHeight = Math.max(maxHeight, wall.height);
      }

      // Spawn at center of floor plan
      this.posX = ((minX + maxX) / 2) * scale;
      this.posZ = -((minY + maxY) / 2) * scale; // Negate Y → Z
      this.posY = 1.7; // Eye height
      
      // Face toward positive Z (into the room)
      this.yaw = 0;
      this.pitch = 0;
    }

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
      ],
    });

    this.uniforms = { bindGroupLayout, bindGroup };
  }

  /** Handle mouse look (when pointer is locked) */
  handleMouseMove(deltaX: number, deltaY: number) {
    if (!this.isPointerLocked) return;
    
    this.yaw -= deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;
    
    // Clamp pitch to prevent looking too far up/down
    this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
  }

  /** Handle key down for WASD movement */
  handleKeyDown(key: string) {
    switch (key.toLowerCase()) {
      case 'w': this.moveForward = true; break;
      case 's': this.moveBackward = true; break;
      case 'a': this.moveLeft = true; break;
      case 'd': this.moveRight = true; break;
    }
  }

  /** Handle key up for WASD movement */
  handleKeyUp(key: string) {
    switch (key.toLowerCase()) {
      case 'w': this.moveForward = false; break;
      case 's': this.moveBackward = false; break;
      case 'a': this.moveLeft = false; break;
      case 'd': this.moveRight = false; break;
    }
  }

  /** Set pointer lock state */
  setPointerLocked(locked: boolean) {
    this.isPointerLocked = locked;
  }

  /** Get pointer lock state */
  getPointerLocked(): boolean {
    return this.isPointerLocked;
  }

  /** Reset camera to spawn position */
  resetCamera(floorPlanData?: FloorPlanData) {
    if (floorPlanData && floorPlanData.walls.length > 0) {
      const scale = 0.01;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      for (const wall of floorPlanData.walls) {
        minX = Math.min(minX, wall.startX, wall.endX);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxY = Math.max(maxY, wall.startY, wall.endY);
      }

      this.posX = ((minX + maxX) / 2) * scale;
      this.posZ = -((minY + maxY) / 2) * scale;
    } else {
      this.posX = 0;
      this.posZ = 0;
    }
    this.posY = 1.7;
    this.yaw = 0;
    this.pitch = 0;
  }

  /** Updates the uniform buffer data with FPS camera */
  update(params: { rotateCamera: boolean; aspect: number }) {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Process movement
    if (this.isPointerLocked) {
      // Calculate forward and right vectors (on XZ plane for walking)
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      let moveX = 0;
      let moveZ = 0;

      if (this.moveForward) {
        moveX += forwardX;
        moveZ += forwardZ;
      }
      if (this.moveBackward) {
        moveX -= forwardX;
        moveZ -= forwardZ;
      }
      if (this.moveLeft) {
        moveX -= rightX;
        moveZ -= rightZ;
      }
      if (this.moveRight) {
        moveX += rightX;
        moveZ += rightZ;
      }

      // Normalize and apply speed
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (len > 0) {
        moveX = (moveX / len) * this.moveSpeed * deltaTime;
        moveZ = (moveZ / len) * this.moveSpeed * deltaTime;
        this.posX += moveX;
        this.posZ += moveZ;
      }
    }

    const projectionMatrix = mat4.perspective(
      (2 * Math.PI) / 5, // ~72 degree FOV for FPS
      params.aspect,
      0.1,
      100
    );

    // Calculate look direction from yaw and pitch
    const lookX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const lookY = Math.sin(this.pitch);
    const lookZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

    const viewMatrix = mat4.lookAt(
      vec3.fromValues(this.posX, this.posY, this.posZ),
      vec3.fromValues(
        this.posX + lookX,
        this.posY + lookY,
        this.posZ + lookZ
      ),
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
