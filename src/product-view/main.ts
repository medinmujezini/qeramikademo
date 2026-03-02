import { GUI } from "dat.gui";
import Scene, { FurnitureData } from "./scene";
import Common from "./common";
import Radiosity from "./radiosity";
import Rasterizer from "./rasterizer";
import Tonemapper from "./tonemapper";
import Raytracer from "./raytracer";
import Bloom from "./bloom";
import PostProcess from "./postprocess";
import { quitIfAdapterNotAvailable, quitIfWebGPUNotAvailable, quitIfLimitLessThan } from "./util";
import { loadGLBTriangles, createTriangleBuffer, Triangle } from "./glbLoader";

export interface ProductViewFurnitureData extends FurnitureData {
  modelUrl?: string;
}

export async function initProductView(canvas: HTMLCanvasElement, furnitureData?: ProductViewFurnitureData): Promise<() => void> {
  const adapter = await navigator.gpu?.requestAdapter({ featureLevel: "compatibility" });
  quitIfAdapterNotAvailable(adapter);

  const features: GPUFeatureName[] = [];
  let presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  if (presentationFormat == "bgra8unorm" && adapter.features.has("bgra8unorm-storage")) {
    features.push("bgra8unorm-storage");
  } else if (presentationFormat == "bgra8unorm") {
    presentationFormat = "rgba8unorm";
  }
  const limits: Record<string, GPUSize32> = {};
  quitIfLimitLessThan(adapter, "maxComputeWorkgroupSizeX", 256, limits);
  quitIfLimitLessThan(adapter, "maxComputeInvocationsPerWorkgroup", 256, limits);
  const device = await adapter?.requestDevice({ requiredFeatures: features, requiredLimits: limits });
  quitIfWebGPUNotAvailable(adapter, device);

  device.lost.then((info) => console.error(`WebGPU device was lost: ${info.message}`));

  // Load GLB model if URL provided
  let triangles: Triangle[] = [];
  if (furnitureData?.modelUrl) {
    console.log('[ProductView] Loading GLB model:', furnitureData.modelUrl);
    try {
      triangles = await loadGLBTriangles(
        furnitureData.modelUrl,
        furnitureData.color,
        furnitureData.dimensions
      );
      console.log(`[ProductView] Loaded ${triangles.length} triangles`);
    } catch (error) {
      console.error('[ProductView] Failed to load GLB:', error);
    }
  }

  const isMobile = window.innerWidth < 768;
  const getPixelRatio = () => isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;

  const params = {
    renderer: "raytracer" as "rasterizer" | "raytracer", rotateCamera: true,
    bloomEnabled: true, bloomThreshold: 1.2, bloomIntensity: 0.15, bloomRadius: 5, bloomPasses: 4,
    aaMode: 2, brightness: 1.0, contrast: 1.1, saturation: 1.1, gamma: 1.0,
    temperature: -1.0, tint: 0.0, vignetteIntensity: 0.55, vignetteRadius: 0.65,
    chromaticAberration: 0.2, grainIntensity: 0, sharpness: 0.15, lensDistortion: -0.06,
  };

  const gui = new GUI({ width: isMobile ? 200 : 280 });
  const rendererFolder = gui.addFolder("Renderer");
  rendererFolder.add(params, "renderer", ["rasterizer", "raytracer"]);
  rendererFolder.add(params, "rotateCamera");
  if (!isMobile) rendererFolder.open();
  const bloomFolder = gui.addFolder("Bloom");
  bloomFolder.add(params, "bloomEnabled").name("Enabled");
  bloomFolder.add(params, "bloomThreshold", 0.1, 1.5, 0.05).name("Threshold");
  bloomFolder.add(params, "bloomIntensity", 0, 2, 0.05).name("Intensity");
  if (!isMobile) bloomFolder.open();

  const updateCanvasSize = () => {
    const pixelRatio = getPixelRatio();
    canvas.width = canvas.clientWidth * pixelRatio;
    canvas.height = canvas.clientHeight * pixelRatio;
    return { width: canvas.width, height: canvas.height };
  };

  let { width: canvasWidth, height: canvasHeight } = updateCanvasSize();
  const context = canvas.getContext("webgpu");
  context!.configure({ device, format: presentationFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING });

  const createTextures = (width: number, height: number) => ({
    framebuffer: device.createTexture({ label: "framebuffer", size: [width, height], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }),
    postBloomBuffer: device.createTexture({ label: "postBloomBuffer", size: [width, height], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }),
    postTonemapBuffer: device.createTexture({ label: "postTonemapBuffer", size: [width, height], format: "rgba8unorm", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }),
  });

  let textures = createTextures(canvasWidth, canvasHeight);
  
  // Create scene with triangle flag if we have triangles
  const sceneData: FurnitureData | undefined = furnitureData ? {
    ...furnitureData,
    hasTriangles: triangles.length > 0,
  } : undefined;
  
  const scene = new Scene(device, sceneData);
  
  // Create triangle buffer (even if empty, we need a valid buffer)
  const triangleBuffer = createTriangleBuffer(device, triangles);
  const triangleCount = triangles.length;
  
  const common = new Common(device, scene.quadBuffer, triangleBuffer, triangleCount);
  const radiosity = new Radiosity(device, common, scene);
  let rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
  let raytracer = new Raytracer(device, common, radiosity, textures.framebuffer);
  let bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
  let tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
  let tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);

  let resizeTimeout: number | null = null;
  const handleResize = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const { width, height } = updateCanvasSize();
      if (width !== canvasWidth || height !== canvasHeight) {
        canvasWidth = width; canvasHeight = height;
        context!.configure({ device, format: presentationFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING });
        textures.framebuffer.destroy(); textures.postBloomBuffer.destroy(); textures.postTonemapBuffer.destroy();
        textures = createTextures(width, height);
        rasterizer = new Rasterizer(device, common, scene, radiosity, textures.framebuffer);
        raytracer = new Raytracer(device, common, radiosity, textures.framebuffer);
        bloom = new Bloom(device, textures.framebuffer, textures.postBloomBuffer);
        tonemapperWithBloom = new Tonemapper(device, common, textures.postBloomBuffer, textures.postTonemapBuffer);
        tonemapperNoBloom = new Tonemapper(device, common, textures.framebuffer, textures.postTonemapBuffer);
      }
    }, 150);
  };
  window.addEventListener("resize", handleResize);

  let isDragging = false, lastMouseX = 0, lastMouseY = 0;
  const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; canvas.style.cursor = "grabbing"; } };
  const handleMouseMove = (e: MouseEvent) => { if (!isDragging || params.rotateCamera) return; common.updateCamera(-(e.clientX - lastMouseX) * 0.005, (e.clientY - lastMouseY) * 0.005, 0); lastMouseX = e.clientX; lastMouseY = e.clientY; };
  const handleMouseUp = () => { isDragging = false; canvas.style.cursor = "grab"; };
  const handleWheel = (e: WheelEvent) => { if (params.rotateCamera) return; e.preventDefault(); common.updateCamera(0, 0, e.deltaY * 0.01); };

  canvas.style.cursor = "grab";
  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  let animationFrameId: number | null = null, isRunning = true;

  function frame() {
    if (!isRunning) return;
    const canvasTexture = context!.getCurrentTexture();
    const commandEncoder = device.createCommandEncoder();
    common.update({ rotateCamera: params.rotateCamera, aspect: canvasWidth / canvasHeight });
    radiosity.run(commandEncoder);
    if (params.renderer === "rasterizer") rasterizer.run(commandEncoder); else raytracer.run(commandEncoder);
    if (params.bloomEnabled) {
      bloom.updateSettings({ threshold: params.bloomThreshold, intensity: params.bloomIntensity, radius: params.bloomRadius });
      bloom.run(commandEncoder, params.bloomPasses);
      tonemapperWithBloom.run(commandEncoder);
    } else { tonemapperNoBloom.run(commandEncoder); }
    const postProcess = new PostProcess(device, textures.postTonemapBuffer, canvasTexture);
    postProcess.updateSettings({ brightness: params.brightness, contrast: params.contrast, saturation: params.saturation, gamma: params.gamma, temperature: params.temperature, tint: params.tint, vignetteIntensity: params.vignetteIntensity, vignetteRadius: params.vignetteRadius, chromaticAberration: params.chromaticAberration, grainIntensity: params.grainIntensity, grainSize: 1.5, sharpness: params.sharpness, aaMode: params.aaMode, lensDistortion: params.lensDistortion });
    postProcess.run(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);
    animationFrameId = requestAnimationFrame(frame);
  }
  animationFrameId = requestAnimationFrame(frame);

  return () => {
    isRunning = false;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    if (resizeTimeout) clearTimeout(resizeTimeout);
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("wheel", handleWheel);
    gui.destroy();
    textures.framebuffer.destroy(); textures.postBloomBuffer.destroy(); textures.postTonemapBuffer.destroy();
    triangleBuffer.destroy();
    context?.unconfigure();
    device.destroy();
  };
}
