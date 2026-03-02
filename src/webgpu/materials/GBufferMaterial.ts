// G-Buffer Material for Deferred Rendering
// Outputs: Normal+Roughness, Albedo+AO, Depth+Metalness

import * as THREE from 'three';

// Vertex shader - shared across all G-Buffer passes
const GBufferVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    vec4 mvPosition = viewMatrix * worldPos;
    vDepth = -mvPosition.z;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader for normal+roughness pass
const NormalRoughnessFragmentShader = `
  uniform float roughness;
  uniform float metalness;
  uniform vec3 albedo;
  uniform sampler2D albedoMap;
  uniform bool hasAlbedoMap;
  
  varying vec3 vNormal;
  varying vec2 vUv;

  // Octahedral encoding for normals
  vec2 encodeNormal(vec3 n) {
    n /= (abs(n.x) + abs(n.y) + abs(n.z));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return n.xy * 0.5 + 0.5;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec2 encodedNormal = encodeNormal(normal);
    
    // Output: RG = encoded normal, B = roughness, A = metalness
    gl_FragColor = vec4(encodedNormal, roughness, metalness);
  }
`;

// Fragment shader for albedo+AO pass
const AlbedoAOFragmentShader = `
  uniform vec3 albedo;
  uniform float ao;
  uniform sampler2D albedoMap;
  uniform bool hasAlbedoMap;
  
  varying vec2 vUv;

  void main() {
    vec3 color = albedo;
    if (hasAlbedoMap) {
      color *= texture2D(albedoMap, vUv).rgb;
    }
    
    // Output: RGB = albedo, A = ambient occlusion
    gl_FragColor = vec4(color, ao);
  }
`;

// Fragment shader for depth pass (uses depth texture attachment)
const DepthFragmentShader = `
  uniform float cameraNear;
  uniform float cameraFar;
  
  varying float vDepth;

  float linearizeDepth(float depth) {
    return (2.0 * cameraNear) / (cameraFar + cameraNear - depth * (cameraFar - cameraNear));
  }

  void main() {
    float linearDepth = (vDepth - cameraNear) / (cameraFar - cameraNear);
    gl_FragColor = vec4(linearDepth, linearDepth, linearDepth, 1.0);
  }
`;

export interface GBufferMaterialParams {
  albedo?: THREE.Color | string;
  roughness?: number;
  metalness?: number;
  ao?: number;
  albedoMap?: THREE.Texture | null;
  cameraNear?: number;
  cameraFar?: number;
}

// Create normal+roughness material
export function createNormalRoughnessMaterial(params: GBufferMaterialParams = {}): THREE.ShaderMaterial {
  const {
    roughness = 0.5,
    metalness = 0.0,
    albedo = new THREE.Color(0xffffff),
    albedoMap = null,
  } = params;

  return new THREE.ShaderMaterial({
    vertexShader: GBufferVertexShader,
    fragmentShader: NormalRoughnessFragmentShader,
    uniforms: {
      roughness: { value: roughness },
      metalness: { value: metalness },
      albedo: { value: albedo instanceof THREE.Color ? albedo : new THREE.Color(albedo) },
      albedoMap: { value: albedoMap },
      hasAlbedoMap: { value: !!albedoMap },
    },
  });
}

// Create albedo+AO material
export function createAlbedoAOMaterial(params: GBufferMaterialParams = {}): THREE.ShaderMaterial {
  const {
    albedo = new THREE.Color(0xffffff),
    ao = 1.0,
    albedoMap = null,
  } = params;

  return new THREE.ShaderMaterial({
    vertexShader: GBufferVertexShader,
    fragmentShader: AlbedoAOFragmentShader,
    uniforms: {
      albedo: { value: albedo instanceof THREE.Color ? albedo : new THREE.Color(albedo) },
      ao: { value: ao },
      albedoMap: { value: albedoMap },
      hasAlbedoMap: { value: !!albedoMap },
    },
  });
}

// Create depth material
export function createDepthMaterial(params: GBufferMaterialParams = {}): THREE.ShaderMaterial {
  const {
    cameraNear = 0.1,
    cameraFar = 100,
  } = params;

  return new THREE.ShaderMaterial({
    vertexShader: GBufferVertexShader,
    fragmentShader: DepthFragmentShader,
    uniforms: {
      cameraNear: { value: cameraNear },
      cameraFar: { value: cameraFar },
    },
  });
}

// Material cache for G-Buffer rendering
export class GBufferMaterialCache {
  private normalRoughnessMaterials: Map<string, THREE.ShaderMaterial> = new Map();
  private albedoAOMaterials: Map<string, THREE.ShaderMaterial> = new Map();
  private depthMaterial: THREE.ShaderMaterial | null = null;
  private cameraNear: number = 0.1;
  private cameraFar: number = 100;

  setCamera(near: number, far: number) {
    this.cameraNear = near;
    this.cameraFar = far;
    if (this.depthMaterial) {
      this.depthMaterial.uniforms.cameraNear.value = near;
      this.depthMaterial.uniforms.cameraFar.value = far;
    }
  }

  getDepthMaterial(): THREE.ShaderMaterial {
    if (!this.depthMaterial) {
      this.depthMaterial = createDepthMaterial({
        cameraNear: this.cameraNear,
        cameraFar: this.cameraFar,
      });
    }
    return this.depthMaterial;
  }

  // Get or create a material based on object's original material
  getMaterialsForObject(object: THREE.Mesh): {
    normalRoughness: THREE.ShaderMaterial;
    albedoAO: THREE.ShaderMaterial;
    depth: THREE.ShaderMaterial;
  } {
    const originalMaterial = object.material as THREE.MeshStandardMaterial;
    const key = object.uuid;

    let normalRoughness = this.normalRoughnessMaterials.get(key);
    let albedoAO = this.albedoAOMaterials.get(key);

    if (!normalRoughness) {
      normalRoughness = createNormalRoughnessMaterial({
        roughness: originalMaterial.roughness ?? 0.5,
        metalness: originalMaterial.metalness ?? 0.0,
        albedo: originalMaterial.color ?? new THREE.Color(0xffffff),
        albedoMap: originalMaterial.map,
      });
      this.normalRoughnessMaterials.set(key, normalRoughness);
    }

    if (!albedoAO) {
      albedoAO = createAlbedoAOMaterial({
        albedo: originalMaterial.color ?? new THREE.Color(0xffffff),
        ao: originalMaterial.aoMapIntensity ?? 1.0,
        albedoMap: originalMaterial.map,
      });
      this.albedoAOMaterials.set(key, albedoAO);
    }

    return {
      normalRoughness,
      albedoAO,
      depth: this.getDepthMaterial(),
    };
  }

  dispose() {
    this.normalRoughnessMaterials.forEach(m => m.dispose());
    this.albedoAOMaterials.forEach(m => m.dispose());
    this.depthMaterial?.dispose();
    this.normalRoughnessMaterials.clear();
    this.albedoAOMaterials.clear();
    this.depthMaterial = null;
  }
}
