import widgetStyles from "./styles.css?inline";

interface ServerConfig {
  primaryColor: string;
  accentColor: string;
  companyName: string;
  greeting: { en: string; es: string };
  quickReplies: { en: string[]; es: string[] };
}

interface WidgetConfig {
  apiKey: string;
  apiBaseUrl: string;
  language: "en" | "es";
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

(function () {
  const scriptTag = document.currentScript as HTMLScriptElement;
  if (!scriptTag) return;

  const apiKey = scriptTag.dataset.apiKey || "";

  const config: WidgetConfig = {
    apiKey,
    apiBaseUrl: new URL(scriptTag.src).origin,
    language:
      scriptTag.dataset.language === "es"
        ? "es"
        : scriptTag.dataset.language === "auto"
          ? navigator.language.startsWith("es")
            ? "es"
            : "en"
          : "en",
  };

  // Session management — namespaced by API key
  const keyPrefix = apiKey.slice(0, 12);
  const SESSION_KEY = `chat_session_${keyPrefix}`;
  const CONV_KEY = `chat_conv_${keyPrefix}`;
  let sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sessionId);
  let conversationId: string | null = localStorage.getItem(CONV_KEY);

  const messages: Message[] = [];
  let isOpen = false;
  let isStreaming = false;
  let serverConfig: ServerConfig | null = null;

  // Create Shadow DOM
  const host = document.createElement("div");
  host.id = `chat-widget-${keyPrefix}`;
  const shadow = host.attachShadow({ mode: "closed" });
  document.body.appendChild(host);

  // Inject styles
  const style = document.createElement("style");
  style.textContent = widgetStyles;
  shadow.appendChild(style);

  // CSS variables (defaults, overridden when config loads)
  const varsStyle = document.createElement("style");
  varsStyle.textContent = `:host { --primary: #0A4A6E; --accent: #F59E1C; }`;
  shadow.appendChild(varsStyle);

  // Build UI with placeholders
  const container = document.createElement("div");
  container.innerHTML = `
    <button class="chat-bubble" aria-label="Open chat">
      <svg class="icon-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
    </button>
    <div class="chat-panel">
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-header-avatar">💬</div>
          <div class="chat-header-text">
            <h3 class="header-title">Chat</h3>
            <p>${config.language === "es" ? "En línea • Respuesta inmediata" : "Online • Instant reply"}</p>
          </div>
        </div>
        <button class="chat-header-close" aria-label="Close">✕</button>
      </div>
      <div class="chat-messages"></div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <div class="quick-replies"></div>
      <div class="chat-input-area">
        <input class="chat-input" placeholder="${config.language === "es" ? "Escribe tu mensaje..." : "Type your message..."}" maxlength="2000" />
        <button class="chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="powered-by">Powered by AI</div>
    </div>
  `;
  shadow.appendChild(container);

  // Elements
  const bubble = shadow.querySelector(".chat-bubble") as HTMLButtonElement;
  const panel = shadow.querySelector(".chat-panel") as HTMLDivElement;
  const closeBtn = shadow.querySelector(".chat-header-close") as HTMLButtonElement;
  const headerTitle = shadow.querySelector(".header-title") as HTMLHeadingElement;
  const messagesEl = shadow.querySelector(".chat-messages") as HTMLDivElement;
  const typingEl = shadow.querySelector(".typing-indicator") as HTMLDivElement;
  const quickRepliesEl = shadow.querySelector(".quick-replies") as HTMLDivElement;
  const input = shadow.querySelector(".chat-input") as HTMLInputElement;
  const sendBtn = shadow.querySelector(".chat-send") as HTMLButtonElement;

  // Load project config from server
  async function loadConfig() {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/v1/widget-config`, {
        headers: { "x-api-key": config.apiKey },
      });
      if (!res.ok) return;
      serverConfig = await res.json();
      if (serverConfig) {
        applyBranding(serverConfig);
      }
    } catch {
      // Widget still works with defaults if config fails
    }
  }

  function applyBranding(sc: ServerConfig) {
    varsStyle.textContent = `:host { --primary: ${sc.primaryColor}; --accent: ${sc.accentColor}; }`;
    headerTitle.textContent = sc.companyName;
  }

  function toggleChat() {
    isOpen = !isOpen;
    panel.classList.toggle("visible", isOpen);
    bubble.classList.toggle("open", isOpen);

    if (isOpen && messages.length === 0) {
      showGreeting();
      showQuickReplies();
    }
  }

  function showGreeting() {
    const greeting = serverConfig?.greeting?.[config.language]
      || (config.language === "es"
        ? "¡Hola! 👋 ¿En qué puedo ayudarte?"
        : "Hi! 👋 How can I help you?");
    appendMessage("assistant", greeting);
  }

  function showQuickReplies() {
    const replies = serverConfig?.quickReplies?.[config.language]
      || (config.language === "es"
        ? ["Precios", "Información"]
        : ["Pricing", "Info"]);
    quickRepliesEl.innerHTML = replies
      .map((r) => `<button class="quick-reply-btn">${r}</button>`)
      .join("");
    quickRepliesEl.querySelectorAll(".quick-reply-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = (btn as HTMLButtonElement).textContent || "";
        sendMessage(text);
        quickRepliesEl.innerHTML = "";
      });
    });
  }

  function appendMessage(role: "user" | "assistant", content: string) {
    messages.push({ role, content });
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = linkify(content);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function linkify(text: string): string {
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );
    text = text.replace(
      /(?<!["\(])(https?:\/\/[^\s<\)]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>',
    );
    text = text.replace(/\n/g, "<br>");
    return text;
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    appendMessage("user", text);
    input.value = "";
    isStreaming = true;
    sendBtn.disabled = true;
    typingEl.classList.add("visible");

    const assistantDiv = document.createElement("div");
    assistantDiv.className = "message assistant";
    messagesEl.appendChild(assistantDiv);

    let fullResponse = "";

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
        },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined,
          sessionId,
          language: config.language,
          pageUrl: window.location.href,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      typingEl.classList.remove("visible");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.text) {
              fullResponse += data.text;
              assistantDiv.innerHTML = linkify(fullResponse);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            if (data.conversationId) {
              conversationId = data.conversationId;
              localStorage.setItem(CONV_KEY, conversationId!);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      messages.push({ role: "assistant", content: fullResponse });
    } catch {
      typingEl.classList.remove("visible");
      const errMsg =
        config.language === "es"
          ? "Lo siento, hubo un error. Por favor intenta de nuevo."
          : "Sorry, there was an error. Please try again.";
      assistantDiv.textContent = errMsg;
      messages.push({ role: "assistant", content: errMsg });
    }

    isStreaming = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // Event listeners
  bubble.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);
  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  // Initialize: load project config
  loadConfig();
})();
