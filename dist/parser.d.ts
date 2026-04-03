import type { ParsedLogEntry, LogEventType } from "./types.js";
export declare function parseLogs(options?: {
    since?: string;
    eventTypes?: LogEventType[];
    tailLines?: number;
}): ParsedLogEntry[];
