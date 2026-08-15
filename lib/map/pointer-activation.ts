export type PointerModality = "mouse" | "touch" | "pen";

export interface PointerActivationEvent {
  pointerId: number;
  pointerType: string;
  button?: number;
  isPrimary?: boolean;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export interface PointerActivation {
  itemId: string;
  pointerId: number;
  pointerType: PointerModality;
  startX: number;
  startY: number;
  startedAt: number;
  activationId: string;
}

export interface CompatibilityActivationRecord {
  activationId: string;
  modality: PointerModality | "keyboard";
  pointerId: number | null;
  at: number;
}

export interface CompatibilityClickEvent {
  pointerId?: number;
  detail?: number;
  button?: number;
  isPrimary?: boolean;
}

export const POINTER_TAP_MOVE_TOLERANCE_PX = 12;
export const POINTER_TAP_MAX_DURATION_MS = 350;

export function normalizePointerModality(pointerType: string): PointerModality {
  return pointerType === "touch" || pointerType === "pen" ? pointerType : "mouse";
}

export function isPrimaryPointerActivation(event: PointerActivationEvent): boolean {
  if (event.isPrimary === false) return false;
  return event.button === undefined || event.button === 0;
}

export function isPrimaryCompatibilityClick(event: CompatibilityClickEvent): boolean {
  return event.button === undefined || event.button === 0;
}

export function createPointerActivation(
  itemId: string,
  event: PointerActivationEvent,
): PointerActivation {
  return {
    itemId,
    pointerId: event.pointerId,
    pointerType: normalizePointerModality(event.pointerType),
    startX: event.clientX,
    startY: event.clientY,
    startedAt: event.timeStamp,
    activationId: `${itemId}:pointer:${event.pointerId}:${event.timeStamp}`,
  };
}

export function isPointerTap(
  activation: PointerActivation,
  event: PointerActivationEvent,
): boolean {
  if (event.pointerId !== activation.pointerId) return false;
  const elapsed = event.timeStamp - activation.startedAt;
  if (elapsed < 0 || elapsed > POINTER_TAP_MAX_DURATION_MS) return false;
  const distance = Math.hypot(event.clientX - activation.startX, event.clientY - activation.startY);
  return distance <= POINTER_TAP_MOVE_TOLERANCE_PX;
}

export function shouldDedupeCompatibilityClick(
  record: CompatibilityActivationRecord,
  event: CompatibilityClickEvent,
  now: number,
  maxAgeMs = 1500,
): boolean {
  if (now - record.at < 0 || now - record.at >= maxAgeMs) return false;
  if (record.modality === "keyboard") return event.detail === 0;
  if (event.pointerId === undefined) return true;
  return record.pointerId !== null && event.pointerId === record.pointerId;
}
