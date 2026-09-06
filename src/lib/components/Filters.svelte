<script lang="ts">
  import { MODES, MODE_LABEL, type Mode } from '../gtfs/types';
  import { DAY_LABEL, type DayType } from '../state/url';

  let {
    modes,
    hour,
    day,
    onchange,
  }: {
    modes: Mode[];
    hour: number;
    day: DayType;
    onchange: (patch: { modes?: Mode[]; hour?: number; day?: DayType }) => void;
  } = $props();

  const days: DayType[] = ['wd', 'sa', 'su'];
  const clock = $derived(`${String(hour).padStart(2, '0')}:00`);

  function toggle(mode: Mode) {
    const next = modes.includes(mode) ? modes.filter((m) => m !== mode) : [...modes, mode];
    // An empty map looks broken; the last mode stays on.
    if (next.length) onchange({ modes: next });
  }
</script>

<div class="filters">
  <fieldset>
    <legend>Modes</legend>
    <div class="chips">
      {#each MODES as mode (mode)}
        <label class="chip" data-mode={mode}>
          <input
            type="checkbox"
            aria-label={MODE_LABEL[mode]}
            checked={modes.includes(mode)}
            onchange={() => toggle(mode)}
          />
          <span>{MODE_LABEL[mode]}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>
      Time of day <output for="hour-filter">{clock}</output>
    </legend>
    <input
      id="hour-filter"
      class="hour"
      type="range"
      min="0"
      max="23"
      step="1"
      value={hour}
      aria-label="Hour of the day"
      aria-valuetext={clock}
      oninput={(event) => onchange({ hour: Number(event.currentTarget.value) })}
    />
    <div class="days" role="group" aria-label="Kind of day">
      {#each days as value (value)}
        <button
          type="button"
          class="day"
          class:on={day === value}
          aria-pressed={day === value}
          onclick={() => onchange({ day: value })}
        >
          {DAY_LABEL[value]}
        </button>
      {/each}
    </div>
  </fieldset>
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  legend {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-weight: 600;
    padding: 0;
    margin-bottom: 8px;
  }

  output {
    font-size: 13px;
    letter-spacing: 0;
    text-transform: none;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 7px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 13px;
    cursor: pointer;
    background: var(--surface);
  }

  .chip:hover {
    border-color: var(--border-strong);
  }

  .chip input {
    accent-color: var(--accent);
    margin: 0;
  }

  .chip[data-mode='metro'] span {
    border-bottom: 2px solid var(--mode-metro);
  }
  .chip[data-mode='tram'] span {
    border-bottom: 2px solid var(--mode-tram);
  }
  .chip[data-mode='rail'] span {
    border-bottom: 2px solid var(--mode-rail);
  }
  .chip[data-mode='bus'] span {
    border-bottom: 2px solid var(--mode-bus);
  }

  .hour {
    width: 100%;
    accent-color: var(--accent);
    margin: 0 0 10px;
  }

  .days {
    display: flex;
    gap: 4px;
  }

  .day {
    flex: 1;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 5px 6px;
    font-size: 12.5px;
    cursor: pointer;
  }

  .day.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
    font-weight: 600;
  }
</style>
