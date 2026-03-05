import type { ProjectConfig } from "../projects/types.js";
import { buildBaseSystemPrompt } from "../prompts/base-system.js";
import { buildSalesPrompt } from "../prompts/sales-personality.js";
import { buildKnowledgePrompt } from "../prompts/knowledge-builder.js";

export function assembleSystemPrompt(language: "en" | "es", project: ProjectConfig): string {
  return [
    buildBaseSystemPrompt(language, project.name),
    buildSalesPrompt(language, project.salesGoals),
    buildKnowledgePrompt(project.name, project.knowledgeBase),
  ].join("\n\n---\n\n");
}
