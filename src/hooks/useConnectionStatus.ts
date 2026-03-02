import { useMemo } from 'react';
import type { FloorPlan, ConnectionStatus, Fixture } from '@/types/floorPlan';

// Thresholds for connection status (in cm)
const CONNECTED_MAX_LENGTH = 500; // Under 5m is "connected" (green)
const WARNING_MAX_LENGTH = 1000; // 5-10m is "warning" (yellow)
// Above 10m is "error" (red)

export function getConnectionStatusColor(status: 'connected' | 'warning' | 'error'): string {
  switch (status) {
    case 'connected': return 'hsl(142 76% 36%)'; // green
    case 'warning': return 'hsl(45 100% 50%)'; // yellow
    case 'error': return 'hsl(0 70% 50%)'; // red
    default: return 'hsl(var(--muted-foreground))';
  }
}

export function getStatusFromLength(length: number): 'connected' | 'warning' | 'error' {
  if (length <= 0) return 'error';
  if (length <= CONNECTED_MAX_LENGTH) return 'connected';
  if (length <= WARNING_MAX_LENGTH) return 'warning';
  return 'error';
}

export function useConnectionStatus(floorPlan: FloorPlan): Map<string, ConnectionStatus> {
  return useMemo(() => {
    const statusMap = new Map<string, ConnectionStatus>();

    for (const fixture of floorPlan.fixtures) {
      if (fixture.category !== 'bathroom' && fixture.category !== 'kitchen') {
        continue;
      }

      // Find routes for this fixture
      const supplyRoute = floorPlan.plumbingRoutes.find(
        r => r.fixtureId === fixture.id && r.type === 'water-supply'
      );
      const drainRoute = floorPlan.plumbingRoutes.find(
        r => r.fixtureId === fixture.id && r.type === 'drainage'
      );
      const electricalRoute = floorPlan.electricalRoutes.find(
        r => r.fixtureId === fixture.id
      );

      const supplyLength = supplyRoute?.length ?? 0;
      const drainLength = drainRoute?.length ?? 0;
      const electricalLength = electricalRoute?.length ?? 0;

      // Determine status based on route length
      const hasPlumbing = fixture.plumbingConnections.length > 0;
      const hasElectrical = fixture.electricalConnections.length > 0;

      const status: ConnectionStatus = {
        fixtureId: fixture.id,
        waterSupply: hasPlumbing ? getStatusFromLength(supplyLength) : 'connected',
        drainage: hasPlumbing ? getStatusFromLength(drainLength) : 'connected',
        electrical: hasElectrical ? getStatusFromLength(electricalLength) : 'connected',
        supplyLength,
        drainLength,
        electricalLength,
      };

      statusMap.set(fixture.id, status);
    }

    return statusMap;
  }, [floorPlan.fixtures, floorPlan.plumbingRoutes, floorPlan.electricalRoutes]);
}

export function getOverallStatus(status: ConnectionStatus): 'connected' | 'warning' | 'error' {
  if (status.waterSupply === 'error' || status.drainage === 'error' || status.electrical === 'error') {
    return 'error';
  }
  if (status.waterSupply === 'warning' || status.drainage === 'warning' || status.electrical === 'warning') {
    return 'warning';
  }
  return 'connected';
}
