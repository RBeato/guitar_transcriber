import { useCallback, useRef } from "react";

interface MidiFileUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function MidiFileUploader({
  onFileSelected,
  disabled,
}: MidiFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelected(file);
        // Reset so re-selecting the same file works
        e.target.value = "";
      }
    },
    [onFileSelected],
  );

  return (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={disabled}
      className="px-3 py-2 text-sm rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors disabled:opacity-50"
    >
      Import .mid file
      <input
        ref={inputRef}
        type="file"
        accept=".mid,.midi"
        onChange={handleChange}
        className="hidden"
      />
    </button>
  );
}
