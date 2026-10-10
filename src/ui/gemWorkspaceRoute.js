export const GEM_WORKSPACE_QUERY = 'gemWorkspace';
export const GLOBAL_SURFACE_WORKSPACE = 'global-surface';

/** Detect the dedicated Global Surface browser window from its URL query. */
export function isGlobalSurfaceWindow(search = '') {
  return new URLSearchParams(String(search).startsWith('?') ? String(search).slice(1) : String(search))
    .get(GEM_WORKSPACE_QUERY) === GLOBAL_SURFACE_WORKSPACE;
}

/** Preserve the local Pinokio origin and existing query parameters. */
export function buildGlobalSurfaceUrl(currentHref) {
  const url = new URL(currentHref);
  url.searchParams.set(GEM_WORKSPACE_QUERY, GLOBAL_SURFACE_WORKSPACE);
  return url.toString();
}
