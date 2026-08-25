import { useEffect } from "react";
import { fetchPreferences } from "../lib/preferencesApi";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";

export function PreferencesHydrator() {
  const token = useAuthStore((state) => state.token);
  const hydrateFromServer = usePreferencesStore((state) => state.hydrateFromServer);

  useEffect(() => {
    if (!token) {
      return;
    }

    let mounted = true;

    fetchPreferences()
      .then((preferences) => {
        if (mounted) {
          hydrateFromServer(preferences);
        }
      })
      .catch(() => {
        // Keep local cache when the server is unreachable.
      });

    return () => {
      mounted = false;
    };
  }, [token, hydrateFromServer]);

  return null;
}

export async function hydratePreferencesFromServer() {
  const preferences = await fetchPreferences();
  usePreferencesStore.getState().hydrateFromServer(preferences);
}
