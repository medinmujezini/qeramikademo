import raytracerWGSL from './raytracer.wgsl?raw';

import Common from './common';
import Radiosity from './radiosity';
import { PBRTextures } from './scene';

/**
 * Raytracer renders the scene using a software ray-tracing compute pipeline.
 * Supports full PBR materials with albedo, normal, ARM (AO/Roughness/Metallic), and height maps.
 */
export default class Raytracer {
  private readonly common: Common;
  private readonly framebuffer: GPUTexture;
  private readonly pipeline: GPUComputePipeline;
  private readonly bindGroup: GPUBindGroup;

  private readonly kWorkgroupSizeX = 16;
  private readonly kWorkgroupSizeY = 16;

  constructor(
    device: GPUDevice,
    common: Common,
    radiosity: Radiosity,
    framebuffer: GPUTexture,
    pbrTextures?: PBRTextures
  ) {
    this.common = common;
    this.framebuffer = framebuffer;
    
    // Create fallback textures for when no material is provided
    const createFallbackTexture = (color: ArrayBuffer) => {
      const tex = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      device.queue.writeTexture({ texture: tex }, color, { bytesPerRow: 4 }, [1, 1, 1]);
      return tex.createView();
    };
    
    const fallbackAlbedo = createFallbackTexture(new Uint8Array([255, 255, 255, 255]).buffer);
    const fallbackNormal = createFallbackTexture(new Uint8Array([128, 128, 255, 255]).buffer);
    const fallbackARM = createFallbackTexture(new Uint8Array([255, 128, 0, 255]).buffer);
    const fallbackHeight = createFallbackTexture(new Uint8Array([128, 128, 128, 255]).buffer);
    
    const albedoView = pbrTextures?.albedoView || fallbackAlbedo;
    const normalView = pbrTextures?.normalView || fallbackNormal;
    const armView = pbrTextures?.armView || fallbackARM;
    const heightView = pbrTextures?.heightView || fallbackHeight;
    
    // Create sampler for PBR textures (repeating)
    const pbrSampler = device.createSampler({
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
    
    const bindGroupLayout = device.createBindGroupLayout({
      label: 'Raytracer.bindGroupLayout',
      entries: [
        {
          // lightmap
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
          texture: { viewDimension: '2d-array' },
        },
        {
          // sampler
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
          sampler: {},
        },
        {
          // framebuffer
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: 'write-only',
            format: framebuffer.format,
            viewDimension: '2d',
          },
        },
        {
          // albedo texture
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          texture: { viewDimension: '2d' },
        },
        {
          // normal texture
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          texture: { viewDimension: '2d' },
        },
        {
          // ARM texture (AO, Roughness, Metallic)
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          texture: { viewDimension: '2d' },
        },
        {
          // height texture
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          texture: { viewDimension: '2d' },
        },
        {
          // PBR sampler
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          sampler: {},
        },
      ],
    });

    this.bindGroup = device.createBindGroup({
      label: 'rendererBindGroup',
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: radiosity.lightmap.createView(),
        },
        {
          binding: 1,
          resource: device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
            magFilter: 'linear',
            minFilter: 'linear',
          }),
        },
        {
          binding: 2,
          resource: framebuffer.createView(),
        },
        {
          binding: 3,
          resource: albedoView,
        },
        {
          binding: 4,
          resource: normalView,
        },
        {
          binding: 5,
          resource: armView,
        },
        {
          binding: 6,
          resource: heightView,
        },
        {
          binding: 7,
          resource: pbrSampler,
        },
      ],
    });

    this.pipeline = device.createComputePipeline({
      label: 'raytracerPipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [common.uniforms.bindGroupLayout, bindGroupLayout],
      }),
      compute: {
        module: device.createShaderModule({
          code: raytracerWGSL + common.wgsl,
        }),
        constants: {
          WorkgroupSizeX: this.kWorkgroupSizeX,
          WorkgroupSizeY: this.kWorkgroupSizeY,
        },
      },
    });
  }

  run(commandEncoder: GPUCommandEncoder) {
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.common.uniforms.bindGroup);
    passEncoder.setBindGroup(1, this.bindGroup);
    passEncoder.dispatchWorkgroups(
      Math.ceil(this.framebuffer.width / this.kWorkgroupSizeX),
      Math.ceil(this.framebuffer.height / this.kWorkgroupSizeY)
    );
    passEncoder.end();
  }
}
