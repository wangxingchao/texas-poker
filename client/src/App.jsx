import { useEffect } from 'react';
import useGameStore from './store/gameStore';
import LoginScreen from './components/lobby/LoginScreen';
import LobbyScreen from './components/lobby/LobbyScreen';
import GameTable from './components/game/GameTable';

export default function App() {
  const { screen, connect } = useGameStore();

  useEffect(() => {
    connect();
  }, []);

  return (
    <div className="h-dvh w-full overflow-hidden">
      {screen === 'login' && <LoginScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <GameTable />}
    </div>
  );
}
