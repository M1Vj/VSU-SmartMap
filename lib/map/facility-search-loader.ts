export type SearchDataSource = "cache" | "remote" | "empty";

export type SearchLoadResult<T> = {
  data: T[];
  source: SearchDataSource;
  failed: boolean;
};

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
}: FacilityLoaderDependencies<T>): Promise<SearchLoadResult<T>> {
  const cached = await readCache();
  if (cached !== null) publish(cached, "cache");

  try {
    const remote = await fetchRemote();
    if (!remote.error && remote.data !== null) {
      try {
        await writeCache(remote.data);
      } catch {
        // Remote data remains canonical when best-effort persistence fails.
      }
      publish(remote.data, "remote");
      return { data: remote.data, source: "remote", failed: false };
    }
  } catch {
    // Failure is represented without exposing the underlying service error.
  }

  if (cached === null) publish([], "empty");
  return {
    data: cached ?? [],
    source: cached === null ? "empty" : "cache",
    failed: true,
  };
}

export async function loadFacilitySearchRooms<T>({
  query,
  readCache,
  fetchRemote,
  publish,
}: LoaderDependencies<T> & { query: string }): Promise<SearchLoadResult<T>> {
  const term = query.trim();
  if (term.length < 2) {
    publish([], "empty");
    return { data: [], source: "empty", failed: false };
  }

  const cached = await readCache();
  if (cached !== null) publish(cached, "cache");

  try {
    const remote = await fetchRemote();
    if (!remote.error && remote.data !== null) {
      publish(remote.data, "remote");
      return { data: remote.data, source: "remote", failed: false };
    }
  } catch {
    // Failure is represented without exposing the underlying service error.
  }

  if (cached === null) publish([], "empty");
  return {
    data: cached ?? [],
    source: cached === null ? "empty" : "cache",
    failed: true,
  };
}

export type FacilitySearchRequest<T> = {
  available: Promise<T[]>;
  complete: Promise<SearchLoadResult<T>>;
  subscribe: (
    listener: (data: T[], source: SearchDataSource) => void,
  ) => () => void;
};

export type RoomSearchPublication<T> = {
  query: string;
  data: T[];
  source: SearchDataSource;
};

export type RoomSearchRequest<T> = {
  available: Promise<RoomSearchPublication<T>>;
  complete: Promise<SearchLoadResult<T>>;
  subscribe: (
    listener: (publication: RoomSearchPublication<T>) => void,
  ) => () => void;
};

export function startFacilitySearchFacilities<T>(
  dependencies: Omit<FacilityLoaderDependencies<T>, "publish">,
): FacilitySearchRequest<T> {
  const listeners = new Set<(data: T[], source: SearchDataSource) => void>();
  let latest: { data: T[]; source: SearchDataSource } | null = null;
  let resolveAvailable!: (data: T[]) => void;
  let availableResolved = false;
  const available = new Promise<T[]>((resolve) => {
    resolveAvailable = resolve;
  });
  const publish = (data: T[], source: SearchDataSource) => {
    latest = { data, source };
    if (!availableResolved && source === "cache") {
      availableResolved = true;
      resolveAvailable(data);
    }
    for (const listener of listeners) listener(data, source);
  };
  const complete = loadFacilitySearchFacilities({
    ...dependencies,
    publish,
  }).then((result) => {
    if (!availableResolved) {
      availableResolved = true;
      resolveAvailable(result.data);
    }
    return result;
  });

  return {
    available,
    complete,
    subscribe(listener) {
      listeners.add(listener);
      if (latest) listener(latest.data, latest.source);
      return () => listeners.delete(listener);
    },
  };
}

export function startFacilitySearchRooms<T>({
  query,
  readCache,
  fetchRemote,
}: Omit<LoaderDependencies<T>, "publish"> & {
  query: string;
}): RoomSearchRequest<T> {
  const listeners = new Set<(publication: RoomSearchPublication<T>) => void>();
  let latest: RoomSearchPublication<T> | null = null;
  let resolveAvailable!: (publication: RoomSearchPublication<T>) => void;
  let availableResolved = false;
  const available = new Promise<RoomSearchPublication<T>>((resolve) => {
    resolveAvailable = resolve;
  });
  const publish = (data: T[], source: SearchDataSource) => {
    const publication = { query, data, source };
    latest = publication;
    if (!availableResolved) {
      availableResolved = true;
      resolveAvailable(publication);
    }
    for (const listener of listeners) listener(publication);
  };
  const complete = loadFacilitySearchRooms({
    query,
    readCache,
    fetchRemote,
    publish,
  });

  return {
    available,
    complete,
    subscribe(listener) {
      listeners.add(listener);
      if (latest) listener(latest);
      return () => listeners.delete(listener);
    },
  };
}
