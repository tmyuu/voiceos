export type LogLevel = "info" | "warn" | "error";
export type LogEventType = "session_start" | "transcription" | "agent_response" | "error" | "context_gather" | "system";
export interface ParsedLogEntry {
    timestamp: string;
    level: LogLevel;
    component: string | null;
    message: string;
    eventType: LogEventType;
}
export interface VoiceSession {
    id: string;
    transcript: string | null;
    generated_text: string | null;
    app_name: string | null;
    window_title: string | null;
    mode: number;
    duration_seconds: number | null;
    word_count: number | null;
    language: string | null;
    created_at: string;
    chat_history: string | null;
}
export interface CustomInstruction {
    id: string;
    app_identifier: string;
    instruction: string;
    created_at: string;
}
export interface AnalysisResult {
    modeDistribution: Record<string, number>;
    appFrequency: Record<string, number>;
    errorRate: number;
    errorTypes: Record<string, number>;
    avgSessionDuration: number;
    totalSessions: number;
    hourlyDistribution: Record<number, number>;
    sessionSequences: SessionSequence[];
}
export interface SessionSequence {
    pattern: string;
    count: number;
    apps: string[];
}
export interface WorkflowSuggestion {
    toolName: string;
    description: string;
    inputSchema: Record<string, unknown>;
    rationale: string;
    confidence: "high" | "medium" | "low";
    supportingData: {
        occurrences: number;
        exampleTranscripts: string[];
        involvedApps: string[];
    };
}
