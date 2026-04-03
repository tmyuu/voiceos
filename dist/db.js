import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";
const DB_PATH = join(homedir(), "Library/Application Support/VoiceOS/voiceos.db");
function openDb() {
    return new Database(DB_PATH, { readonly: true });
}
export function getSessions(options) {
    const db = openDb();
    try {
        const conditions = ["deleted_at IS NULL"];
        const params = [];
        if (options?.mode !== undefined) {
            conditions.push("mode = ?");
            params.push(options.mode);
        }
        if (options?.appName) {
            conditions.push("app_name LIKE ?");
            params.push(`%${options.appName}%`);
        }
        if (options?.since) {
            conditions.push("created_at >= ?");
            params.push(options.since);
        }
        const limit = options?.limit ?? 50;
        const sql = `SELECT id, transcript, generated_text, app_name, window_title, mode, duration_seconds, word_count, language, created_at, chat_history FROM voice_sessions WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        return db.prepare(sql).all(...params);
    }
    finally {
        db.close();
    }
}
export function getCustomInstructions() {
    const db = openDb();
    try {
        return db
            .prepare("SELECT id, app_identifier, instruction, created_at FROM custom_instructions WHERE deleted_at IS NULL ORDER BY created_at DESC")
            .all();
    }
    finally {
        db.close();
    }
}
