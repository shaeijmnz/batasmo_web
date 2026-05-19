/** True on phones / low-memory devices — use lighter video settings. */
export const isLowPowerVideoDevice = () => {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const lowMemory =
    typeof navigator !== 'undefined' &&
    Number(navigator.deviceMemory || 0) > 0 &&
    navigator.deviceMemory <= 4;
  return narrow || lowMemory;
};

/** Light permission warmup — avoids opening the camera twice before VideoSDK. */
export const warmupMediaPermissions = async () => {
  if (!navigator?.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      isLowPowerVideoDevice() ? { audio: true } : { audio: true, video: true },
    );
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // VideoSDK will prompt again if needed.
  }
};
