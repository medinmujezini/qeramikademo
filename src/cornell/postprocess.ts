import postprocessWGSL from './postprocess.wgsl?raw';

export interface PostProcessSettings {
  // Color correction
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  
  // Color temperature
  temperature: number;
  tint: number;
  
  // Vignette
  vignetteIntensity: number;
  vignetteRadius: number;
  
  // Chromatic aberration
  chromaticAberration: number;
  
  // Film grain
  grainIntensity: number;
  grainSize: number;
  
  // Sharpness
  sharpness: number;
  
  // AA mode: 0=off, 1=FXAA, 2=SMAA-lite
  aaMode: number;
  
  // Lens distortion
  lensDistortion: number;
}

/**
 * PostProcess combines all post-processing effects into a single pass.
 */
export default class PostProcess {
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPUComputePipeline;
  private readonly settingsBuffer: GPUBuffer;
  private readonly device: GPUDevice;
  private readonly width: number;
  private readonly height: number;
  private readonly kWorkgroupSizeX = 16;
  private readonly kWorkgroupSizeY = 16;
  private time = 0;

  constructor(
    device: GPUDevice,
    input: GPUTexture,
    output: GPUTexture
  ) {
    this.device = device;
    this.width = input.width;
    this.height = input.height;

    // 16 floats = 64 bytes, but aaMode is u32 at offset 52
    // Total struct size: 17 values * 4 bytes = 68 bytes, padded to 80 for alignment
    this.settingsBuffer = device.createBuffer({
      label: 'PostProcess.settingsBuffer',
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      label: 'PostProcess.bindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: output.format, viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.bindGroup = device.createBindGroup({
      label: 'PostProcess.bindGroup',
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: input.createView() },
        { binding: 1, resource: output.createView() },
        { binding: 2, resource: { buffer: this.settingsBuffer } },
      ],
    });

    const mod = device.createShaderModule({
      code: postprocessWGSL.replace('{OUTPUT_FORMAT}', output.format),
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'PostProcess.pipelineLayout',
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = device.createComputePipeline({
      label: 'PostProcess.pipeline',
      layout: pipelineLayout,
      compute: {
        module: mod,
        constants: {
          WorkgroupSizeX: this.kWorkgroupSizeX,
          WorkgroupSizeY: this.kWorkgroupSizeY,
        },
      },
    });
  }

  updateSettings(settings: PostProcessSettings) {
    this.time += 0.016; // ~60fps time increment
    
    const buffer = new ArrayBuffer(80);
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);
    
    // Pack settings into buffer matching WGSL struct layout
    floatView[0] = settings.brightness;
    floatView[1] = settings.contrast;
    floatView[2] = settings.saturation;
    floatView[3] = settings.gamma;
    floatView[4] = settings.temperature;
    floatView[5] = settings.tint;
    floatView[6] = settings.vignetteIntensity;
    floatView[7] = settings.vignetteRadius;
    floatView[8] = settings.chromaticAberration;
    floatView[9] = settings.grainIntensity;
    floatView[10] = settings.grainSize;
    floatView[11] = settings.sharpness;
    uintView[12] = settings.aaMode; // u32
    floatView[13] = this.time;
    floatView[14] = settings.lensDistortion;
    
    this.device.queue.writeBuffer(this.settingsBuffer, 0, buffer);
  }

  run(commandEncoder: GPUCommandEncoder) {
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.dispatchWorkgroups(
      Math.ceil(this.width / this.kWorkgroupSizeX),
      Math.ceil(this.height / this.kWorkgroupSizeY)
    );
    passEncoder.end();
  }
}
