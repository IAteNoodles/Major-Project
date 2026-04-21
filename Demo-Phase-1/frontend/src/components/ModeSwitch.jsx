import { useMode } from "../hooks/useMode";

export default function ModeSwitch() {
  const { mode, setMode, MODE_CONFIGS } = useMode();

  return (
    <div className="mode-switch" id="mode-switch">
      {Object.entries(MODE_CONFIGS).map(([key, cfg]) => (
        <button
          key={key}
          className={`mode-pill${mode === key ? " active" : ""}`}
          onClick={() => setMode(key)}
          title={cfg.description}
        >
          <span className="mode-icon">{cfg.icon}</span>
          <span className="mode-label">{cfg.label}</span>
        </button>
      ))}
    </div>
  );
}
