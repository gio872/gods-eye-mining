/**
 * Activate the requested first basemap, then recover from a false-positive
 * Earth Engine health check with the independent public satellite source.
 * MapSourceController records activation failures in its returned state.
 */
export async function activateInitialMapStack(
  controller,
  requestedStackId,
  { geeStackId = 'gee-global-eo', fallbackStackId = 'esri-imagery' } = {},
) {
  const primaryState = await controller.setStack(requestedStackId, { silent: true });
  const primaryFailed =
    Boolean(primaryState?.lastError) ||
    primaryState?.status === 'error' ||
    primaryState?.activeId !== requestedStackId;
  if (requestedStackId !== geeStackId || !primaryFailed) {
    return {
      requestedStackId,
      state: primaryState,
      usedFallback: false,
      reason: null,
    };
  }

  const reason = primaryState?.lastError || 'Earth Engine imagery did not activate';
  const fallbackState = await controller.setStack(fallbackStackId, { silent: true });
  return {
    requestedStackId,
    state: fallbackState,
    usedFallback: true,
    reason,
  };
}
