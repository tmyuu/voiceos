# VoiceOS MCP

VoiceOS（Mac音声AIアシスタント）向けの MCP サーバーを開発するリポジトリ。

## Commands

```bash
pnpm install        # 依存関係インストール
pnpm build          # TypeScript コンパイル（tsc → dist/）
pnpm start          # MCP サーバー起動（stdio transport）
pnpm dev            # tsc --watch（開発用）
```

## Architecture

```
src/
  index.ts          MCP サーバー エントリーポイント（ツール登録 + stdio transport）
  types.ts          共通型定義（ParsedLogEntry, VoiceSession, etc.）
  parser.ts         ~/Library/Logs/VoiceOS/main.log のパーサー
  db.ts             ~/Library/Application Support/VoiceOS/voiceos.db のリーダー（read-only）
  analyzer.ts       パターン分析（overview, app_usage, search, errors, sequences）
```

- **MCP SDK**: `@modelcontextprotocol/sdk` — stdio transport
- **SQLite**: `better-sqlite3` — ネイティブモジュール、read-only アクセス
- **Validation**: `zod/v4` — ツール入力スキーマ
- **Build**: TypeScript → ESM (`"type": "module"`, `"module": "Node16"`)

## データソース

- ログ: `~/Library/Logs/VoiceOS/main.log`
- DB: `~/Library/Application Support/VoiceOS/voiceos.db`
  - `voice_sessions` — transcript, generated_text, app_name, mode(0=dictate,2=write,3=agent), chat_history
  - `custom_instructions` — アプリ別カスタム指示
  - `dictionary` — ユーザー辞書

## VoiceOS への接続

VoiceOS > パーソナライズ > カスタム連携 > + 追加:
- 名前: 任意
- 起動コマンド: `node /Users/ymatsui/Documents/voiceos/dist/index.js`

## Gotchas

- `better-sqlite3` はネイティブモジュール。`pnpm install` 後にビルドが必要（`pnpm approve-builds` が求められる場合あり）
- DB は read-only で開くこと。VoiceOS が書き込み中にロックを取る可能性がある
- ログファイルは VoiceOS 再起動でリセットされることがある
- Zod v4 は `zod/v4` からインポート（`import { z } from "zod/v4"`）

## GitHub Workflow

- Issue → ブランチ（`feature/#N-desc` / `fix/#N-desc`）→ コミット（`#N` 参照必須）→ PR（`Closes #N`、`--label`、`--assignee`、`--project` 必須）
- プロジェクト: 「VoiceOS MCP 開発」
- ラベル: フェーズ（開発/テスト/納品）+ 重要度（高/中/低）
