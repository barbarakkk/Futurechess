import { api } from "./api";
import type { BoardThemeId } from "./boardThemes";

export type UserPreferences = {
  boardTheme: BoardThemeId;
};

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await api.get("/me/preferences");
  return response.data.preferences as UserPreferences;
}

export async function updateBoardTheme(boardTheme: BoardThemeId): Promise<UserPreferences> {
  const response = await api.patch("/me/preferences", { boardTheme });
  return response.data.preferences as UserPreferences;
}
