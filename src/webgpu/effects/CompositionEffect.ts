// Final Composition Effect
// Combines direct lighting, SSAO, SSGI, and applies tone mapping

import * as THREE from 'three';

const CompositionVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const CompositionFragmentShader = `
  uniform sampler2D directTexture;
  uniform sampler2D ssaoTexture;
  uniform sampler2D ssgiTexture;
  uniform sampler2D albedoTexture;
  uniform sampler2D depthTexture;
  
  uniform bool useSSAO;
  uniform bool useSSGI;
  uniform float ssaoStrength;
  uniform float ssgiStrength;
  uniform float exposure;
  uniform float ambientIntensity;
  uniform vec3 ambientColor;
  
  varying vec2 vUv;

  // ACES Filmic Tone Mapping
  vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  // Reinhard tone mapping (simpler alternative)
  vec3 Reinhard(vec3 x) {
    return x / (1.0 + x);
  }

  void main() {
    // Sample all inputs
    vec4 direct = texture2D(directTexture, vUv);
    vec4 albedo = texture2D(albedoTexture, vUv);
    float depth = texture2D(depthTexture, vUv).r;
    
    // Skip sky pixels
    if (depth >= 1.0) {
      gl_FragColor = vec4(0.1, 0.12, 0.15, 1.0); // Sky color
      return;
    }
    
    // Start with direct lighting
    vec3 color = direct.rgb;
    
    // Add ambient lighting
    vec3 ambient = ambientColor * ambientIntensity * albedo.rgb;
    color += ambient;
    
    // Apply SSAO
    if (useSSAO) {
      float ao = texture2D(ssaoTexture, vUv).r;
      ao = mix(1.0, ao, ssaoStrength);
      color *= ao;
    }
    
    // Add SSGI indirect lighting
    if (useSSGI) {
      vec3 indirect = texture2D(ssgiTexture, vUv).rgb;
      color += indirect * ssgiStrength * albedo.rgb;
    }
    
    // Apply exposure
    color *= exposure;
    
    // Tone mapping
    color = ACESFilm(color);
    
    // Gamma correction (sRGB)
    color = pow(color, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CompositionEffectParams {
  useSSAO?: boolean;
  useSSGI?: boolean;
  ssaoStrength?: number;
  ssgiStrength?: number;
  exposure?: number;
  ambientIntensity?: number;
  ambientColor?: THREE.Color;
}

export class CompositionEffect {
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(params: CompositionEffectParams = {}) {
    const {
      useSSAO = true,
      useSSGI = false,
      ssaoStrength = 1.0,
      ssgiStrength = 1.0,
      exposure = 1.0,
      ambientIntensity = 0.3,
      ambientColor = new THREE.Color(0.5, 0.6, 0.7),
    } = params;

    this.material = new THREE.ShaderMaterial({
      vertexShader: CompositionVertexShader,
      fragmentShader: CompositionFragmentShader,
      uniforms: {
        directTexture: { value: null },
        ssaoTexture: { value: null },
        ssgiTexture: { value: null },
        albedoTexture: { value: null },
        depthTexture: { value: null },
        useSSAO: { value: useSSAO },
        useSSGI: { value: useSSGI },
        ssaoStrength: { value: ssaoStrength },
        ssgiStrength: { value: ssgiStrength },
        exposure: { value: exposure },
        ambientIntensity: { value: ambientIntensity },
        ambientColor: { value: ambientColor },
      },
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.material);
    this.quad.frustumCulled = false;

    // Create render scene
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  updateParams(params: CompositionEffectParams) {
    if (params.useSSAO !== undefined) this.material.uniforms.useSSAO.value = params.useSSAO;
    if (params.useSSGI !== undefined) this.material.uniforms.useSSGI.value = params.useSSGI;
    if (params.ssaoStrength !== undefined) this.material.uniforms.ssaoStrength.value = params.ssaoStrength;
    if (params.ssgiStrength !== undefined) this.material.uniforms.ssgiStrength.value = params.ssgiStrength;
    if (params.exposure !== undefined) this.material.uniforms.exposure.value = params.exposure;
    if (params.ambientIntensity !== undefined) this.material.uniforms.ambientIntensity.value = params.ambientIntensity;
    if (params.ambientColor !== undefined) this.material.uniforms.ambientColor.value = params.ambientColor;
  }

  render(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget | null,
    inputs: {
      directTexture: THREE.Texture;
      albedoTexture: THREE.Texture;
      depthTexture: THREE.Texture;
      ssaoTexture?: THREE.Texture;
      ssgiTexture?: THREE.Texture;
    }
  ) {
    this.material.uniforms.directTexture.value = inputs.directTexture;
    this.material.uniforms.albedoTexture.value = inputs.albedoTexture;
    this.material.uniforms.depthTexture.value = inputs.depthTexture;
    
    if (inputs.ssaoTexture) {
      this.material.uniforms.ssaoTexture.value = inputs.ssaoTexture;
    }
    if (inputs.ssgiTexture) {
      this.material.uniforms.ssgiTexture.value = inputs.ssgiTexture;
    }

    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
