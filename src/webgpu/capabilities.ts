// WebGPU Capability Detection
// Checks for WebGPU support and available features

export interface WebGPUCapabilities {
  supported: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  features: Set<string>;
  limits: GPUSupportedLimits | null;
  preferredFormat: GPUTextureFormat | null;
  fallbackReason?: string;
}

export interface RendererCapabilities {
  webgpu: boolean;
  webgl2: boolean;
  computeShaders: boolean;
  storageTextures: boolean;
  float32Filterable: boolean;
  maxTextureSize: number;
  maxComputeWorkgroupSize: number;
}

// Check if WebGPU is available and initialize
export async function checkWebGPUSupport(): Promise<WebGPUCapabilities> {
  // Check for navigator.gpu
  if (!navigator.gpu) {
    return {
      supported: false,
      adapter: null,
      device: null,
      features: new Set(),
      limits: null,
      preferredFormat: null,
      fallbackReason: 'WebGPU not available in this browser',
    };
  }

  try {
    // Request adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!adapter) {
      return {
        supported: false,
        adapter: null,
        device: null,
        features: new Set(),
        limits: null,
        preferredFormat: null,
        fallbackReason: 'No suitable GPU adapter found',
      };
    }

    // Request device with required features
    const requiredFeatures: GPUFeatureName[] = [];
    const optionalFeatures: GPUFeatureName[] = [
      'float32-filterable',
      'texture-compression-bc',
    ];

    // Add optional features if supported
    const enabledFeatures: GPUFeatureName[] = [...requiredFeatures];
    for (const feature of optionalFeatures) {
      if (adapter.features.has(feature)) {
        enabledFeatures.push(feature);
      }
    }

    const device = await adapter.requestDevice({
      requiredFeatures: enabledFeatures,
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
      },
    });

    // Get preferred canvas format
    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();

    return {
      supported: true,
      adapter,
      device,
      features: new Set(adapter.features),
      limits: adapter.limits,
      preferredFormat,
    };
  } catch (error) {
    return {
      supported: false,
      adapter: null,
      device: null,
      features: new Set(),
      limits: null,
      preferredFormat: null,
      fallbackReason: `WebGPU initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get comprehensive renderer capabilities
export async function getRendererCapabilities(): Promise<RendererCapabilities> {
  const webgpuCaps = await checkWebGPUSupport();

  // Check WebGL2 as fallback
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  const webgl2 = !!gl;

  if (webgpuCaps.supported && webgpuCaps.limits) {
    return {
      webgpu: true,
      webgl2,
      computeShaders: true,
      storageTextures: webgpuCaps.features.has('storage-textures') || true, // Usually available
      float32Filterable: webgpuCaps.features.has('float32-filterable'),
      maxTextureSize: webgpuCaps.limits.maxTextureDimension2D,
      maxComputeWorkgroupSize: webgpuCaps.limits.maxComputeWorkgroupSizeX,
    };
  }

  // Fallback to WebGL2 capabilities
  if (webgl2 && gl) {
    return {
      webgpu: false,
      webgl2: true,
      computeShaders: false,
      storageTextures: false,
      float32Filterable: !!gl.getExtension('OES_texture_float_linear'),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxComputeWorkgroupSize: 0,
    };
  }

  // No GPU acceleration
  return {
    webgpu: false,
    webgl2: false,
    computeShaders: false,
    storageTextures: false,
    float32Filterable: false,
    maxTextureSize: 2048,
    maxComputeWorkgroupSize: 0,
  };
}

// Quality tier recommendation based on capabilities
export function recommendQualityTier(caps: RendererCapabilities): 'low' | 'medium' | 'high' {
  if (caps.webgpu && caps.computeShaders) {
    // WebGPU with compute - can handle high quality
    if (caps.maxTextureSize >= 8192) {
      return 'high';
    }
    return 'medium';
  }

  if (caps.webgl2) {
    // WebGL2 fallback - medium at best
    if (caps.maxTextureSize >= 4096) {
      return 'medium';
    }
    return 'low';
  }

  return 'low';
}
