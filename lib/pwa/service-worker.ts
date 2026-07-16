export type ServiceWorkerMode = "register" | "unregister";

export function getServiceWorkerMode(nodeEnv: string | undefined): ServiceWorkerMode {
  return nodeEnv === "production" ? "register" : "unregister";
}

export function getServiceWorkerUrl(enableLocalOffline: string | undefined, hostname: string) {
  const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
  return isLocalHost && enableLocalOffline === "true" ? "/sw.js?offline=1" : "/sw.js";
}
