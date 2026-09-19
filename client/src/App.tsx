import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PreferencesHydrator } from "./components/PreferencesHydrator";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AiGamePage } from "./pages/AiGamePage";
import { BoardPage } from "./pages/BoardPage";
import { BecomeCoachPage } from "./pages/BecomeCoachPage";
import { CoachApplicationResponsePage } from "./pages/CoachApplicationResponsePage";
import { CoachBookingResponsePage } from "./pages/CoachBookingResponsePage";
import { CoachDashboardPage } from "./pages/CoachDashboardPage";
import { CoachDetailPage } from "./pages/CoachDetailPage";
import { CoachesPage } from "./pages/CoachesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { FriendGamePage } from "./pages/FriendGamePage";
import { GameHistoryPage } from "./pages/GameHistoryPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NewGamePage } from "./pages/NewGamePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <>
      <PreferencesHydrator />
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/coach-bookings/respond" element={<CoachBookingResponsePage />} />
        <Route path="/coach-applications/respond" element={<CoachApplicationResponsePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/new-game" element={<NewGamePage />} />
            <Route path="/game/:gameId" element={<FriendGamePage />} />
            <Route path="/ai-game/:gameId" element={<AiGamePage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/game-history" element={<GameHistoryPage />} />
            <Route path="/coaches" element={<CoachesPage />} />
            <Route path="/coaches/:coachId" element={<CoachDetailPage />} />
            <Route path="/become-a-coach" element={<BecomeCoachPage />} />
            <Route path="/coach/dashboard" element={<CoachDashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
