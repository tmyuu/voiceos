import { analyzePatterns } from "./analyzer.js";
import { getSessions, getCustomInstructions } from "./db.js";
export function suggestWorkflows(options) {
    const minOcc = options?.minOccurrences ?? 2;
    const analysis = analyzePatterns({ since: options?.since, focus: "all" });
    const sessions = getSessions({ since: options?.since, limit: 1000 });
    const instructions = getCustomInstructions();
    const suggestions = [];
    // Rule 1: App-specific tool for frequently used apps
    for (const [app, count] of Object.entries(analysis.appFrequency)) {
        if (count >= Math.max(minOcc, 3) && app !== "(unknown)") {
            const appSessions = sessions.filter((s) => s.app_name === app);
            const transcripts = appSessions
                .map((s) => s.transcript)
                .filter((t) => !!t)
                .slice(0, 5);
            const safeName = app.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
            suggestions.push({
                toolName: `${safeName}_assistant`,
                description: `Voice assistant specialized for ${app}. Automates common voice interactions detected in this app.`,
                inputSchema: {
                    type: "object",
                    properties: {
                        command: { type: "string", description: "Voice command or query" },
                        context: {
                            type: "string",
                            description: "Current window/page context",
                        },
                    },
                    required: ["command"],
                },
                rationale: `${app} was used in ${count} voice sessions. Frequent usage suggests a dedicated tool would reduce repetitive setup.`,
                confidence: count >= 5 ? "high" : "medium",
                supportingData: {
                    occurrences: count,
                    exampleTranscripts: transcripts,
                    involvedApps: [app],
                },
            });
        }
    }
    // Rule 2: Dictate→Agent sequence pattern
    for (const seq of analysis.sessionSequences) {
        if (seq.pattern === "dictate → agent" && seq.count >= minOcc) {
            suggestions.push({
                toolName: "voice_command_pipeline",
                description: "Combined dictation-to-agent pipeline. Captures dictated text and automatically routes it as an agent command.",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "Dictated text to process as command",
                        },
                        target_app: {
                            type: "string",
                            description: "Target application context",
                        },
                    },
                    required: ["text"],
                },
                rationale: `Detected ${seq.count} instances of dictate→agent sequence within 30s. Users appear to dictate then immediately switch to agent mode.`,
                confidence: seq.count >= 4 ? "high" : "medium",
                supportingData: {
                    occurrences: seq.count,
                    exampleTranscripts: [],
                    involvedApps: seq.apps,
                },
            });
        }
    }
    // Rule 3: High error rate
    if (analysis.errorRate > 0.3 &&
        analysis.totalSessions >= minOcc) {
        suggestions.push({
            toolName: "transcription_retry",
            description: "Automatic retry with audio quality check. Detects short or noisy audio and prompts the user before sending.",
            inputSchema: {
                type: "object",
                properties: {
                    min_duration_ms: {
                        type: "number",
                        description: "Minimum audio duration in ms (default 500)",
                    },
                    max_retries: {
                        type: "number",
                        description: "Max retry attempts (default 2)",
                    },
                },
            },
            rationale: `Transcription error rate is ${(analysis.errorRate * 100).toFixed(0)}% (${Object.values(analysis.errorTypes).reduce((a, b) => a + b, 0)} errors across ${analysis.totalSessions} sessions). Many failures appear to be from short audio clips.`,
            confidence: "high",
            supportingData: {
                occurrences: Object.values(analysis.errorTypes).reduce((a, b) => a + b, 0),
                exampleTranscripts: [],
                involvedApps: [],
            },
        });
    }
    // Rule 4: Custom instructions → dedicated MCP tools
    for (const instr of instructions) {
        suggestions.push({
            toolName: `${instr.app_identifier.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_custom`,
            description: `Custom voice workflow for ${instr.app_identifier}, implementing user-defined instructions.`,
            inputSchema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Voice command" },
                },
                required: ["command"],
            },
            rationale: `User has custom instructions configured for ${instr.app_identifier}: "${instr.instruction.slice(0, 100)}..."`,
            confidence: "medium",
            supportingData: {
                occurrences: 1,
                exampleTranscripts: [],
                involvedApps: [instr.app_identifier],
            },
        });
    }
    // Rule 5: Time-based workflow (if usage concentrated in specific hours)
    const hours = Object.entries(analysis.hourlyDistribution).sort((a, b) => b[1] - a[1]);
    if (hours.length > 0) {
        const peakHour = Number(hours[0][0]);
        const peakCount = hours[0][1];
        if (peakCount >= minOcc && peakCount > analysis.totalSessions * 0.4) {
            suggestions.push({
                toolName: "scheduled_voice_workflow",
                description: `Scheduled voice workflow optimized for peak usage hours (around ${peakHour}:00).`,
                inputSchema: {
                    type: "object",
                    properties: {
                        schedule: {
                            type: "string",
                            description: "Cron expression for scheduling",
                        },
                        workflow: {
                            type: "string",
                            description: "Workflow to execute",
                        },
                    },
                    required: ["workflow"],
                },
                rationale: `${peakCount} of ${analysis.totalSessions} sessions (${((peakCount / analysis.totalSessions) * 100).toFixed(0)}%) occur around ${peakHour}:00. A scheduled workflow could pre-warm or automate recurring tasks at this time.`,
                confidence: "low",
                supportingData: {
                    occurrences: peakCount,
                    exampleTranscripts: [],
                    involvedApps: [],
                },
            });
        }
    }
    return suggestions;
}
