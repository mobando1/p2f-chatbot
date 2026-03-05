import type { ProjectConfig } from "./types.js";

export const p2fProject: ProjectConfig = {
  name: "Passport to Fluency",
  apiKey: "pk_p2f_live_001",
  defaultLanguage: "en",
  salesGoals: [
    "Guide the visitor to book a FREE trial class (primary goal)",
    "Determine if they need Spanish or English, and if it's for an adult or child",
    "Share the correct booking link based on their needs",
  ],
  widgetConfig: {
    primaryColor: "#0A4A6E",
    accentColor: "#F59E1C",
    headerTitle: "Passport to Fluency",
    greeting: {
      en: "Hi! 👋 I'm here to help you start your language learning journey. Ask me anything!",
      es: "¡Hola! 👋 Estoy aquí para ayudarte a comenzar tu aventura de aprender idiomas. ¡Pregúntame lo que quieras!",
    },
    quickReplies: {
      en: ["Pricing", "Free trial class", "Programs", "How does it work?"],
      es: ["Precios", "Clase gratuita", "Programas", "¿Cómo funciona?"],
    },
  },
  knowledgeBase: {
    businessDescription:
      "Passport to Fluency offers personalized, 1-on-1 online language classes with native instructors. We teach Spanish to English speakers and English to Spanish speakers. Classes are 100% virtual, available 24/7 with flexible scheduling.",
    programs: [
      {
        name: "Spanish for Adults",
        audience: "Adults (18+)",
        description:
          "Private 1-on-1 Spanish lessons with native Latin American instructors. 40-minute sessions focused on conversation, listening, and practical fluency. Personalized to your goals — travel, career, family connections.",
      },
      {
        name: "Spanish for Children",
        audience: "Children ages 5-17",
        description:
          "Fun, interactive Spanish sessions with specialized instructors trained in child education. 40-minute sessions using games, songs, and interactive activities.",
      },
      {
        name: "English for Adults",
        audience: "Adultos hispanohablantes",
        description:
          "Clases privadas 1-a-1 de inglés con instructores nativos americanos. Sesiones de 40 minutos enfocadas en conversación y fluidez práctica.",
      },
      {
        name: "English for Children",
        audience: "Niños de 5-17 años",
        description:
          "Sesiones interactivas de inglés diseñadas para niños. 40 minutos con actividades apropiadas para su edad.",
      },
      {
        name: "Business Programs",
        audience: "Companies and corporate teams",
        description:
          "Corporate language training programs. Customized for businesses — group or individual. Industry-specific vocabulary and professional communication.",
      },
    ],
    pricing: [
      {
        plan: "Starter",
        price: "$119.96/month",
        perUnit: "$29.99/class",
        details: "1 class/week (4/month). Perfect for steady progress.",
      },
      {
        plan: "Popular (MOST POPULAR)",
        price: "$219.99/month",
        perUnit: "$27.50/class",
        details: "2 classes/week (8/month). Best for fast improvement.",
      },
      {
        plan: "Intensive",
        price: "$299.99/month",
        perUnit: "$24.99/class",
        details: "3 classes/week (12/month). For serious learners who want results fast.",
      },
    ],
    faqs: [
      { q: "How long are classes?", a: "40 minutes — optimal for focused language learning." },
      { q: "Are there contracts?", a: "No contracts. Cancel anytime." },
      { q: "What do I need?", a: "Just a computer or tablet with internet, camera, and microphone. 100% online." },
      { q: "Can I change my schedule?", a: "Yes! Scheduling is completely flexible, available 24/7." },
      { q: "Are instructors native speakers?", a: "Yes! Spanish instructors are native Latin American speakers. English instructors are native American English speakers." },
      { q: "Is the free trial really free?", a: "Yes, 100% free. No credit card required. A full 40-minute class." },
    ],
    bookingUrls: {
      "Adults learning Spanish": "https://api.leadconnectorhq.com/widget/booking/g27wbcMQU9YvigMrJfVK",
      "Adults learning English": "https://api.leadconnectorhq.com/widget/booking/Z5fJpM9ktwCxfpHAPJRh",
      "Children learning Spanish": "https://api.leadconnectorhq.com/widget/booking/DplznTj4YrOGaYJ12ufO",
      "Children learning English": "https://api.leadconnectorhq.com/widget/booking/dYj2Xhmgf3w26n0Mrwqw",
    },
    contactEmail: "info@passporttofluency.com",
    website: "https://passporttofluency.com",
    customRules:
      "When a visitor seems ready to book, determine if they want Spanish or English, and if it's for an adult or child, then share the specific booking link. The free trial is 40 minutes, no credit card required. For business inquiries, direct them to email info@passporttofluency.com for custom corporate solutions.",
  },
};
