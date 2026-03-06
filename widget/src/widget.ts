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
  timestamp: number;
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
  const MESSAGES_KEY = `chat_msgs_${keyPrefix}`;
  let sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sessionId);
  let conversationId: string | null = localStorage.getItem(CONV_KEY);

  const messages: Message[] = [];
  let isOpen = false;
  let isStreaming = false;
  let serverConfig: ServerConfig | null = null;
  let unreadCount = 0;
  let currentAbortController: AbortController | null = null;

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

  // Build UI
  const container = document.createElement("div");
  container.innerHTML = `
    <button class="chat-bubble" aria-label="Open chat">
      <svg class="icon-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
      <span class="unread-badge" style="display:none"></span>
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
        <div class="chat-header-actions">
          <button class="chat-header-btn new-chat-btn" aria-label="${config.language === "es" ? "Nueva conversación" : "New conversation"}" title="${config.language === "es" ? "Nueva conversación" : "New conversation"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="chat-header-btn close-btn" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="chat-messages" role="log" aria-label="${config.language === "es" ? "Mensajes del chat" : "Chat messages"}" aria-live="polite"></div>
      <div class="typing-indicator" aria-label="${config.language === "es" ? "Escribiendo..." : "Typing..."}" role="status">
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
  const badgeEl = shadow.querySelector(".unread-badge") as HTMLSpanElement;
  const panel = shadow.querySelector(".chat-panel") as HTMLDivElement;
  const closeBtn = shadow.querySelector(".close-btn") as HTMLButtonElement;
  const newChatBtn = shadow.querySelector(".new-chat-btn") as HTMLButtonElement;
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

  // --- Message Persistence ---

  function saveMessages() {
    try {
      // Keep last 20 messages to stay within localStorage limits
      const toSave = messages.slice(-20);
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }

  function restoreMessages(): boolean {
    try {
      const stored = localStorage.getItem(MESSAGES_KEY);
      if (!stored) return false;
      const parsed: Message[] = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      // Rebuild messages array and DOM
      for (const msg of parsed) {
        messages.push(msg);
        renderRestoredMessage(msg);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return true;
    } catch {
      return false;
    }
  }

  /** Render a restored message (no animation, uses stored timestamp) */
  function renderRestoredMessage(msg: Message) {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${msg.role}`;

    const div = document.createElement("div");
    div.className = `message ${msg.role}`;
    renderContent(div, msg.content);

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(msg.timestamp);

    wrapper.appendChild(div);
    wrapper.appendChild(time);
    messagesEl.appendChild(wrapper);
  }

  // --- New Conversation ---

  function startNewConversation() {
    // Clear in-memory state
    messages.length = 0;
    conversationId = null;

    // Clear DOM
    messagesEl.innerHTML = "";
    quickRepliesEl.innerHTML = "";

    // Clear localStorage
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(CONV_KEY);

    // Show fresh greeting
    showGreeting();
    showQuickReplies();
  }

  // --- Chat Toggle ---

  function toggleChat() {
    isOpen = !isOpen;
    panel.classList.toggle("visible", isOpen);
    bubble.classList.toggle("open", isOpen);

    if (isOpen) {
      unreadCount = 0;
      updateBadge();
      input.focus();
      if (messages.length === 0) {
        // Try restoring previous conversation
        const restored = restoreMessages();
        if (!restored) {
          // No previous messages — show greeting for new visitor
          showGreeting();
          showQuickReplies();
        }
      }
    }
  }

  function updateBadge() {
    if (unreadCount > 0 && !isOpen) {
      badgeEl.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
      badgeEl.style.display = "flex";
    } else {
      badgeEl.style.display = "none";
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
    quickRepliesEl.innerHTML = "";
    replies.forEach((r) => {
      const btn = document.createElement("button");
      btn.className = "quick-reply-btn";
      btn.textContent = r;
      btn.addEventListener("click", () => {
        sendMessage(r);
        quickRepliesEl.innerHTML = "";
      });
      quickRepliesEl.appendChild(btn);
    });
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString(config.language === "es" ? "es" : "en", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function appendMessage(role: "user" | "assistant", content: string) {
    const ts = Date.now();
    messages.push({ role, content, timestamp: ts });
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${role}`;

    const div = document.createElement("div");
    div.className = `message ${role}`;
    renderContent(div, content);

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(ts);

    wrapper.appendChild(div);
    wrapper.appendChild(time);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!isOpen && role === "assistant") {
      unreadCount++;
      updateBadge();
    }

    saveMessages();
    return div;
  }

  /** Safely render text with links using DOM API (prevents XSS) */
  function renderContent(container: HTMLElement, text: string) {
    container.innerHTML = "";
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) container.appendChild(document.createElement("br"));
      renderLineWithLinks(container, line);
    });
  }

  function renderLineWithLinks(container: HTMLElement, line: string) {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/[^\s<\)]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
      }
      const a = document.createElement("a");
      a.target = "_blank";
      a.rel = "noopener";
      if (match[1] && match[2]) {
        a.href = match[2];
        a.textContent = match[1];
      } else {
        a.href = match[3];
        a.textContent = match[3];
      }
      container.appendChild(a);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      container.appendChild(document.createTextNode(line.slice(lastIndex)));
    }
  }

  function getErrorMessage(status: number): string {
    if (config.language === "es") {
      if (status === 429) return "Demasiados mensajes. Espera un momento e intenta de nuevo.";
      if (status === 401 || status === 403) return "Error de autenticación. Verifica la configuración.";
      return "Lo siento, hubo un error. Por favor intenta de nuevo.";
    }
    if (status === 429) return "Too many messages. Please wait a moment and try again.";
    if (status === 401 || status === 403) return "Authentication error. Please check configuration.";
    return "Sorry, there was an error. Please try again.";
  }

  let lastFailedMessage: string | null = null;

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    lastFailedMessage = null;
    appendMessage("user", text);
    input.value = "";
    isStreaming = true;
    sendBtn.disabled = true;
    typingEl.classList.add("visible");

    const assistantDiv = document.createElement("div");
    assistantDiv.className = "message assistant";
    const wrapper = document.createElement("div");
    wrapper.className = "message-wrapper assistant";
    wrapper.appendChild(assistantDiv);
    messagesEl.appendChild(wrapper);

    let fullResponse = "";

    currentAbortController = new AbortController();

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
        signal: currentAbortController.signal,
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
              renderContent(assistantDiv, fullResponse);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            if (data.conversationId) {
              conversationId = data.conversationId;
              localStorage.setItem(CONV_KEY, conversationId!);
            }
            if (data.message && !data.text) {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message) throw e;
          }
        }
      }

      if (fullResponse.trim()) {
        messages.push({ role: "assistant", content: fullResponse, timestamp: Date.now() });
        const time = document.createElement("span");
        time.className = "message-time";
        time.textContent = formatTime(Date.now());
        wrapper.appendChild(time);
        saveMessages();
        if (!isOpen) {
          unreadCount++;
          updateBadge();
        }
      } else {
        const errMsg = getErrorMessage(0);
        assistantDiv.textContent = errMsg;
        messages.push({ role: "assistant", content: errMsg, timestamp: Date.now() });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        assistantDiv.remove();
        wrapper.remove();
      } else {
        console.error("[chat-widget] Error:", err);
        typingEl.classList.remove("visible");

        const status = err instanceof Error && err.message.startsWith("HTTP ")
          ? parseInt(err.message.slice(5))
          : 0;
        const errMsg = getErrorMessage(status);
        assistantDiv.textContent = errMsg;
        messages.push({ role: "assistant", content: errMsg, timestamp: Date.now() });

        lastFailedMessage = text;
        const retryBtn = document.createElement("button");
        retryBtn.className = "retry-btn";
        retryBtn.textContent = config.language === "es" ? "Reintentar" : "Retry";
        retryBtn.addEventListener("click", () => {
          wrapper.remove();
          messages.pop();
          if (lastFailedMessage) sendMessage(lastFailedMessage);
        });
        wrapper.appendChild(retryBtn);
      }
    }

    currentAbortController = null;
    isStreaming = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // Event listeners
  bubble.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);
  newChatBtn.addEventListener("click", startNewConversation);
  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  // Abort in-flight requests on page unload
  window.addEventListener("beforeunload", () => {
    currentAbortController?.abort();
  });

  // Initialize: load project config
  loadConfig();
})();
