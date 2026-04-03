export function isTesla(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Tesla/i.test(navigator.userAgent);
}

export function getChromiumVersion(): number {
  if (typeof navigator === "undefined") return 999;
  const match = navigator.userAgent.match(/Chrome\/(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

export const TESLA_VIEWPORT = {
  MODEL_3Y_WIDTH: 1920,
  MODEL_3Y_HEIGHT: 855, // with address bar
  MODEL_3Y_FULL: 1005, // address bar hidden
  MODEL_SX_WIDTH: 2200,
  MODEL_SX_HEIGHT: 1100,
} as const;
