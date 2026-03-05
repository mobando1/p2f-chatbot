export interface KnowledgeBase {
  businessDescription: string;
  programs: { name: string; audience: string; description: string }[];
  pricing: { plan: string; price: string; perUnit: string; details: string }[];
  faqs: { q: string; a: string }[];
  bookingUrls: Record<string, string>;
  contactEmail: string;
  website: string;
  customRules: string;
}

export interface WidgetConfig {
  primaryColor: string;
  accentColor: string;
  greeting: { en: string; es: string };
  quickReplies: { en: string[]; es: string[] };
  headerTitle: string;
}

export interface ProjectConfig {
  name: string;
  apiKey: string;
  defaultLanguage: "en" | "es";
  knowledgeBase: KnowledgeBase;
  salesGoals: string[];
  widgetConfig: WidgetConfig;
}
