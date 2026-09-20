import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAppShell from "../locales/en/appShell.json";
import enBoard from "../locales/en/board.json";
import enLanding from "../locales/en/landing.json";
import enAuth from "../locales/en/auth.json";
import enDashboard from "../locales/en/dashboard.json";
import enNewGame from "../locales/en/newGame.json";
import enAiGame from "../locales/en/aiGame.json";
import enFriendGame from "../locales/en/friendGame.json";
import enGameHistory from "../locales/en/gameHistory.json";
import enSettings from "../locales/en/settings.json";
import enCoaches from "../locales/en/coaches.json";
import enBecomeCoach from "../locales/en/becomeCoach.json";
import enCoachDashboard from "../locales/en/coachDashboard.json";
import enResume from "../locales/en/resume.json";

import kaAppShell from "../locales/ka/appShell.json";
import kaBoard from "../locales/ka/board.json";
import kaLanding from "../locales/ka/landing.json";
import kaAuth from "../locales/ka/auth.json";
import kaDashboard from "../locales/ka/dashboard.json";
import kaNewGame from "../locales/ka/newGame.json";
import kaAiGame from "../locales/ka/aiGame.json";
import kaFriendGame from "../locales/ka/friendGame.json";
import kaGameHistory from "../locales/ka/gameHistory.json";
import kaSettings from "../locales/ka/settings.json";
import kaCoaches from "../locales/ka/coaches.json";
import kaBecomeCoach from "../locales/ka/becomeCoach.json";
import kaCoachDashboard from "../locales/ka/coachDashboard.json";
import kaResume from "../locales/ka/resume.json";

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "ka", label: "ქართული" },
] as const;

export type SupportedLanguageCode = (typeof supportedLanguages)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        appShell: enAppShell,
        board: enBoard,
        landing: enLanding,
        auth: enAuth,
        dashboard: enDashboard,
        newGame: enNewGame,
        aiGame: enAiGame,
        friendGame: enFriendGame,
        gameHistory: enGameHistory,
        settings: enSettings,
        coaches: enCoaches,
        becomeCoach: enBecomeCoach,
        coachDashboard: enCoachDashboard,
        resume: enResume,
      },
      ka: {
        appShell: kaAppShell,
        board: kaBoard,
        landing: kaLanding,
        auth: kaAuth,
        dashboard: kaDashboard,
        newGame: kaNewGame,
        aiGame: kaAiGame,
        friendGame: kaFriendGame,
        gameHistory: kaGameHistory,
        settings: kaSettings,
        coaches: kaCoaches,
        becomeCoach: kaBecomeCoach,
        coachDashboard: kaCoachDashboard,
        resume: kaResume,
      },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ka"],
    ns: [
      "appShell",
      "board",
      "landing",
      "auth",
      "dashboard",
      "newGame",
      "aiGame",
      "friendGame",
      "gameHistory",
      "settings",
      "coaches",
      "becomeCoach",
      "coachDashboard",
      "resume",
    ],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "chesshub-language",
    },
  });

export default i18n;
