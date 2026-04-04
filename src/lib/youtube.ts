import { Innertube, Platform, ClientType } from "youtubei.js";

// Register JS evaluator for YouTube URL deciphering
Platform.shim.eval = (code: unknown) => {
  const script = typeof code === "string" ? code : ((code as Record<string, string>)?.output || String(code));
  const fn = new Function(script);
  return fn();
};

export async function getInnertube() {
  return await Innertube.create({
    generate_session_locally: true,
    enable_safety_mode: false,
    client_type: ClientType.TV,
  });
}
