export interface TenantContext {
  networkId: string;
  actorType: 'USER' | 'DRIVER' | 'SYSTEM';
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DriverContext extends TenantContext {
  actorType: 'DRIVER';
  driverId: string;
  partnerCompanyId: string;
}

export interface UserContext extends TenantContext {
  actorType: 'USER';
  userId: string;
}

export interface SystemContext extends TenantContext {
  actorType: 'SYSTEM';
}
