# Blöf Oyunu - Liar's Dice

Bu proje, çok oyunculu bir Blöf (Liar's Dice) oyunu içerir. Oyuncular zarlarını gizleyerek bahis yapar, blöf yapar veya itiraz ederler.

## 🚀 Özellikler

- **Gerçek Zamanlı Çok Oyunculu**: Socket.io ile gerçek zamanlı senkronizasyon
- **Casino Teması**: Profesyonel casino atmosferi
- **Blöf Mekaniği**: Klasik Liar's Dice kuralları
- **Chip Sistemi**: Sanal para birimi ile oynama
- **Chat & Emoji**: Oyuncular arası iletişim
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## 🎮 Oyun Kuralları

1. **Başlangıç**: Her oyuncu 5 zar alır (zarlar gizli)
2. **Bahis**: İlk oyuncu "En az X tane Y var" şeklinde bahis yapar
3. **Sıra**: Sonraki oyuncular bahis yükseltir veya itiraz eder
4. **İtiraz**: Bahis doğruysa itiraz eden, yanlışsa bahis yapan kaybeder
5. **Kazanç**: Kaybeden chip kaybeder, oyun belirli chip hedefi ile biter

## 🛠️ Teknik Detaylar

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Tip güvenliği
- **Tailwind CSS** - Stil sistemi
- **Socket.io-client** - Gerçek zamanlı bağlantı

### Backend
- **Node.js** - Server runtime
- **Socket.io** - Gerçek zamanlı iletişim
- **Supabase** - Veritabanı

### Veritabanı Tabloları
- `bluff_games` - Oyun odaları
- `bluff_game_sessions` - Oyun oturumları
- `bluff_player_hands` - Oyuncu zarları
- `bluff_bets` - Bahisler
- `bluff_rounds` - Turlar
- `bluff_challenges` - İtirazlar
- `bluff_player_stats` - Oyuncu istatistikleri

## 📁 Dosya Yapısı

```
src/
├── app/
│   ├── bluff/
│   │   ├── page.tsx          # Ana Blöf sayfası
│   │   └── [roomId]/
│   │       └── page.tsx      # Oyun odası
│   └── page.tsx              # Ana sayfa
├── components/
│   ├── BluffGame.tsx         # Ana oyun componenti
│   ├── BetPlacement.tsx      # Bahis yerleştirme
│   ├── ChatComponent.tsx     # Chat sistemi
│   ├── SoundVolumeControl.tsx # Ses kontrolü
│   └── Scoreboard.tsx        # Skor tablosu
├── lib/
│   ├── useBluffGame.ts       # Blöf hook'u
│   ├── virtualCurrency.tsx   # Chip sistemi
│   └── supabase.ts           # DB bağlantısı
└── server.js                 # Socket.io server
```

## 🚀 Kurulum ve Çalıştırma

1. **Veritabanı Kurulumu**:
   ```sql
   -- bluff_schema.sql dosyasındaki komutları çalıştırın
   ```

2. **Bağımlılıkları Yükleyin**:
   ```bash
   npm install
   ```

3. **Çalıştırın**:
   ```bash
   npm run dev
   ```

4. **Tarayıcıda Açın**:
   ```
   http://localhost:3000
   ```

## 🎯 Kullanım

1. Ana sayfadan "Blöf" kartına tıklayın
2. Oda oluşturun veya mevcut odaya katılın
3. Bahis yerleştirin ve oyuna başlayın
4. Zarlarınız gizli kalır, stratejik bahisler yapın
5. Blöf yapın veya gerçek bahis yapın
6. Diğer oyuncuların blöf yaptığını düşünüyorsanız itiraz edin

## 🎨 UI/UX Özellikleri

- **Casino Teması**: Yeşil masa, zar animasyonları
- **Oyuncu Pozisyonları**: Masanın etrafında konumlandırılmış
- **Ses Efektleri**: Zar sesleri, chip sesleri
- **Animasyonlar**: Zar dağıtma, açma efektleri
- **Responsive**: Mobil cihazlarda da oynanabilir

## 🔧 Geliştirme

### Yeni Özellik Ekleme
1. `BluffGame.tsx` componentinde UI ekleyin
2. `useBluffGame.ts` hook'unda logic ekleyin
3. `server.js` Blöf sınıfında backend logic ekleyin
4. Gerekirse veritabanı tablolarını güncelleyin

### Test Etme
- Farklı tarayıcı pencerelerinde birden fazla oyuncu olarak test edin
- Mobil cihazlarda responsive tasarımı kontrol edin
- Edge case'leri test edin (bağlantı kopması, oyuncu ayrılması vb.)

## 📊 İstatistikler

Oyuncular için şu istatistikler takip edilir:
- Oynanan oyun sayısı
- Kazanılan/kaybedilen oyun sayısı
- Toplam blöf sayısı
- Başarılı blöf oranı
- Toplam chip kazanç/kayıp

## 🔒 Güvenlik

- Supabase Row Level Security (RLS) politikaları
- Socket.io bağlantı doğrulama
- Input validasyonları
- Rate limiting koruması

## 📞 Destek

Herhangi bir sorun yaşarsanız:
1. Console log'larını kontrol edin
2. Network tab'ında socket bağlantısını kontrol edin
3. Veritabanı tablolarının doğru oluşturulduğunu kontrol edin

---

🎲 **İyi eğlenceler! En iyi blöfçü siz olun!**
