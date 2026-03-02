export function quitIfWebGPUNotAvailable(
  adapter: GPUAdapter | null,
  device: GPUDevice | null
): asserts adapter is GPUAdapter {
  if (!adapter || !device) {
    document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff;">
        <h1 style="margin-bottom: 1rem;">WebGPU Not Available</h1>
        <p style="color: #888;">This demo requires a browser with WebGPU support.</p>
        <p style="color: #888; margin-top: 0.5rem;">Try Chrome 113+ or Edge 113+ on desktop.</p>
      </div>
    `;
    throw new Error('WebGPU not available');
  }
}

export function quitIfAdapterNotAvailable(
  adapter: GPUAdapter | null
): asserts adapter is GPUAdapter {
  if (!adapter) {
    document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff;">
        <h1 style="margin-bottom: 1rem;">WebGPU Not Available</h1>
        <p style="color: #888;">This demo requires a browser with WebGPU support.</p>
        <p style="color: #888; margin-top: 0.5rem;">Try Chrome 113+ or Edge 113+ on desktop.</p>
      </div>
    `;
    throw new Error('WebGPU adapter not available');
  }
}

export function quitIfLimitLessThan(
  adapter: GPUAdapter,
  limitName: string,
  minValue: number,
  limits: Record<string, GPUSize32>
): void {
  const adapterLimit = (adapter.limits as unknown as Record<string, number>)[limitName];
  if (adapterLimit < minValue) {
    document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff;">
        <h1 style="margin-bottom: 1rem;">WebGPU Limit Not Met</h1>
        <p style="color: #888;">This demo requires ${limitName} >= ${minValue}.</p>
        <p style="color: #888; margin-top: 0.5rem;">Your adapter only supports ${adapterLimit}.</p>
      </div>
    `;
    throw new Error(`WebGPU limit ${limitName} not met`);
  }
  limits[limitName] = minValue;
}
