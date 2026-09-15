/** Build/feature status list. */

const ROADMAP: { id: string; title: string; done: boolean }[] = [
  { id: "01", title: "Scaffolding — FastAPI + Vite / React / TS / Tailwind", done: true },
  { id: "02", title: "Audio capture & upload", done: true },
  { id: "03", title: "Speech-to-text (faster-whisper)", done: true },
  { id: "04", title: "Speaker verification (ECAPA-TDNN)", done: true },
  { id: "05", title: "AI-voice (deepfake) detection", done: true },
  { id: "06", title: "Suspicious-request analysis", done: true },
  { id: "07", title: "Risk engine & decision thresholds", done: true },
  { id: "08", title: "Dashboard / result UI", done: true },
  { id: "09", title: "Demo samples & script", done: true },
  { id: "10", title: "README & setup guide", done: true },
];

export default function BuildRoadmap() {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ROADMAP.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-lg border border-line bg-surface2/50 px-4 py-3"
        >
          <span className="font-mono text-xs text-faint">{item.id}</span>
          <span className="flex-1 text-sm text-fg">{item.title}</span>
          <span className={`font-mono text-xs ${item.done ? "text-ok" : "text-faint"}`}>
            {item.done ? "DONE" : "QUEUED"}
          </span>
        </li>
      ))}
    </ul>
  );
}
