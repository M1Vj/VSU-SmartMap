import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";

export async function getPublicBoardingHouseSummaries(): Promise<BoardingHouseSummary[]> {
  const response = await fetch("/api/boarding-houses", {
    headers: { Accept: "application/json" },
  });

  if (response.status === 204) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load boarding houses (status ${response.status})`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return [];
  }

  return Array.isArray(data) ? (data as BoardingHouseSummary[]) : [];
}

export function keepPublicBoardingHouses(
  list: BoardingHouseSummary[],
): BoardingHouseSummary[] {
  return list.filter(
    (item) => item.status === "published" && item.verificationStatus === "verified",
  );
}
