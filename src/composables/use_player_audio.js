import { ref, watch } from 'vue';
import { LoudnessNormalizer } from '../utils/loudness';

export function usePlayerAudio({
  initialVolume,
  initialLoudnessEnabled,
  onSaveVolume,
  onSaveLoudness,
}) {
  const audioElement = ref(null);
  const volume = ref(initialVolume);
  const loudnessEnabled = ref(initialLoudnessEnabled);
  let loudnessNormalizer = null;

  watch(volume, (value) => {
    onSaveVolume(value);
    if (!audioElement.value) return;
    if (loudnessEnabled.value && loudnessNormalizer?.ready) {
      loudnessNormalizer.setUserVolume(value);
    } else {
      audioElement.value.volume = value;
    }
  });

  watch(loudnessEnabled, async (enabled) => {
    onSaveLoudness(enabled);
    if (!audioElement.value) return;
    if (enabled) {
      initLoudnessNormalizer();
      await loudnessNormalizer?.enable(volume.value);
    } else {
      loudnessNormalizer?.disable(volume.value);
    }
  });

  function initLoudnessNormalizer() {
    if (loudnessNormalizer || !audioElement.value) return;
    loudnessNormalizer = new LoudnessNormalizer(audioElement.value);
    loudnessNormalizer.init();
  }

  async function setAudioElement(element) {
    audioElement.value = element;
    if (!element) return;
    element.crossOrigin = 'anonymous';
    if (loudnessEnabled.value) {
      initLoudnessNormalizer();
      await loudnessNormalizer?.enable(volume.value);
    } else {
      element.volume = volume.value;
    }
  }

  async function fadeOut() {
    if (loudnessEnabled.value && loudnessNormalizer?.ready) {
      await loudnessNormalizer.fadeOut(200);
    }
  }

  async function normalizeTrack(cacheKey) {
    if (!loudnessEnabled.value) return;
    initLoudnessNormalizer();
    await loudnessNormalizer?.enable(volume.value, cacheKey);
  }

  function setVolume(value) {
    volume.value = value;
  }

  return {
    audioElement,
    volume,
    loudnessEnabled,
    setAudioElement,
    initLoudnessNormalizer,
    fadeOut,
    normalizeTrack,
    setVolume,
  };
}
