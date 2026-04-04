"use client";

import WasmPlayer from "./WasmPlayer";

interface Props {
  title: string;
  streamUrl: string;
  onClose: () => void;
}

export default function WasmPlayerDirect({ title, streamUrl, onClose }: Props) {
  return (
    <WasmPlayer
      videoId=""
      title={title}
      streamUrl={streamUrl}
      onClose={onClose}
    />
  );
}
