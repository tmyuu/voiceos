# VoiceOS Log Analyzer MCP Server

VoiceOS（Mac音声AIアシスタント）の使用パターンを分析するMCPサーバー。VoiceOSの内部AIがagentic loopで段階的にデータを掘り下げ、ワークフローを発見できるようにするツール群を提供します。

## ツール一覧

| ツール | 説明 |
|--------|------|
| `voiceos_overview` | 全体像（セッション数、モード分布、アプリ頻度、エラー率） |
| `voiceos_app_usage` | 特定アプリの使用詳細（transcript、ウィンドウタイトル等） |
| `voiceos_search_transcripts` | キーワードでtranscript/AI応答を検索 |
| `voiceos_session_detail` | 1セッションの完全な詳細（chat_history含む） |
| `voiceos_error_patterns` | エラー分析（コンポーネント別、直近セッション文脈） |
| `voiceos_session_sequences` | セッション連続パターン（dictate→agent等） |
| `voiceos_custom_instructions` | ユーザー定義のアプリ別カスタム指示 |
| `voiceos_get_sessions` | 生セッションデータ（フィルタ付き） |
| `voiceos_parse_logs` | 生ログ解析（イベントタイプ分類） |

## セットアップ

```bash
pnpm install
pnpm build
```

## VoiceOS への接続

VoiceOS > パーソナライズ > カスタム連携 > + 追加:

- **名前**: VoiceOS Log Analyzer
- **起動コマンド**: `node /path/to/voiceos/dist/index.js`

## Agentic Loop の流れ

```
1. voiceos_overview        → 全体像を把握
2. voiceos_app_usage       → 興味深いアプリを深掘り
3. voiceos_search_transcripts → 特定トピックを検索
4. voiceos_session_detail  → 個別セッションの詳細確認
5. voiceos_error_patterns  → エラーパターンの調査
6. AI が分析結果を統合してワークフローを提案
```

## データソース

- ログ: `~/Library/Logs/VoiceOS/main.log`
- DB: `~/Library/Application Support/VoiceOS/voiceos.db`（read-only）

外部API不要。全てローカル完結。
