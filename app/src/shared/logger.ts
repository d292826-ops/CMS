export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';
export type LogEvent = { level: LogLevel; event: string; attempt?: string };
export type LogSink = (entry: LogEvent) => void;
const defaultSink: LogSink = entry => {
  const method = entry.level === 'ERROR' ? console.error : entry.level === 'WARNING' ? console.warn : console.info;
  method('[supply]', entry.level, entry.event, entry.attempt ?? '');
};
export function log(level: LogLevel, event: string, attempt?: string, sink = defaultSink): void {
  const safeEvent = /^[A-Z0-9_]{1,64}$/.test(event) ? event : 'UNSAFE_EVENT_REDACTED';
  const safeAttempt = attempt && /^[a-zA-Z0-9-]{1,64}$/.test(attempt) ? attempt : undefined;
  sink({ level, event: safeEvent, ...(safeAttempt ? { attempt: safeAttempt } : {}) });
}
