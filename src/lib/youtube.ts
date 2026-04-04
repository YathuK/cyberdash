import { Innertube, Platform } from "youtubei.js";

// Register JS evaluator for YouTube URL deciphering
Platform.shim.eval = (code: unknown) => {
  const script = typeof code === "string" ? code : ((code as Record<string, string>)?.output || String(code));
  const fn = new Function(script);
  return fn();
};

// Don't cache the instance — create fresh each time to avoid stale sessions
export async function getInnertube() {
  return await Innertube.create({
    generate_session_locally: true,
    enable_safety_mode: false,
  });
}
