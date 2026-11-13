'use client';

import Image from 'next/image';
import { useState } from 'react';
import ui from './project-cover-render.module.css';

export const COVER_PRIMARY_SRC = '/Setting us apart.png';
export const COVER_FALLBACK_SRC = '/minimalist infographic cluster of small construction buildings.png';
export const COVER_RENDER_CAPTION = 'Illustrative design render — not a photograph of completed work.';
export const COVER_ARTWORK_CAPTION = 'Illustrative artwork — not a photograph of completed work.';
export const COVER_RENDER_ALT = 'Illustrative render of a project programme board for an office renovation.';

export function coverFor(useFallback: boolean) {
  return useFallback
    ? { src: COVER_FALLBACK_SRC, caption: COVER_ARTWORK_CAPTION }
    : { src: COVER_PRIMARY_SRC, caption: COVER_RENDER_CAPTION };
}

export function ProjectCoverRender({ imageClassName, priority = false }: { imageClassName?: string; priority?: boolean }) {
  const [useFallback, setUseFallback] = useState(false);
  const cover = coverFor(useFallback);
  return (
    <figure className={ui.figure}>
      <div className={ui.frame}>
        <Image
          src={cover.src}
          alt={useFallback ? 'Line-art illustration of construction buildings.' : COVER_RENDER_ALT}
          fill
          priority={priority}
          onError={() => setUseFallback(true)}
          className={imageClassName}
        />
      </div>
      <figcaption className={ui.caption}>{cover.caption}</figcaption>
    </figure>
  );
}
