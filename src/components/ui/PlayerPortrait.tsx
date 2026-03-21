"use client";

import { useState } from "react";

interface PlayerPortraitProps {
  mlbamID: number | null | undefined;
  playerID: string;
  name: string;
  initials: string;
}

/**
 * Player portrait with multiple image source fallback:
 * 1. MLB Photos (current headshot)
 * 2. MLB Photos (action shot)
 * 3. MiLB headshot (minor league)
 * 4. Initials fallback
 */
export function PlayerPortrait({
  mlbamID,
  playerID,
  name,
  initials,
}: PlayerPortraitProps) {
  const [sourceIndex, setSourceIndex] = useState(0);

  // Build the source chain — only MLB sources that use mlbamID
  const sources: string[] = [];
  if (mlbamID) {
    // Primary: MLB headshot (current)
    sources.push(
      `https://img.mlb.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbamID}/headshot/67/current`
    );
    // Fallback: MLB silo (full body)
    sources.push(
      `https://img.mlb.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/w_213,q_auto:best/v1/people/${mlbamID}/headshot/silo/current`
    );
    // Fallback: MLB action shot
    sources.push(
      `https://img.mlb.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/${mlbamID}/action/hero/current`
    );
  }

  const currentSrc = sources[sourceIndex];
  const allFailed = !currentSrc || sourceIndex >= sources.length;

  if (allFailed) {
    return (
      <div className="w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-xl border border-border bg-surface-alt flex items-center justify-center flex-shrink-0">
        <span className="text-4xl md:text-5xl text-muted-light font-light">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className="w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-xl border border-border bg-surface overflow-hidden flex-shrink-0">
      <img
        src={currentSrc}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setSourceIndex((i) => i + 1)}
        loading="eager"
      />
    </div>
  );
}
