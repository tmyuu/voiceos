import { parseLogs } from "./parser.js";
import { getSessions } from "./db.js";
const MODE_NAMES = {
    0: "dictate",
    2: "write",
    3: "agent",
};
export function getOverview() {
    const sessions = getSessions({ limit: 10000 });
    const logEntries = parseLogs({ tailLines: 2000 });
    const modeDistribution = {};
    const appCounts = {};
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
    const dateRange = dates.length > 0
        ? { earliest: dates[0], latest: dates[dates.length - 1] }
        : null;
    const errors = logEntries.filter((e) => e.eventType === "error");
    const sessionStarts = logEntries.filter((e) => e.eventType === "session_start");
    const errorRate = sessionStarts.length > 0
        ? ((errors.length / sessionStarts.length) * 100).toFixed(1) + "%"
        : "N/A";
    const durations = sessions
        .map((s) => s.duration_seconds)
        .filter((d) => d != null);
    const avgDuration = durations.length > 0
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
export function getAppUsage(appName) {
    const sessions = getSessions({ appName, limit: 200 });
    const modeBreakdown = {};
    const titleCounts = {};
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
        .filter((d) => d != null);
    const avgDuration = durations.length > 0
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
export function searchTranscripts(query, limit = 20) {
    const sessions = getSessions({ limit: 10000 });
    const q = query.toLowerCase();
    return sessions
        .filter((s) => s.transcript?.toLowerCase().includes(q) ||
        s.generated_text?.toLowerCase().includes(q) ||
        s.chat_history?.toLowerCase().includes(q))
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
export function getErrorPatterns() {
    const logEntries = parseLogs({ tailLines: 2000, eventTypes: ["error"] });
    const sessions = getSessions({ limit: 20 });
    const byComponent = {};
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
export function getSessionDetail(sessionId) {
    const sessions = getSessions({ limit: 10000 });
    return sessions.find((s) => s.id === sessionId) ?? null;
}
export function getSessionSequences() {
    const sessions = getSessions({ limit: 10000 });
    const sorted = [...sessions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const patterns = new Map();
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        const gap = new Date(next.created_at).getTime() -
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
            if (curr.app_name)
                existing.apps.add(curr.app_name);
            if (next.app_name)
                existing.apps.add(next.app_name);
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
