// Screen-Space Global Illumination Effect
// Uses ray marching with temporal reprojection for stable indirect lighting

import * as THREE from 'three';

const SSGIVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SSGIFragmentShader = `
  precision highp float;
  
  uniform sampler2D depthTexture;
  uniform sampler2D normalTexture;
  uniform sampler2D albedoTexture;
  uniform sampler2D directTexture;
  uniform sampler2D historyTexture;
  
  uniform vec2 resolution;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float rayLength;
  uniform int numRays;
  uniform int raySteps;
  uniform float historyWeight;
  uniform float time;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 uInverseProjectionMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uInverseViewMatrix;
  uniform mat4 uPrevViewProjectionMatrix;
  
  varying vec2 vUv;

  // Constants
  const float PI = 3.14159265359;
  const float TWO_PI = 6.28318530718;

  // Pseudo-random number generator
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec2 hash2(vec2 p) {
    return vec2(hash(p), hash(p + vec2(17.0, 31.0)));
  }

  // Decode octahedral normal
  vec3 decodeNormal(vec2 encoded) {
    encoded = encoded * 2.0 - 1.0;
    vec3 n = vec3(encoded, 1.0 - abs(encoded.x) - abs(encoded.y));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return normalize(n);
  }

  // Reconstruct view-space position from UV and depth
  vec3 reconstructViewPos(vec2 uv, float depth) {
    float z = depth * 2.0 - 1.0;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, z, 1.0);
    vec4 viewPos = uInverseProjectionMatrix * clipPos;
    return viewPos.xyz / viewPos.w;
  }

  // Reconstruct world-space position
  vec3 reconstructWorldPos(vec2 uv, float depth) {
    vec3 viewPos = reconstructViewPos(uv, depth);
    vec4 worldPos = uInverseViewMatrix * vec4(viewPos, 1.0);
    return worldPos.xyz;
  }

  // Generate cosine-weighted hemisphere direction
  vec3 cosineWeightedDirection(vec3 normal, vec2 seed) {
    vec2 rand = hash2(seed + vUv * resolution + time);
    
    float theta = TWO_PI * rand.x;
    float r = sqrt(rand.y);
    
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = cross(normal, tangent);
    
    float x = r * cos(theta);
    float y = r * sin(theta);
    float z = sqrt(1.0 - rand.y);
    
    return normalize(tangent * x + bitangent * y + normal * z);
  }

  // Ray march in screen space
  bool traceRay(vec3 origin, vec3 direction, out vec2 hitUV, out float hitDepth) {
    vec3 rayPos = origin;
    vec3 rayDir = normalize(direction);
    
    float stepSize = rayLength / float(raySteps);
    
    for (int i = 0; i < 32; i++) {
      if (i >= raySteps) break;
      
      rayPos += rayDir * stepSize;
      
      // Project to screen space
      vec4 projPos = uProjectionMatrix * vec4(rayPos, 1.0);
      projPos.xyz /= projPos.w;
      vec2 screenUV = projPos.xy * 0.5 + 0.5;
      
      // Check bounds
      if (screenUV.x < 0.0 || screenUV.x > 1.0 || screenUV.y < 0.0 || screenUV.y > 1.0) {
        return false;
      }
      
      // Sample depth at this position
      float sampledDepth = texture2D(depthTexture, screenUV).r;
      vec3 sampledViewPos = reconstructViewPos(screenUV, sampledDepth);
      
      // Check for intersection
      float depthDiff = rayPos.z - sampledViewPos.z;
      
      if (depthDiff > 0.0 && depthDiff < stepSize * 2.0) {
        hitUV = screenUV;
        hitDepth = sampledDepth;
        return true;
      }
    }
    
    return false;
  }

  // Sample indirect lighting
  vec3 sampleIndirect(vec3 viewPos, vec3 normal, vec2 seed) {
    vec3 worldNormal = (uInverseViewMatrix * vec4(normal, 0.0)).xyz;
    vec3 rayDir = cosineWeightedDirection(normal, seed);
    
    vec2 hitUV;
    float hitDepth;
    
    if (traceRay(viewPos + normal * 0.01, rayDir, hitUV, hitDepth)) {
      // Sample color at hit point
      vec3 hitColor = texture2D(directTexture, hitUV).rgb;
      vec3 hitAlbedo = texture2D(albedoTexture, hitUV).rgb;
      
      // Simple diffuse indirect
      return hitColor * hitAlbedo;
    }
    
    // Sky contribution (fallback)
    float skyFactor = max(0.0, dot(worldNormal, vec3(0.0, 1.0, 0.0)));
    return vec3(0.1, 0.12, 0.15) * skyFactor * 0.5;
  }

  // Temporal reprojection
  vec2 reproject(vec3 worldPos) {
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(worldPos, 1.0);
    return prevClipPos.xy / prevClipPos.w * 0.5 + 0.5;
  }

  // Neighborhood clamping for temporal stability
  vec3 neighborhoodClamp(vec3 color, vec2 uv) {
    vec2 texelSize = 1.0 / resolution;
    
    vec3 minColor = color;
    vec3 maxColor = color;
    
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec3 neighbor = texture2D(directTexture, uv + vec2(float(x), float(y)) * texelSize).rgb;
        minColor = min(minColor, neighbor);
        maxColor = max(maxColor, neighbor);
      }
    }
    
    return clamp(color, minColor, maxColor);
  }

  void main() {
    float depth = texture2D(depthTexture, vUv).r;
    
    // Skip sky pixels
    if (depth >= 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    
    // Reconstruct position and normal
    vec4 normalData = texture2D(normalTexture, vUv);
    vec3 normal = decodeNormal(normalData.rg);
    vec3 viewPos = reconstructViewPos(vUv, depth);
    vec3 worldPos = reconstructWorldPos(vUv, depth);
    
    // Accumulate indirect lighting from multiple rays
    vec3 indirect = vec3(0.0);
    
    for (int i = 0; i < 16; i++) {
      if (i >= numRays) break;
      indirect += sampleIndirect(viewPos, normal, vec2(float(i), time));
    }
    indirect /= float(numRays);
    
    // Temporal reprojection
    vec2 historyUV = reproject(worldPos);
    
    if (historyUV.x >= 0.0 && historyUV.x <= 1.0 && historyUV.y >= 0.0 && historyUV.y <= 1.0) {
      vec3 history = texture2D(historyTexture, historyUV).rgb;
      
      // Neighborhood clamp to prevent ghosting
      history = neighborhoodClamp(history, vUv);
      
      // Blend with history
      indirect = mix(indirect, history, historyWeight);
    }
    
    gl_FragColor = vec4(indirect, 1.0);
  }
`;

// Bilateral denoise shader for SSGI
const SSGIDenoiseFragmentShader = `
  uniform sampler2D ssgiTexture;
  uniform sampler2D depthTexture;
  uniform sampler2D normalTexture;
  uniform vec2 resolution;
  uniform vec2 direction;
  uniform float sharpness;
  uniform float normalSharpness;
  
  varying vec2 vUv;

  vec3 decodeNormal(vec2 encoded) {
    encoded = encoded * 2.0 - 1.0;
    vec3 n = vec3(encoded, 1.0 - abs(encoded.x) - abs(encoded.y));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return normalize(n);
  }

  void main() {
    vec2 texelSize = 1.0 / resolution;
    
    float centerDepth = texture2D(depthTexture, vUv).r;
    vec3 centerNormal = decodeNormal(texture2D(normalTexture, vUv).rg);
    vec3 centerColor = texture2D(ssgiTexture, vUv).rgb;
    
    float totalWeight = 1.0;
    vec3 totalColor = centerColor;
    
    // 9-tap bilateral blur
    for (float i = -4.0; i <= 4.0; i += 1.0) {
      if (i == 0.0) continue;
      
      vec2 offset = direction * texelSize * i;
      vec2 sampleUV = vUv + offset;
      
      float sampleDepth = texture2D(depthTexture, sampleUV).r;
      vec3 sampleNormal = decodeNormal(texture2D(normalTexture, sampleUV).rg);
      vec3 sampleColor = texture2D(ssgiTexture, sampleUV).rgb;
      
      // Depth weight
      float depthDiff = abs(centerDepth - sampleDepth);
      float depthWeight = exp(-depthDiff * sharpness);
      
      // Normal weight
      float normalDiff = 1.0 - max(0.0, dot(centerNormal, sampleNormal));
      float normalWeight = exp(-normalDiff * normalSharpness);
      
      // Spatial weight
      float spatialWeight = exp(-abs(i) * 0.3);
      
      float weight = depthWeight * normalWeight * spatialWeight;
      
      totalColor += sampleColor * weight;
      totalWeight += weight;
    }
    
    gl_FragColor = vec4(totalColor / totalWeight, 1.0);
  }
`;

export interface SSGIEffectParams {
  rayLength?: number;
  numRays?: number;
  raySteps?: number;
  historyWeight?: number;
  denoiseStrength?: number;
}

export class SSGIEffect {
  private ssgiMaterial: THREE.ShaderMaterial;
  private denoiseHMaterial: THREE.ShaderMaterial;
  private denoiseVMaterial: THREE.ShaderMaterial;
  
  private ssgiTarget: THREE.WebGLRenderTarget;
  private denoiseTarget: THREE.WebGLRenderTarget;
  private historyTarget: THREE.WebGLRenderTarget;
  private outputTarget: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private prevViewProjectionMatrix: THREE.Matrix4;
  private frameCount: number = 0;

  constructor(width: number, height: number, params: SSGIEffectParams = {}) {
    const {
      rayLength = 2.5,
      numRays = 8,
      raySteps = 24,
      historyWeight = 0.9,
      denoiseStrength = 100.0,
    } = params;

    // Create SSGI material
    this.ssgiMaterial = new THREE.ShaderMaterial({
      vertexShader: SSGIVertexShader,
      fragmentShader: SSGIFragmentShader,
      uniforms: {
        depthTexture: { value: null },
        normalTexture: { value: null },
        albedoTexture: { value: null },
        directTexture: { value: null },
        historyTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        rayLength: { value: rayLength },
        numRays: { value: numRays },
        raySteps: { value: raySteps },
        historyWeight: { value: historyWeight },
        time: { value: 0 },
        uProjectionMatrix: { value: new THREE.Matrix4() },
        uInverseProjectionMatrix: { value: new THREE.Matrix4() },
        uViewMatrix: { value: new THREE.Matrix4() },
        uInverseViewMatrix: { value: new THREE.Matrix4() },
        uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
      },
    });

    // Create denoise materials
    const createDenoiseMaterial = (direction: THREE.Vector2) => {
      return new THREE.ShaderMaterial({
        vertexShader: SSGIVertexShader,
        fragmentShader: SSGIDenoiseFragmentShader,
        uniforms: {
          ssgiTexture: { value: null },
          depthTexture: { value: null },
          normalTexture: { value: null },
          resolution: { value: new THREE.Vector2(width, height) },
          direction: { value: direction },
          sharpness: { value: denoiseStrength },
          normalSharpness: { value: 16.0 },
        },
      });
    };

    this.denoiseHMaterial = createDenoiseMaterial(new THREE.Vector2(1, 0));
    this.denoiseVMaterial = createDenoiseMaterial(new THREE.Vector2(0, 1));

    // Create render targets
    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };

    this.ssgiTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    this.denoiseTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    this.historyTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    this.outputTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.ssgiMaterial);
    this.quad.frustumCulled = false;

    // Create render scene
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Previous frame matrix
    this.prevViewProjectionMatrix = new THREE.Matrix4();
  }

  setSize(width: number, height: number) {
    const resolution = new THREE.Vector2(width, height);
    
    this.ssgiTarget.setSize(width, height);
    this.denoiseTarget.setSize(width, height);
    this.historyTarget.setSize(width, height);
    this.outputTarget.setSize(width, height);
    
    this.ssgiMaterial.uniforms.resolution.value = resolution;
    this.denoiseHMaterial.uniforms.resolution.value = resolution;
    this.denoiseVMaterial.uniforms.resolution.value = resolution;
  }

  updateCamera(camera: THREE.PerspectiveCamera) {
    this.ssgiMaterial.uniforms.cameraNear.value = camera.near;
    this.ssgiMaterial.uniforms.cameraFar.value = camera.far;
    this.ssgiMaterial.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
    this.ssgiMaterial.uniforms.uInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    this.ssgiMaterial.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
    this.ssgiMaterial.uniforms.uInverseViewMatrix.value.copy(camera.matrixWorld);
  }

  updateParams(params: SSGIEffectParams) {
    if (params.rayLength !== undefined) this.ssgiMaterial.uniforms.rayLength.value = params.rayLength;
    if (params.numRays !== undefined) this.ssgiMaterial.uniforms.numRays.value = params.numRays;
    if (params.raySteps !== undefined) this.ssgiMaterial.uniforms.raySteps.value = params.raySteps;
    if (params.historyWeight !== undefined) this.ssgiMaterial.uniforms.historyWeight.value = params.historyWeight;
    if (params.denoiseStrength !== undefined) {
      this.denoiseHMaterial.uniforms.sharpness.value = params.denoiseStrength;
      this.denoiseVMaterial.uniforms.sharpness.value = params.denoiseStrength;
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    inputs: {
      depthTexture: THREE.Texture;
      normalTexture: THREE.Texture;
      albedoTexture: THREE.Texture;
      directTexture: THREE.Texture;
    }
  ): THREE.Texture {
    this.frameCount++;
    
    // Update time for noise variation
    this.ssgiMaterial.uniforms.time.value = this.frameCount * 0.1;
    
    // Set previous view-projection matrix for temporal reprojection
    this.ssgiMaterial.uniforms.uPrevViewProjectionMatrix.value.copy(this.prevViewProjectionMatrix);
    
    // SSGI pass
    this.ssgiMaterial.uniforms.depthTexture.value = inputs.depthTexture;
    this.ssgiMaterial.uniforms.normalTexture.value = inputs.normalTexture;
    this.ssgiMaterial.uniforms.albedoTexture.value = inputs.albedoTexture;
    this.ssgiMaterial.uniforms.directTexture.value = inputs.directTexture;
    this.ssgiMaterial.uniforms.historyTexture.value = this.historyTarget.texture;
    
    this.quad.material = this.ssgiMaterial;
    renderer.setRenderTarget(this.ssgiTarget);
    renderer.render(this.scene, this.camera);

    // Horizontal denoise
    this.denoiseHMaterial.uniforms.ssgiTexture.value = this.ssgiTarget.texture;
    this.denoiseHMaterial.uniforms.depthTexture.value = inputs.depthTexture;
    this.denoiseHMaterial.uniforms.normalTexture.value = inputs.normalTexture;
    this.quad.material = this.denoiseHMaterial;
    renderer.setRenderTarget(this.denoiseTarget);
    renderer.render(this.scene, this.camera);

    // Vertical denoise
    this.denoiseVMaterial.uniforms.ssgiTexture.value = this.denoiseTarget.texture;
    this.denoiseVMaterial.uniforms.depthTexture.value = inputs.depthTexture;
    this.denoiseVMaterial.uniforms.normalTexture.value = inputs.normalTexture;
    this.quad.material = this.denoiseVMaterial;
    renderer.setRenderTarget(this.outputTarget);
    renderer.render(this.scene, this.camera);

    // Copy to history for next frame
    const temp = this.historyTarget;
    this.historyTarget = this.outputTarget;
    this.outputTarget = temp;

    // Store current view-projection for next frame
    this.prevViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );

    return this.historyTarget.texture;
  }

  dispose() {
    this.ssgiMaterial.dispose();
    this.denoiseHMaterial.dispose();
    this.denoiseVMaterial.dispose();
    this.ssgiTarget.dispose();
    this.denoiseTarget.dispose();
    this.historyTarget.dispose();
    this.outputTarget.dispose();
    this.quad.geometry.dispose();
  }
}
