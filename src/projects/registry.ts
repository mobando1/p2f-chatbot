import type { ProjectConfig } from "./types.js";
import { p2fProject } from "./p2f.js";

// Register all projects here. To add a new project:
// 1. Create a new file in src/projects/ (e.g., my-client.ts)
// 2. Export a ProjectConfig object
// 3. Add it to this array
const allProjects: ProjectConfig[] = [
  p2fProject,
];

// Index by API key for fast lookup
const projectsByApiKey = new Map<string, ProjectConfig>();
for (const project of allProjects) {
  projectsByApiKey.set(project.apiKey, project);
}

export function getProjectByApiKey(apiKey: string): ProjectConfig | undefined {
  return projectsByApiKey.get(apiKey);
}

export function getAllProjects(): ProjectConfig[] {
  return allProjects;
}
