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
  version: "0.3.0",
});

// ── Resource: MCP Spec Template ──
// VoiceOS の AI がこのリソースを読んで、分析結果を実装指示書として出力する
server.resource(
  "mcp-spec-template",
  "voiceos://templates/mcp-spec",
  async () => ({
    contents: [
      {
        uri: "voiceos://templates/mcp-spec",
        mimeType: "text/markdown",
        text: MCP_SPEC_TEMPLATE,
      },
    ],
  })
);

// ── Resource: Analysis Guide ──
// AI に分析の進め方と最終出力形式を伝えるガイド
server.resource(
  "analysis-guide",
  "voiceos://guides/analysis",
  async () => ({
    contents: [
      {
        uri: "voiceos://guides/analysis",
        mimeType: "text/markdown",
        text: ANALYSIS_GUIDE,
      },
    ],
  })
);

// ── Tools ──

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

server.tool(
  "voiceos_app_usage",
  "Deep dive into how VoiceOS is used with a specific app. Returns all sessions with transcripts, mode breakdown, and common window titles. Use this after overview to explore interesting apps.",
  {
    app_name: z
      .string()
      .describe("App name to investigate (e.g., 'luma.com', 'Chrome')"),
  },
  async (params) => {
    const usage = getAppUsage(params.app_name);
    return {
      content: [{ type: "text", text: JSON.stringify(usage, null, 2) }],
    };
  }
);

server.tool(
  "voiceos_search_transcripts",
  "Search through voice session transcripts and AI responses by keyword. Use this to find patterns around specific topics or commands.",
  {
    query: z
      .string()
      .describe(
        "Search keyword (matches transcript, generated_text, chat_history)"
      ),
    limit: z.optional(z.number().describe("Max results (default 20)")),
  },
  async (params) => {
    const results = searchTranscripts(params.query, params.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

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

server.tool(
  "voiceos_get_sessions",
  "Get raw voice sessions from the database with filters. Use for custom analysis when other tools don't cover your needs.",
  {
    mode: z.optional(
      z.number().describe("Filter by mode (0=dictate, 2=write, 3=agent)")
    ),
    app_name: z.optional(
      z.string().describe("Filter by app name (partial match)")
    ),
    since: z.optional(
      z.string().describe("ISO date — only sessions after this")
    ),
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

server.tool(
  "voiceos_parse_logs",
  "Parse raw VoiceOS log file into structured events. Use for low-level investigation when higher-level tools aren't sufficient.",
  {
    since: z.optional(
      z.string().describe("ISO datetime — only events after this")
    ),
    event_types: z.optional(
      z
        .array(
          z.enum([
            "session_start",
            "transcription",
            "agent_response",
            "error",
            "context_gather",
            "system",
          ])
        )
        .describe("Filter by event category")
    ),
    tail_lines: z.optional(
      z.number().describe("Read last N lines (default 500)")
    ),
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

// ── Constants ──

const ANALYSIS_GUIDE = `# VoiceOS Log Analyzer — 分析ガイド

あなたは VoiceOS の使用パターンを分析し、ユーザー専用の MCP ツールを設計するアナリストです。

## 分析の進め方

### Step 1: 全体像を把握
\`voiceos_overview\` を呼び出して、セッション数・モード分布・アプリ頻度を確認する。

### Step 2: 気になるパターンを深掘り
- 頻出アプリ → \`voiceos_app_usage\` で transcript を全件読む
- エラーが多い → \`voiceos_error_patterns\` で原因を特定
- 連続操作 → \`voiceos_session_sequences\` でマルチステップを発見

### Step 3: 具体的なセッションを精査
- \`voiceos_search_transcripts\` でキーワード検索
- \`voiceos_session_detail\` で個別セッションの全文を確認

### Step 4: パターンを MCP 設計に変換
発見したパターンごとに、以下を考える:
- **ユーザーが繰り返していること** は何か？
- **自動化したら何秒/何ステップ短縮できるか？**
- **MCP ツールとして実装するなら** 入力・出力・処理は何か？

### Step 5: 実装指示書を出力
\`voiceos://templates/mcp-spec\` のテンプレートに従って、Claude Code にそのまま渡せる品質の設計書を Markdown で出力する。

## 出力の品質基準

出力された MD を Claude Code に「これを作って」と渡したら、**追加の質問なしで実装が始まる**レベルを目指す。具体的には:

- ツール名、説明、入出力スキーマが全て定義されている
- なぜこのツールが必要かの根拠（実際の transcript 引用）がある
- 技術的な実装方針（使う API、ライブラリ等）が書かれている
- エッジケースや注意点が記載されている
`;

const MCP_SPEC_TEMPLATE = `# MCP 設計テンプレート

以下のフォーマットで、提案する MCP ツールごとに設計書を出力してください。

---

## [MCP名]: [1行の説明]

### 背景

> ここに VoiceOS のログから発見したパターンを記述する。
> 実際の transcript を引用して、なぜこのツールが必要かを示す。

**検出されたパターン:**
- アプリ: [app_name]
- 頻度: [N回 / 期間]
- 代表的な発話:
  - "[実際のtranscript1]"
  - "[実際のtranscript2]"

### ツール定義

\`\`\`typescript
server.tool(
  "tool_name",
  "ツールの説明（VoiceOS上での表示にも使われる）",
  {
    // Zod v4 スキーマ
    param1: z.string().describe("説明"),
    param2: z.optional(z.number().describe("説明")),
  },
  async (params) => {
    // 処理の概要をコメントで記述
    // 実際の実装コードまたは擬似コード
  }
);
\`\`\`

### 入出力

| 方向 | フィールド | 型 | 説明 |
|------|-----------|-----|------|
| 入力 | param1 | string | ... |
| 出力 | result | object | ... |

### 実装方針

- 使用する API / ライブラリ
- データの取得元
- エラーハンドリング
- パフォーマンス上の注意点

### VoiceOS での使い方

ユーザーが VoiceOS に向かってこう言うと、このツールが呼ばれる想定:

> "[想定される音声コマンドの例1]"
> "[想定される音声コマンドの例2]"

### 依存関係

\`\`\`json
{
  "dependencies": {
    "package-name": "^x.y.z"
  }
}
\`\`\`

---

## 出力例（参考）

## page-summarizer: Web ページの内容を要約する

### 背景

> ユーザーは luma.com を閲覧中に「この画面内に書いてあるのはどういうこと？」と 3回発話している。
> VoiceOS の write モードでは画面のアクセシビリティテキストを読んで回答できたが、
> dictate モードでは同じ質問に対してテキストをそのまま返すだけだった。

**検出されたパターン:**
- アプリ: luma.com (Google Chrome)
- 頻度: 3回 / 1日
- 代表的な発話:
  - "この画面内に書いてあるのはどういうこと？"
  - "このエージェントモードを公開ってこのこと?"

### ツール定義

\`\`\`typescript
server.tool(
  "summarize_page",
  "現在のブラウザページの内容を要約する",
  {
    url: z.optional(z.string().describe("要約対象のURL（省略時はアクティブタブ）")),
    focus: z.optional(z.string().describe("特に注目してほしい部分（例: 日時、参加条件）")),
  },
  async (params) => {
    // 1. AppleScript で Chrome のアクティブタブの URL と HTML を取得
    // 2. HTML をパースしてメインコンテンツを抽出
    // 3. 要約を返す
  }
);
\`\`\`

このように、**実際のログデータに基づいた具体的な設計**を出力してください。
`;

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
