import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-yellow-400 mb-4 drop-shadow-2xl animate-pulse">
            🎰 CASINO WITH FRIENDS
          </h1>
          <p className="text-xl text-yellow-200 font-semibold">
            Arkadaşlarınla birlikte oynadığın casino deneyimi
          </p>
          <div className="w-32 h-1 bg-yellow-400 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Games Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Blackjack */}
          <Link href="/blackjack" className="group">
            <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-3xl shadow-2xl border-4 border-yellow-400 hover:border-yellow-300 transform hover:-translate-y-4 transition-all duration-300 hover:shadow-3xl">
              <div className="text-center">
                <div className="text-8xl mb-4 group-hover:animate-bounce">🃏</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">BLACKJACK</h2>
                <p className="text-gray-600 mb-4">21&apos;e ulaşmaya çalış!</p>
                <div className="bg-green-600 text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-green-700 transition-colors">
                  OYNA
                </div>
              </div>
            </div>
          </Link>

          {/* Roulette - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎡</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">ROULETTE</h2>
              <p className="text-gray-500 mb-4">Çarkı çevir, kazan!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Poker - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🃏</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">POKER</h2>
              <p className="text-gray-500 mb-4">En iyi eli yakala!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Slots - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎰</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">SLOTS</h2>
              <p className="text-gray-500 mb-4">Şansını dene!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Baccarat - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎴</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">BACCARAT</h2>
              <p className="text-gray-500 mb-4">Banker mı Player mı?</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Craps - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎲</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">CRAPS</h2>
              <p className="text-gray-500 mb-4">Zarları at!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-yellow-200 text-lg">
            🎲 Çok yakında daha fazla oyun eklenecek! 🎲
          </p>
          <p className="text-yellow-300 text-sm mt-2">
            Arkadaşlarınla birlikte eğlenceli vakit geçirmek için hazır
          </p>
        </div>
      </div>
    </div>
  );
}
