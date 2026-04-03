import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { parseLogs } from "./parser.js";
import { getSessions, getCustomInstructions } from "./db.js";
import {
  getOverview,
  getAppUsage,
  searchTranscripts,
  getErrorPatterns,
  getSessionDetail,
  getSessionSequences,
} from "./analyzer.js";

const server = new McpServer({
  name: "voiceos-log-analyzer",
  version: "0.2.0",
});

// Step 1: Overview — AI starts here to understand the big picture
server.tool(
  "voiceos_overview",
  "Get a high-level overview of VoiceOS usage: total sessions, mode distribution, active apps, error rate, average duration. Start here to understand what the user does with VoiceOS.",
  {},
  async () => {
    const overview = getOverview();
    return {
      content: [{ type: "text", text: JSON.stringify(overview, null, 2) }],
    };
  }
);

// Step 2: Drill down into a specific app
server.tool(
  "voiceos_app_usage",
  "Deep dive into how VoiceOS is used with a specific app. Returns all sessions with transcripts, mode breakdown, and common window titles. Use this after overview to explore interesting apps.",
  {
    app_name: z.string().describe("App name to investigate (e.g., 'luma.com', 'Chrome')"),
  },
  async (params) => {
    const usage = getAppUsage(params.app_name);
    return {
      content: [{ type: "text", text: JSON.stringify(usage, null, 2) }],
    };
  }
);

// Step 3: Search transcripts by keyword
server.tool(
  "voiceos_search_transcripts",
  "Search through voice session transcripts and AI responses by keyword. Use this to find patterns around specific topics or commands.",
  {
    query: z.string().describe("Search keyword (matches transcript, generated_text, chat_history)"),
    limit: z.optional(z.number().describe("Max results (default 20)")),
  },
  async (params) => {
    const results = searchTranscripts(params.query, params.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Step 4: Get full detail of a single session
server.tool(
  "voiceos_session_detail",
  "Get full details of a specific voice session including chat_history. Use this to understand the complete context of an interesting session.",
  {
    session_id: z.string().describe("Session UUID"),
  },
  async (params) => {
    const session = getSessionDetail(params.session_id);
    if (!session) {
      return {
        content: [{ type: "text", text: "Session not found" }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
    };
  }
);

// Step 5: Analyze error patterns
server.tool(
  "voiceos_error_patterns",
  "Analyze transcription and system errors. Returns error details grouped by component, with recent session context. Use this to identify reliability issues.",
  {},
  async () => {
    const errors = getErrorPatterns();
    return {
      content: [{ type: "text", text: JSON.stringify(errors, null, 2) }],
    };
  }
);

// Step 6: Get session sequences (mode transitions)
server.tool(
  "voiceos_session_sequences",
  "Detect patterns in how sessions follow each other (e.g., dictate→agent within 30s). Reveals multi-step workflows the user performs repeatedly.",
  {},
  async () => {
    const sequences = getSessionSequences();
    return {
      content: [{ type: "text", text: JSON.stringify(sequences, null, 2) }],
    };
  }
);

// Step 7: Get custom instructions
server.tool(
  "voiceos_custom_instructions",
  "Read user-defined per-app custom instructions. These reveal what the user has explicitly configured for specific apps.",
  {},
  async () => {
    const instructions = getCustomInstructions();
    return {
      content: [{ type: "text", text: JSON.stringify(instructions, null, 2) }],
    };
  }
);

// Raw data access: sessions with filters
server.tool(
  "voiceos_get_sessions",
  "Get raw voice sessions from the database with filters. Use for custom analysis when other tools don't cover your needs.",
  {
    mode: z.optional(z.number().describe("Filter by mode (0=dictate, 2=write, 3=agent)")),
    app_name: z.optional(z.string().describe("Filter by app name (partial match)")),
    since: z.optional(z.string().describe("ISO date — only sessions after this")),
    limit: z.optional(z.number().describe("Max rows (default 50)")),
  },
  async (params) => {
    const sessions = getSessions({
      mode: params.mode,
      appName: params.app_name,
      since: params.since,
      limit: params.limit,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
    };
  }
);

// Raw data access: parsed logs
server.tool(
  "voiceos_parse_logs",
  "Parse raw VoiceOS log file into structured events. Use for low-level investigation when higher-level tools aren't sufficient.",
  {
    since: z.optional(z.string().describe("ISO datetime — only events after this")),
    event_types: z.optional(
      z.array(
        z.enum([
          "session_start",
          "transcription",
          "agent_response",
          "error",
          "context_gather",
          "system",
        ])
      ).describe("Filter by event category")
    ),
    tail_lines: z.optional(z.number().describe("Read last N lines (default 500)")),
  },
  async (params) => {
    const entries = parseLogs({
      since: params.since,
      eventTypes: params.event_types,
      tailLines: params.tail_lines,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
