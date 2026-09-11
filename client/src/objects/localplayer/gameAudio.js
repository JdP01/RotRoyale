import { useCallback, useEffect, useRef } from 'react';

const SOUND_PATHS = {
  footsteps: [
    '/audio/footstep-outdoor-01.ogg',
    '/audio/footstep-outdoor-02.ogg',
    '/audio/footstep-outdoor-03.ogg',
  ],
  gunshot: '/audio/pistol-gunshot.wav',
  reload: '/audio/pistol-reload.mp3',
};

const MAX_SIMULTANEOUS_SOUNDS = 4;

export const useGameAudio = () => {
  const soundPoolsRef = useRef(new Map());
  const nextFootstepAtRef = useRef(0);
  const previousFootstepIndexRef = useRef(-1);

  const getAudioElement = useCallback((path) => {
    const soundPools = soundPoolsRef.current;
    const pool = soundPools.get(path) || [];
    const reusableAudio = pool.find((audio) => audio.paused || audio.ended);
    if (reusableAudio) return reusableAudio;

    if (pool.length < MAX_SIMULTANEOUS_SOUNDS) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      pool.push(audio);
      soundPools.set(path, pool);
      return audio;
    }

    return pool[0];
  }, []);

  const playSound = useCallback((path, volume, playbackRate = 1) => {
    const audio = getAudioElement(path);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => {});
  }, [getAudioElement]);

  const unlockAudio = useCallback(() => {
    Object.values(SOUND_PATHS).flat().forEach((path) => getAudioElement(path));
  }, [getAudioElement]);

  const playFootstep = useCallback((isSprinting) => {
    const stepCount = SOUND_PATHS.footsteps.length;
    let nextIndex = Math.floor(Math.random() * stepCount);
    if (stepCount > 1 && nextIndex === previousFootstepIndexRef.current) {
      nextIndex = (nextIndex + 1) % stepCount;
    }
    previousFootstepIndexRef.current = nextIndex;
    playSound(
      SOUND_PATHS.footsteps[nextIndex],
      isSprinting ? 0.42 : 0.32,
      isSprinting ? 1.08 + Math.random() * 0.06 : 0.96 + Math.random() * 0.06,
    );
  }, [playSound]);

  const setMovementAudio = useCallback((isMoving, isSprinting) => {
    if (!isMoving) {
      nextFootstepAtRef.current = 0;
      return;
    }
    const now = performance.now() / 1000;
    if (now < nextFootstepAtRef.current) return;

    playFootstep(isSprinting);
    nextFootstepAtRef.current = now + (isSprinting ? 0.27 : 0.38);
  }, [playFootstep]);

  const playGunshot = useCallback(() => {
    playSound(SOUND_PATHS.gunshot, 0.62, 0.98 + Math.random() * 0.04);
  }, [playSound]);

  const playReload = useCallback(() => {
    playSound(SOUND_PATHS.reload, 0.5, 0.98 + Math.random() * 0.03);
  }, [playSound]);

  useEffect(() => () => {
    soundPoolsRef.current.forEach((pool) => {
      pool.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    });
    soundPoolsRef.current.clear();
  }, []);

  return { playGunshot, playReload, setMovementAudio, unlockAudio };
};