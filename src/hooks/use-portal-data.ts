import { useState, useEffect } from "react";

type Portal = {
  title: string;
  description: string;
  href: string;
  image: string;
};

export function usePortalData() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function tryApi() {
      const response = await fetch("/api/portals", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load portal API");
      }

      const data = await response.json();
      return data.portals ?? [];
    }

    async function tryJson() {
      const response = await fetch("/portal-config.json");

      if (!response.ok) {
        throw new Error("Failed to load portal configuration");
      }

      const data = await response.json();
      return data.portals ?? [];
    }

    async function loadPortalData() {
      try {
        const apiPortals = await tryApi();
        setPortals(apiPortals);
        setError(null);
      } catch {
        try {
          const jsonPortals = await tryJson();
          setPortals(jsonPortals);
          setError(null);
        } catch (fallbackErr) {
          console.error("Error loading portal data:", fallbackErr);
          setError(
            fallbackErr instanceof Error ? fallbackErr.message : "Unknown error",
          );
          setPortals([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, []);

  return { portals, loading, error };
}
