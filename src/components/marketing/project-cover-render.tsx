'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  COVER_ARTWORK_CAPTION,
  COVER_FALLBACK_SRC,
  COVER_PRIMARY_SRC,
  COVER_RENDER_ALT,
  COVER_RENDER_CAPTION,
  COVER_ARTWORK_ALT,
  coverForIllustrativeRender,
} from '@/lib/proposal-cover-photo';
import ui from './project-cover-render.module.css';

export {
  COVER_PRIMARY_SRC,
  COVER_FALLBACK_SRC,
  COVER_RENDER_CAPTION,
  COVER_ARTWORK_CAPTION,
  COVER_RENDER_ALT,
} from '@/lib/proposal-cover-photo';

export function coverFor(useFallback: boolean) {
  const cover = coverForIllustrativeRender(useFallback);
  return { src: cover.url, caption: cover.caption };
}

export function ProjectCoverRender({ imageClassName, priority = false }: { imageClassName?: string; priority?: boolean }) {
  const [useFallback, setUseFallback] = useState(false);
  const cover = coverForIllustrativeRender(useFallback);
  return (
    <figure className={ui.figure}>
      <div className={ui.frame}>
        <Image
          src={cover.url}
          alt={useFallback ? COVER_ARTWORK_ALT : COVER_RENDER_ALT}
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