"use client";

import { useState } from "react";

interface PlayerPortraitProps {
  mlbamID: number | null | undefined;
  playerID: string;
  name: string;
  initials: string;
}

/**
 * Player portrait with multiple image source fallback chain:
 * 1. MLB midfield spots (works for almost all players, even historical)
 * 2. MLB static headshot JPG (redirect-based, good quality)
 * 3. MLB Photos silo (high-res cutout)
 * 4. MLB Photos headshot with generic fallback
 * 5. Initials placeholder
 */
export function PlayerPortrait({
  mlbamID,
  name,
  initials,
}: PlayerPortraitProps) {
  const [sourceIndex, setSourceIndex] = useState(0);

  const sources: string[] = [];
  if (mlbamID) {
    // Primary: midfield spots — works for nearly everyone including Babe Ruth
    sources.push(
      `https://midfield.mlbstatic.com/v1/people/${mlbamID}/spots/240`
    );
    // Fallback: mlbstatic headshot JPG
    sources.push(
      `https://img.mlbstatic.com/mlb/images/players/head_shot/${mlbamID}.jpg`
    );
    // Fallback: mlbstatic photos silo
    sources.push(
      `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_100/v1/people/${mlbamID}/headshot/silo/current`
    );
    // Fallback: mlbstatic with generic default
    sources.push(
      `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbamID}/headshot/67/current`
    );
  }

  const currentSrc = sources[sourceIndex];
  const allFailed = !currentSrc || sourceIndex >= sources.length;

  if (allFailed) {
    return (
      <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] rounded-xl border border-border bg-surface-alt flex items-center justify-center flex-shrink-0">
        <span className="text-4xl md:text-5xl text-muted-light font-light">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] rounded-xl border border-border bg-surface overflow-hidden flex-shrink-0">
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
