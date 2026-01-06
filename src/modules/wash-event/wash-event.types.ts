import { WashEventStatus, WashEntryMode } from '@prisma/client';

// Valid state transitions
export const VALID_STATE_TRANSITIONS: Record<WashEventStatus, WashEventStatus[]> = {
  [WashEventStatus.CREATED]: [WashEventStatus.AUTHORIZED, WashEventStatus.REJECTED],
  [WashEventStatus.AUTHORIZED]: [WashEventStatus.IN_PROGRESS, WashEventStatus.REJECTED],
  [WashEventStatus.IN_PROGRESS]: [WashEventStatus.COMPLETED],
  [WashEventStatus.COMPLETED]: [WashEventStatus.LOCKED],
  [WashEventStatus.LOCKED]: [], // Terminal state - no transitions allowed
  [WashEventStatus.REJECTED]: [], // Terminal state - no transitions allowed
};

export interface WashServiceItem {
  servicePackageId: string;
  vehicleType?: string;
  vehicleRole?: 'TRACTOR' | 'TRAILER';
  plateNumber?: string;
  quantity?: number;
}

export interface CreateWashEventQrDriverInput {
  entryMode: typeof WashEntryMode.QR_DRIVER;
  locationId: string;
  driverId: string;
  servicePackageId?: string;  // DEPRECATED - use services array
  services?: WashServiceItem[];  // Több szolgáltatás támogatása
  tractorVehicleId?: string;
  tractorPlateManual?: string;
  trailerVehicleId?: string;
  trailerPlateManual?: string;
}

export interface CreateWashEventManualOperatorInput {
  entryMode: typeof WashEntryMode.MANUAL_OPERATOR;
  locationId: string;
  partnerCompanyId: string;
  driverNameManual: string;
  servicePackageId: string;
  tractorPlateManual: string;
  trailerPlateManual?: string;
  createdByUserId: string;
}

export type CreateWashEventInput =
  | CreateWashEventQrDriverInput
  | CreateWashEventManualOperatorInput;

export interface WashEventTransitionContext {
  actorType: 'USER' | 'DRIVER' | 'SYSTEM';
  actorId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}
