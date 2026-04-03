import { NextRequest } from "next/server";
import { Innertube } from "youtubei.js";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");

  if (!videoId) {
    return Response.json({ error: "Missing video ID" }, { status: 400 });
  }

  try {
    const yt = await Innertube.create({ generate_session_locally: true });
    const info = await yt.getBasicInfo(videoId);

    const title = info.basic_info.title || "YouTube Video";
    const author = info.basic_info.author || "Unknown";
    const duration = info.basic_info.duration || 0;
    const thumbnail = info.basic_info.thumbnail?.[0]?.url;

    // Get streaming formats
    const formats = (info.streaming_data?.formats || []).map((f) => ({
      itag: f.itag,
      mimeType: f.mime_type,
      quality: f.quality_label,
      width: f.width,
      height: f.height,
      hasAudio: !!f.has_audio,
      bitrate: f.bitrate,
    }));

    const adaptiveFormats = (info.streaming_data?.adaptive_formats || [])
      .filter((f) => f.has_video)
      .map((f) => ({
        itag: f.itag,
        mimeType: f.mime_type,
        quality: f.quality_label,
        width: f.width,
        height: f.height,
        hasAudio: !!f.has_audio,
        bitrate: f.bitrate,
      }));

    return Response.json({
      title,
      author,
      lengthSeconds: duration,
      thumbnail,
      formats: [...formats, ...adaptiveFormats],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("YouTube info error:", msg);
    return Response.json(
      { error: "Failed to get video info", details: msg },
      { status: 500 }
    );
  }
}
