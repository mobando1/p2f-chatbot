import type { ProjectConfig } from "../projects/types.js";
import { buildBaseSystemPrompt } from "../prompts/base-system.js";
import { buildSalesPrompt } from "../prompts/sales-personality.js";
import { buildKnowledgePrompt } from "../prompts/knowledge-builder.js";

export function assembleSystemPrompt(
  language: "en" | "es",
  project: ProjectConfig,
  contactInfo?: { name?: string; email?: string },
): string {
  const parts = [
    buildBaseSystemPrompt(language, project.name),
    buildSalesPrompt(language, project.salesGoals),
    buildKnowledgePrompt(project.name, project.knowledgeBase),
  ];

  if (contactInfo?.name || contactInfo?.email) {
    const lines: string[] = [];
    if (contactInfo.name) lines.push(`Visitor's name: ${contactInfo.name}`);
    if (contactInfo.email)
      lines.push(
        `Visitor's email: ${contactInfo.email} (already collected — no need to ask again)`,
      );

    const header =
      language === "es"
        ? "INFORMACIÓN DEL VISITANTE (usa el nombre naturalmente en tus respuestas, no vuelvas a preguntar lo que ya tienes):"
        : "VISITOR INFO (use the name naturally in your responses, do not ask again for info you already have):";

    parts.push(`${header}\n${lines.join("\n")}`);
  }

  return parts.join("\n\n---\n\n");
}
