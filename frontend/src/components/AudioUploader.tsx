import { useCallback, useState, DragEvent } from "react";

const ACCEPTED = new Set(["wav", "mp3", "ogg", "flac", "m4a"]);

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function AudioUploader({ onFileSelected, disabled }: AudioUploaderProps) {
  const [dragging, setDragging] = useState(false);

  const validateAndSelect = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED.has(ext)) {
        alert(`Unsupported format: .${ext}\nSupported: ${[...ACCEPTED].join(", ")}`);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = [...ACCEPTED].map((ext) => `.${ext}`).join(",");
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) validateAndSelect(file);
    };
    input.click();
  }, [validateAndSelect]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={disabled ? undefined : handleClick}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed border-gray-700" : "cursor-pointer hover:border-indigo-500"}
        ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-gray-700"}
      `}
    >
      <div className="text-4xl mb-3">🎸</div>
      <p className="text-lg font-medium mb-1">
        Drop audio file here or click to browse
      </p>
      <p className="text-sm text-gray-400">
        WAV, MP3, OGG, FLAC, M4A — max 50 MB
      </p>
    </div>
  );
}
