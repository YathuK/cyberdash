import { Innertube, Platform } from "youtubei.js";

// Register JS evaluator for YouTube URL deciphering
// youtubei.js needs to execute YouTube's player script to decode video URLs
Platform.shim.eval = (code: unknown) => {
  const script = typeof code === "string" ? code : ((code as Record<string, string>)?.output || String(code));
  const fn = new Function(script);
  return fn();
};

let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null;

export async function getInnertube() {
  if (innertubeInstance) return innertubeInstance;

  innertubeInstance = await Innertube.create({
    generate_session_locally: true,
    enable_safety_mode: false,
  });

  return innertubeInstance;
}
