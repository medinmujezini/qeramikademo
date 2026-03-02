// Velocity Buffer Effect
// Stores per-pixel motion vectors for temporal effects (TAA, motion blur)

import * as THREE from 'three';

const VelocityVertexShader = /* glsl */ `
precision highp float;

uniform mat4 uPrevModelViewProjection;
uniform mat4 uCurrentModelViewProjection;

varying vec4 vCurrentPos;
varying vec4 vPreviousPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  
  // Current frame clip position
  vCurrentPos = uCurrentModelViewProjection * worldPos;
  
  // Previous frame clip position  
  vPreviousPos = uPrevModelViewProjection * worldPos;
  
  gl_Position = vCurrentPos;
}
`;

const VelocityFragmentShader = /* glsl */ `
precision highp float;

varying vec4 vCurrentPos;
varying vec4 vPreviousPos;

void main() {
  // Convert to NDC
  vec2 currentNDC = vCurrentPos.xy / vCurrentPos.w;
  vec2 previousNDC = vPreviousPos.xy / vPreviousPos.w;
  
  // Calculate velocity in screen space [-1, 1] -> [-0.5, 0.5]
  vec2 velocity = (currentNDC - previousNDC) * 0.5;
  
  // Store velocity (RG channels)
  // Multiply by 10 to increase precision for small movements
  gl_FragColor = vec4(velocity * 10.0, 0.0, 1.0);
}
`;

// Camera-only velocity shader (for static geometry optimization)
const CameraVelocityFragmentShader = /* glsl */ `
precision highp float;

uniform mat4 uInverseProjection;
uniform mat4 uPrevViewProjection;
uniform mat4 uCurrentViewProjection;
uniform sampler2D depthTexture;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}

vec3 reconstructWorldPos(vec2 uv, float depth) {
  vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPos = uInverseProjection * clipPos;
  viewPos /= viewPos.w;
  return viewPos.xyz;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float depth = texture2D(depthTexture, uv).r;
  
  if (depth >= 1.0) {
    // Sky/background - no velocity
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Reconstruct world position
  vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  
  // Current NDC
  vec2 currentNDC = clipPos.xy;
  
  // Reproject to previous frame
  vec4 worldPos = uInverseProjection * clipPos;
  worldPos /= worldPos.w;
  
  vec4 prevClipPos = uPrevViewProjection * worldPos;
  vec2 prevNDC = prevClipPos.xy / prevClipPos.w;
  
  // Calculate velocity
  vec2 velocity = (currentNDC - prevNDC) * 0.5;
  
  gl_FragColor = vec4(velocity * 10.0, 0.0, 1.0);
}
`;

const FullscreenVertexShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export interface VelocityBufferParams {
  width: number;
  height: number;
}

/**
 * VelocityBufferEffect - Generates per-pixel motion vectors
 * Used for TAA reprojection and motion blur
 */
export class VelocityBufferEffect {
  private velocityTarget: THREE.WebGLRenderTarget;
  private velocityMaterial: THREE.ShaderMaterial;
  private cameraVelocityMaterial: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private prevViewProjection: THREE.Matrix4 = new THREE.Matrix4();
  private currentViewProjection: THREE.Matrix4 = new THREE.Matrix4();
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  
  private width: number;
  private height: number;
  private isFirstFrame: boolean = true;
  
  // Store per-object previous matrices
  private objectPrevMatrices: WeakMap<THREE.Object3D, THREE.Matrix4> = new WeakMap();
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Create velocity render target (RG16F for precision)
    this.velocityTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    
    // Per-object velocity material
    this.velocityMaterial = new THREE.ShaderMaterial({
      vertexShader: VelocityVertexShader,
      fragmentShader: VelocityFragmentShader,
      uniforms: {
        uPrevModelViewProjection: { value: new THREE.Matrix4() },
        uCurrentModelViewProjection: { value: new THREE.Matrix4() },
      },
    });
    
    // Camera-only velocity material (screen-space)
    this.cameraVelocityMaterial = new THREE.ShaderMaterial({
      vertexShader: FullscreenVertexShader,
      fragmentShader: CameraVelocityFragmentShader,
      uniforms: {
        depthTexture: { value: null },
        uInverseProjection: { value: new THREE.Matrix4() },
        uPrevViewProjection: { value: new THREE.Matrix4() },
        uCurrentViewProjection: { value: new THREE.Matrix4() },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
      },
    });
    
    // Fullscreen quad for camera velocity
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.cameraVelocityMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.velocityTarget.setSize(width, height);
    this.cameraVelocityMaterial.uniforms.resolution.value.set(width, height);
  }
  
  /**
   * Update camera matrices for velocity calculation
   * Call this BEFORE rendering the frame
   */
  updateCamera(camera: THREE.PerspectiveCamera): void {
    // Store previous view-projection
    if (!this.isFirstFrame) {
      this.prevViewProjection.copy(this.currentViewProjection);
    }
    
    // Calculate current view-projection
    this.currentViewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    
    if (this.isFirstFrame) {
      this.prevViewProjection.copy(this.currentViewProjection);
      this.isFirstFrame = false;
    }
    
    // Update uniforms
    this.cameraVelocityMaterial.uniforms.uPrevViewProjection.value.copy(this.prevViewProjection);
    this.cameraVelocityMaterial.uniforms.uCurrentViewProjection.value.copy(this.currentViewProjection);
    this.cameraVelocityMaterial.uniforms.cameraNear.value = camera.near;
    this.cameraVelocityMaterial.uniforms.cameraFar.value = camera.far;
    
    // Inverse projection for world reconstruction
    this.tempMatrix.copy(camera.projectionMatrix).invert();
    this.cameraVelocityMaterial.uniforms.uInverseProjection.value.copy(this.tempMatrix);
  }
  
  /**
   * Render velocity buffer using camera motion only
   * Fast path for fully static scenes
   */
  renderCameraVelocity(
    renderer: THREE.WebGLRenderer,
    depthTexture: THREE.Texture
  ): THREE.Texture {
    this.cameraVelocityMaterial.uniforms.depthTexture.value = depthTexture;
    
    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.velocityTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(oldTarget);
    
    return this.velocityTarget.texture;
  }
  
  /**
   * Get velocity material for per-object rendering
   * Use this for animated/moving objects
   */
  getVelocityMaterial(
    object: THREE.Object3D,
    camera: THREE.PerspectiveCamera
  ): THREE.ShaderMaterial {
    // Get or create previous matrix for this object
    let prevMatrix = this.objectPrevMatrices.get(object);
    if (!prevMatrix) {
      prevMatrix = new THREE.Matrix4();
      prevMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      ).multiply(object.matrixWorld);
      this.objectPrevMatrices.set(object, prevMatrix);
    }
    
    // Calculate current MVP
    this.tempMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    ).multiply(object.matrixWorld);
    
    // Update uniforms
    this.velocityMaterial.uniforms.uPrevModelViewProjection.value.copy(prevMatrix);
    this.velocityMaterial.uniforms.uCurrentModelViewProjection.value.copy(this.tempMatrix);
    
    // Store current for next frame
    prevMatrix.copy(this.tempMatrix);
    
    return this.velocityMaterial;
  }
  
  /**
   * Clear stored object matrices (call on scene change)
   */
  clearObjectMatrices(): void {
    this.objectPrevMatrices = new WeakMap();
  }
  
  /**
   * Reset for new scene
   */
  reset(): void {
    this.isFirstFrame = true;
    this.clearObjectMatrices();
  }
  
  getTexture(): THREE.Texture {
    return this.velocityTarget.texture;
  }
  
  dispose(): void {
    this.velocityTarget.dispose();
    this.velocityMaterial.dispose();
    this.cameraVelocityMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
