import { BrowserRouter, Routes, Route } from "react-router-dom";
import GameSelect from "@/pages/GameSelect";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import RPGAdventure from "@/pages/RPGAdventure";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/Guard/ProtectedRoute.tsx";
import BotSelect from "@/pages/BotSelect.tsx";
import Lobby from "@/pages/Lobby.jsx";
import Register from "@/pages/Register.tsx";
import ForgotPassword from "@/pages/ForgotPassword.tsx";
import ChessBoardPvP from "@/components/InterfacesService/ChessBoardPvP.tsx";
import { WebSocketProvider } from "./WebSocket/WebSocketContext";
import ChessGameLayoutPvP from "@/components/InterfacesService/ChessGameLayoutPvP.tsx";

const App = () => {
  return (
    <WebSocketProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/game/:gameId" element={<ChessGameLayoutPvP />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/game-select" element={<GameSelect />} />
          <Route path="/bot-select" element={<BotSelect />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:gameId" element={<ChessBoardPvP />} />
          <Route path="/" element={<Index />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/rpg" element={<RPGAdventure />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </WebSocketProvider>
  );
};

export default App;
