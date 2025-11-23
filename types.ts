
export interface DetailedCorrection {
  word: string;
  youSaid: string;
  correct: string;
  cause: string;
  fix: string;
  audioExplanation: string; // Script for the AI to speak
}

export interface PhonemePattern {
  pattern: string;
  explanation: string;
}

export interface Drills {
  minimalPairs: string[];
  drillWords: string[];
  practiceSentences: string[];
}

export interface FeedbackData {
  score: number;
  problemWords: string[];
  detailedCorrections: DetailedCorrection[];
  phonemePatterns: PhonemePattern[];
  rhythmAnalysis: string;
  coachNotes: string;
  drills: Drills;
}

export enum AppState {
  LANDING,
  INPUT_TEXT,
  RECORDING,
  PROCESSING,
  SUCCESS,
  ERROR
}
