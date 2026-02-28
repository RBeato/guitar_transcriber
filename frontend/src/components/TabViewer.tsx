import { useRef, useEffect, useState } from "react";

interface TabViewerProps {
  tex: string | null;
}

export default function TabViewer({ tex }: TabViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<import("@coderline/alphatab").AlphaTabApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tex) return;

    const el = containerRef.current;
    if (!el) return;

    setLoading(true);
    setError(null);

    // Destroy previous instance
    if (apiRef.current) {
      try { apiRef.current.destroy(); } catch { /* ignore */ }
      apiRef.current = null;
      el.innerHTML = "";
    }

    console.log("[TabViewer] Loading alphaTab with tex:", tex.substring(0, 100));

    import("@coderline/alphatab")
      .then((alphaTab) => {
        const settings = new alphaTab.Settings();
        settings.core.engine = "svg";
        settings.core.tex = true;
        settings.display.staveProfile = alphaTab.StaveProfile.Tab;
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.player.enablePlayer = false;

        // Dark theme
        settings.display.resources.staffLineColor = new alphaTab.model.Color(255, 255, 255, 40);
        settings.display.resources.barSeparatorColor = new alphaTab.model.Color(255, 255, 255, 80);
        settings.display.resources.mainGlyphColor = new alphaTab.model.Color(229, 231, 235, 255);
        settings.display.resources.secondaryGlyphColor = new alphaTab.model.Color(156, 163, 175, 255);
        settings.display.resources.scoreInfoColor = new alphaTab.model.Color(229, 231, 235, 255);

        const api = new alphaTab.AlphaTabApi(el, settings);
        apiRef.current = api;

        api.renderFinished.on(() => {
          console.log("[TabViewer] Render finished");
          setLoading(false);
        });

        api.error.on((e: Error) => {
          console.error("[TabViewer] alphaTab error:", e);
          setLoading(false);
          setError(e.message || String(e));
        });

        api.scoreLoaded.on((score) => {
          console.log("[TabViewer] Score loaded — tracks:", score.tracks.length, "bars:", score.masterBars.length);
        });

        api.tex(tex);
      })
      .catch((err) => {
        console.error("[TabViewer] Failed to import alphaTab:", err);
        setLoading(false);
        setError(`Failed to load alphaTab: ${err}`);
      });

    return () => {
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [tex]);

  if (!tex) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-3">Guitar Tablature</h3>
      {loading && <p className="text-gray-400 text-sm mb-2 animate-pulse">Rendering tabs...</p>}
      {error && <p className="text-red-400 text-sm mb-2">Render error: {error}</p>}
      <div ref={containerRef} className="bg-gray-900 rounded-xl p-4 min-h-[200px] overflow-auto" />
    </div>
  );
}
