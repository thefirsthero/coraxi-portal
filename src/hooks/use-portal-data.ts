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
    async function loadPortalData() {
      try {
        const response = await fetch("/api/portals", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load portals");
        }

        const data = await response.json();
        setPortals(data.portals ?? []);
        setError(null);
      } catch (err) {
        console.error("Error loading portal data:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setPortals([]);
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, []);

  return { portals, loading, error };
}
