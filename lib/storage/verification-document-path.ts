export const VERIFICATION_DOCUMENT_BUCKET = "boarding-house-verification";

// Future uploads keep user-controlled filename material small. Historical
// object keys are validated separately against the conservative key bound.
export const MAX_VERIFICATION_DOCUMENT_FILENAME_LENGTH = 120;
export const MAX_VERIFICATION_DOCUMENT_OBJECT_KEY_BYTES = 1024;

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_PATTERN = new RegExp(
  `^${UUID_PATTERN}/${UUID_PATTERN}/(?:identity|authority)-[0-9]{1,16}-[a-z0-9.-]*$`,
  "i",
);
const UUID_VALUE_PATTERN = new RegExp(`^${UUID_PATTERN}$`, "i");

export type VerificationDocumentLabel = "identity" | "authority";

function safeFilename(value: string) {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, MAX_VERIFICATION_DOCUMENT_FILENAME_LENGTH)
    .replace(/[.-]+$/g, "");
  return sanitized || "document";
}

export function buildVerificationDocumentPath({
  userId,
  applicationId,
  label,
  timestamp,
  filename,
}: {
  userId: string;
  applicationId: string;
  label: VerificationDocumentLabel;
  timestamp: number;
  filename: string;
}) {
  if (
    !UUID_VALUE_PATTERN.test(userId)
    || !UUID_VALUE_PATTERN.test(applicationId)
    || !Number.isSafeInteger(timestamp)
    || timestamp < 0
  ) {
    throw new Error("Invalid verification document path input.");
  }
  return `${userId}/${applicationId}/${label}-${timestamp}-${safeFilename(filename)}`;
}

export function isValidVerificationDocumentLocation(
  bucket: string,
  objectPath: string,
) {
  if (
    bucket !== VERIFICATION_DOCUMENT_BUCKET
    || objectPath.length === 0
    || Buffer.byteLength(objectPath, "utf8") > MAX_VERIFICATION_DOCUMENT_OBJECT_KEY_BYTES
    || objectPath.includes("%")
  ) {
    return false;
  }
  return PATH_PATTERN.test(objectPath);
}
