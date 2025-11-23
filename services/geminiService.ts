
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FeedbackData } from "../types";

const SYSTEM_INSTRUCTION = `
You are AI American Accent Coach, a highly advanced pronunciation evaluation system.
Your job is to analyze the user’s audio and compare it to the target text with extreme precision.

Your goal is to be a *Voice-First* Coach. The user prefers listening over reading.
Generate output specifically designed to be spoken aloud by a Text-to-Speech engine.

OUTPUT FORMAT (JSON Schema):
1. score (0-100).
2. problemWords (List of strings).
3. detailedCorrections:
   - word
   - youSaid (Phonetic approx)
   - correct (Phonetic)
   - cause (Short text)
   - fix (Short text)
   - audioExplanation: A conversational script (1-2 sentences) for the coach to speak to the user about this specific word. 
     Example: "You said 'viz-yon', but it should be 'VI-zhun'. Try to buzz your tongue."
4. coachNotes: A warm, conversational summary script (3-4 sentences) speaking DIRECTLY to the user. 
   Do not use bullet points. Write it like a letter. 
   Example: "Great effort! I noticed you tend to stop your airflow on V sounds. You also chopped up the rhythm in the second sentence. Let's focus on linking those words smoothly."
5. phonemePatterns.
6. rhythmAnalysis.
7. drills.

Evaluation Focus:
- Phoneme accuracy
- Rhythm and flow
- Mechanical errors (tongue, lips, jaw, airflow)

Be strict on scoring, but helpful and encouraging in the 'audioExplanation' and 'coachNotes'.
`;

export const analyzeAudio = async (
  audioBase64: string,
  targetText: string,
  mimeType: string = "audio/webm"
): Promise<FeedbackData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Score from 0 to 100" },
            problemWords: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "List of words that were pronounced incorrectly" 
            },
            detailedCorrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  youSaid: { type: Type.STRING },
                  correct: { type: Type.STRING },
                  cause: { type: Type.STRING },
                  fix: { type: Type.STRING },
                  audioExplanation: { type: Type.STRING, description: "Spoken script for this specific error" }
                },
                required: ["word", "youSaid", "correct", "cause", "fix", "audioExplanation"]
              }
            },
            phonemePatterns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pattern: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["pattern", "explanation"]
              }
            },
            rhythmAnalysis: { type: Type.STRING },
            coachNotes: { type: Type.STRING, description: "Conversational spoken summary" },
            drills: {
              type: Type.OBJECT,
              properties: {
                minimalPairs: { type: Type.ARRAY, items: { type: Type.STRING } },
                drillWords: { type: Type.ARRAY, items: { type: Type.STRING } },
                practiceSentences: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["minimalPairs", "drillWords", "practiceSentences"]
            }
          },
          required: ["score", "problemWords", "detailedCorrections", "phonemePatterns", "rhythmAnalysis", "coachNotes", "drills"]
        }
      },
      contents: {
        parts: [
          {
            text: `Target Text: "${targetText}". Analyze the attached audio.`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          }
        ]
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI");
    
    return JSON.parse(resultText) as FeedbackData;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

// --- HELPER FUNCTIONS FOR WAV CONVERSION ---

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function addWavHeader(samples: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length, true);

  new Uint8Array(buffer).set(samples, 44);

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const generateNativeSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  if (!text || !text.trim()) {
     throw new Error("Text is empty");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");
    
    // Convert raw PCM to WAV
    const pcmData = base64ToUint8Array(base64Audio);
    const wavData = addWavHeader(pcmData, 24000, 1);
    const wavBase64 = uint8ArrayToBase64(wavData);

    return `data:audio/wav;base64,${wavBase64}`;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};
