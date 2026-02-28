import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    alphaTab: typeof import("@coderline/alphatab");
  }
}

export function useAlphaTab(containerRef: React.RefObject<HTMLDivElement | null>) {
  const apiRef = useRef<import("@coderline/alphatab").AlphaTabApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Dynamic import to avoid SSR issues
    import("@coderline/alphatab").then((alphaTab) => {
      const api = new alphaTab.AlphaTabApi(el, {
        core: {
          fontDirectory: "/font/",
          tex: false,
        },
        display: {
          staveProfile: "Tab",
          layoutMode: 1, // Page layout
          resources: {
            staffLineColor: "rgba(255, 255, 255, 0.15)",
            barSeparatorColor: "rgba(255, 255, 255, 0.3)",
            mainGlyphColor: "#e5e7eb",
            secondaryGlyphColor: "#9ca3af",
            scoreInfoColor: "#e5e7eb",
          },
        },
        player: {
          enablePlayer: false,
        },
      });

      apiRef.current = api;
    });

    return () => {
      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
      }
    };
  }, [containerRef]);

  const loadData = useCallback((data: ArrayBuffer) => {
    if (apiRef.current) {
      apiRef.current.load(new Uint8Array(data));
    }
  }, []);

  return { api: apiRef, loadData };
}
