# Casino with Friends

A multiplayer casino game website built with Next.js, featuring Blackjack and more games to come. Play with your friends in real-time!

## Features

- **Multiplayer Blackjack**: Play blackjack with friends in real-time
- **Real-time Communication**: Socket.io for instant game updates
- **Modern UI**: Built with Next.js and Tailwind CSS
- **Scalable Backend**: Express.js server with Socket.io
- **Database Ready**: Supabase integration for user management and game persistence

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js, Socket.io
- **Database**: Supabase (optional)
- **Real-time**: Socket.io

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd casinowithfriends
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional, for Supabase):
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Running the Application

To run both frontend and backend together:
```bash
npm run dev:full
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001

### Alternative: Run separately

Frontend only:
```bash
npm run dev
```

Backend only:
```bash
npm run backend
```

## How to Play

1. Open the website in multiple browser tabs/windows
2. Each player enters the same Room ID and their name
3. Click "Join Room" to enter the game
4. Once all players have joined, click "Start Game"
5. Take turns hitting or standing
6. The dealer plays automatically when all players finish

## Game Rules

- Standard Blackjack rules apply
- Dealer hits on 16, stands on 17
- Aces count as 1 or 11
- First to 21 wins, or closest without busting

## Project Structure

```
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   └── BlackjackGame.tsx
│   └── lib/              # Utilities and hooks
│       ├── supabase.ts
│       └── useSocket.ts
├── backend/              # Express.js server
│   ├── server.js
│   └── package.json
└── public/               # Static assets
```

## Future Games

- Poker
- Roulette
- Slots
- Baccarat

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own casino website!
