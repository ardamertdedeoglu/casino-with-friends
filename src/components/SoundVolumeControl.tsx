'use client';

import { useState, useEffect } from 'react';

interface SoundVolumeControlProps {
  onVolumeChange?: (volume: number) => void;
  className?: string;
}

export default function SoundVolumeControl({ onVolumeChange, className = '' }: SoundVolumeControlProps) {
  const [soundVolume, setSoundVolume] = useState(70); // Default volume 70%
  const [isMuted, setIsMuted] = useState(false);

  // Load sound volume from localStorage on component mount
  useEffect(() => {
    const savedVolume = localStorage.getItem('blackjack-sound-volume');
    if (savedVolume !== null) {
      const volume = parseInt(savedVolume, 10);
      if (volume >= 1 && volume <= 100) {
        setSoundVolume(volume);
      }
    }
  }, []);

  // Save sound volume to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('blackjack-sound-volume', soundVolume.toString());
  }, [soundVolume]);

  // Notify parent component of volume changes
  useEffect(() => {
    if (onVolumeChange) {
      const effectiveVolume = isMuted ? 0 : soundVolume / 100;
      onVolumeChange(effectiveVolume);
    }
  }, [soundVolume, isMuted, onVolumeChange]);

  const handleVolumeChange = (newVolume: number) => {
    setSoundVolume(newVolume);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600 ${className}`}>
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleMute}
          className="text-yellow-400 text-lg hover:text-yellow-300 transition-colors duration-200 p-1"
          title={isMuted ? "Sesi aç" : "Sesi kapat"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
        <div className="flex-1">
          <label className="block text-sm font-bold text-white mb-2">Ses Seviyesi</label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={soundVolume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
            disabled={isMuted}
            className={`w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-opacity duration-200 ${isMuted ? 'opacity-50' : 'opacity-100'}`}
            style={{
              background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${soundVolume}%, #374151 ${soundVolume}%, #374151 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1%</span>
            <span className={`font-bold ${isMuted ? 'text-gray-500' : 'text-yellow-400'}`}>
              {isMuted ? 'Sessiz' : `${soundVolume}%`}
            </span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Custom CSS for slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: 2px solid #f59e0b;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: 2px solid #f59e0b;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
