/**
 * Device fingerprinting types and interfaces
 */

export interface DeviceFingerprint {
  visitorId: string;
  confidence: {
    score: number;
  };
  components: Record<string, any>;
}

export interface DeviceMetadata {
  userAgent?: string;
  locale?: string;
  timezone?: string;
  screenResolution?: string;
  platform?: string;
}

export interface StoredDeviceData {
  deviceId: string;
  fingerprint: string;
  createdAt: number;
  metadata?: DeviceMetadata;
}
