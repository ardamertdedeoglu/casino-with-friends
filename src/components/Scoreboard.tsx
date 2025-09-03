'use client';

interface ScoreboardEntry {
  id: string;
  name: string;
  netWinnings: number;
  isDealer: boolean;
}

interface ScoreboardProps {
  scoreboard: ScoreboardEntry[];
  className?: string;
}

export default function Scoreboard({ scoreboard, className = '' }: ScoreboardProps) {
  if (!scoreboard || scoreboard.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600 ${className}`}>
        <h3 className="text-lg font-bold text-yellow-400 mb-3 text-center">🏆 SKOR TABLOSU</h3>
        <p className="text-gray-400 text-sm text-center">Henüz kazanma yok</p>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-yellow-500 ${className}`}>
      <h3 className="text-lg font-bold text-yellow-400 mb-3 text-center flex items-center justify-center">
        <span className="text-xl mr-2">🏆</span>
        SKOR TABLOSU
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {scoreboard.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-300 ${
              entry.isDealer
                ? 'bg-gradient-to-r from-red-900 to-red-800 border-red-500 shadow-lg'
                : index === 0 && scoreboard.length > 1
                  ? 'bg-gradient-to-r from-yellow-900 to-yellow-800 border-yellow-500 shadow-lg animate-pulse'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-500'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                entry.isDealer
                  ? 'bg-red-600 text-white'
                  : index === 0 && scoreboard.length > 1
                    ? 'bg-yellow-600 text-black'
                    : 'bg-gray-600 text-white'
              }`}>
                #{index + 1}
              </span>
              <span className={`font-semibold ${
                entry.isDealer ? 'text-red-300' : 'text-white'
              }`}>
                {entry.name}
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <span className={`text-lg font-bold ${
                entry.netWinnings > 0
                  ? 'text-green-400'
                  : entry.netWinnings < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}>
                {entry.netWinnings > 0 ? '+' : ''}{entry.netWinnings}
              </span>
              <span className="text-yellow-400 text-sm">💰</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-600">
        <p className="text-xs text-gray-400 text-center">
          <span className="text-green-400">+ Yeşil:</span> Net kazanç • <span className="text-red-400">- Kırmızı:</span> Net kayıp
        </p>
      </div>
    </div>
  );
}
