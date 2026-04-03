import type { SessionSequence, VoiceSession } from "./types.js";
export declare function getOverview(): {
    totalSessions: number;
    modeDistribution: Record<string, number>;
    activeApps: {
        name: string;
        count: number;
    }[];
    dateRange: {
        earliest: string;
        latest: string;
    } | null;
    errorSummary: {
        total: number;
        rate: string;
    };
    avgDuration: number;
};
export declare function getAppUsage(appName: string): {
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
    commonWindowTitles: {
        title: string;
        count: number;
    }[];
    avgDuration: number;
};
export declare function searchTranscripts(query: string, limit?: number): {
    id: string;
    transcript: string | null;
    generated_text: string | null;
    app_name: string | null;
    mode: string;
    created_at: string;
}[];
export declare function getErrorPatterns(): {
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
};
export declare function getSessionDetail(sessionId: string): VoiceSession | null;
export declare function getSessionSequences(): SessionSequence[];
