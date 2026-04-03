import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const LOG_PATH = join(homedir(), "Library/Logs/VoiceOS/main.log");
const LINE_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] \[(\w+)\]\s+(?:\[([^\]]+)\])?\s*(.*)/;
function classifyEvent(level, component, message) {
    if (level === "error" || message.includes("failed") || message.includes("Error")) {
        return "error";
    }
    if (component === "Session Start" ||
        (component === "AgentInputService" && message.includes("Starting new"))) {
        return "session_start";
    }
    if (component === "AgentInputService" &&
        (message.includes("status: 0") || message.includes("status: 1"))) {
        return "transcription";
    }
    if (component === "AgentInputService" &&
        (message.includes("status: 5") || message.includes("status: 7"))) {
        return "agent_response";
    }
    if (component === "ScreenCapture" ||
        component === "SelectedTextService" ||
        component === "WindowTextReader" ||
        (message.toLowerCase().includes("accessibility"))) {
        return "context_gather";
    }
    return "system";
}
export function parseLogs(options) {
    const tailLines = options?.tailLines ?? 500;
    let content;
    try {
        statSync(LOG_PATH);
        content = readFileSync(LOG_PATH, "utf-8");
    }
    catch {
        return [];
    }
    const allLines = content.split("\n");
    const lines = allLines.slice(Math.max(0, allLines.length - tailLines));
    const entries = [];
    let current = null;
    for (const line of lines) {
        const match = line.match(LINE_RE);
        if (match) {
            if (current)
                entries.push(current);
            const [, timestamp, level, component, message] = match;
            const eventType = classifyEvent(level, component ?? null, message);
            current = {
                timestamp: timestamp,
                level: level,
                component: component ?? null,
                message: message,
                eventType,
            };
        }
        else if (current && line.trim()) {
            current.message += "\n" + line;
        }
    }
    if (current)
        entries.push(current);
    let filtered = entries;
    if (options?.since) {
        filtered = filtered.filter((e) => e.timestamp >= options.since);
    }
    if (options?.eventTypes?.length) {
        const types = new Set(options.eventTypes);
        filtered = filtered.filter((e) => types.has(e.eventType));
    }
    return filtered;
}
