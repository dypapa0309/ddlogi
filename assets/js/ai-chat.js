(function () {
  const STORAGE_PREFIX = "ddlogiAiChat";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAdapter() {
    return window.DDLOGI_AI || null;
  }

  function getServiceType() {
    const adapter = getAdapter();
    if (adapter?.serviceType) return adapter.serviceType;
    return document.body?.dataset?.defaultService === "clean" ? "cleaning" : "small_move";
  }

  function storageKey(serviceType) {
    return `${STORAGE_PREFIX}:${serviceType}`;
  }

  function loadMessages(serviceType) {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey(serviceType)) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveMessages(serviceType, messages) {
    try {
      sessionStorage.setItem(storageKey(serviceType), JSON.stringify(messages));
    } catch (_) {}
  }

  function createDockButton(dock, adapterExists) {
    if (!dock || dock.querySelector(".quick-contact-dock__btn--ai")) return null;

    const btn = document.createElement(adapterExists ? "button" : "a");
    btn.className = "quick-contact-dock__btn quick-contact-dock__btn--ai";
    btn.setAttribute("aria-label", "AI 상담");
    if (!adapterExists) btn.href = "/calculator/?ai=1";
    btn.innerHTML = `
      <span class="quick-contact-dock__label">
        <span class="quick-contact-dock__icon">AI</span>
        <span class="quick-contact-dock__text">상담</span>
      </span>
    `;
    dock.appendChild(btn);
    return btn;
  }

  function createModal() {
    if ($("#aiChatModal")) return $("#aiChatModal");

    const modal = document.createElement("div");
    modal.className = "modal ai-chat-modal";
    modal.id = "aiChatModal";
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="modal-backdrop" data-ai-close></div>
      <div class="modal-panel ai-chat-panel">
        <div class="modal-head">
          <div>
            <div class="modal-title">AI 상담</div>
            <div class="sub">말로 설명하면 견적 칸을 채워드려요.</div>
          </div>
          <button class="modal-x" type="button" data-ai-close aria-label="닫기">×</button>
        </div>
        <div class="modal-body ai-chat-body">
          <div class="ai-chat-messages" id="aiChatMessages"></div>
        </div>
        <div class="ai-chat-suggestions" id="aiChatSuggestions"></div>
        <div class="modal-foot ai-chat-foot">
          <textarea id="aiChatInput" class="address-input ai-chat-input" rows="3" placeholder="예: 내일 오후 2시에 부평에서 화곡동으로 원룸이사예요. 냉장고, 세탁기 있어요."></textarea>
          <button type="button" class="wizard-btn" id="aiChatSendBtn">보내기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderMessages(messages) {
    const host = $("#aiChatMessages");
    if (!host) return;
    host.innerHTML = messages.map((message) => `
      <div class="ai-chat-msg ai-chat-msg--${message.role === "assistant" ? "assistant" : "user"}">
        <div class="ai-chat-bubble">${escapeHtml(message.content).replace(/\n/g, "<br />")}</div>
      </div>
    `).join("");
    host.scrollTop = host.scrollHeight;
  }

  function renderSuggestions(items) {
    const host = $("#aiChatSuggestions");
    if (!host) return;
    host.innerHTML = "";
    (items || []).slice(0, 3).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ai-chat-suggestion";
      button.textContent = item;
      button.addEventListener("click", () => {
        const input = $("#aiChatInput");
        if (!input) return;
        input.value = item;
        input.focus();
      });
      host.appendChild(button);
    });
  }

  function openModal() {
    const modal = createModal();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    const modal = $("#aiChatModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  async function sendMessage() {
    const adapter = getAdapter();
    if (!adapter) return;
    const input = $("#aiChatInput");
    const sendBtn = $("#aiChatSendBtn");
    if (!input || !sendBtn) return;

    const text = String(input.value || "").trim();
    if (!text) return;

    const serviceType = adapter.serviceType || getServiceType();
    const messages = loadMessages(serviceType);
    messages.push({ role: "user", content: text });
    saveMessages(serviceType, messages);
    renderMessages(messages);
    renderSuggestions([]);
    input.value = "";
    sendBtn.disabled = true;

    try {
      const response = await fetch("/.netlify/functions/aiQuoteChat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          messages,
          snapshot: adapter.getSnapshot ? adapter.getSnapshot() : {},
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "AI 상담 요청에 실패했습니다.");
      }

      if (data.updates && adapter.applyPatch) {
        await adapter.applyPatch(data.updates);
      }

      messages.push({
        role: "assistant",
        content: data.reply || "입력한 내용을 반영했어요. 필요한 항목이 있으면 이어서 말해주세요.",
      });
      saveMessages(serviceType, messages);
      renderMessages(messages);
      renderSuggestions(data.suggested_replies || []);
    } catch (error) {
      messages.push({ role: "assistant", content: `AI 상담 연결에 실패했어요. ${String(error.message || error)}` });
      saveMessages(serviceType, messages);
      renderMessages(messages);
    } finally {
      sendBtn.disabled = false;
    }
  }

  function boot() {
    const dock = $(".quick-contact-dock");
    if (!dock) return;

    const adapter = getAdapter();
    const btn = createDockButton(dock, !!adapter);
    if (!btn || !adapter) return;

    createModal();
    const serviceType = adapter.serviceType || getServiceType();
    const messages = loadMessages(serviceType);
    if (!messages.length) {
      const initial = [{
        role: "assistant",
        content: "말로 설명해주시면 견적 칸을 채워드릴게요. 예: 내일 오전 9시에 부평에서 화곡동으로 소형이사예요. 냉장고와 세탁기 있어요.",
      }];
      saveMessages(serviceType, initial);
      renderMessages(initial);
      renderSuggestions([
        "내일 오후 2시에 부평에서 화곡동으로 원룸이사예요.",
        "입주청소 24평이고 방 3개, 화장실 2개예요.",
        "용달로 냉장고 하나 옮기고 싶어요. 오늘 저녁 가능할까요?",
      ]);
    } else {
      renderMessages(messages);
    }

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
      $("#aiChatInput")?.focus();
    });

    $("#aiChatModal")?.addEventListener("click", (event) => {
      if (event.target.closest("[data-ai-close]")) closeModal();
    });

    $("#aiChatSendBtn")?.addEventListener("click", sendMessage);
    $("#aiChatInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    const shouldAutoOpen = new URLSearchParams(window.location.search).get("ai") === "1";
    if (shouldAutoOpen) {
      window.setTimeout(() => {
        openModal();
        $("#aiChatInput")?.focus();
      }, 300);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
