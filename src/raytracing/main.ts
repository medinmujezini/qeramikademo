import { GUI } from 'dat.gui';
import Scene, { FloorPlanData, MaterialData, PBRTextures } from './scene';
import Common from './common';
import Radiosity from './radiosity';
import Rasterizer from './rasterizer';
import Tonemapper from './tonemapper';
import Raytracer from './raytracer';
import Bloom from './bloom';
import PostProcess from './postprocess';
import {
  quitIfAdapterNotAvailable,
  quitIfWebGPUNotAvailable,
  quitIfLimitLessThan,
} from './util';

/**
 * Initialize the Raytracing WebGPU renderer with floor plan walls and optional PBR material.
 * Uses FPS-style controls: click to lock pointer, WASD to move, mouse to look.
 */
export async function initRaytracing(
  canvas: HTMLCanvasElement, 
  floorPlanData?: FloorPlanData,
  materialData?: MaterialData
): Promise<() => void> {
  const adapter = await navigator.gpu?.requestAdapter({ featureLevel: 'compatibility' });
  quitIfAdapterNotAvailable(adapter);

  const features: GPUFeatureName[] = [];
  let presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  if (presentationFormat == 'bgra8unorm') {
    if (adapter.features.has('bgra8unorm-storage')) {
      features.push('bgra8unorm-storage');
    } else {
      presentationFormat = 'rgba8unorm';
    }
  }
  const limits: Record<string, GPUSize32> = {};
  quitIfLimitLessThan(adapter, 'maxComputeWorkgroupSizeX', 256, limits);
  quitIfLimitLessThan(adapter, 'maxComputeInvocationsPerWorkgroup', 256, limits);
  const device = await adapter?.requestDevice({ requiredFeatures: features, requiredLimits: limits });
  quitIfWebGPUNotAvailable(adapter, device);

  device.lost.then((info) => console.error(`WebGPU device was lost: ${info.message}`));

  const isMobile = window.innerWidth < 768;
  const getPixelRatio = () => isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;

  const params = {
    renderer: 'raytracer' as 'rasterizer' | 'raytracer',
    rotateCamera: false,
    bloomEnabled: true,
    bloomThreshold: 1.2,
    bloomIntensity: 0.15,
    bloomRadius: 5,
    bloomPasses: 4,
    aaMode: 2,
    brightness: 1.0,
    contrast: 1.1,
    saturation: 1.1,
    gamma: 1.0,
    temperature: 0.0,
    tint: 0.0,
    denoiseEnabled: true,
    denoiseStrength: 1.0,
    denoiseBlurRadius: 5,
    denoiseEdgeSensitivity: 0.1,
    vignetteIntensity: 0.55,
    vignetteRadius: 0.65,
    chromaticAberration: 0.2,
    grainIntensity: 0,
    grainSize: 1.5,
    sharpness: 0.15,
    lensDistortion: -0.06,
  };

  const gui = new GUI({ width: isMobile ? 200 : 280 });
  const rendererFolder = gui.addFolder('Renderer');
  rendererFolder.add(params, 'renderer', ['rasterizer', 'raytracer']);
  if (!isMobile) rendererFolder.open();

  const bloomFolder = gui.addFolder('Bloom');
  bloomFolder.add(params, 'bloomEnabled').name('Enabled');
  bloomFolder.add(params, 'bloomThreshold', 0.1, 1.5, 0.05).name('Threshold');
  bloomFolder.add(params, 'bloomIntensity', 0, 2, 0.05).name('Intensity');
  bloomFolder.add(params, 'bloomRadius', 1, 8, 0.5).name('Radius');
  bloomFolder.add(params, 'bloomPasses', 1, 8, 1).name('Blur Passes');
  if (!isMobile) bloomFolder.open();

  const aaFolder = gui.addFolder('Anti-Aliasing');
  aaFolder.add(params, 'aaMode', { 'Off': 0, 'FXAA': 1, 'SMAA-lite': 2 }).name('Mode');
  aaFolder.add(params, 'sharpness', 0, 1, 0.05).name('Sharpness');

  const colorFolder = gui.addFolder('Color Correction');
  colorFolder.add(params, 'brightness', 0.5, 2, 0.05).name('Brightness');
  colorFolder.add(params, 'contrast', 0.5, 2, 0.05).name('Contrast');
  colorFolder.add(params, 'saturation', 0, 2, 0.05).name('Saturation');
  colorFolder.add(params, 'gamma', 0.5, 2.5, 0.05).name('Gamma');

  const effectsFolder = gui.addFolder('Effects');
  effectsFolder.add(params, 'vignetteIntensity', 0, 1, 0.05).name('Vignette');
  effectsFolder.add(params, 'vignetteRadius', 0.2, 1, 0.05).name('Vignette Size');
  effectsFolder.add(params, 'chromaticAberration', 0, 5, 0.1).name('Chromatic');
  effectsFolder.add(params, 'lensDistortion', -0.5, 0.5, 0.02).name('Lens Distort');
  if (!isMobile) effectsFolder.open();

  const updateCanvasSize = () => {
    const pixelRatio = getPixelRatio();
    canvas.width = canvas.clientWidth * pixelRatio;
    canvas.height = canvas.clientHeight * pixelRatio;
    return { width: canvas.width, height: canvas.height };
  };

  let { width: canvasWidth, height: canvasHeight } = updateCanvasSize();

  const context = canvas.getContext('webgpu');
  context!.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  const createTextures = (width: number, height: number) => ({
    framebuffer: device.createTexture({
      label: 'framebuffer', size: [width, height], format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    }),
    postBloomBuffer: device.createTexture({
      label: 'postBloomBuffer', size: [width, height], format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    }),
    postTonemapBuffer: device.createTexture({
      label: 'postTonemapBuffer', size: [width, height], format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    }),
  });

  let textures = createTextures(canvasWidth, canvasHeight);

  // Create scene with floor plan data and material
  const scene = new Scene(device, floorPlanData, materialData);
  const common = new Common(device, scene.quadBuffer, floorPlanData);
  const radiosity = new Radiosity(device, common, scene);
  
  // Load all PBR material textures
  let pbrTextures: PBRTextures | undefined;
  if (materialData && (materialData.albedo || materialData.normal || materialData.arm || 
      materialData.roughness || materialData.metallic || materialData.ao || materialData.height)) {
    pbrTextures = await scene.loadPBRTextures(device, materialData);
  }
  
  let rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
  let raytracer = new Raytracer(device, common, radiosity, textures.framebuffer, pbrTextures);
  let bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
  let tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
  let tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);

  let resizeTimeout: number | null = null;
  const handleResize = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const { width, height } = updateCanvasSize();
      if (width !== canvasWidth || height !== canvasHeight) {
        canvasWidth = width;
        canvasHeight = height;
        context!.configure({ device, format: presentationFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING });
        textures.framebuffer.destroy();
        textures.postBloomBuffer.destroy();
        textures.postTonemapBuffer.destroy();
        textures = createTextures(width, height);
        rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
        raytracer = new Raytracer(device, common, radiosity, textures.framebuffer, pbrTextures);
        bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
        tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
        tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);
      }
    }, 150);
  };
  window.addEventListener('resize', handleResize);

  // FPS Controls - pointer lock for mouse look
  const handleCanvasClick = () => {
    if (!common.getPointerLocked()) {
      canvas.requestPointerLock();
    }
  };

  const handlePointerLockChange = () => {
    const locked = document.pointerLockElement === canvas;
    common.setPointerLocked(locked);
    canvas.style.cursor = locked ? 'none' : 'crosshair';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (common.getPointerLocked()) {
      common.handleMouseMove(e.movementX, e.movementY);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return;
    common.handleKeyDown(e.key);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    common.handleKeyUp(e.key);
  };

  // Touch controls for mobile
  let lastTouchX = 0, lastTouchY = 0;
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      common.setPointerLocked(true);
    }
  };
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && common.getPointerLocked()) {
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      common.handleMouseMove(dx, dy);
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  };
  const handleTouchEnd = () => {};

  const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };

  canvas.style.cursor = 'crosshair';
  
  canvas.addEventListener('click', handleCanvasClick);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('contextmenu', handleContextMenu);
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleTouchEnd);

  let animationFrameId: number | null = null;
  let isRunning = true;

  function frame() {
    if (!isRunning) return;
    const canvasTexture = context!.getCurrentTexture();
    const commandEncoder = device.createCommandEncoder();
    common.update({ rotateCamera: params.rotateCamera, aspect: canvasWidth / canvasHeight });
    radiosity.run(commandEncoder);
    if (params.renderer === 'rasterizer') rasterizer.run(commandEncoder);
    else raytracer.run(commandEncoder);
    if (params.bloomEnabled) {
      bloom.updateSettings({ threshold: params.bloomThreshold, intensity: params.bloomIntensity, radius: params.bloomRadius });
      bloom.run(commandEncoder, params.bloomPasses);
      tonemapperWithBloom.run(commandEncoder);
    } else {
      tonemapperNoBloom.run(commandEncoder);
    }
    const postProcess = new PostProcess(device, textures.postTonemapBuffer, canvasTexture);
    postProcess.updateSettings({
      brightness: params.brightness, contrast: params.contrast, saturation: params.saturation, gamma: params.gamma,
      temperature: params.temperature, tint: params.tint, vignetteIntensity: params.vignetteIntensity, vignetteRadius: params.vignetteRadius,
      chromaticAberration: params.chromaticAberration, grainIntensity: params.grainIntensity, grainSize: params.grainSize,
      sharpness: params.sharpness, aaMode: params.aaMode, lensDistortion: params.lensDistortion,
    });
    postProcess.run(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);
    animationFrameId = requestAnimationFrame(frame);
  }
  animationFrameId = requestAnimationFrame(frame);

  return () => {
    isRunning = false;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    if (resizeTimeout) clearTimeout(resizeTimeout);
    
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    
    window.removeEventListener('resize', handleResize);
    canvas.removeEventListener('click', handleCanvasClick);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    canvas.removeEventListener('contextmenu', handleContextMenu);
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
    
    gui.destroy();
    textures.framebuffer.destroy();
    textures.postBloomBuffer.destroy();
    textures.postTonemapBuffer.destroy();
    context?.unconfigure();
    device.destroy();
  };
}
