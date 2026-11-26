"use client";

import { useState } from "react";
import WasmPlayer from "./WasmPlayer";
import type { ResumeKind } from "@/lib/resume";

interface Props {
  title: string;
  streamUrl: string;
  onClose: () => void;
  kind?: ResumeKind;
}

export default function WasmPlayerDirect({ title, streamUrl, onClose, kind }: Props) {
  // Bumped by Try Again on the error overlay: remounts the player fresh so a
  // transient failure (Einthusan/Pluto) doesn't dead-end at an error screen.
  const [attempt, setAttempt] = useState(0);
  return (
    <WasmPlayer
      key={attempt}
      videoId=""
      title={title}
      streamUrl={streamUrl}
      audioStreamUrl={streamUrl}
      onClose={onClose}
      onRetry={() => setAttempt((a) => a + 1)}
      resumeKind={kind}
    />
  );
}
