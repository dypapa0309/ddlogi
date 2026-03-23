(function () {
  const STORAGE_KEY = "ddlogiLeadSmsPayload";
  const PHONE = "01075416143";
  const SERVICE_TYPE = document.body?.dataset?.leadclearService || "small_move";
  const PAGE_PATH = document.body?.dataset?.leadclearPage || window.location.pathname;

  function buildSmsHref(phone, text) {
    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
    const separator = isAppleMobile ? "&" : "?";
    return `sms:${phone}${separator}body=${encodeURIComponent(String(text || ""))}`;
  }

  function openSms(message) {
    const text = String(message || "").trim();
    if (!text) return false;

    try {
      window.location.href = buildSmsHref(PHONE, text);
      return true;
    } catch (err) {
      console.warn("leadclear sms open failed:", err);
      return false;
    }
  }

  function loadPayload() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function bindRetry(message) {
    const retryBtn = document.getElementById("leadclearOpenSmsBtn");
    const statusEl = document.getElementById("leadclearStatus");
    if (!retryBtn) return;

    retryBtn.addEventListener("click", function () {
      const ok = openSms(message);
      if (!ok && statusEl) {
        statusEl.textContent = "문자 앱을 열지 못했습니다. 01075416143 번호로 복사된 내용을 직접 붙여넣어 보내주세요.";
      }
    });
  }

  function trackLeadclearPage() {
    if (typeof window.gtag === "function") {
      window.gtag("event", "leadclear_page_view", {
        event_category: "conversion",
        event_label: PAGE_PATH,
        service_type: SERVICE_TYPE,
      });
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "leadclear_page_view",
        service_type: SERVICE_TYPE,
        page_path: PAGE_PATH,
      });
    }
  }

  const payload = loadPayload();
  bindRetry(payload);
  trackLeadclearPage();

  if (payload) {
    window.setTimeout(function () {
      openSms(payload);
    }, 250);
  }
})();
