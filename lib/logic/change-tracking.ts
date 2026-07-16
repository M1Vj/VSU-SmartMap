import { isDeepEqual } from "@/lib/utils";

type ChangeRecord = {
  from: unknown;
  to: unknown;
};

export type Changes<T> = Partial<Record<keyof T, ChangeRecord>>;

/**
 * Calculates the difference between two objects.
 * Returns a record of changes where keys are the property names and values are objects containing 'from' and 'to' values.
 */
export function calculateChanges<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: Partial<T>,
  ignoreKeys: (keyof T)[] = []
): Changes<T> {
  const changes: Changes<T> = {};

  Object.keys(newObj).forEach((key) => {
    const k = key as keyof T;
    if (ignoreKeys.includes(k)) return;

    const newValue = newObj[k];
    const oldValue = oldObj[k];

    // Handle special case for coordinates if it exists on the type
    if (k === "coordinates" && newValue && typeof newValue === "object" && oldValue && typeof oldValue === "object") {
      const newCoords = newValue as unknown as { lat: number; lng: number };
      const oldCoords = oldValue as unknown as { lat: number; lng: number };

      if (newCoords.lat !== oldCoords.lat || newCoords.lng !== oldCoords.lng) {
        changes[k] = { from: oldCoords, to: newCoords };
      }
      return;
    }

    if (!isDeepEqual(newValue, oldValue)) {
      // Record the change if newValue is not undefined.
      // null is a valid change (clearing a field).
      if (newValue !== undefined) {
        changes[k] = { from: oldValue ?? null, to: newValue };
      }
    }
  });

  return changes;
}
