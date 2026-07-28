export type SearchDataSource = "cache" | "remote" | "empty";

type RemoteResult<T> = {
  data: T[] | null;
  error: unknown;
};

type LoaderDependencies<T> = {
  readCache: () => Promise<T[] | null>;
  fetchRemote: () => Promise<RemoteResult<T>>;
  publish: (data: T[], source: SearchDataSource) => void;
};

type FacilityLoaderDependencies<T> = LoaderDependencies<T> & {
  writeCache: (data: T[]) => Promise<void>;
};

export async function loadFacilitySearchFacilities<T>({
  readCache,
  writeCache,
  fetchRemote,
  publish,
}: FacilityLoaderDependencies<T>): Promise<T[]> {
  const cached = await readCache();
  if (cached !== null) publish(cached, "cache");

  try {
    const remote = await fetchRemote();
    if (!remote.error && remote.data !== null) {
      await writeCache(remote.data);
      publish(remote.data, "remote");
      return remote.data;
    }
  } catch {
    // The caller exposes a safe status instead of the underlying service error.
  }

  if (cached === null) publish([], "empty");
  return cached ?? [];
}

export async function loadFacilitySearchRooms<T>({
  query,
  readCache,
  fetchRemote,
  publish,
}: LoaderDependencies<T> & { query: string }): Promise<T[]> {
  const term = query.trim();
  if (term.length < 2) {
    publish([], "empty");
    return [];
  }

  const cached = await readCache();
  if (cached !== null) publish(cached, "cache");

  try {
    const remote = await fetchRemote();
    if (!remote.error && remote.data !== null) {
      publish(remote.data, "remote");
      return remote.data;
    }
  } catch {
    // The caller exposes a safe status instead of the underlying service error.
  }

  if (cached === null) publish([], "empty");
  return cached ?? [];
}
