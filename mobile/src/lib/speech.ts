import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { ExpoSpeechRecognitionModule as NativeSpeech } from 'expo-speech-recognition';

/** Распознавание речи; null в Expo Go, где нативного модуля нет и пакет не загружается. */
export const SpeechModule: typeof NativeSpeech | null =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeechRecognition') !== null
    ? require('expo-speech-recognition').ExpoSpeechRecognitionModule
    : null;
