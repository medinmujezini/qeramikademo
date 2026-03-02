/**
 * MEP Inspection Validator - Phase 8
 * 
 * "Fails Inspection" validator that checks all plumbing code requirements
 * and generates a detailed inspection report.
 */

import { v4 as uuidv4 } from 'uuid';
import type { MEPFixture, MEPRoute, MEPNode, MEPClash, Point3D } from '@/types/mep';
import { validateRouteSlopes, checkMaxFlatRun, type SlopeViolation } from './mepSlopeEngine';
import { validateVentRoute, detectSTrap, validateTrapArmLength, type VentViolation } from './mepVentRules';
import { placeCleanouts, type CleanoutViolation } from './mepCleanouts';
import { createTrapInfo, detectSTraps, type TrapInfo } from './mepTraps';
import { checkBranchLimits, validateNoIllegalReductions, analyzeBranchLoad } from './mepBranchSizing';
import { checkHotColdSeparation, validateIsolationValves, type WaterLineViolation } from './mepWaterLines';
import { detectClashes } from './mepClashDetection';

// =============================================================================
// TYPES
// =============================================================================

export type ViolationCategory = 
  | 'slope'
  | 'vent'
  | 'cleanout'
  | 'trap'
  | 'size'
  | 'clearance'
  | 'connection'
  | 'valve'
  | 'code';

export type ViolationSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface InspectionViolation {
  id: string;
  category: ViolationCategory;
  severity: ViolationSeverity;
  title: string;
  message: string;
  location?: Point3D;
  elementId?: string;
  elementType?: 'fixture' | 'route' | 'segment' | 'node';
  codeReference?: string;
  suggestedFix?: string;
}

export interface InspectionResult {
  passed: boolean;
  score: number;                    // 0-100
  violations: InspectionViolation[];
  warnings: InspectionViolation[];
  summary: InspectionSummary;
  timestamp: Date;
}

export interface InspectionSummary {
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  byCategory: Record<ViolationCategory, number>;
  passedChecks: string[];
  failedChecks: string[];
}

export interface InspectionCheckResult {
  checkName: string;
  passed: boolean;
  violations: InspectionViolation[];
}

// =============================================================================
// INSPECTION CHECKS
// =============================================================================

/**
 * Run complete inspection on MEP system
 */
export function runFullInspection(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[],
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
): InspectionResult {
  const allViolations: InspectionViolation[] = [];
  const checks: InspectionCheckResult[] = [];
  
  // 1. Slope Checks
  checks.push(runSlopeInspection(routes));
  
  // 2. Vent Checks
  checks.push(runVentInspection(fixtures, routes));
  
  // 3. Cleanout Checks
  checks.push(runCleanoutInspection(routes, nodes));
  
  // 4. Trap Checks
  checks.push(runTrapInspection(fixtures, routes));
  
  // 5. Sizing Checks
  checks.push(runSizingInspection(routes, fixtures));
  
  // 6. Clearance Checks
  checks.push(runClearanceInspection(fixtures, routes, nodes));
  
  // 7. Connection Checks
  checks.push(runConnectionInspection(fixtures, routes, nodes));
  
  // 8. Water Line Checks
  checks.push(runWaterLineInspection(routes, fixtures, nodes));
  
  // Collect all violations
  for (const check of checks) {
    allViolations.push(...check.violations);
  }
  
  // Separate by severity
  const criticalAndErrors = allViolations.filter(v => 
    v.severity === 'critical' || v.severity === 'error'
  );
  const warnings = allViolations.filter(v => v.severity === 'warning');
  
  // Calculate score
  const score = calculateInspectionScore(allViolations);
  
  // Build summary
  const summary = buildSummary(allViolations, checks);
  
  return {
    passed: criticalAndErrors.length === 0,
    score,
    violations: criticalAndErrors,
    warnings,
    summary,
    timestamp: new Date(),
  };
}

// =============================================================================
// INDIVIDUAL INSPECTION CHECKS
// =============================================================================

function runSlopeInspection(routes: MEPRoute[]): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  const drainageRoutes = routes.filter(r => r.systemType === 'drainage');
  
  for (const route of drainageRoutes) {
    // Check segment slopes
    const slopeViolations = validateRouteSlopes(route);
    for (const sv of slopeViolations) {
      violations.push({
        id: uuidv4(),
        category: 'slope',
        severity: sv.severity === 'error' ? 'critical' : 'error',
        title: 'Insufficient Drainage Slope',
        message: sv.message,
        elementId: sv.segmentId,
        elementType: 'segment',
        codeReference: 'IPC 704.1',
        suggestedFix: `Increase slope to minimum ${sv.requiredSlope}"/ft`,
      });
    }
    
    // Check for long flat runs
    const flatRun = checkMaxFlatRun(route);
    if (flatRun.isViolation) {
      violations.push({
        id: uuidv4(),
        category: 'slope',
        severity: 'error',
        title: 'Excessive Flat Run',
        message: flatRun.message,
        elementId: route.id,
        elementType: 'route',
        codeReference: 'IPC 704.1',
        suggestedFix: 'Add slope or reduce horizontal run length',
      });
    }
  }
  
  return {
    checkName: 'Drainage Slopes',
    passed: violations.length === 0,
    violations,
  };
}

function runVentInspection(fixtures: MEPFixture[], routes: MEPRoute[]): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  // Fixtures that don't require individual vents (wet vented, integral trap, or no drain)
  const noVentRequired = ['toilet', 'floor-drain', 'hose-bib', 'dishwasher', 'washing-machine'];
  
  for (const fixture of fixtures) {
    const ventRoute = routes.find(r => 
      r.destination.type === 'fixture' &&
      r.destination.id === fixture.id &&
      r.systemType === 'vent'
    );
    
    const drainRoute = routes.find(r =>
      r.destination.type === 'fixture' &&
      r.destination.id === fixture.id &&
      r.systemType === 'drainage'
    );
    
    // Check vent route if exists
    if (ventRoute) {
      const ventViolations = validateVentRoute(ventRoute, fixture);
      // Only report first violation per fixture for venting
      if (ventViolations.length > 0) {
        const vv = ventViolations[0];
        violations.push({
          id: uuidv4(),
          category: 'vent',
          severity: vv.severity === 'critical' ? 'critical' : 'error',
          title: 'Vent Configuration Error',
          message: vv.message,
          elementId: fixture.id,
          elementType: 'fixture',
          codeReference: vv.codeReference,
          suggestedFix: 'Ensure vent rises above flood rim before horizontal run',
        });
      }
    } else if (drainRoute && !noVentRequired.includes(fixture.type)) {
      // No vent route but has drainage - check if wet venting is likely
      // If drain route goes to a stack, assume wet venting is acceptable
      const goesToStack = drainRoute.destination.type === 'node' || 
        routes.some(r => r.systemType === 'vent' && r.source.nodeId === drainRoute.source.nodeId);
      
      if (!goesToStack) {
        violations.push({
          id: uuidv4(),
          category: 'vent',
          severity: 'warning', // Downgrade to warning - wet venting may be acceptable
          title: 'Missing Vent',
          message: `${fixture.name} may require individual vent (or verify wet vent)`,
          elementId: fixture.id,
          elementType: 'fixture',
          codeReference: 'IPC 901.2',
          suggestedFix: 'Add vent connection or verify wet vent configuration',
        });
      }
    }
    
    // Check for S-trap only if there's no vent route (S-trap with vent is OK)
    if (drainRoute && !ventRoute) {
      const sTrap = detectSTrap(drainRoute);
      if (sTrap) {
        violations.push({
          id: uuidv4(),
          category: 'trap',
          severity: 'critical',
          title: 'S-Trap Detected',
          message: sTrap.message,
          elementId: fixture.id,
          elementType: 'fixture',
          codeReference: sTrap.codeReference,
          suggestedFix: 'Install P-trap with proper trap arm to vent',
        });
      }
    }
  }
  
  return {
    checkName: 'Venting',
    passed: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    violations,
  };
}

function runCleanoutInspection(routes: MEPRoute[], nodes: MEPNode[]): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  const drainageRoutes = routes.filter(r => r.systemType === 'drainage');
  
  for (const route of drainageRoutes) {
    const cleanoutResult = placeCleanouts(route, nodes);
    
    for (const cv of cleanoutResult.violations) {
      violations.push({
        id: uuidv4(),
        category: 'cleanout',
        severity: cv.severity === 'error' ? 'error' : 'warning',
        title: 'Cleanout Issue',
        message: cv.message,
        location: cv.location,
        elementId: route.id,
        elementType: 'route',
        codeReference: cv.codeReference,
        suggestedFix: 'Add cleanout access per code requirements',
      });
    }
  }
  
  return {
    checkName: 'Cleanouts',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

function runTrapInspection(fixtures: MEPFixture[], routes: MEPRoute[]): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  // Check all S-traps
  const sTraps = detectSTraps(fixtures, routes);
  for (const st of sTraps) {
    violations.push({
      id: uuidv4(),
      category: 'trap',
      severity: 'critical',
      title: 'S-Trap Configuration',
      message: st.message,
      elementId: st.fixtureId,
      elementType: 'fixture',
      codeReference: 'IPC 1002.1',
      suggestedFix: 'Replace with P-trap and add proper venting',
    });
  }
  
  // Check trap info for each fixture
  for (const fixture of fixtures) {
    if (fixture.type === 'toilet' || fixture.type === 'hose-bib') continue;
    
    const drainRoute = routes.find(r =>
      r.destination.type === 'fixture' &&
      r.destination.id === fixture.id &&
      r.systemType === 'drainage'
    );
    
    if (drainRoute) {
      const trapInfo = createTrapInfo(fixture, drainRoute, null);
      
      if (trapInfo.isViolation && trapInfo.violationType === 'oversized-arm') {
        violations.push({
          id: uuidv4(),
          category: 'trap',
          severity: 'error',
          title: 'Trap Arm Too Long',
          message: trapInfo.message,
          elementId: fixture.id,
          elementType: 'fixture',
          codeReference: 'IPC Table 906.1',
          suggestedFix: `Reduce trap arm to max ${trapInfo.maxArmLength} ft or add vent closer`,
        });
      }
    }
  }
  
  return {
    checkName: 'Traps',
    passed: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
  };
}

function runSizingInspection(routes: MEPRoute[], fixtures: MEPFixture[]): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  for (const route of routes) {
    // Check for undersized pipes
    const branchLoad = analyzeBranchLoad(route, fixtures);
    
    if (branchLoad.isUndersized) {
      violations.push({
        id: uuidv4(),
        category: 'size',
        severity: 'error',
        title: 'Pipe Undersized',
        message: branchLoad.message,
        elementId: route.id,
        elementType: 'route',
        codeReference: route.systemType === 'drainage' ? 'IPC Table 709.1' : 'IPC Table 604.4',
        suggestedFix: `Increase pipe size to ${branchLoad.calculatedSize}"`,
      });
    }
    
    // Check for illegal reductions in drainage
    const reductionViolations = validateNoIllegalReductions(route);
    for (const msg of reductionViolations) {
      violations.push({
        id: uuidv4(),
        category: 'size',
        severity: 'error',
        title: 'Illegal Pipe Reduction',
        message: msg,
        elementId: route.id,
        elementType: 'route',
        codeReference: 'IPC 704.3',
        suggestedFix: 'Maintain or increase pipe size in flow direction',
      });
    }
    
    // Check branch limits
    if (route.systemType === 'drainage') {
      const branchCheck = checkBranchLimits(
        route.requiredSize,
        route.totalDFU,
        1 // Assuming 1 fixture per route for now
      );
      
      if (branchCheck.isOverloaded) {
        violations.push({
          id: uuidv4(),
          category: 'size',
          severity: 'error',
          title: 'Branch Overloaded',
          message: branchCheck.message,
          elementId: route.id,
          elementType: 'route',
          codeReference: 'IPC 710.1',
          suggestedFix: 'Increase branch size or reduce connected fixtures',
        });
      }
    }
  }
  
  return {
    checkName: 'Pipe Sizing',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

function runClearanceInspection(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[]
): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  // Run clash detection
  const clashResult = detectClashes(fixtures, routes, nodes);
  
  // Deduplicate by element pair
  const seenPairs = new Set<string>();
  
  for (const clash of clashResult.clashes) {
    const pairKey = [clash.element1.id, clash.element2.id].sort().join('-');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    
    violations.push({
      id: clash.id,
      category: 'clearance',
      severity: clash.severity === 'critical' ? 'critical' : 
                clash.severity === 'warning' ? 'warning' : 'error',
      title: clash.type === 'hard' ? 'Physical Collision' : 'Clearance Violation',
      message: clash.resolution || `${clash.type} clash between systems`,
      location: clash.position,
      elementId: clash.element1.id,
      elementType: clash.element1.type as 'fixture' | 'route' | 'node',
      suggestedFix: clash.canAutoResolve 
        ? 'Auto-resolve available' 
        : 'Manually adjust pipe routing',
    });
  }
  
  return {
    checkName: 'Clearances',
    passed: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
  };
}

function runConnectionInspection(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[]
): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  for (const fixture of fixtures) {
    const requiredConnections = fixture.connections.filter(c => c.isRequired);
    
    for (const conn of requiredConnections) {
      const hasRoute = routes.some(r =>
        r.destination.type === 'fixture' &&
        r.destination.id === fixture.id &&
        r.systemType === conn.systemType
      );
      
      if (!hasRoute) {
        violations.push({
          id: uuidv4(),
          category: 'connection',
          severity: conn.systemType === 'drainage' ? 'critical' : 'error',
          title: 'Missing Connection',
          message: `${fixture.name} missing required ${conn.systemType} connection`,
          elementId: fixture.id,
          elementType: 'fixture',
          codeReference: 'IPC 301.3',
          suggestedFix: `Route ${conn.systemType} to fixture`,
        });
      }
    }
  }
  
  return {
    checkName: 'Connections',
    passed: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
  };
}

function runWaterLineInspection(
  routes: MEPRoute[],
  fixtures: MEPFixture[],
  nodes: MEPNode[]
): InspectionCheckResult {
  const violations: InspectionViolation[] = [];
  
  const hotRoutes = routes.filter(r => r.systemType === 'hot-water');
  const coldRoutes = routes.filter(r => r.systemType === 'cold-water');
  
  // Check hot/cold separation
  const separationViolations = checkHotColdSeparation(hotRoutes, coldRoutes);
  for (const sv of separationViolations) {
    violations.push({
      id: uuidv4(),
      category: 'clearance',
      severity: sv.severity === 'error' ? 'error' : 'warning',
      title: 'Water Line Separation',
      message: sv.message,
      location: sv.position,
      codeReference: sv.codeReference,
      suggestedFix: 'Increase separation or add insulation',
    });
  }
  
  return {
    checkName: 'Water Lines',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// =============================================================================
// SCORING AND SUMMARY
// =============================================================================

function calculateInspectionScore(violations: InspectionViolation[]): number {
  let score = 100;
  
  for (const v of violations) {
    switch (v.severity) {
      case 'critical':
        score -= 25;
        break;
      case 'error':
        score -= 10;
        break;
      case 'warning':
        score -= 3;
        break;
      case 'info':
        score -= 0;
        break;
    }
  }
  
  return Math.max(0, score);
}

function buildSummary(
  violations: InspectionViolation[],
  checks: InspectionCheckResult[]
): InspectionSummary {
  const byCategory: Record<ViolationCategory, number> = {
    slope: 0,
    vent: 0,
    cleanout: 0,
    trap: 0,
    size: 0,
    clearance: 0,
    connection: 0,
    valve: 0,
    code: 0,
  };
  
  let criticalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  
  for (const v of violations) {
    byCategory[v.category]++;
    
    switch (v.severity) {
      case 'critical': criticalCount++; break;
      case 'error': errorCount++; break;
      case 'warning': warningCount++; break;
      case 'info': infoCount++; break;
    }
  }
  
  const passedChecks = checks.filter(c => c.passed).map(c => c.checkName);
  const failedChecks = checks.filter(c => !c.passed).map(c => c.checkName);
  
  return {
    criticalCount,
    errorCount,
    warningCount,
    infoCount,
    byCategory,
    passedChecks,
    failedChecks,
  };
}

// =============================================================================
// REPORT FORMATTING
// =============================================================================

/**
 * Format inspection result for display
 */
export function formatInspectionReport(result: InspectionResult): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════');
  lines.push('         MEP INSPECTION REPORT             ');
  lines.push('═══════════════════════════════════════════');
  lines.push('');
  lines.push(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Date: ${result.timestamp.toLocaleString()}`);
  lines.push('');
  
  lines.push('─────────────────────────────────────────');
  lines.push('SUMMARY');
  lines.push('─────────────────────────────────────────');
  lines.push(`Critical Issues: ${result.summary.criticalCount}`);
  lines.push(`Errors: ${result.summary.errorCount}`);
  lines.push(`Warnings: ${result.summary.warningCount}`);
  lines.push('');
  
  if (result.summary.passedChecks.length > 0) {
    lines.push('✅ Passed Checks:');
    for (const check of result.summary.passedChecks) {
      lines.push(`   • ${check}`);
    }
    lines.push('');
  }
  
  if (result.summary.failedChecks.length > 0) {
    lines.push('❌ Failed Checks:');
    for (const check of result.summary.failedChecks) {
      lines.push(`   • ${check}`);
    }
    lines.push('');
  }
  
  if (result.violations.length > 0) {
    lines.push('─────────────────────────────────────────');
    lines.push('VIOLATIONS');
    lines.push('─────────────────────────────────────────');
    
    for (const v of result.violations) {
      const icon = v.severity === 'critical' ? '🚨' : '❌';
      lines.push(`${icon} [${v.category.toUpperCase()}] ${v.title}`);
      lines.push(`   ${v.message}`);
      if (v.codeReference) {
        lines.push(`   Code: ${v.codeReference}`);
      }
      if (v.suggestedFix) {
        lines.push(`   Fix: ${v.suggestedFix}`);
      }
      lines.push('');
    }
  }
  
  lines.push('═══════════════════════════════════════════');
  
  return lines.join('\n');
}
