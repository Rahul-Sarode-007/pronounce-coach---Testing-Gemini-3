import React, { useState, useRef } from 'react';
import { FeedbackData, DetailedCorrection } from '../types';
import { generateNativeSpeech } from '../services/geminiService';

interface FeedbackCardProps {
  data: FeedbackData;
  targetText: string;
  userAudioUrl: string | null;
  onRetry: () => void;
  onNew: () => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ data, targetText, userAudioUrl, onRetry, onNew }) => {
  const [activeCorrection, setActiveCorrection] = useState<DetailedCorrection | null>(null);
  const [isPlaying, setIsPlaying] = useState<'coach' | 'native' | 'original' | 'correction' | null>(null);
  const [playingCorrectionId, setPlayingCorrectionId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<0.5 | 0.75 | 1>(1);
  
  // Audio Refs
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsPlaying(null);
    setPlayingCorrectionId(null);
  };

  const playAudio = async (url: string, type: 'coach' | 'native' | 'original' | 'correction') => {
    stopCurrentAudio();
    setIsPlaying(type);
    
    const audio = new Audio(url);
    
    // Apply speed only for Native playback
    if (type === 'native') {
        audio.playbackRate = playbackRate;
    }
    
    currentAudioRef.current = audio;
    
    audio.onended = () => {
      setIsPlaying(null);
      setPlayingCorrectionId(null);
      currentAudioRef.current = null;
    };

    try {
      await audio.play();
    } catch (e) {
      console.error("Playback error:", e);
      setIsPlaying(null);
      setPlayingCorrectionId(null);
    }
  };

  const playTTS = async (text: string, voice: string, type: 'coach' | 'native' | 'correction') => {
     if (isPlaying === type && type !== 'correction') {
       stopCurrentAudio();
       return;
     }

     stopCurrentAudio();
     setIsPlaying(type); // Set loading state effectively
     
     try {
       // Use a simple hash or just the text as key. For long text this is fine in memory.
       const cacheKey = `${voice}:${text.substring(0, 50)}`; 
       let url = audioCacheRef.current.get(cacheKey);

       if (!url) {
         url = await generateNativeSpeech(text, voice);
         audioCacheRef.current.set(cacheKey, url);
       }
       
       playAudio(url, type);
     } catch (e) {
       console.error("TTS generation failed:", e);
       setIsPlaying(null);
       setPlayingCorrectionId(null);
     }
  };

  const handlePlayOriginal = () => {
    if (!userAudioUrl) return;
    if (isPlaying === 'original') {
      stopCurrentAudio();
    } else {
      playAudio(userAudioUrl, 'original');
    }
  };

  const handleWordClick = async (correction: DetailedCorrection, wordIndex: number) => {
      const id = `${correction.word}-${wordIndex}`;
      
      if (playingCorrectionId === id) {
          stopCurrentAudio();
          return;
      }
      
      setPlayingCorrectionId(id);
      setActiveCorrection(correction);
      
      // Use Zephyr (Coach Voice) for the specific advice
      await playTTS(correction.audioExplanation, 'Zephyr', 'correction');
  };

  const toggleSpeed = (e: React.MouseEvent) => {
      e.stopPropagation();
      setPlaybackRate(prev => {
          if (prev === 1) return 0.75;
          if (prev === 0.75) return 0.5;
          return 1;
      });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const words = targetText.split(/(\s+)/).map((word, index) => {
    const cleanWord = word.replace(/[^a-zA-Z']/g, "");
    const isProblem = data.problemWords.some(pw => 
        cleanWord.toLowerCase() === pw.toLowerCase() || 
        (cleanWord.length > 3 && pw.toLowerCase().includes(cleanWord.toLowerCase()))
    );
    
    const correction = data.detailedCorrections.find(c => 
        c.word.toLowerCase().includes(cleanWord.toLowerCase()) || 
        cleanWord.toLowerCase().includes(c.word.toLowerCase())
    );

    if (isProblem && correction && cleanWord.trim().length > 0) {
      const isPlayingThis = playingCorrectionId === `${correction.word}-${index}`;

      return (
        <span 
          key={index}
          className="relative group cursor-pointer inline-block mx-0.5"
          onClick={() => handleWordClick(correction, index)}
        >
          <span className={`
            px-1 rounded font-semibold transition-all border-b-2
            ${isPlayingThis 
                ? 'bg-blue-600 text-white border-blue-800 scale-105 shadow-lg z-10' 
                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-400'}
          `}>
            {word}
            
            {/* Playing Indicator */}
            {isPlayingThis && (
               <span className="absolute -top-3 -right-3 w-5 h-5 bg-white text-blue-600 rounded-full flex items-center justify-center text-[10px] shadow-sm animate-pulse z-20 border border-blue-100">
                 🔊
               </span>
            )}

            {/* Hint Indicator (if not playing) */}
            {!isPlayingThis && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
            )}
          </span>
        </span>
      );
    }
    return <span key={index}>{word}</span>;
  });

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-fade-in-up">
      {/* Header with Blue Accent */}
      <div className="h-2 bg-blue-600 w-full"></div>

      <div className="p-6 sm:p-10 space-y-10">
        
        {/* Text Analysis View */}
        <div className="bg-white">
            <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Tap red words to hear advice
                </span>
                <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-100">
                    {data.problemWords.length} Issues found
                </span>
            </div>
            
            <p className="text-2xl sm:text-3xl font-serif text-slate-800 leading-relaxed">
                {words}
            </p>

            {/* Active Correction Text Display (Subtle) */}
            <div className="h-8 mt-4">
                {activeCorrection && !playingCorrectionId && (
                   <div className="text-sm text-slate-500 animate-fade-in flex items-center">
                      <span className="font-bold text-red-500 mr-2">{activeCorrection.word}</span>
                      <span className="text-slate-400 mr-2">you said:</span>
                      <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded mr-2">/{activeCorrection.youSaid}/</span>
                      <span className="text-blue-600 text-xs font-bold uppercase cursor-pointer hover:underline">Click word to hear why</span>
                   </div>
                )}
                 {playingCorrectionId && (
                   <div className="text-sm text-blue-600 font-bold animate-pulse flex items-center">
                      🔊 Coach is explaining how to fix "{activeCorrection?.word}"...
                   </div>
                )}
            </div>
        </div>

        {/* Score & Controls */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Overall Score</span>
            <span className={`text-7xl font-bold ${getScoreColor(data.score)} mb-6`}>
                {data.score}%
            </span>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <button 
                  onClick={() => playTTS(data.coachNotes, 'Zephyr', 'coach')}
                  disabled={isPlaying === 'native' || isPlaying === 'original' || isPlaying === 'correction'}
                  className={`
                    flex-1 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2
                    ${isPlaying === 'coach' 
                      ? 'bg-blue-700 text-white scale-95 ring-2 ring-blue-300' 
                      : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-200'}
                  `}
                >
                    {isPlaying === 'coach' ? (
                       <><span className="animate-spin">⏳</span> Speaking...</>
                    ) : '✨ Hear Coach'}
                </button>

                <button 
                  onClick={handlePlayOriginal}
                  disabled={!userAudioUrl || (isPlaying !== null && isPlaying !== 'original')}
                  className={`
                    flex-1 py-3 rounded-xl font-bold transition-all border flex items-center justify-center gap-2
                    ${isPlaying === 'original'
                        ? 'bg-slate-200 text-slate-900 border-slate-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}
                  `}
                >
                    {isPlaying === 'original' ? '⏹ Stop' : '▶ My Recording'}
                </button>

                {/* Native Button with Speed Control */}
                <div className="flex-1 flex gap-1">
                    <button 
                    onClick={() => playTTS(targetText, 'Kore', 'native')}
                    disabled={isPlaying !== null && isPlaying !== 'native'}
                    className={`
                        flex-grow py-3 rounded-l-xl font-bold transition-all border flex items-center justify-center gap-2
                        ${isPlaying === 'native'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}
                    `}
                    >
                        {isPlaying === 'native' ? (
                            <><span className="animate-pulse">🔊</span> Playing...</>
                        ) : (
                            <>🔊 Native</>
                        )}
                    </button>
                    <button 
                        onClick={toggleSpeed}
                        className="w-12 rounded-r-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-mono text-xs font-bold border-y border-r border-emerald-200 flex items-center justify-center transition-colors"
                        title="Change Playback Speed"
                    >
                        {playbackRate}x
                    </button>
                </div>
            </div>
        </div>

        {/* Coach's Notes Text (Visual Backup) */}
        <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-2xl">
            <h3 className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-4">✨ Coach's Summary</h3>
            <p className="text-slate-300 text-lg leading-relaxed font-light">
                "{data.coachNotes}"
            </p>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
            <button 
                onClick={onRetry}
                className="flex-1 py-4 bg-white text-slate-700 font-bold rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-colors"
            >
                Retry Same Text
            </button>
            <button 
                onClick={onNew}
                className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-200 transition-colors"
            >
                New Challenge ↻
            </button>
        </div>

      </div>
    </div>
  );
};