export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface ImageAsset {
  readonly src: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ContactInfo {
  readonly email?: string;
  readonly phone?: string;
  readonly facebook?: string;
  readonly website?: string;
}

export interface AuditFields {
  readonly createdAt: string;
  readonly updatedAt?: string;
}