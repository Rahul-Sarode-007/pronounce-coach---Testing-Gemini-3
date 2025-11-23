import React, { useState } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { FeedbackCard } from './components/FeedbackCard';
import { analyzeAudio } from './services/geminiService';
import { AppState, FeedbackData } from './types';

// --- DATA: PRACTICE CATEGORIES ---
const CATEGORIES = [
  {
    id: 'business',
    icon: '💼',
    title: 'Business',
    text: "I'd like to schedule a follow-up meeting to discuss the quarterly projections and strategy for the upcoming fiscal year."
  },
  {
    id: 'casual',
    icon: '☕',
    title: 'Casual Chat',
    text: "Hey! It's been ages. We should definitely grab coffee sometime this week and catch up properly."
  },
  {
    id: 'twister',
    icon: '🌪',
    title: 'Tongue Twister',
    text: "Usually, Silas's stubborn vision is to sift seven silky seashells beside the station. This season, his decision is to sell the shells."
  },
  {
    id: 'th-sound',
    icon: '👅',
    title: 'The "TH" Sound',
    text: "I thought about thirty-three things that confuse them, although they breathe through their mouths seamlessly."
  },
  {
    id: 'r-sound',
    icon: '🚗',
    title: 'The American "R"',
    text: "Robert ran around the red car to retrieve the rare red rose for his rural road trip."
  }
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [targetText, setTargetText] = useState("");
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);

  const startCustom = () => {
    setTargetText("");
    setAppState(AppState.INPUT_TEXT);
  };

  const selectCategory = (text: string) => {
    setTargetText(text);
    setAppState(AppState.RECORDING);
  };

  const handleAudioStop = async (audioBlob: Blob) => {
    setAppState(AppState.PROCESSING);
    
    // Create URL for playback
    const url = URL.createObjectURL(audioBlob);
    setUserAudioUrl(url);
    
    try {
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          const data = await analyzeAudio(base64Audio, targetText, audioBlob.type);
          setFeedback(data);
          setAppState(AppState.SUCCESS);
        } catch (e) {
          console.error(e);
          setErrorMsg("Failed to analyze audio. Please try again.");
          setAppState(AppState.ERROR);
        }
      };
    } catch (e) {
      console.error(e);
      setErrorMsg("Error processing audio file.");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    setUserAudioUrl(null);
    setAppState(AppState.LANDING);
    setFeedback(null);
    setErrorMsg("");
  };

  const retrySame = () => {
    setAppState(AppState.RECORDING);
    setFeedback(null);
  }

  const newChallenge = () => {
    setTargetText("");
    setAppState(AppState.LANDING);
    setFeedback(null);
  }

  // --- RENDERING ---

  // 1. LANDING PAGE (Category Selection)
  if (appState === AppState.LANDING) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-4xl w-full animate-fade-in-up">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
            Master your <br className="hidden sm:block" />
            <span className="text-blue-600">American Accent.</span>
          </h1>
          <p className="max-w-xl mx-auto text-lg text-slate-600 mb-12 leading-relaxed">
            Choose a scenario below. I will analyze your flow, rhythm, and phonemes to help you sound native.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.text)}
                className="bg-white hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-200 p-6 rounded-2xl transition-all group text-left shadow-sm hover:shadow-md"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">{cat.icon}</div>
                <div className="font-bold text-slate-800 text-lg mb-1">{cat.title}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{cat.text}</div>
              </button>
            ))}
            
            {/* Custom Card */}
            <button
              onClick={startCustom}
              className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-900 p-6 rounded-2xl transition-all group text-left shadow-lg text-white"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">✏️</div>
              <div className="font-bold text-white text-lg mb-1">Write Your Own</div>
              <div className="text-xs text-slate-400">Paste text from a book or script</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. INPUT TEXT MODAL
  if (appState === AppState.INPUT_TEXT) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 border border-slate-100 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
            📄 Enter Practice Text
          </h2>
          <div className="relative">
            <textarea
              className="w-full h-48 bg-slate-900 text-slate-100 rounded-xl p-6 text-lg leading-relaxed focus:ring-4 focus:ring-blue-100 outline-none resize-none"
              placeholder="Type or paste the text you want to practice here..."
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-4 mt-6">
            <button 
              onClick={() => setAppState(AppState.LANDING)}
              className="px-6 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
            >
              Back
            </button>
            <button 
              onClick={() => {
                if(targetText.trim()) setAppState(AppState.RECORDING);
              }}
              disabled={!targetText.trim()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all"
            >
              Start Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. RECORDING & PROCESSING
  if (appState === AppState.RECORDING || appState === AppState.PROCESSING || appState === AppState.ERROR) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-fade-in-up">
          
          {/* Header Bar */}
          <div className="h-2 bg-blue-600 w-full"></div>
          
          <div className="p-8 sm:p-12">
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Read This Out Loud</span>
              <button onClick={newChallenge} className="text-slate-400 hover:text-blue-600 transition-colors text-sm font-semibold flex items-center">
                 ← Change Text
              </button>
            </div>

            <p className="text-2xl sm:text-3xl font-serif text-slate-800 leading-relaxed mb-12">
              {targetText}
            </p>

            <div className="mt-8">
              {appState === AppState.ERROR ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-200">
                  <p className="font-bold">{errorMsg}</p>
                  <button onClick={() => setAppState(AppState.RECORDING)} className="text-sm underline mt-2">Try Again</button>
                </div>
              ) : (
                <AudioRecorder onRecordingComplete={handleAudioStop} appState={appState} />
              )}
            </div>
            
            {appState === AppState.PROCESSING && (
              <div className="mt-8 text-center animate-fade-in">
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                  <svg className="animate-spin h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading Coach...</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // 4. RESULTS
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {feedback && (
          <FeedbackCard 
            data={feedback} 
            targetText={targetText}
            userAudioUrl={userAudioUrl}
            onRetry={retrySame}
            onNew={newChallenge}
          />
        )}
      </div>
    </div>
  );
};

export default App;