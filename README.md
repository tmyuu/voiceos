# VoiceOS Log Analyzer MCP

VoiceOS の使い方を自動分析して、あなた専用の MCP ワークフローを提案するメタ MCP サーバーです。

## これは何？

[VoiceOS](https://voiceos.com) は Mac 向けの音声 AI アシスタントアプリです。日常的に VoiceOS を使っていると、「毎回同じアプリで同じような操作をしている」「特定の時間帯に集中して使っている」といったパターンが生まれます。

この MCP サーバーは VoiceOS のログと内部データベースを読み取り、AI が段階的に分析できるツール群を提供します。VoiceOS の AI が自律的にデータを掘り下げ、あなたの使い方に最適化された MCP ワークフローを提案します。

## クイックスタート

### 1. ビルド

```bash
git clone https://github.com/tmyuu/voiceos.git
cd voiceos
pnpm install
pnpm build
```

> `better-sqlite3` のネイティブビルドで `pnpm approve-builds` を求められた場合は承認してください。

### 2. VoiceOS に接続

VoiceOS アプリを開き、以下の手順で MCP サーバーを追加します。

1. サイドバーの **パーソナライズ** を開く
2. **カスタム連携** セクションの **+ 追加** をクリック
3. 以下を入力:

| フィールド | 値 |
|-----------|-----|
| 名前 | VoiceOS Log Analyzer（任意） |
| 起動コマンド | `node /path/to/voiceos/dist/index.js` |

4. **接続** をクリック

### 3. 使ってみる

VoiceOS に向かって話しかけるだけです:

> "私の使い方を分析して、自動化できそうなワークフローを提案して"

AI が自動的にツールを呼び出し、段階的にデータを掘り下げて提案を返します。

## 仕組み: Agentic Loop

従来の MCP ツールは「データを渡して終わり」ですが、この MCP は **AI が自分で考えながら複数回ツールを呼び出す**設計になっています。

```
┌─────────────────────────────────────────────┐
│  VoiceOS 内部 AI                             │
│                                              │
│  1. voiceos_overview で全体像を把握           │
│     ↓ "luma.com の使用が多いな"               │
│  2. voiceos_app_usage で luma.com を深掘り    │
│     ↓ "画面の内容を聞く操作が多い"             │
│  3. voiceos_search_transcripts で確認         │
│     ↓ "3回同じパターンがある"                  │
│  4. voiceos_session_detail で詳細を見る       │
│     ↓                                        │
│  5. 分析を統合して、ワークフローを提案         │
└─────────────────────────────────────────────┘
```

AI が何をどの順番で呼ぶかは、あなたの質問とデータの内容によって毎回変わります。

## ツール一覧

### 探索の起点

| ツール | 説明 | 使いどころ |
|--------|------|-----------|
| `voiceos_overview` | セッション数、モード分布、アプリ頻度、エラー率の概要 | 最初に全体像を把握する |

### 掘り下げ

| ツール | 説明 | 使いどころ |
|--------|------|-----------|
| `voiceos_app_usage` | 特定アプリの全セッション・ウィンドウタイトル・モード内訳 | 気になるアプリを詳しく見る |
| `voiceos_search_transcripts` | transcript / AI応答をキーワード検索 | 特定のトピックや操作を探す |
| `voiceos_session_detail` | 1セッションの完全な情報（chat_history 含む） | 面白いセッションの全文を読む |
| `voiceos_error_patterns` | エラーのコンポーネント別集計と直近セッション文脈 | 問題を特定する |
| `voiceos_session_sequences` | 30秒以内の連続セッションパターン（dictate→agent 等） | マルチステップの操作習慣を発見する |
| `voiceos_custom_instructions` | アプリ別のカスタム指示一覧 | ユーザーの意図を理解する |

### 生データアクセス

| ツール | 説明 | 使いどころ |
|--------|------|-----------|
| `voiceos_get_sessions` | DB からセッションを取得（mode, app, since でフィルタ） | 他のツールでカバーできない分析 |
| `voiceos_parse_logs` | ログファイルをイベントタイプ別に構造化 | 低レベルな調査 |

## 使い方の例

### 基本: 自分の使い方を知る

> "VoiceOS をどんなアプリでどう使っているか教えて"

### 応用: ワークフロー提案

> "よく繰り返している操作パターンを見つけて、自動化できる MCP ツールを提案して"

### 特定アプリの分析

> "Chrome で VoiceOS をどう使っているか分析して"

### エラー調査

> "音声認識がよく失敗するけど、原因を調べて"

## データソース

| データ | パス | アクセス |
|--------|------|---------|
| ログ | `~/Library/Logs/VoiceOS/main.log` | 読み取り専用 |
| DB | `~/Library/Application Support/VoiceOS/voiceos.db` | 読み取り専用 |

外部 API は一切使いません。全てローカルで完結します。

## 技術スタック

- **Runtime**: Node.js (ESM)
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` (stdio transport)
- **SQLite**: `better-sqlite3` (read-only)
- **Validation**: Zod v4

## ライセンス

MIT
