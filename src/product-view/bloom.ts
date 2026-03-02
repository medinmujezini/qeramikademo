import bloomWGSL from './bloom.wgsl?raw';

export interface BloomSettings {
  threshold: number;
  intensity: number;
  radius: number;
}

/**
 * Bloom implements a multi-pass bloom effect for HDR rendering.
 */
export default class Bloom {
  private readonly extractPipeline: GPUComputePipeline;
  private readonly blurHPipeline: GPUComputePipeline;
  private readonly blurVPipeline: GPUComputePipeline;
  private readonly compositePipeline: GPUComputePipeline;
  
  private readonly extractBindGroup: GPUBindGroup;
  private readonly blurHBindGroup: GPUBindGroup;
  private readonly blurVBindGroup: GPUBindGroup;
  private readonly compositeBindGroup: GPUBindGroup;
  
  private readonly settingsBuffer: GPUBuffer;
  private readonly device: GPUDevice;
  private readonly width: number;
  private readonly height: number;
  private readonly kWorkgroupSizeX = 16;
  private readonly kWorkgroupSizeY = 16;

  constructor(
    device: GPUDevice,
    input: GPUTexture,
    output: GPUTexture
  ) {
    this.device = device;
    this.width = input.width;
    this.height = input.height;

    // Settings buffer
    this.settingsBuffer = device.createBuffer({
      label: 'Bloom.settingsBuffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create intermediate textures
    const brightTexture = device.createTexture({
      label: 'Bloom.brightTexture',
      size: [this.width, this.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    const blurTempTexture = device.createTexture({
      label: 'Bloom.blurTempTexture',
      size: [this.width, this.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Bind group layouts
    const extractLayout = device.createBindGroupLayout({
      label: 'Bloom.extractLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } }, // unused but needed for layout compat
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    const blurLayout = device.createBindGroupLayout({
      label: 'Bloom.blurLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } }, // unused
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    const compositeLayout = device.createBindGroupLayout({
      label: 'Bloom.compositeLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    const mod = device.createShaderModule({ code: bloomWGSL });

    const extractPipelineLayout = device.createPipelineLayout({
      label: 'Bloom.extractPipelineLayout',
      bindGroupLayouts: [extractLayout],
    });

    const blurPipelineLayout = device.createPipelineLayout({
      label: 'Bloom.blurPipelineLayout',
      bindGroupLayouts: [blurLayout],
    });

    const compositePipelineLayout = device.createPipelineLayout({
      label: 'Bloom.compositePipelineLayout',
      bindGroupLayouts: [compositeLayout],
    });

    const constants = {
      WorkgroupSizeX: this.kWorkgroupSizeX,
      WorkgroupSizeY: this.kWorkgroupSizeY,
    };

    this.extractPipeline = device.createComputePipeline({
      label: 'Bloom.extractPipeline',
      layout: extractPipelineLayout,
      compute: { module: mod, entryPoint: 'extractBright', constants },
    });

    this.blurHPipeline = device.createComputePipeline({
      label: 'Bloom.blurHPipeline',
      layout: blurPipelineLayout,
      compute: { module: mod, entryPoint: 'blurHorizontal', constants },
    });

    this.blurVPipeline = device.createComputePipeline({
      label: 'Bloom.blurVPipeline',
      layout: blurPipelineLayout,
      compute: { module: mod, entryPoint: 'blurVertical', constants },
    });

    this.compositePipeline = device.createComputePipeline({
      label: 'Bloom.compositePipeline',
      layout: compositePipelineLayout,
      compute: { module: mod, entryPoint: 'composite', constants },
    });

    // Bind groups - using input as placeholder for unused binding 2 in extract/blur
    this.extractBindGroup = device.createBindGroup({
      label: 'Bloom.extractBindGroup',
      layout: extractLayout,
      entries: [
        { binding: 0, resource: input.createView() },
        { binding: 1, resource: brightTexture.createView() },
        { binding: 2, resource: input.createView() }, // placeholder
        { binding: 3, resource: { buffer: this.settingsBuffer } },
      ],
    });

    this.blurHBindGroup = device.createBindGroup({
      label: 'Bloom.blurHBindGroup',
      layout: blurLayout,
      entries: [
        { binding: 0, resource: brightTexture.createView() },
        { binding: 1, resource: blurTempTexture.createView() },
        { binding: 2, resource: brightTexture.createView() }, // placeholder
        { binding: 3, resource: { buffer: this.settingsBuffer } },
      ],
    });

    this.blurVBindGroup = device.createBindGroup({
      label: 'Bloom.blurVBindGroup',
      layout: blurLayout,
      entries: [
        { binding: 0, resource: blurTempTexture.createView() },
        { binding: 1, resource: brightTexture.createView() },
        { binding: 2, resource: blurTempTexture.createView() }, // placeholder
        { binding: 3, resource: { buffer: this.settingsBuffer } },
      ],
    });

    this.compositeBindGroup = device.createBindGroup({
      label: 'Bloom.compositeBindGroup',
      layout: compositeLayout,
      entries: [
        { binding: 0, resource: input.createView() },
        { binding: 1, resource: output.createView() },
        { binding: 2, resource: brightTexture.createView() },
        { binding: 3, resource: { buffer: this.settingsBuffer } },
      ],
    });
  }

  updateSettings(settings: BloomSettings) {
    const data = new Float32Array([
      settings.threshold,
      settings.intensity,
      settings.radius,
      0, // padding
    ]);
    this.device.queue.writeBuffer(this.settingsBuffer, 0, data);
  }

  run(commandEncoder: GPUCommandEncoder, blurPasses: number = 3) {
    const workgroupsX = Math.ceil(this.width / this.kWorkgroupSizeX);
    const workgroupsY = Math.ceil(this.height / this.kWorkgroupSizeY);

    // Extract
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.extractPipeline);
      pass.setBindGroup(0, this.extractBindGroup);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
    }

    // Multi-pass blur
    for (let i = 0; i < blurPasses; i++) {
      {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.blurHPipeline);
        pass.setBindGroup(0, this.blurHBindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
      }
      {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.blurVPipeline);
        pass.setBindGroup(0, this.blurVBindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
      }
    }

    // Composite
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.compositePipeline);
      pass.setBindGroup(0, this.compositeBindGroup);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
    }
  }
}
