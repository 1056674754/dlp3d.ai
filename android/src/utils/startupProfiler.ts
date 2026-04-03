import RNFS from 'react-native-fs';

type StartupDetails = Record<string, unknown>;
type StartupChannel = 'android' | 'web';
type StartupMetric = StartupDetails & {
  channel: StartupChannel;
  stage: string;
  elapsedMs: number;
};

const sessionStart = Date.now();
const metricsPath = `${
  RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath
}/startup-metrics.json`;
let metrics: StartupMetric[] = [];

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

async function persistMetrics(): Promise<void> {
  try {
    const parentDir = metricsPath.slice(0, metricsPath.lastIndexOf('/'));
    await RNFS.mkdir(parentDir);
    await RNFS.writeFile(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');
  } catch {
    // Ignore persistence failures during startup profiling.
  }
}

export async function resetStartupMetrics(): Promise<void> {
  metrics = [];
  await persistMetrics();
}

export function recordStartupMetric(
  channel: StartupChannel,
  payload: StartupDetails & { stage: string; elapsedMs: number },
): void {
  const metric: StartupMetric = {
    channel,
    ...payload,
  };
  metrics.push(metric);
  console.warn(`[startup:${channel}] ${JSON.stringify(metric)}`);
  void persistMetrics();
}

export function logStartupEvent(stage: string, details?: StartupDetails): void {
  recordStartupMetric('android', {
    stage,
    elapsedMs: roundMs(Date.now() - sessionStart),
    ...(details ?? {}),
  });
}

export function createStartupSpan(stage: string, details?: StartupDetails) {
  const startedAt = Date.now();
  logStartupEvent(`${stage}:start`, details);
  return (extra?: StartupDetails): void => {
    logStartupEvent(`${stage}:end`, {
      durationMs: roundMs(Date.now() - startedAt),
      ...(extra ?? {}),
    });
  };
}
