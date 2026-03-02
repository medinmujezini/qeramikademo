import * as THREE from 'three';

/**
 * Final Composition Shader
 * Combines direct lighting, SSGI, probe GI, SSAO, and room tint
 * into the final rendered image
 */

export const CompositionVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const CompositionFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tDirect;
  uniform sampler2D tSSGI;
  uniform sampler2D tProbeGI;
  uniform sampler2D tSSAO;
  uniform sampler2D tAlbedo;
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  
  uniform float ssgiWeight;
  uniform float probeWeight;
  uniform float aoIntensity;
  uniform vec3 roomTintColor;
  uniform float roomTintIntensity;
  uniform float exposure;
  uniform bool useSSGI;
  uniform bool useProbeGI;
  uniform bool useSSAO;
  uniform bool useRoomTint;
  
  varying vec2 vUv;
  
  // Decode normal from octahedral representation
  vec3 decodeNormal(vec2 f) {
    f = f * 2.0 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  // ACES Filmic Tone Mapping
  vec3 ACESFilmic(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  
  // Reinhard tone mapping (softer alternative)
  vec3 Reinhard(vec3 x) {
    return x / (x + vec3(1.0));
  }
  
  // Room tint bounce - fake color bleeding
  vec3 applyRoomTint(vec3 indirect, vec3 normal) {
    // Bias indirect toward room's dominant color
    vec3 tint = roomTintColor * roomTintIntensity;
    
    // Apply more to surfaces facing up/down (floor/ceiling bounce simulation)
    float upFactor = abs(normal.y) * 0.5 + 0.5;
    
    return indirect + tint * upFactor;
  }
  
  // Fallback ambient when GI not available
  vec3 hemisphereAmbient(vec3 normal) {
    vec3 skyColor = vec3(0.6, 0.7, 0.9);
    vec3 groundColor = vec3(0.2, 0.2, 0.1);
    
    float upFactor = normal.y * 0.5 + 0.5;
    return mix(groundColor, skyColor, upFactor) * 0.3;
  }
  
  void main() {
    float depth = texture2D(tDepth, vUv).r;
    
    // Background - just output direct
    if (depth >= 1.0) {
      vec3 direct = texture2D(tDirect, vUv).rgb;
      gl_FragColor = vec4(direct, 1.0);
      return;
    }
    
    // Sample all inputs
    vec3 direct = texture2D(tDirect, vUv).rgb;
    vec3 ssgi = texture2D(tSSGI, vUv).rgb;
    vec3 probeGI = texture2D(tProbeGI, vUv).rgb;
    float ao = texture2D(tSSAO, vUv).r;
    vec3 albedo = texture2D(tAlbedo, vUv).rgb;
    vec3 normal = decodeNormal(texture2D(tNormal, vUv).xy);
    
    // Compute indirect lighting
    vec3 indirect = vec3(0.0);
    bool hasGI = false;
    
    // Add probe GI (stable, covers off-screen)
    if (useProbeGI) {
      indirect += probeGI * probeWeight;
      hasGI = true;
    }
    
    // Add SSGI (detailed, local)
    if (useSSGI) {
      indirect += ssgi * ssgiWeight;
      hasGI = true;
    }
    
    // Fallback if no GI available
    if (!hasGI) {
      indirect = hemisphereAmbient(normal);
    }
    
    // Apply room tint (the "cheat" for extra color bleeding)
    if (useRoomTint) {
      indirect = applyRoomTint(indirect, normal);
    }
    
    // Clamp indirect to prevent glowing/fireflies
    indirect = clamp(indirect, vec3(0.0), vec3(2.0));
    
    // Apply SSAO only to indirect lighting (not direct)
    if (useSSAO) {
      float aoFactor = mix(1.0, ao, aoIntensity);
      indirect *= aoFactor;
    }
    
    // Final color: direct + (indirect * albedo)
    vec3 finalColor = direct + indirect * albedo;
    
    // Apply exposure
    finalColor *= exposure;
    
    // Tone mapping
    finalColor = ACESFilmic(finalColor);
    
    // Gamma correction (assuming linear workflow)
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function createCompositionUniforms(params: {
  directTexture: THREE.Texture;
  ssgiTexture: THREE.Texture;
  probeGITexture: THREE.Texture;
  ssaoTexture: THREE.Texture;
  albedoTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  ssgiWeight?: number;
  probeWeight?: number;
  aoIntensity?: number;
  roomTintColor?: THREE.Color;
  roomTintIntensity?: number;
  exposure?: number;
  useSSGI?: boolean;
  useProbeGI?: boolean;
  useSSAO?: boolean;
  useRoomTint?: boolean;
}): Record<string, THREE.IUniform> {
  const {
    directTexture,
    ssgiTexture,
    probeGITexture,
    ssaoTexture,
    albedoTexture,
    depthTexture,
    normalTexture,
    ssgiWeight = 0.5,
    probeWeight = 0.5,
    aoIntensity = 1.0,
    roomTintColor = new THREE.Color(0.3, 0.3, 0.3),
    roomTintIntensity = 0.15,
    exposure = 1.0,
    useSSGI = true,
    useProbeGI = true,
    useSSAO = true,
    useRoomTint = true,
  } = params;
  
  return {
    tDirect: { value: directTexture },
    tSSGI: { value: ssgiTexture },
    tProbeGI: { value: probeGITexture },
    tSSAO: { value: ssaoTexture },
    tAlbedo: { value: albedoTexture },
    tDepth: { value: depthTexture },
    tNormal: { value: normalTexture },
    ssgiWeight: { value: ssgiWeight },
    probeWeight: { value: probeWeight },
    aoIntensity: { value: aoIntensity },
    roomTintColor: { value: roomTintColor },
    roomTintIntensity: { value: roomTintIntensity },
    exposure: { value: exposure },
    useSSGI: { value: useSSGI },
    useProbeGI: { value: useProbeGI },
    useSSAO: { value: useSSAO },
    useRoomTint: { value: useRoomTint },
  };
}

export function createCompositionMaterial(
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: CompositionVertexShader,
    fragmentShader: CompositionFragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}
