import { useRef, useEffect, useState } from "react";
import { Logger } from "../services/api";

type ViewMode = "tab" | "score" | "both";

interface TabViewerProps {
  tex: string | null;
  log?: Logger;
  viewMode?: ViewMode;
}

function staveProfileFor(
  viewMode: ViewMode,
  alphaTab: typeof import("@coderline/alphatab"),
) {
  switch (viewMode) {
    case "score":
      return alphaTab.StaveProfile.Score;
    case "both":
      return alphaTab.StaveProfile.Default;
    case "tab":
    default:
      return alphaTab.StaveProfile.Tab;
  }
}

export default function TabViewer({ tex, log, viewMode = "tab" }: TabViewerProps) {
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

    log?.info(`alphaTab: loading module...`);

    import("@coderline/alphatab")
      .then((alphaTab) => {
        log?.info("alphaTab: module loaded, creating renderer (no workers)...");

        const settings = new alphaTab.Settings();
        settings.core.tex = true;
        settings.core.engine = "svg";
        settings.core.fontDirectory = "/font/";
        settings.core.useWorkers = false;
        settings.core.logLevel = alphaTab.LogLevel.Debug;
        settings.display.staveProfile = staveProfileFor(viewMode, alphaTab);
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

        api.renderStarted.on(() => {
          log?.info("alphaTab: render started...");
        });

        api.renderFinished.on(() => {
          log?.success("alphaTab: render finished!");
          setLoading(false);
        });

        api.error.on((e: Error) => {
          log?.error(`alphaTab error: ${e.message || e}`);
          setLoading(false);
          setError(e.message || String(e));
        });

        api.scoreLoaded.on((score) => {
          log?.info(
            `alphaTab: score loaded — ${score.tracks.length} track(s), ${score.masterBars.length} bar(s)`
          );
        });

        log?.info(`alphaTab: feeding alphaTex (${tex.length} chars)...`);
        api.tex(tex);
      })
      .catch((err) => {
        log?.error(`alphaTab: failed to load — ${err}`);
        setLoading(false);
        setError(`Failed to load alphaTab: ${err}`);
      });

    return () => {
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [tex, log, viewMode]);

  if (!tex) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-3">
        {viewMode === "tab" ? "Guitar Tablature" : viewMode === "score" ? "Sheet Music" : "Score & Tablature"}
      </h3>
      {loading && <p className="text-gray-400 text-sm mb-2 animate-pulse">Rendering...</p>}
      {error && <p className="text-red-400 text-sm mb-2">Render error: {error}</p>}
      <div ref={containerRef} className="bg-gray-900 rounded-xl p-4 min-h-[200px] overflow-auto" />
    </div>
  );
}
