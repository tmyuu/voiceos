import { parseLogs } from "./parser.js";
import { getSessions } from "./db.js";
import type {
  AnalysisResult,
  SessionSequence,
  VoiceSession,
  ModeRetry,
  AiTransformSession,
  WindowContext,
} from "./types.js";

const MODE_NAMES: Record<number, string> = {
  0: "dictate",
  2: "write",
  3: "agent",
};

export function getOverview(): {
  totalSessions: number;
  modeDistribution: Record<string, number>;
  activeApps: { name: string; count: number }[];
  dateRange: { earliest: string; latest: string } | null;
  errorSummary: { total: number; rate: string };
  avgDuration: number;
} {
  const sessions = getSessions({ limit: 10000 });
  const logEntries = parseLogs({ tailLines: 2000 });

  const modeDistribution: Record<string, number> = {};
  const appCounts: Record<string, number> = {};

  for (const s of sessions) {
    const name = MODE_NAMES[s.mode] ?? `unknown(${s.mode})`;
    modeDistribution[name] = (modeDistribution[name] ?? 0) + 1;
    const app = s.app_name || "(unknown)";
    appCounts[app] = (appCounts[app] ?? 0) + 1;
  }

  const activeApps = Object.entries(appCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dates = sessions.map((s) => s.created_at).sort();
  const dateRange =
    dates.length > 0
      ? { earliest: dates[0]!, latest: dates[dates.length - 1]! }
      : null;

  const errors = logEntries.filter((e) => e.eventType === "error");
  const sessionStarts = logEntries.filter(
    (e) => e.eventType === "session_start"
  );
  const errorRate =
    sessionStarts.length > 0
      ? ((errors.length / sessionStarts.length) * 100).toFixed(1) + "%"
      : "N/A";

  const durations = sessions
    .map((s) => s.duration_seconds)
    .filter((d): d is number => d != null);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  return {
    totalSessions: sessions.length,
    modeDistribution,
    activeApps,
    dateRange,
    errorSummary: { total: errors.length, rate: errorRate },
    avgDuration: Math.round(avgDuration * 100) / 100,
  };
}

export function getAppUsage(appName: string): {
  sessions: {
    id: string;
    transcript: string | null;
    generated_text: string | null;
    mode: string;
    duration_seconds: number | null;
    window_title: string | null;
    created_at: string;
  }[];
  modeBreakdown: Record<string, number>;
  commonWindowTitles: { title: string; count: number }[];
  avgDuration: number;
} {
  const sessions = getSessions({ appName, limit: 200 });

  const modeBreakdown: Record<string, number> = {};
  const titleCounts: Record<string, number> = {};

  for (const s of sessions) {
    const mode = MODE_NAMES[s.mode] ?? `unknown(${s.mode})`;
    modeBreakdown[mode] = (modeBreakdown[mode] ?? 0) + 1;
    if (s.window_title) {
      titleCounts[s.window_title] = (titleCounts[s.window_title] ?? 0) + 1;
    }
  }

  const commonWindowTitles = Object.entries(titleCounts)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const durations = sessions
    .map((s) => s.duration_seconds)
    .filter((d): d is number => d != null);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      transcript: s.transcript,
      generated_text: s.generated_text,
      mode: MODE_NAMES[s.mode] ?? `unknown(${s.mode})`,
      duration_seconds: s.duration_seconds,
      window_title: s.window_title,
      created_at: s.created_at,
    })),
    modeBreakdown,
    commonWindowTitles,
    avgDuration: Math.round(avgDuration * 100) / 100,
  };
}

export function searchTranscripts(query: string, limit: number = 20): {
  id: string;
  transcript: string | null;
  generated_text: string | null;
  app_name: string | null;
  mode: string;
  created_at: string;
}[] {
  const sessions = getSessions({ limit: 10000 });
  const q = query.toLowerCase();

  return sessions
    .filter(
      (s) =>
        s.transcript?.toLowerCase().includes(q) ||
        s.generated_text?.toLowerCase().includes(q) ||
        s.chat_history?.toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      transcript: s.transcript,
      generated_text: s.generated_text,
      app_name: s.app_name,
      mode: MODE_NAMES[s.mode] ?? `unknown(${s.mode})`,
      created_at: s.created_at,
    }));
}

export function getErrorPatterns(): {
  errors: {
    timestamp: string;
    component: string | null;
    message: string;
  }[];
  byComponent: Record<string, number>;
  totalErrors: number;
  recentSessionContext: {
    sessionId: string;
    transcript: string | null;
    mode: string;
    app: string | null;
  }[];
} {
  const logEntries = parseLogs({ tailLines: 2000, eventTypes: ["error"] });
  const sessions = getSessions({ limit: 20 });

  const byComponent: Record<string, number> = {};
  for (const e of logEntries) {
    const key = e.component ?? "unknown";
    byComponent[key] = (byComponent[key] ?? 0) + 1;
  }

  return {
    errors: logEntries.map((e) => ({
      timestamp: e.timestamp,
      component: e.component,
      message: e.message,
    })),
    byComponent,
    totalErrors: logEntries.length,
    recentSessionContext: sessions.slice(0, 5).map((s) => ({
      sessionId: s.id,
      transcript: s.transcript,
      mode: MODE_NAMES[s.mode] ?? `unknown(${s.mode})`,
      app: s.app_name,
    })),
  };
}

export function getSessionDetail(sessionId: string): VoiceSession | null {
  const sessions = getSessions({ limit: 10000 });
  return sessions.find((s) => s.id === sessionId) ?? null;
}

export function getSessionSequences(): SessionSequence[] {
  const sessions = getSessions({ limit: 10000 });
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const patterns: Map<string, { count: number; apps: Set<string> }> =
    new Map();

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    const gap =
      new Date(next.created_at).getTime() -
      new Date(curr.created_at).getTime();

    if (gap < 30_000) {
      const currMode = MODE_NAMES[curr.mode] ?? "unknown";
      const nextMode = MODE_NAMES[next.mode] ?? "unknown";
      const pattern = `${currMode} → ${nextMode}`;
      const existing = patterns.get(pattern) ?? {
        count: 0,
        apps: new Set(),
      };
      existing.count++;
      if (curr.app_name) existing.apps.add(curr.app_name);
      if (next.app_name) existing.apps.add(next.app_name);
      patterns.set(pattern, existing);
    }
  }

  return Array.from(patterns.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      apps: Array.from(data.apps),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Pattern 2: Mode retries (same transcript, different mode within short time) ──

export function detectModeRetries(maxGapSeconds: number = 60): ModeRetry[] {
  const sessions = getSessions({ limit: 10000 });
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const retries: ModeRetry[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;

    if (curr.mode === next.mode) continue;
    if (!curr.transcript || !next.transcript) continue;

    const gap =
      (new Date(next.created_at).getTime() -
        new Date(curr.created_at).getTime()) /
      1000;
    if (gap > maxGapSeconds) continue;

    // Check transcript similarity: exact match or one contains the other
    const t1 = curr.transcript.trim();
    const t2 = next.transcript.trim();
    const similar =
      t1 === t2 ||
      t1.includes(t2) ||
      t2.includes(t1) ||
      (t1.length > 5 &&
        t2.length > 5 &&
        levenshteinRatio(t1, t2) > 0.7);

    if (similar) {
      retries.push({
        firstSession: {
          id: curr.id,
          transcript: curr.transcript,
          mode: MODE_NAMES[curr.mode] ?? `unknown(${curr.mode})`,
          created_at: curr.created_at,
        },
        retrySession: {
          id: next.id,
          transcript: next.transcript,
          mode: MODE_NAMES[next.mode] ?? `unknown(${next.mode})`,
          created_at: next.created_at,
        },
        gapSeconds: Math.round(gap * 10) / 10,
        app_name: curr.app_name ?? next.app_name,
        window_title: curr.window_title ?? next.window_title,
      });
    }
  }

  return retries;
}

function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  return 1 - matrix[a.length]![b.length]! / maxLen;
}

// ── Pattern 4: AI transform detection (transcript vs generated_text) ──

export function detectAiTransforms(): {
  sessions: AiTransformSession[];
  summary: {
    passthrough: number;
    ai_transformed: number;
    no_output: number;
    total: number;
  };
} {
  const sessions = getSessions({ limit: 10000 });

  const results: AiTransformSession[] = sessions.map((s) => {
    let transformType: AiTransformSession["transformType"];

    if (!s.generated_text) {
      transformType = "no_output";
    } else if (
      s.transcript &&
      s.generated_text.trim() === s.transcript.trim()
    ) {
      transformType = "passthrough";
    } else {
      transformType = "ai_transformed";
    }

    return {
      id: s.id,
      transcript: s.transcript,
      generated_text: s.generated_text,
      app_name: s.app_name,
      mode: MODE_NAMES[s.mode] ?? `unknown(${s.mode})`,
      transformType,
      created_at: s.created_at,
    };
  });

  const summary = {
    passthrough: results.filter((r) => r.transformType === "passthrough").length,
    ai_transformed: results.filter((r) => r.transformType === "ai_transformed")
      .length,
    no_output: results.filter((r) => r.transformType === "no_output").length,
    total: results.length,
  };

  return { sessions: results, summary };
}

// ── Pattern 5: Window title context analysis ──

export function analyzeWindowContexts(): {
  contexts: WindowContext[];
  urlPatterns: { pattern: string; count: number; apps: string[] }[];
} {
  const sessions = getSessions({ limit: 10000 });

  // Group by app_name + window_title
  const contextMap = new Map<
    string,
    {
      app_name: string;
      window_title: string;
      count: number;
      modes: Record<string, number>;
      transcripts: string[];
    }
  >();

  for (const s of sessions) {
    if (!s.app_name || !s.window_title) continue;
    const key = `${s.app_name}|${s.window_title}`;
    const existing = contextMap.get(key) ?? {
      app_name: s.app_name,
      window_title: s.window_title,
      count: 0,
      modes: {},
      transcripts: [],
    };
    existing.count++;
    const mode = MODE_NAMES[s.mode] ?? `unknown(${s.mode})`;
    existing.modes[mode] = (existing.modes[mode] ?? 0) + 1;
    if (s.transcript) {
      existing.transcripts.push(s.transcript);
    }
    contextMap.set(key, existing);
  }

  const contexts: WindowContext[] = Array.from(contextMap.values())
    .map((c) => ({
      app_name: c.app_name,
      window_title: c.window_title,
      sessionCount: c.count,
      modes: c.modes,
      transcripts: c.transcripts.slice(0, 10),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  // Extract URL patterns from window titles
  const urlRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/[^\s]*)*/g;
  const urlCounts = new Map<
    string,
    { count: number; apps: Set<string> }
  >();

  for (const s of sessions) {
    if (!s.window_title) continue;
    const matches = s.window_title.matchAll(urlRegex);
    for (const m of matches) {
      const domain = m[1]!;
      const existing = urlCounts.get(domain) ?? {
        count: 0,
        apps: new Set(),
      };
      existing.count++;
      if (s.app_name) existing.apps.add(s.app_name);
      urlCounts.set(domain, existing);
    }
  }

  // Also extract paths from window titles that look like file paths
  const pathRegex = /[~\/][\w\-\.\/]+/g;
  for (const s of sessions) {
    if (!s.window_title) continue;
    const matches = s.window_title.matchAll(pathRegex);
    for (const m of matches) {
      const path = m[0]!;
      const existing = urlCounts.get(path) ?? {
        count: 0,
        apps: new Set(),
      };
      existing.count++;
      if (s.app_name) existing.apps.add(s.app_name);
      urlCounts.set(path, existing);
    }
  }

  const urlPatterns = Array.from(urlCounts.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      apps: Array.from(data.apps),
    }))
    .sort((a, b) => b.count - a.count);

  return { contexts, urlPatterns };
}
