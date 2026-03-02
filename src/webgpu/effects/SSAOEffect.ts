// Screen-Space Ambient Occlusion Effect
// Uses hemisphere sampling with noise for high-quality AO

import * as THREE from 'three';

const SSAOVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SSAOFragmentShader = `
  uniform sampler2D depthTexture;
  uniform sampler2D normalTexture;
  uniform vec2 resolution;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float radius;
  uniform float intensity;
  uniform float bias;
  uniform int samples;
  uniform float noiseScale;
  uniform mat4 projectionMatrix;
  uniform mat4 inverseProjectionMatrix;
  
  varying vec2 vUv;

  // Pseudo-random noise
  float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
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

  // Reconstruct view-space position from NON-LINEAR device depth (0..1)
  vec3 reconstructViewPos(vec2 uv, float deviceDepth) {
    // Device depth is gl_FragCoord.z style (non-linear)
    float z = deviceDepth * 2.0 - 1.0;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, z, 1.0);
    vec4 viewPos = inverseProjectionMatrix * clipPos;
    return viewPos.xyz / viewPos.w;
  }

  // Generate sample direction on hemisphere
  vec3 hemisphereDirection(float i, float n, vec3 normal) {
    float theta = 2.0 * 3.14159265 * random(vUv + vec2(i * 0.1, 0.0));
    float phi = acos(1.0 - 2.0 * random(vUv + vec2(0.0, i * 0.1)));
    
    vec3 dir = vec3(
      sin(phi) * cos(theta),
      sin(phi) * sin(theta),
      cos(phi)
    );
    
    // Orient to normal hemisphere
    return dot(dir, normal) < 0.0 ? -dir : dir;
  }

  void main() {
    // Sample depth - use .g channel which contains non-linear device depth
    vec4 depthData = texture2D(depthTexture, vUv);
    float deviceDepth = depthData.g;  // Non-linear depth for reconstruction
    
    // Early out for sky (device depth ~1.0)
    if (deviceDepth >= 0.9999) {
      gl_FragColor = vec4(1.0);
      return;
    }

    // Get normal and view position
    vec4 normalData = texture2D(normalTexture, vUv);
    vec3 normal = decodeNormal(normalData.rg);
    vec3 viewPos = reconstructViewPos(vUv, deviceDepth);

    // Accumulate occlusion
    float occlusion = 0.0;
    float sampleCount = float(samples);
    float validSamples = 0.0;
    
    for (int i = 0; i < 256; i++) {
      if (i >= samples) break;
      
      // Generate sample point
      vec3 sampleDir = hemisphereDirection(float(i), sampleCount, normal);
      float scale = float(i + 1) / sampleCount;
      scale = mix(0.1, 1.0, scale * scale);
      
      vec3 samplePos = viewPos + sampleDir * radius * scale;
      
      // Project to screen space
      vec4 offset = projectionMatrix * vec4(samplePos, 1.0);
      offset.xy /= offset.w;
      offset.xy = offset.xy * 0.5 + 0.5;
      
      // Skip samples outside screen bounds
      if (offset.x < 0.0 || offset.x > 1.0 || offset.y < 0.0 || offset.y > 1.0) {
        continue;
      }
      
      // Sample depth at offset - use .g channel (device depth)
      float sampleDeviceDepth = texture2D(depthTexture, offset.xy).g;
      
      // Skip sky samples
      if (sampleDeviceDepth >= 0.9999) {
        continue;
      }
      
      vec3 sampleViewPos = reconstructViewPos(offset.xy, sampleDeviceDepth);
      
      // Range check and occlusion
      float rangeCheck = smoothstep(0.0, 1.0, radius / abs(viewPos.z - sampleViewPos.z));
      occlusion += (sampleViewPos.z >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
      validSamples += 1.0;
    }
    
    // Prevent divide by zero, clamp final AO to [0,1]
    float ao = 1.0;
    if (validSamples > 0.0) {
      ao = clamp(1.0 - (occlusion / validSamples) * intensity, 0.0, 1.0);
    }
    
    gl_FragColor = vec4(vec3(ao), 1.0);
  }
`;

// Bilateral blur shader for edge-aware denoising
const SSAOBlurFragmentShader = `
  uniform sampler2D ssaoTexture;
  uniform sampler2D depthTexture;
  uniform vec2 resolution;
  uniform vec2 direction;
  uniform float sharpness;
  
  varying vec2 vUv;

  void main() {
    vec2 texelSize = 1.0 / resolution;
    float centerDepth = texture2D(depthTexture, vUv).r;
    float centerAO = texture2D(ssaoTexture, vUv).r;
    
    float totalWeight = 1.0;
    float totalAO = centerAO;
    
    // 9-tap bilateral blur
    for (float i = -4.0; i <= 4.0; i += 1.0) {
      if (i == 0.0) continue;
      
      vec2 offset = direction * texelSize * i;
      float sampleDepth = texture2D(depthTexture, vUv + offset).r;
      float sampleAO = texture2D(ssaoTexture, vUv + offset).r;
      
      // Depth-aware weight
      float depthDiff = abs(centerDepth - sampleDepth);
      float weight = exp(-depthDiff * sharpness) * exp(-abs(i) * 0.5);
      
      totalAO += sampleAO * weight;
      totalWeight += weight;
    }
    
    gl_FragColor = vec4(vec3(totalAO / totalWeight), 1.0);
  }
`;

export interface SSAOEffectParams {
  radius?: number;
  intensity?: number;
  bias?: number;
  samples?: number;
  blurSharpness?: number;
}

export class SSAOEffect {
  private ssaoMaterial: THREE.ShaderMaterial;
  private blurMaterialH: THREE.ShaderMaterial;
  private blurMaterialV: THREE.ShaderMaterial;
  private ssaoTarget: THREE.WebGLRenderTarget;
  private blurTarget: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(
    width: number,
    height: number,
    params: SSAOEffectParams = {}
  ) {
    const {
      radius = 0.5,
      intensity = 1.0,
      bias = 0.025,
      samples = 16,
      blurSharpness = 100.0,
    } = params;

    // Create SSAO material
    this.ssaoMaterial = new THREE.ShaderMaterial({
      vertexShader: SSAOVertexShader,
      fragmentShader: SSAOFragmentShader,
      uniforms: {
        depthTexture: { value: null },
        normalTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        radius: { value: radius },
        intensity: { value: intensity },
        bias: { value: bias },
        samples: { value: samples },
        noiseScale: { value: 4.0 },
        projectionMatrix: { value: new THREE.Matrix4() },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
      },
    });

    // Create blur materials
    this.blurMaterialH = new THREE.ShaderMaterial({
      vertexShader: SSAOVertexShader,
      fragmentShader: SSAOBlurFragmentShader,
      uniforms: {
        ssaoTexture: { value: null },
        depthTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        direction: { value: new THREE.Vector2(1, 0) },
        sharpness: { value: blurSharpness },
      },
    });

    this.blurMaterialV = new THREE.ShaderMaterial({
      vertexShader: SSAOVertexShader,
      fragmentShader: SSAOBlurFragmentShader,
      uniforms: {
        ssaoTexture: { value: null },
        depthTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        direction: { value: new THREE.Vector2(0, 1) },
        sharpness: { value: blurSharpness },
      },
    });

    // Create render targets
    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RedFormat,
      type: THREE.HalfFloatType,
    };

    this.ssaoTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    this.blurTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.ssaoMaterial);
    this.quad.frustumCulled = false;

    // Create render scene
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width: number, height: number) {
    this.ssaoTarget.setSize(width, height);
    this.blurTarget.setSize(width, height);
    
    const resolution = new THREE.Vector2(width, height);
    this.ssaoMaterial.uniforms.resolution.value = resolution;
    this.blurMaterialH.uniforms.resolution.value = resolution;
    this.blurMaterialV.uniforms.resolution.value = resolution;
  }

  updateCamera(camera: THREE.PerspectiveCamera) {
    this.ssaoMaterial.uniforms.cameraNear.value = camera.near;
    this.ssaoMaterial.uniforms.cameraFar.value = camera.far;
    this.ssaoMaterial.uniforms.projectionMatrix.value.copy(camera.projectionMatrix);
    this.ssaoMaterial.uniforms.inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  }

  updateParams(params: SSAOEffectParams) {
    if (params.radius !== undefined) this.ssaoMaterial.uniforms.radius.value = params.radius;
    if (params.intensity !== undefined) this.ssaoMaterial.uniforms.intensity.value = params.intensity;
    if (params.bias !== undefined) this.ssaoMaterial.uniforms.bias.value = params.bias;
    if (params.samples !== undefined) this.ssaoMaterial.uniforms.samples.value = params.samples;
    if (params.blurSharpness !== undefined) {
      this.blurMaterialH.uniforms.sharpness.value = params.blurSharpness;
      this.blurMaterialV.uniforms.sharpness.value = params.blurSharpness;
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    depthTexture: THREE.Texture,
    normalTexture: THREE.Texture
  ): THREE.Texture {
    // SSAO pass
    this.ssaoMaterial.uniforms.depthTexture.value = depthTexture;
    this.ssaoMaterial.uniforms.normalTexture.value = normalTexture;
    this.quad.material = this.ssaoMaterial;
    
    renderer.setRenderTarget(this.ssaoTarget);
    renderer.render(this.scene, this.camera);

    // Horizontal blur
    this.blurMaterialH.uniforms.ssaoTexture.value = this.ssaoTarget.texture;
    this.blurMaterialH.uniforms.depthTexture.value = depthTexture;
    this.quad.material = this.blurMaterialH;
    
    renderer.setRenderTarget(this.blurTarget);
    renderer.render(this.scene, this.camera);

    // Vertical blur
    this.blurMaterialV.uniforms.ssaoTexture.value = this.blurTarget.texture;
    this.blurMaterialV.uniforms.depthTexture.value = depthTexture;
    this.quad.material = this.blurMaterialV;
    
    renderer.setRenderTarget(this.ssaoTarget);
    renderer.render(this.scene, this.camera);

    return this.ssaoTarget.texture;
  }

  dispose() {
    this.ssaoMaterial.dispose();
    this.blurMaterialH.dispose();
    this.blurMaterialV.dispose();
    this.ssaoTarget.dispose();
    this.blurTarget.dispose();
    this.quad.geometry.dispose();
  }
}
