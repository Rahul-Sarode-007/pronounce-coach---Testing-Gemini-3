import React, { useState, useRef } from 'react';
import { AppState } from '../types';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  appState: AppState;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, appState }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);
    
    drawVisualizer();
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw dashed center line
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.stroke();
      ctx.setLineDash([]);

      const barWidth = (canvas.width / bufferLength) * 3;
      let x = 0;

      for(let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        ctx.fillStyle = '#3b82f6'; // blue-500
        // Draw bars centered vertically
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);

        x += barWidth + 2;
      }
    };

    draw();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      initVisualizer(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        onRecordingComplete(blob);
        
        stream.getTracks().forEach(track => track.stop());
        
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const disabled = appState === AppState.PROCESSING;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Visualizer Area */}
      <div className="w-full h-16 bg-slate-50 rounded-xl mb-8 relative overflow-hidden">
        <canvas ref={canvasRef} width={600} height={64} className="w-full h-full" />
        {!isRecording && appState !== AppState.PROCESSING && (
           <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-medium">
             Microphone Ready
           </div>
        )}
      </div>

      {/* Record Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={`
            group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl
            ${disabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:scale-105 hover:shadow-2xl'}
          `}
        >
          {isRecording ? (
            <div className="w-8 h-8 bg-white rounded-md animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          ) : (
            <div className="w-8 h-8 bg-red-500 rounded-full group-hover:bg-red-400 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          )}
        </button>
        <span className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest">
          {isRecording ? "Stop" : "Record"}
        </span>
      </div>
    </div>
  );
};
