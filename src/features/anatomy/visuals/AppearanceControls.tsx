import { usePreference } from '../../../app/preferences';
import { defaultAppearance, displayModes, type Appearance } from './appearance';

export function useAppearance() {
  return usePreference('anatomy.appearance', defaultAppearance, (stored) => {
    const value = JSON.parse(stored) as Partial<Appearance>;
    return {
      mode:
        value.mode && displayModes.includes(value.mode)
          ? value.mode
          : defaultAppearance.mode,
      opacity:
        typeof value.opacity === 'number' && Number.isFinite(value.opacity)
          ? Math.max(0, Math.min(100, value.opacity))
          : defaultAppearance.opacity,
      bones:
        typeof value.bones === 'boolean'
          ? value.bones
          : defaultAppearance.bones,
      muscles:
        typeof value.muscles === 'boolean'
          ? value.muscles
          : defaultAppearance.muscles,
    };
  });
}

export function AppearanceControls({
  value,
  onChange,
  onReset,
}: {
  value: Appearance;
  onChange: (next: Appearance) => void;
  onReset: () => void;
}) {
  return (
    <div className="appearance-fields">
      <label>
        Display mode
        <select
          aria-label="Display mode"
          value={value.mode}
          onChange={(event) => {
            const mode = displayModes.find(
              (entry) => entry === event.currentTarget.value,
            );
            if (mode) onChange({ ...value, mode });
          }}
        >
          {displayModes.map((mode) => (
            <option key={mode}>{mode}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="opacity-label">
          Context opacity <output>{value.opacity}%</output>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={value.opacity}
          aria-label="Context opacity"
          onChange={(event) =>
            onChange({ ...value, opacity: event.currentTarget.valueAsNumber })
          }
        />
      </label>
      <label className="appearance-check">
        <input
          type="checkbox"
          checked={value.bones}
          onChange={(event) =>
            onChange({ ...value, bones: event.currentTarget.checked })
          }
        />
        Show bones
      </label>
      <label className="appearance-check">
        <input
          type="checkbox"
          checked={value.muscles && value.mode !== 'Strict Quiz'}
          disabled={value.mode === 'Strict Quiz'}
          onChange={(event) =>
            onChange({ ...value, muscles: event.currentTarget.checked })
          }
        />
        Show surrounding muscles
      </label>
      <button className="reset" type="button" onClick={onReset}>
        Reset appearance
      </button>
    </div>
  );
}
