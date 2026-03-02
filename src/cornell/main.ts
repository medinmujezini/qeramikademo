import { GUI } from "dat.gui";
import Scene from "./scene";
import Common from "./common";
import Radiosity from "./radiosity";
import Rasterizer from "./rasterizer";
import Tonemapper from "./tonemapper";
import Raytracer from "./raytracer";
import Bloom from "./bloom";
import PostProcess from "./postprocess";
import { quitIfAdapterNotAvailable, quitIfWebGPUNotAvailable, quitIfLimitLessThan } from "./util";

/**
 * Initialize the Cornell Box WebGPU renderer.
 * @param canvas - The canvas element to render to
 * @returns A cleanup function to properly dispose of all resources
 */
export async function initCornell(canvas: HTMLCanvasElement): Promise<() => void> {
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: "compatibility",
  });
  quitIfAdapterNotAvailable(adapter);

  const features: GPUFeatureName[] = [];
  let presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  if (presentationFormat == "bgra8unorm") {
    if (adapter.features.has("bgra8unorm-storage")) {
      features.push("bgra8unorm-storage");
    } else {
      presentationFormat = "rgba8unorm";
    }
  }
  const limits: Record<string, GPUSize32> = {};
  quitIfLimitLessThan(adapter, "maxComputeWorkgroupSizeX", 256, limits);
  quitIfLimitLessThan(adapter, "maxComputeInvocationsPerWorkgroup", 256, limits);
  const device = await adapter?.requestDevice({
    requiredFeatures: features,
    requiredLimits: limits,
  });
  quitIfWebGPUNotAvailable(adapter, device);

  // Handle device lost
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);
  });

  // Mobile detection
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

  // Scale down pixel ratio on mobile for performance
  const getPixelRatio = () => {
    if (isMobile) return Math.min(window.devicePixelRatio, 1.5);
    if (isTablet) return Math.min(window.devicePixelRatio, 2);
    return window.devicePixelRatio;
  };

  const params = {
    // Renderer - raytracer as default
    renderer: "raytracer" as "rasterizer" | "raytracer",
    rotateCamera: false,

    // Bloom settings
    bloomEnabled: true,
    bloomThreshold: 1.2,
    bloomIntensity: 0.15,
    bloomRadius: 5,
    bloomPasses: 4,

    // Anti-aliasing: 0=off, 1=FXAA, 2=SMAA-lite
    aaMode: 2,

    // Color correction
    brightness: 1.0,
    contrast: 1.1,
    saturation: 1.1,
    gamma: 1.0,

    // Color temperature
    temperature: -1.0,
    tint: 0.0,

    // Denoise
    denoiseEnabled: true,
    denoiseStrength: 1.0,
    denoiseBlurRadius: 5,
    denoiseEdgeSensitivity: 0.1,

    // Vignette
    vignetteIntensity: 0.55,
    vignetteRadius: 0.65,

    // Chromatic aberration
    chromaticAberration: 0.2,

    // Film grain
    grainIntensity: 0,
    grainSize: 1.5,

    // Sharpness
    sharpness: 0.15,

    // Lens distortion
    lensDistortion: -0.06,
  };

  // Create mobile-optimized GUI
  const guiWidth = isMobile ? 200 : 280;
  const gui = new GUI({ width: guiWidth });

  // Renderer folder
  const rendererFolder = gui.addFolder("Renderer");
  rendererFolder.add(params, "renderer", ["rasterizer", "raytracer"]);
  rendererFolder.add(params, "rotateCamera");
  if (!isMobile) rendererFolder.open();

  // Bloom folder
  const bloomFolder = gui.addFolder("Bloom");
  bloomFolder.add(params, "bloomEnabled").name("Enabled");
  bloomFolder.add(params, "bloomThreshold", 0.1, 1.5, 0.05).name("Threshold");
  bloomFolder.add(params, "bloomIntensity", 0, 2, 0.05).name("Intensity");
  bloomFolder.add(params, "bloomRadius", 1, 8, 0.5).name("Radius");
  bloomFolder.add(params, "bloomPasses", 1, 8, 1).name("Blur Passes");
  if (!isMobile) bloomFolder.open();

  // Anti-aliasing folder
  const aaFolder = gui.addFolder("Anti-Aliasing");
  aaFolder.add(params, "aaMode", { Off: 0, FXAA: 1, "SMAA-lite": 2 }).name("Mode");
  aaFolder.add(params, "sharpness", 0, 1, 0.05).name("Sharpness");
  if (!isMobile) aaFolder.open();

  // Color folder
  const colorFolder = gui.addFolder("Color Correction");
  colorFolder.add(params, "brightness", 0.5, 2, 0.05).name("Brightness");
  colorFolder.add(params, "contrast", 0.5, 2, 0.05).name("Contrast");
  colorFolder.add(params, "saturation", 0, 2, 0.05).name("Saturation");
  colorFolder.add(params, "gamma", 0.5, 2.5, 0.05).name("Gamma");
  colorFolder.add(params, "temperature", -1, 1, 0.05).name("Temperature");
  colorFolder.add(params, "tint", -1, 1, 0.05).name("Tint");

  // Denoise folder
  const denoiseFolder = gui.addFolder("Denoise");
  denoiseFolder.add(params, "denoiseEnabled").name("Enabled");
  denoiseFolder.add(params, "denoiseStrength", 0, 2, 0.05).name("Strength");
  denoiseFolder.add(params, "denoiseBlurRadius", 1, 10, 1).name("Blur Radius");
  denoiseFolder.add(params, "denoiseEdgeSensitivity", 0.01, 0.5, 0.01).name("Edge Sensitivity");

  // Effects folder
  const effectsFolder = gui.addFolder("Effects");
  effectsFolder.add(params, "vignetteIntensity", 0, 1, 0.05).name("Vignette");
  effectsFolder.add(params, "vignetteRadius", 0.2, 1, 0.05).name("Vignette Size");
  effectsFolder.add(params, "chromaticAberration", 0, 5, 0.1).name("Chromatic");
  effectsFolder.add(params, "lensDistortion", -0.5, 0.5, 0.02).name("Lens Distort");
  effectsFolder.add(params, "grainIntensity", 0, 0.15, 0.005).name("Film Grain");
  effectsFolder.add(params, "grainSize", 0.5, 4, 0.1).name("Grain Size");
  if (!isMobile) effectsFolder.open();

  // Canvas sizing function
  const updateCanvasSize = () => {
    const pixelRatio = getPixelRatio();
    canvas.width = canvas.clientWidth * pixelRatio;
    canvas.height = canvas.clientHeight * pixelRatio;
    return { width: canvas.width, height: canvas.height };
  };

  let { width: canvasWidth, height: canvasHeight } = updateCanvasSize();

  const context = canvas.getContext("webgpu");
  context!.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  // Create textures function for resize handling
  const createTextures = (width: number, height: number) => {
    const framebuffer = device.createTexture({
      label: "framebuffer",
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    const postBloomBuffer = device.createTexture({
      label: "postBloomBuffer",
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    const postTonemapBuffer = device.createTexture({
      label: "postTonemapBuffer",
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    return { framebuffer, postBloomBuffer, postTonemapBuffer };
  };

  let textures = createTextures(canvasWidth, canvasHeight);

  // Scene and renderers
  const scene = new Scene(device);
  const common = new Common(device, scene.quadBuffer);
  const radiosity = new Radiosity(device, common, scene);

  let rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
  let raytracer = new Raytracer(device, common, radiosity, textures.framebuffer);
  let bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
  let tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
  let tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);

  // Handle resize
  let resizeTimeout: number | null = null;
  const handleResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = window.setTimeout(() => {
      const { width, height } = updateCanvasSize();

      if (width !== canvasWidth || height !== canvasHeight) {
        canvasWidth = width;
        canvasHeight = height;

        // Reconfigure context
        context!.configure({
          device,
          format: presentationFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
        });

        // Destroy old textures
        textures.framebuffer.destroy();
        textures.postBloomBuffer.destroy();
        textures.postTonemapBuffer.destroy();

        // Create new textures
        textures = createTextures(width, height);

        // Recreate renderers with new textures
        rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
        raytracer = new Raytracer(device, common, radiosity, textures.framebuffer);
        bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
        tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
        tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);
      }
    }, 150);
  };

  window.addEventListener("resize", handleResize);

  // Camera orbit controls
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastTouchDistance = 0;

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      // Left click
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || params.rotateCamera) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    common.updateCamera(
      -deltaX * 0.005, // Horizontal rotation
      deltaY * 0.005, // Vertical rotation
      0, // No zoom
    );

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  };

  const handleMouseUp = () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  };

  const handleWheel = (e: WheelEvent) => {
    if (params.rotateCamera) return;
    e.preventDefault();
    common.updateCamera(0, 0, e.deltaY * 0.01);
  };

  // Touch support
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging = true;
      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (params.rotateCamera) return;

    if (e.touches.length === 1 && isDragging) {
      const deltaX = e.touches[0].clientX - lastMouseX;
      const deltaY = e.touches[0].clientY - lastMouseY;

      common.updateCamera(-deltaX * 0.005, deltaY * 0.005, 0);

      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const delta = lastTouchDistance - distance;

      common.updateCamera(0, 0, delta * 0.05);
      lastTouchDistance = distance;
    }
  };

  const handleTouchEnd = () => {
    isDragging = false;
    lastTouchDistance = 0;
  };

  // Set initial cursor style
  canvas.style.cursor = "grab";

  // Add event listeners
  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  // Track animation frame for cleanup
  let animationFrameId: number | null = null;
  let isRunning = true;

  function frame() {
    if (!isRunning) return;

    const canvasTexture = context!.getCurrentTexture();
    const commandEncoder = device.createCommandEncoder();

    common.update({
      rotateCamera: params.rotateCamera,
      aspect: canvasWidth / canvasHeight,
    });
    radiosity.run(commandEncoder);

    // Render scene
    switch (params.renderer) {
      case "rasterizer":
        rasterizer.run(commandEncoder);
        break;
      case "raytracer":
        raytracer.run(commandEncoder);
        break;
    }

    // Bloom pass
    if (params.bloomEnabled) {
      bloom.updateSettings({
        threshold: params.bloomThreshold,
        intensity: params.bloomIntensity,
        radius: params.bloomRadius,
      });
      bloom.run(commandEncoder, params.bloomPasses);
      tonemapperWithBloom.run(commandEncoder);
    } else {
      tonemapperNoBloom.run(commandEncoder);
    }

    // Final post-processing with all effects
    const postProcess = new PostProcess(device, textures.postTonemapBuffer, canvasTexture);
    postProcess.updateSettings({
      brightness: params.brightness,
      contrast: params.contrast,
      saturation: params.saturation,
      gamma: params.gamma,
      temperature: params.temperature,
      tint: params.tint,
      vignetteIntensity: params.vignetteIntensity,
      vignetteRadius: params.vignetteRadius,
      chromaticAberration: params.chromaticAberration,
      grainIntensity: params.grainIntensity,
      grainSize: params.grainSize,
      sharpness: params.sharpness,
      aaMode: params.aaMode,
      lensDistortion: params.lensDistortion,
    });
    postProcess.run(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);
    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  // Return cleanup function
  return () => {
    // Stop animation loop
    isRunning = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    // Clear any pending resize timeout
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    // Remove event listeners
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.removeEventListener("touchstart", handleTouchStart);
    canvas.removeEventListener("touchmove", handleTouchMove);
    canvas.removeEventListener("touchend", handleTouchEnd);

    // Destroy GUI
    gui.destroy();

    // Destroy textures
    textures.framebuffer.destroy();
    textures.postBloomBuffer.destroy();
    textures.postTonemapBuffer.destroy();

    // Unconfigure context
    context?.unconfigure();

    // Destroy device
    device.destroy();
  };
}
