import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AiGamePage } from "./pages/AiGamePage";
import { DashboardPage } from "./pages/DashboardPage";
import { FriendGamePage } from "./pages/FriendGamePage";
import { GameHistoryPage } from "./pages/GameHistoryPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NewGamePage } from "./pages/NewGamePage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/new-game" element={<NewGamePage />} />
          <Route path="/game/:gameId" element={<FriendGamePage />} />
          <Route path="/ai-game/:gameId" element={<AiGamePage />} />
          <Route path="/game-history" element={<GameHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
