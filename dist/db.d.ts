import type { VoiceSession, CustomInstruction } from "./types.js";
export declare function getSessions(options?: {
    mode?: number;
    appName?: string;
    since?: string;
    limit?: number;
}): VoiceSession[];
export declare function getCustomInstructions(): CustomInstruction[];
