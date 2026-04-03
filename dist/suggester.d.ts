import type { WorkflowSuggestion } from "./types.js";
export declare function suggestWorkflows(options?: {
    since?: string;
    minOccurrences?: number;
}): WorkflowSuggestion[];
