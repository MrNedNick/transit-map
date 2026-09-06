import { loadNetwork, loadTimetable, type Network, type Timetable } from '../gtfs/feed';

export type Phase = 'idle' | 'network' | 'timetable' | 'ready' | 'error';

let phase = $state<Phase>('idle');
let network = $state.raw<Network | null>(null);
let timetable = $state.raw<Timetable | null>(null);
let error = $state<string | null>(null);
let timings = $state<{ network: number; timetable: number }>({ network: 0, timetable: 0 });

let inFlight: AbortController | null = null;

async function run() {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  phase = 'network';
  error = null;

  try {
    const startNetwork = performance.now();
    const loaded = await loadNetwork(controller.signal);
    if (controller.signal.aborted) return;
    network = loaded;
    timings = { ...timings, network: Math.round(performance.now() - startNetwork) };

    phase = 'timetable';
    const startTimetable = performance.now();
    const loadedTimetable = await loadTimetable(loaded, controller.signal);
    if (controller.signal.aborted) return;
    // `$state.raw` on purpose: tens of thousands of rows behind a proxy is a
    // measurable cost for data that is replaced wholesale and never mutated.
    timetable = loadedTimetable;
    timings = { ...timings, timetable: Math.round(performance.now() - startTimetable) };

    phase = 'ready';
  } catch (cause) {
    if (controller.signal.aborted) return;
    error =
      cause instanceof Error
        ? cause.message
        : 'The feed could not be loaded. Check the connection and try again.';
    phase = 'error';
  }
}

export const feed = {
  get phase(): Phase {
    return phase;
  },
  get network(): Network | null {
    return network;
  },
  get timetable(): Timetable | null {
    return timetable;
  },
  get error(): string | null {
    return error;
  },
  get timings() {
    return timings;
  },
  get hasNetwork(): boolean {
    return network !== null;
  },
  load() {
    if (phase === 'idle' || phase === 'error') void run();
  },
  retry() {
    void run();
  },
};
