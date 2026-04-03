import { Innertube } from "youtubei.js";
import { Jinter } from "jintr";

let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null;

export async function getInnertube() {
  if (innertubeInstance) return innertubeInstance;

  innertubeInstance = await Innertube.create({
    generate_session_locally: true,
    enable_safety_mode: false,
  });

  const player = innertubeInstance.session.player as unknown as Record<string, unknown>;
  player.evaluate = (code: string) => {
    const jinter = new Jinter();
    return jinter.evaluate(code);
  };

  return innertubeInstance;
}
