'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from './story-film-hero.module.css';

const STORAGE_INTRO_SEEN = 'constructa-story-intro-seen-v1';
const POSTER = '/marketing/story-film/constructa-story-poster.webp';
const SRC_1080 = '/marketing/story-film/constructa-story-1080p.mp4';
const SRC_720 = '/marketing/story-film/constructa-story-720p.mp4';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useStoryIntroPreviewEnabled() {
  return process.env.NEXT_PUBLIC_STORY_FILM_INTRO_PREVIEW === '1';
}

type StoryFilmHeroProps = {
  className?: string;
};

export function StoryFilmHero({ className }: StoryFilmHeroProps) {
  const reducedMotion = usePrefersReducedMotion();
  const introPreviewEnabled = useStoryIntroPreviewEnabled();
  const dialogTitleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const tryPlayMuted = useCallback(async () => {
    const el = videoRef.current;
    if (!el || reducedMotion) return;
    el.muted = true;
    setSoundOn(false);
    try {
      await el.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  }, [reducedMotion]);

  useEffect(() => {
    void tryPlayMuted();
  }, [tryPlayMuted]);

  const watchWithSound = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.muted = false;
    setSoundOn(true);
    try {
      await el.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  }, []);

  const openIntroOnce = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_INTRO_SEEN) === '1') return;
    setIntroOpen(true);
    dialogRef.current?.showModal();
    void tryPlayMuted();
  }, [tryPlayMuted]);

  const closeIntro = useCallback(() => {
    setIntroOpen(false);
    dialogRef.current?.close();
    window.localStorage.setItem(STORAGE_INTRO_SEEN, '1');
    videoRef.current?.focus();
  }, []);

  const skipIntro = useCallback(() => {
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
    closeIntro();
  }, [closeIntro]);

  const enterFromIntro = useCallback(() => {
    closeIntro();
  }, [closeIntro]);

  const toggleIntroSound = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !soundOn;
    el.muted = !next;
    setSoundOn(next);
    try {
      await el.play();
    } catch {
      setAutoplayBlocked(true);
    }
  }, [soundOn]);

  return (
    <figure className={`${styles.figure} ${className ?? ''}`.trim()} aria-label="Constructa story film preview">
      <div className={styles.mediaShell}>
        {reducedMotion ? (
          <img
            className={styles.poster}
            src={POSTER}
            alt=""
            width={1280}
            height={720}
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <>
            <img
              className={styles.poster}
              src={POSTER}
              alt=""
              width={1280}
              height={720}
              decoding="async"
              fetchPriority="high"
              aria-hidden="true"
            />
            <video
              ref={videoRef}
              className={styles.video}
              playsInline
              muted
              loop
              preload="metadata"
              poster={POSTER}
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src={SRC_720} type="video/mp4" media="(max-width: 800px)" />
              <source src={SRC_1080} type="video/mp4" />
            </video>
          </>
        )}
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.controlButton} onClick={() => void watchWithSound()}>
          Watch the 40-second story
        </button>
        {autoplayBlocked && (
          <button type="button" className={styles.controlButtonSecondary} onClick={() => void tryPlayMuted()}>
            Play preview
          </button>
        )}
        {introPreviewEnabled && (
          <button type="button" className={styles.controlButtonSecondary} onClick={openIntroOnce}>
            Preview one-time intro
          </button>
        )}
      </div>

      <figcaption className={styles.caption}>
        Illustrative story — muted on the page; sound when you choose.
      </figcaption>

      <dialog
        ref={dialogRef}
        className={styles.introDialog}
        aria-labelledby={dialogTitleId}
        onClose={() => setIntroOpen(false)}
      >
        <div className={styles.introInner}>
          <p id={dialogTitleId} className={styles.introTitle}>
            Constructa story
          </p>
          <p className={styles.introCopy}>Good work. Clearly priced. Better presented.</p>
          <div className={styles.introActions}>
            <button type="button" className={styles.controlButton} onClick={skipIntro} autoFocus>
              Skip
            </button>
            <button type="button" className={styles.controlButtonSecondary} onClick={() => void toggleIntroSound()}>
              {soundOn ? 'Mute' : 'Sound'}
            </button>
            <Link href="/apply" className={styles.controlButton} onClick={enterFromIntro}>
              Enter
            </Link>
          </div>
        </div>
      </dialog>
      {introOpen && <span className={styles.srOnly} aria-live="polite">Story intro open</span>}
    </figure>
  );
}