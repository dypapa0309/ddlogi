(() => {
  "use strict";

  // ✅ 전체 가격 배율 (운영 중 조정)
  const PRICE_MULTIPLIER = 1;

  /* =========================
     ✅ 청소 옵션 가격 (추가)
     - 기준: 간단 30,000 / 집중 60,000
     - 출발/도착 각각 체크된 횟수만큼 합산
  ========================= */
  const CLEANING_PRICE = {
    light: 30000,
    deep: 60000,
  };

  /* =========================
     Supabase client (optional)
  ========================= */
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

  /* =========================
     확정 슬롯 조회/반영 (optional)
  ========================= */
  async function fetchConfirmedSlots(dateStr) {
    if (!supabase || !dateStr) return new Set();
    const { data, error } = await supabase
      .from("confirmed_slots")
      .select("time_slot")
      .eq("date", dateStr)
      .eq("status", "confirmed");

    if (error) {
      console.error("fetchConfirmedSlots error:", error);
      return new Set();
    }
    return new Set((data || []).map((x) => String(x.time_slot)));
  }

  // ✅ FIX: 마감 처리 시 "체크 해제 + state.timeSlot도 같이 비우기"
  function setTimeSlotDisabled(slotValue, disabled) {
    const sel = `input[name="timeSlot"][value="${CSS.escape(String(slotValue))}"]`;
    const el = document.querySelector(sel);
    if (!el) return;

    el.disabled = !!disabled;

    const label = el.closest("label");
    if (!label) return;

    const span = label.querySelector("span");
    if (!span) return;

    const baseText =
      span.getAttribute("data-base-text") ||
      span.textContent.replace(" (마감)", "").trim();

    span.setAttribute("data-base-text", baseText);
    span.textContent = disabled ? `${baseText} (마감)` : baseText;

    if (disabled && el.checked) {
      el.checked = false;
      if (state.timeSlot === String(slotValue)) state.timeSlot = "";
    }
  }

  /* =========================
     가격 테이블
  ========================= */
  const VEHICLE_MAP = {
    "1톤 카고": "truck",
    "1톤 저상탑": "van",
    "1톤 카고+저상탑": "lorry",
  };

  const BASE_PRICE = { truck: 50000, van: 50000, lorry: 90000 };
  const PER_KM_PRICE = { truck: 1550, van: 1550, lorry: 1550 };

  const FURNITURE_PRICE = {
    "전자레인지": { label: "전자레인지", price: 1500 },
    "공기청정기": { label: "공기청정기", price: 3000 },
    "청소기": { label: "청소기", price: 2000 },
    "TV/모니터": { label: "TV/모니터", price: 5000 },
    "정수기(이동만)": { label: "정수기(이동만)", price: 3000 },
    "세탁기(12kg이하)": { label: "세탁기(12kg 이하)", price: 10000 },
    "건조기(12kg이하)": { label: "건조기(12kg 이하)", price: 10000 },
    "냉장고(380L이하)": { label: "냉장고(380L 이하)", price: 10000 },

    "의자": { label: "의자", price: 3000 },
    "행거": { label: "행거", price: 3000 },
    "협탁/사이드테이블(소형)": { label: "협탁/사이드테이블(소형)", price: 3000 },
    "화장대(소형)": { label: "화장대(소형)", price: 5000 },
    "책상/테이블(일반)": { label: "책상/테이블(일반)", price: 5000 },
    "서랍장(3~5단)": { label: "서랍장(3~5단)", price: 5000 },
    "책장(일반)": { label: "책장(일반)", price: 10000 },
    "수납장/TV장(일반)": { label: "수납장/TV장(일반)", price: 10000 },
    "소파(2~3인)": { label: "소파(2~3인)", price: 10000 },
    "소파(4인이상)": { label: "소파(4인 이상)", price: 15000 },
    "침대매트리스(킹제외)": { label: "침대 매트리스(킹 제외)", price: 10000 },
    "침대프레임(분해/조립)": { label: "침대프레임분해조립", price: 30000 },
  };

  const LOAD_MAP_GENERAL = {
    1: { label: "1~5개", price: 10000 },
    2: { label: "6~10개", price: 20000 },
    3: { label: "11~15개", price: 30000 },
    4: { label: "16~20개", price: 40000 },
  };

  const LOAD_MAP_HALF = {
    1: { label: "1~5개", price: 20000 },
    2: { label: "6~10개", price: 35000 },
    3: { label: "11~15개", price: 50000 },
    4: { label: "16~20개", price: 65000 },
  };

  function toNumberSafe(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function getLoadMap(moveType) {
    return moveType === "half" ? LOAD_MAP_HALF : LOAD_MAP_GENERAL;
  }

  function moveTypeLabel(moveType, storageBase, storageDays) {
    if (moveType === "storage") {
      const base = storageBase === "half" ? "반포장" : "일반";
      const days = Math.max(1, parseInt(String(storageDays || 1), 10) || 1);
      return `보관이사 (보관-${base}, ${days}일 / 보관료 2만원×일수 옵션)`;
    }
    return moveType === "half" ? "반포장 이사" : "일반이사";
  }

  function formatTimeSlotKR(v) {
    const s = String(v || "");
    if (!s) return "미선택";
    const hour = toNumberSafe(s, NaN);
    if (!Number.isFinite(hour)) return "미선택";
    if (hour === 12) return "오후 12시";
    if (hour >= 13) return `오후 ${hour - 12}시`;
    return `오전 ${hour}시`;
  }

  function sumQtyMaps(...maps) {
    const out = {};
    maps.forEach((m) => {
      Object.entries(m || {}).forEach(([k, v]) => {
        const q = Math.max(0, Number(v) || 0);
        out[k] = (out[k] || 0) + q;
      });
    });
    return out;
  }

  function getSelectedQtyLabel(qtyMap = {}) {
    const labels = [];
    Object.entries(qtyMap).forEach(([k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      if (q > 0) labels.push(`${FURNITURE_PRICE[k]?.label || k}×${q}`);
    });
    return labels.length ? labels.join(", ") : "없음";
  }

  /* =========================
     ✅ 보관이사/사다리차 규칙
  ========================= */
  const STORAGE_PER_DAY = 20000;

  function ladderPriceByFloor(floor) {
    const f = Math.max(1, parseInt(String(floor || 1), 10) || 1);
    if (f <= 6) return 100000;
    if (f <= 12) return 120000;
    return 140000;
  }

  /* =========================
     ✅ 계단(엘베 없음) 요금 규칙
  ========================= */
  const STAIR_TIER_1 = 7000;   // 2~3층
  const STAIR_TIER_2 = 12000;  // 4~5층
  const STAIR_TIER_3 = 18000;  // 6~7층
  const STAIR_TIER_4 = 25000;  // 8층+

  function stairExtraByFloor(floor) {
    const f = Math.max(1, parseInt(String(floor || 1), 10) || 1);
    if (f <= 1) return 0;
    if (f <= 3) return STAIR_TIER_1;
    if (f <= 5) return STAIR_TIER_2;
    if (f <= 7) return STAIR_TIER_3;
    return STAIR_TIER_4;
  }

  /* =========================
     ✅ 청소 옵션 계산 헬퍼 (추가)
  ========================= */
  function getCleaningInfo() {
    if (!state.cleaningEnabled) {
      return { enabled: false, cost: 0, label: "미사용", unit: 0, count: 0 };
    }

    const type = state.cleaningType === "deep" ? "deep" : "light";
    const typeLabel = type === "deep" ? "집중 청소" : "간단 청소";
    const unit = toNumberSafe(CLEANING_PRICE[type], 0);

    const count = (state.cleaningFrom ? 1 : 0) + (state.cleaningTo ? 1 : 0);
    const cost = unit * count;

    const parts = [];
    if (state.cleaningFrom) parts.push("출발지");
    if (state.cleaningTo) parts.push("도착지");
    const scopeLabel = parts.length ? parts.join(" / ") : "범위 미선택";

    const label = `${typeLabel} (${scopeLabel})`;

    return { enabled: true, cost, label, unit, count, type, typeLabel, scopeLabel };
  }

  /* =========================
     상태
  ========================= */
  const state = {
    vehicle: null,
    distance: 0,

    hasWaypoint: false,
    waypointAddress: "",

    moveType: "general",
    storageBase: "general",
    storageDays: 1,

    moveDate: "",
    timeSlot: "",

    itemsNote: "",
    throwNote: "",

    noFrom: false,
    fromFloor: 1,
    noTo: false,
    toFloor: 1,

    ladderFromEnabled: false,
    ladderToEnabled: false,
    ladderFromFloor: 6,
    ladderToFloor: 6,

    night: false,
    cantCarryFrom: false,
    cantCarryTo: false,
    helperFrom: false,
    helperTo: false,

    // ✅ 청소 옵션 (추가)
    cleaningEnabled: false,
    cleaningFrom: false,
    cleaningTo: false,
    cleaningType: "light",

    ride: 0,
    load: null,

    itemQty: {},

    throwEnabled: false,
    workFrom: false,
    workTo: false,
    throwFromQty: {},
    throwToQty: {},
  };

  /* =========================
     DOM
  ========================= */
  const priceEl = document.getElementById("price");
  const summaryEl = document.getElementById("summary");
  const stickyBarEl = document.getElementById("stickyPriceBar");
  const stickyPriceEl = document.getElementById("stickyPrice");
  const quoteSectionEl = document.getElementById("quoteSection"); // (유지: 참조 없음)

  const distanceText = document.getElementById("distanceText");
  const startAddressInput = document.getElementById("startAddress");
  const endAddressInput = document.getElementById("endAddress");
  const calcDistanceBtn = document.getElementById("calcDistance");

  const hasWaypointEl = document.getElementById("hasWaypoint");
  const waypointWrapEl = document.getElementById("waypointWrap");
  const waypointAddressInput = document.getElementById("waypointAddress");

  const moveDateEl = document.getElementById("moveDate");
  const timeSlotEls = document.querySelectorAll('input[name="timeSlot"]');

  const noFromEl = document.getElementById("noFrom");
  const noToEl = document.getElementById("noTo");
  const fromFloorEl = document.getElementById("fromFloor");
  const toFloorEl = document.getElementById("toFloor");

  const nightEl = document.getElementById("night");
  const cantCarryFromEl = document.getElementById("cantCarryFrom");
  const cantCarryToEl = document.getElementById("cantCarryTo");
  const helperFromEl = document.getElementById("helperFrom");
  const helperToEl = document.getElementById("helperTo");
  const rideEl = document.getElementById("ride");

  // ✅ 청소 DOM (추가)
  const cleaningToggleEl = document.getElementById("cleaningToggle");
  const cleaningBodyEl = document.getElementById("cleaningBody");
  const cleaningFromEl = document.getElementById("cleaningFrom");
  const cleaningToEl = document.getElementById("cleaningTo");
  const cleaningTypeEls = document.querySelectorAll('input[name="cleaningType"]');

  const channelInquiryBtn = document.getElementById("channelInquiry");

  const itemsNoteEl = document.getElementById("itemsNote");
  const throwNoteEl = document.getElementById("throwNote");

  const itemsNotePreviewEl = document.getElementById("itemsNotePreview");
  const throwNotePreviewEl = document.getElementById("throwNotePreview");

  const storageBodyEl = document.getElementById("storageBody");
  const storageDaysEl = document.getElementById("storageDays");
  const storageBaseEls = document.querySelectorAll('input[name="storageBase"]');

  const ladderFromEnabledEl = document.getElementById("ladderFromEnabled");
  const ladderToEnabledEl = document.getElementById("ladderToEnabled");
  const ladderFromBodyEl = document.getElementById("ladderFromBody");
  const ladderToBodyEl = document.getElementById("ladderToBody");
  const ladderFromFloorEl = document.getElementById("ladderFromFloor");
  const ladderToFloorEl = document.getElementById("ladderToFloor");

  const itemsModalEl = document.getElementById("itemsModal");
  const openItemsModalBtn = document.getElementById("openItemsModalBtn");
  const itemsMiniSummaryEl = document.getElementById("itemsMiniSummary");

  const throwModalEl = document.getElementById("throwModal");
  const openThrowModalBtn = document.getElementById("openThrowModalBtn");
  const throwMiniWrapEl = document.getElementById("throwMiniWrap");
  const throwMiniSummaryEl = document.getElementById("throwMiniSummary");

  const throwToggleEl = document.getElementById("throwToggle");
  const workFromEl = document.getElementById("workFrom");
  const workToEl = document.getElementById("workTo");

  const wizardProgressBar = document.getElementById("wizardProgressBar");
  const wizardStepText = document.getElementById("wizardStepText");
  const wizardPrev = document.getElementById("wizardPrev");
  const wizardNext = document.getElementById("wizardNext");
  const heroStartBtn = document.getElementById("heroStartBtn");

  // ✅ 시즌 팝업 DOM
  const seasonPopupEl = document.getElementById("seasonPopup");
  const popupGoQuoteBtn = document.getElementById("popupGoQuote");
  const popupTodayEl = document.getElementById("popupToday");

  let geocoder = null;
  let lastPrice = 0;

  const TIME_SLOTS = ["7", "8", "9", "10", "11", "12", "13", "14", "15"];

  /* =========================
     ✅ 스크롤 잠금 (모달/팝업 공통)
     - iOS에서도 배경 스크롤 방지
  ========================= */
  let scrollLockCount = 0;
  let scrollLockY = 0;

  function lockBodyScroll() {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;

    scrollLockY = window.scrollY || window.pageYOffset || 0;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBodyScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount > 0) return;

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    window.scrollTo(0, scrollLockY);
  }

  /* =========================
     ✅ 포커스 트랩 (모달/팝업 접근성)
  ========================= */
  let lastFocusEl = null;
  let activeFocusTrap = null;

  function getFocusableElements(root) {
    if (!root) return [];
    const els = Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    // display:none 등 제외
    return els.filter((el) => el.offsetParent !== null || el.getClientRects().length);
  }

  function activateFocusTrap(containerEl) {
    if (!containerEl) return;
    if (!containerEl.hasAttribute("tabindex")) containerEl.setAttribute("tabindex", "-1");

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const focusables = getFocusableElements(containerEl);
      if (!focusables.length) {
        e.preventDefault();
        containerEl.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    containerEl.addEventListener("keydown", onKeyDown);
    activeFocusTrap = { containerEl, onKeyDown };

    const focusables = getFocusableElements(containerEl);
    const target = focusables[0] || containerEl;

    requestAnimationFrame(() => {
      try {
        target.focus({ preventScroll: true });
      } catch (_) {
        try { containerEl.focus({ preventScroll: true }); } catch (_) {}
      }
    });
  }

  function releaseFocusTrap() {
    if (!activeFocusTrap) return;
    const { containerEl, onKeyDown } = activeFocusTrap;
    containerEl.removeEventListener("keydown", onKeyDown);
    activeFocusTrap = null;
  }

  function restoreLastFocus() {
    if (!lastFocusEl) return;
    try { lastFocusEl.focus({ preventScroll: true }); } catch (_) {}
    lastFocusEl = null;
  }

  /* =========================
     ✅ 스티키바 높이 측정 → 상단 패딩/스티키 오프셋 안정화
     - CSS 변수 --stickybar-h 를 실제 높이로 갱신
  ========================= */
  function syncStickyBarHeightVar() {
    if (!stickyBarEl) return;
    const inner = stickyBarEl.querySelector(".sticky-inner") || stickyBarEl;
    const h = Math.ceil(inner.getBoundingClientRect().height || 0);
    if (h > 0) {
      document.documentElement.style.setProperty("--stickybar-h", `${h}px`);
    }
  }

  /* =========================
     ✅ 단계형 UI (Wizard)
  ========================= */
  const STEP_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let currentStepIndex = 0;

  function getStepEl(stepNo) {
    return document.querySelector(`.step-card[data-step="${stepNo}"]`);
  }

  function setActiveStep(stepNo) {
    document.querySelectorAll(".step-card").forEach((el) => el.classList.remove("is-active"));
    const el = getStepEl(stepNo);
    if (el) el.classList.add("is-active");

    window.scrollTo({ top: 0, behavior: "smooth" });

    const idx = STEP_ORDER.indexOf(stepNo);
    if (idx >= 0) {
      currentStepIndex = idx;
      const cur = idx + 1;
      const total = STEP_ORDER.length;

      if (wizardStepText) wizardStepText.textContent = `${cur} / ${total}`;
      if (wizardProgressBar) {
        const pct = total <= 1 ? 100 : (idx / (total - 1)) * 100;
        wizardProgressBar.style.width = `${pct}%`;
      }
    }
    syncWizardButtons();
  }

  function canGoNext(stepNo) {
    if (stepNo === 1) return !!state.vehicle;
    if (stepNo === 2) return Number(state.distance) > 0;
    if (stepNo === 3) return !!state.moveDate && !!state.timeSlot;
    return true;
  }

  function syncWizardButtons() {
    if (!wizardPrev || !wizardNext) return;

    wizardPrev.disabled = currentStepIndex <= 0;

    if (currentStepIndex >= STEP_ORDER.length - 1) {
      wizardNext.disabled = true;
      wizardNext.textContent = "완료";
      return;
    }

    const stepNo = STEP_ORDER[currentStepIndex];
    wizardNext.textContent = "다음";
    wizardNext.disabled = !canGoNext(stepNo);
  }

  function gotoNext() {
    const stepNo = STEP_ORDER[currentStepIndex];
    if (!canGoNext(stepNo)) return;
    const nextIdx = Math.min(STEP_ORDER.length - 1, currentStepIndex + 1);
    setActiveStep(STEP_ORDER[nextIdx]);
  }

  function gotoPrev() {
    const prevIdx = Math.max(0, currentStepIndex - 1);
    setActiveStep(STEP_ORDER[prevIdx]);
  }

  /* =========================
     Modal helpers
  ========================= */
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;

    lastFocusEl = document.activeElement;

    el.setAttribute("aria-hidden", "false");
    lockBodyScroll();

    const panel = el.querySelector(".modal-panel") || el;
    activateFocusTrap(panel);
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.setAttribute("aria-hidden", "true");

    releaseFocusTrap();
    unlockBodyScroll();
    restoreLastFocus();

    syncMiniSummaries();
    calc();
    syncWizardButtons();
  }

  function bindModalClosers() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-close]");
      if (!btn) return;
      const id = btn.getAttribute("data-close");
      if (id) closeModal(id);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (itemsModalEl && itemsModalEl.getAttribute("aria-hidden") === "false") closeModal("itemsModal");
      else if (throwModalEl && throwModalEl.getAttribute("aria-hidden") === "false") closeModal("throwModal");
      else if (seasonPopupEl && seasonPopupEl.getAttribute("aria-hidden") === "false") hideSeasonPopup(true);
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function syncMiniSummaries() {
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);

    if (itemsMiniSummaryEl) itemsMiniSummaryEl.textContent = getSelectedQtyLabel(mergedAllItems);

    const throwLabel = getSelectedQtyLabel(mergedThrow);
    if (throwMiniSummaryEl) throwMiniSummaryEl.textContent = throwLabel;

    if (itemsNotePreviewEl) {
      itemsNotePreviewEl.textContent = `기타사항: ${state.itemsNote ? state.itemsNote : "없음"}`;
    }
    if (throwNotePreviewEl) {
      const txt = state.throwEnabled && state.throwNote ? state.throwNote : "";
      throwNotePreviewEl.textContent = `기타사항: ${txt ? txt : "없음"}`;
    }
  }

  /* =========================
     ChannelTalk
  ========================= */
  function bootChannelIO() {
    const pluginKey = CFG.channelPluginKey;
    if (!pluginKey) return;
    if (!window.ChannelIO) return;

    try {
      window.ChannelIO("boot", { pluginKey, hideChannelButtonOnBoot: false });
    } catch (e) {
      console.error("[ChannelIO] boot 실패:", e);
    }
  }

  function waitForChannelIO(timeoutMs = 6000) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (window.ChannelIO) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function copyToClipboardSafe(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {}

    return false;
  }

  /* =========================
     ✅ 날짜 피커 유틸
  ========================= */
  function openDatePickerSafe(inputEl) {
    if (!inputEl) return;
    inputEl.focus();

    if (typeof inputEl.showPicker === "function") {
      try { inputEl.showPicker(); return; } catch (_) {}
    }
    try { inputEl.click(); } catch (_) {}
  }

  /* =========================
     ✅ 시즌 팝업 (오늘은 그만 보기)
  ========================= */
  const POPUP_HIDE_KEY = "dd_season_popup_hide_date";

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function showSeasonPopup() {
    if (!seasonPopupEl) return;

    lastFocusEl = document.activeElement;

    seasonPopupEl.setAttribute("aria-hidden", "false");
    lockBodyScroll();

    const card = seasonPopupEl.querySelector(".dd-popup__card") || seasonPopupEl;
    activateFocusTrap(card);
  }

  function hideSeasonPopup(keepTodaySetting = false) {
    if (!seasonPopupEl) return;

    seasonPopupEl.setAttribute("aria-hidden", "true");

    if (!keepTodaySetting && popupTodayEl?.checked) {
      try { localStorage.setItem(POPUP_HIDE_KEY, todayKey()); } catch (_) {}
    }

    releaseFocusTrap();
    unlockBodyScroll();
    restoreLastFocus();

    calc();
  }

  function initSeasonPopup() {
    if (!seasonPopupEl) return;

    let hideDate = "";
    try { hideDate = localStorage.getItem(POPUP_HIDE_KEY) || ""; } catch (_) {}

    if (hideDate !== todayKey()) {
      showSeasonPopup();
    }

    seasonPopupEl.addEventListener("click", (e) => {
      const close = e.target.closest("[data-popup-close]");
      if (close) {
        e.preventDefault();
        hideSeasonPopup(false);
      }
    });

    if (popupGoQuoteBtn) {
      popupGoQuoteBtn.addEventListener("click", () => {
        hideSeasonPopup(true);
        if (heroStartBtn) heroStartBtn.click();
        else setActiveStep(1);
      });
    }
  }

  /* =========================
     초기화
  ========================= */
  window.addEventListener("DOMContentLoaded", async () => {
    bindModalClosers();
    initSeasonPopup();

    // ✅ 스티키바는 항상 표시
    if (stickyBarEl) {
      stickyBarEl.style.display = "block";
      stickyBarEl.setAttribute("aria-hidden", "false");
    }
    syncStickyBarHeightVar();

    // resize 때 높이 재측정(반응형 줄바꿈 대비)
    window.addEventListener("resize", () => {
      syncStickyBarHeightVar();
    });

    // ✅ itemsNote
    if (itemsNoteEl) {
      itemsNoteEl.addEventListener("input", (e) => {
        state.itemsNote = String(e.target.value || "").trim();
        syncMiniSummaries();
        calc();
      });
      state.itemsNote = String(itemsNoteEl.value || "").trim();
    }

    // ✅ throwNote
    if (throwNoteEl) {
      throwNoteEl.addEventListener("input", (e) => {
        state.throwNote = String(e.target.value || "").trim();
        syncMiniSummaries();
        calc();
      });
      state.throwNote = String(throwNoteEl.value || "").trim();
    }

    const ok = await waitForChannelIO(6000);
    if (ok) bootChannelIO();

    // ✅ 날짜: 칸 전체 클릭하면 달력 열기
    const dateWrapEl = document.querySelector(".date-wrap");
    if (dateWrapEl && moveDateEl) {
      dateWrapEl.addEventListener("click", (e) => {
        e.preventDefault();
        openDatePickerSafe(moveDateEl);
      });
      dateWrapEl.addEventListener("pointerup", (e) => {
        e.preventDefault();
        openDatePickerSafe(moveDateEl);
      });
    }

    // hero 표시
    const heroEl = getStepEl(0);
    if (heroEl) {
      document.querySelectorAll(".step-card").forEach((el) => el.classList.remove("is-active"));
      heroEl.classList.add("is-active");
      if (wizardPrev) wizardPrev.disabled = true;
      if (wizardNext) wizardNext.disabled = true;
    } else {
      setActiveStep(1);
    }

    if (heroStartBtn) heroStartBtn.addEventListener("click", () => setActiveStep(1));
    if (wizardPrev) wizardPrev.addEventListener("click", gotoPrev);
    if (wizardNext) wizardNext.addEventListener("click", gotoNext);

    // 차량: 첫 항목 자동 선택
    const firstVehicle = document.querySelector(".vehicle");
    if (firstVehicle) {
      firstVehicle.classList.add("active");
      state.vehicle = firstVehicle.dataset.vehicle || null;
    }

    // 차량 선택
    document.querySelectorAll(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        document.querySelectorAll(".vehicle").forEach((x) => x.classList.remove("active"));
        v.classList.add("active");
        state.vehicle = v.dataset.vehicle || null;
        calc();
        syncWizardButtons();
      });
    });

    // ✅ 경유지 토글
    if (hasWaypointEl && waypointWrapEl) {
      const syncWaypointUI = () => {
        state.hasWaypoint = !!hasWaypointEl.checked;
        waypointWrapEl.style.display = state.hasWaypoint ? "block" : "none";
        calc();
        syncWizardButtons();
      };
      hasWaypointEl.addEventListener("change", syncWaypointUI);
      syncWaypointUI();
    }

    if (waypointAddressInput) {
      waypointAddressInput.addEventListener("input", (e) => {
        state.waypointAddress = String(e.target.value || "").trim();
      });
    }

    // moveType
    document.querySelectorAll('input[name="moveType"]').forEach((el) => {
      el.addEventListener("change", (e) => {
        state.moveType = e.target.value;
        if (storageBodyEl) storageBodyEl.hidden = state.moveType !== "storage";
        calc();
        syncMiniSummaries();
      });
      if (el.checked) state.moveType = el.value;
    });
    if (storageBodyEl) storageBodyEl.hidden = state.moveType !== "storage";

    // storageBase
    if (storageBaseEls?.length) {
      storageBaseEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.storageBase = e.target.value;
          calc();
        });
        if (el.checked) state.storageBase = el.value;
      });
    }

    // ✅ storageDays
    if (storageDaysEl) {
      const normalize = () => {
        const v = Math.max(1, parseInt(String(storageDaysEl.value || "1"), 10) || 1);
        storageDaysEl.value = String(v);
        state.storageDays = v;
      };
      storageDaysEl.addEventListener("input", () => { normalize(); calc(); });
      storageDaysEl.addEventListener("change", () => { normalize(); calc(); });
      normalize();
    }

    // 날짜 변경 → 마감 반영
    if (moveDateEl) {
      moveDateEl.addEventListener("change", async (e) => {
        state.moveDate = e.target.value || "";
        const confirmed = await fetchConfirmedSlots(state.moveDate);

        TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));

        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : "";

        calc();
        syncWizardButtons();
      });
    }

    // 시간 선택
    if (timeSlotEls?.length) {
      timeSlotEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.timeSlot = e.target.value || "";
          calc();
          syncWizardButtons();
        });
      });
    }

    // 계단/엘베
    if (noFromEl) noFromEl.addEventListener("change", (e) => { state.noFrom = e.target.checked; calc(); });
    if (noToEl) noToEl.addEventListener("change", (e) => { state.noTo = e.target.checked; calc(); });

    if (fromFloorEl) fromFloorEl.addEventListener("input", (e) => {
      state.fromFloor = Math.max(1, toNumberSafe(e.target.value, 1));
      calc();
    });
    if (toFloorEl) toFloorEl.addEventListener("input", (e) => {
      state.toFloor = Math.max(1, toNumberSafe(e.target.value, 1));
      calc();
    });

    // 직접 나르기 어려움 / 인부
    if (cantCarryFromEl) cantCarryFromEl.addEventListener("change", (e) => { state.cantCarryFrom = e.target.checked; calc(); });
    if (cantCarryToEl) cantCarryToEl.addEventListener("change", (e) => { state.cantCarryTo = e.target.checked; calc(); });
    if (helperFromEl) helperFromEl.addEventListener("change", (e) => { state.helperFrom = e.target.checked; calc(); });
    if (helperToEl) helperToEl.addEventListener("change", (e) => { state.helperTo = e.target.checked; calc(); });

    // 야간/주말, 동승
    if (nightEl) nightEl.addEventListener("change", (e) => { state.night = e.target.checked; calc(); });
    if (rideEl) rideEl.addEventListener("input", (e) => {
      state.ride = Math.max(0, toNumberSafe(e.target.value, 0));
      calc();
    });

    // ✅ 청소 옵션 (추가)
    if (cleaningToggleEl && cleaningBodyEl) {
      const syncCleaning = () => {
        state.cleaningEnabled = !!cleaningToggleEl.checked;
        cleaningBodyEl.hidden = !state.cleaningEnabled;
        calc();
      };
      cleaningToggleEl.addEventListener("change", syncCleaning);
      syncCleaning();
    }

    if (cleaningFromEl) cleaningFromEl.addEventListener("change", (e) => { state.cleaningFrom = e.target.checked; calc(); });
    if (cleaningToEl) cleaningToEl.addEventListener("change", (e) => { state.cleaningTo = e.target.checked; calc(); });

    if (cleaningTypeEls?.length) {
      cleaningTypeEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.cleaningType = e.target.value || "light";
          calc();
        });
        if (el.checked) state.cleaningType = el.value;
      });
    }

    // ladder toggle
    if (ladderFromEnabledEl) {
      ladderFromEnabledEl.addEventListener("change", () => {
        state.ladderFromEnabled = !!ladderFromEnabledEl.checked;
        if (ladderFromBodyEl) ladderFromBodyEl.hidden = !state.ladderFromEnabled;
        calc();
      });
      state.ladderFromEnabled = !!ladderFromEnabledEl.checked;
      if (ladderFromBodyEl) ladderFromBodyEl.hidden = !state.ladderFromEnabled;
    }

    if (ladderToEnabledEl) {
      ladderToEnabledEl.addEventListener("change", () => {
        state.ladderToEnabled = !!ladderToEnabledEl.checked;
        if (ladderToBodyEl) ladderToBodyEl.hidden = !state.ladderToEnabled;
        calc();
      });
      state.ladderToEnabled = !!ladderToEnabledEl.checked;
      if (ladderToBodyEl) ladderToBodyEl.hidden = !state.ladderToEnabled;
    }

    // ✅ ladder floor
    if (ladderFromFloorEl) {
      const normalize = () => {
        const v = Math.max(1, parseInt(String(ladderFromFloorEl.value || "1"), 10) || 1);
        ladderFromFloorEl.value = String(v);
        state.ladderFromFloor = v;
      };
      ladderFromFloorEl.addEventListener("input", () => { normalize(); calc(); });
      ladderFromFloorEl.addEventListener("change", () => { normalize(); calc(); });
      normalize();
    }

    if (ladderToFloorEl) {
      const normalize = () => {
        const v = Math.max(1, parseInt(String(ladderToFloorEl.value || "1"), 10) || 1);
        ladderToFloorEl.value = String(v);
        state.ladderToFloor = v;
      };
      ladderToFloorEl.addEventListener("input", () => { normalize(); calc(); });
      ladderToFloorEl.addEventListener("change", () => { normalize(); calc(); });
      normalize();
    }

    // 짐양
    document.querySelectorAll('input[name="load"]').forEach((el) => {
      el.addEventListener("change", (e) => {
        state.load = e.target.value;
        calc();
      });
      if (el.checked) state.load = el.value;
    });

    // items modal open
    if (openItemsModalBtn) {
      openItemsModalBtn.addEventListener("click", () => openModal("itemsModal"));
    }

    // throw toggle + modal open
    if (throwToggleEl && throwMiniWrapEl) {
      const syncThrow = () => {
        state.throwEnabled = !!throwToggleEl.checked;
        throwMiniWrapEl.style.display = state.throwEnabled ? "block" : "none";
        calc();
        syncMiniSummaries();
      };
      throwToggleEl.addEventListener("change", syncThrow);
      syncThrow();
    }
    if (openThrowModalBtn) {
      openThrowModalBtn.addEventListener("click", () => {
        if (!state.throwEnabled) return;
        openModal("throwModal");
      });
    }

    if (workFromEl) workFromEl.addEventListener("change", (e) => { state.workFrom = e.target.checked; calc(); });
    if (workToEl) workToEl.addEventListener("change", (e) => { state.workTo = e.target.checked; calc(); });

    /* =========================
       ✅ 스텝퍼 공통 처리
    ========================= */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".stepper-btn");
      if (!btn) return;

      const dir = Number(btn.getAttribute("data-dir") || "0");
      if (!dir) return;

      // 1) id 기반
      const targetId = btn.getAttribute("data-stepper");
      if (targetId) {
        const input = document.getElementById(targetId);
        if (!input) return;

        const min = input.min !== "" ? Number(input.min) : 0;
        const max = input.max !== "" ? Number(input.max) : Infinity;

        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // 2) itemQty
      const itemKey = btn.getAttribute("data-stepper-item");
      const loc = btn.getAttribute("data-stepper-loc");
      if (itemKey && !loc) {
        const input = document.querySelector(`.itemQty[data-item="${CSS.escape(itemKey)}"]`);
        if (!input) return;
        const min = input.min !== "" ? Number(input.min) : 0;
        const max = input.max !== "" ? Number(input.max) : Infinity;
        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));
        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // 3) throwQty
      if (loc && itemKey) {
        const input = document.querySelector(
          `.throwQty[data-loc="${CSS.escape(loc)}"][data-item="${CSS.escape(itemKey)}"]`
        );
        if (!input) return;
        const min = input.min !== "" ? Number(input.min) : 0;
        const max = input.max !== "" ? Number(input.max) : Infinity;
        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));
        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // 4) 일반 number input 자동
      const wrapper = btn.closest(".stepper") || btn.parentElement;
      if (!wrapper) return;
      const input = wrapper.querySelector('input[type="number"]');
      if (!input) return;

      const min = input.min !== "" ? Number(input.min) : 0;
      const max = input.max !== "" ? Number(input.max) : Infinity;
      const cur = Number(input.value || "0");
      const next = Math.min(max, Math.max(min, cur + dir));
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // itemQty input
    document.querySelectorAll(".itemQty").forEach((el) => {
      el.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-item");
        if (!key) return;
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        state.itemQty[key] = v;
        calc();
        syncMiniSummaries();
      });
      const key = el.getAttribute("data-item");
      if (key) state.itemQty[key] = Math.max(0, toNumberSafe(el.value, 0));
    });

    // throwQty input
    document.querySelectorAll(".throwQty").forEach((el) => {
      el.addEventListener("input", (e) => {
        const loc = e.target.getAttribute("data-loc");
        const key = e.target.getAttribute("data-item");
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        if (!loc || !key) return;
        if (loc === "from") state.throwFromQty[key] = v;
        if (loc === "to") state.throwToQty[key] = v;
        calc();
        syncMiniSummaries();
      });

      const loc = el.getAttribute("data-loc");
      const key = el.getAttribute("data-item");
      if (loc && key) {
        const v = Math.max(0, toNumberSafe(el.value, 0));
        if (loc === "from") state.throwFromQty[key] = v;
        if (loc === "to") state.throwToQty[key] = v;
      }
    });

    // 카카오 geocoder init
    if (typeof kakao !== "undefined" && kakao.maps && typeof kakao.maps.load === "function") {
      kakao.maps.load(() => {
        try {
          if (!kakao.maps.services) {
            console.error("카카오 services 미로드: sdk.js에 libraries=services 확인 필요");
            calc();
            return;
          }
          geocoder = new kakao.maps.services.Geocoder();
          calc();
        } catch (e) {
          console.error(e);
          calc();
        }
      });
    } else {
      console.error("카카오 SDK 로드 실패");
      calc();
    }

    // 날짜가 이미 선택돼있으면 마감 반영
    if (moveDateEl?.value) {
      state.moveDate = moveDateEl.value;
      const confirmed = await fetchConfirmedSlots(state.moveDate);
      TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));
      const checked = document.querySelector('input[name="timeSlot"]:checked');
      state.timeSlot = checked ? checked.value : "";
    }

    // ✅ 문의 버튼 (채널톡 + 클립보드)
    if (channelInquiryBtn) {
      channelInquiryBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const msg = buildInquiryMessage(lastPrice || 0);
        const copied = await copyToClipboardSafe(msg);

        // 채널톡 열기(가능하면)
        try {
          if (window.ChannelIO) {
            window.ChannelIO("showMessenger");
          }
        } catch (_) {}

        if (copied) {
          alert("견적 메시지를 복사했어요.\n채널톡에 붙여넣기만 하면 됩니다.");
        } else {
          alert("클립보드 복사에 실패했습니다.\n아래 메시지를 수동으로 복사해 주세요:\n\n" + msg);
        }
      });
    }

    syncMiniSummaries();
    calc();
    syncWizardButtons();
  });

  /* =========================
     거리 계산 (경유지 포함)
  ========================= */
  if (calcDistanceBtn) {
    calcDistanceBtn.addEventListener("click", async () => {
      const start = (startAddressInput?.value || "").trim();
      const end = (endAddressInput?.value || "").trim();
      const waypoint = (waypointAddressInput?.value || "").trim();

      if (!start || !end) {
        alert("출발지와 도착지를 모두 입력해주세요.");
        return;
      }
      if (state.hasWaypoint && !waypoint) {
        alert("경유지를 선택하셨습니다. 경유지 주소를 입력해주세요.");
        return;
      }
      if (!geocoder) {
        alert("거리 계산을 위한 카카오맵 초기화에 실패했습니다.\n(카카오 개발자센터에 도메인 등록 확인)");
        return;
      }

      calcDistanceBtn.textContent = "계산 중...";
      calcDistanceBtn.disabled = true;

      try {
        const startCoord = await getCoordinates(start);

        if (!state.hasWaypoint) {
          const endCoord = await getCoordinates(end);
          const km = await getBestDistanceKm(startCoord, endCoord);
          state.distance = km;
        } else {
          const wpCoord = await getCoordinates(waypoint);
          const endCoord = await getCoordinates(end);
          const km1 = await getBestDistanceKm(startCoord, wpCoord);
          const km2 = await getBestDistanceKm(wpCoord, endCoord);
          state.distance = Math.max(0, Math.round(km1 + km2));
        }

        if (distanceText) distanceText.textContent = `${state.distance} km`;
        calc();
        syncWizardButtons();
      } catch (error) {
        alert(error?.message || "주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.");
      } finally {
        calcDistanceBtn.textContent = "거리 계산하기";
        calcDistanceBtn.disabled = false;
      }
    });
  }

  function getCoordinates(address) {
    return new Promise((resolve, reject) => {
      geocoder.addressSearch(address, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve({
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x),
          });
        } else {
          reject(new Error(`"${address}" 주소를 찾을 수 없습니다.`));
        }
      });
    });
  }

  async function getRoadDistanceKmByKakaoMobility(origin, destination) {
    const params = new URLSearchParams({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
    });

    const res = await fetch(`/.netlify/functions/kakaoDirections?${params.toString()}`, {
      method: "GET",
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`도로거리 계산 실패: ${res.status} ${t}`);
    }

    const data = await res.json();
    const meter = data?.routes?.[0]?.summary?.distance;
    if (!Number.isFinite(meter)) throw new Error("도로거리 데이터가 없습니다.");
    return Math.max(0, Math.round(meter / 1000));
  }

  async function getBestDistanceKm(startCoord, endCoord) {
    try {
      return await getRoadDistanceKmByKakaoMobility(startCoord, endCoord);
    } catch (e) {
      console.warn("[거리] 도로거리 실패 → 직선거리 백업:", e);
      const straight = calculateDistance(startCoord, endCoord);
      return Math.max(0, Math.round(straight));
    }
  }

  function calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLng = toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function toRad(deg) { return deg * (Math.PI / 180); }

  /* =========================
     문의 메시지 (ChannelTalk)
  ========================= */
  function buildInquiryMessage(priceNumber) {
    const startAddr = (startAddressInput?.value || "").trim();
    const endAddr = (endAddressInput?.value || "").trim();
    const waypoint = (waypointAddressInput?.value || "").trim();

    const vehicleLabel = state.vehicle || "미선택";
    const moveLabel = moveTypeLabel(state.moveType, state.storageBase, state.storageDays);

    const stairsFrom = state.noFrom ? `${state.fromFloor}층(엘베없음)` : "엘베있음";
    const stairsTo = state.noTo ? `${state.toFloor}층(엘베없음)` : "엘베있음";

    const effectiveMoveType = state.moveType === "storage" ? state.storageBase : state.moveType;
    const loadMap = getLoadMap(effectiveMoveType);
    const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "미선택";

    const distanceLabel = state.distance > 0 ? `${state.distance}km` : "미계산";
    const scheduleLabel = state.moveDate || "미선택";
    const timeSlotLabel = formatTimeSlotKR(state.timeSlot);

    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const moveItemsLabel = getSelectedQtyLabel(mergedAllItems);

    // 사다리차 표시
    const ladderParts = [];
    let ladderCost = 0;
    if (state.ladderFromEnabled) {
      const p = ladderPriceByFloor(state.ladderFromFloor);
      ladderCost += p;
      ladderParts.push(`출발 ${state.ladderFromFloor}층(₩${p.toLocaleString("ko-KR")})`);
    }
    if (state.ladderToEnabled) {
      const p = ladderPriceByFloor(state.ladderToFloor);
      ladderCost += p;
      ladderParts.push(`도착 ${state.ladderToFloor}층(₩${p.toLocaleString("ko-KR")})`);
    }
    const ladderLabel = ladderParts.length
      ? `${ladderParts.join(" / ")} (합계 ₩${ladderCost.toLocaleString("ko-KR")})`
      : "불필요";

    // 보관료(옵션)
    const storageFee =
      state.moveType === "storage"
        ? Math.max(1, parseInt(String(state.storageDays || 1), 10) || 1) * STORAGE_PER_DAY
        : 0;

    // ✅ 청소 옵션
    const cleaning = getCleaningInfo();
    const cleaningLabel = cleaning.enabled
      ? `${cleaning.label} (₩${cleaning.cost.toLocaleString("ko-KR")})`
      : "미사용";

    const total = Math.max(0, Number(priceNumber) || 0);
    const deposit = Math.round(total * 0.2);
    const balance = total - deposit;

    const lines = [
      "안녕하세요. 디디운송 견적 문의드립니다.",
      "",
      "[조건]",
      `- 이사 방식: ${moveLabel}`,
      `- 차량: ${vehicleLabel}`,
      `- 거리: ${distanceLabel}`,
      `- 일정: ${scheduleLabel}`,
      `- 희망 시간: ${timeSlotLabel}`,
      startAddr ? `- 출발지: ${startAddr}` : null,
      state.hasWaypoint && waypoint ? `- 경유지: ${waypoint}` : null,
      endAddr ? `- 도착지: ${endAddr}` : null,
      `- 계단: 출발 ${stairsFrom} / 도착 ${stairsTo}`,
      `- 짐양(박스): ${loadLabel}`,
      `- 가구·가전(합산): ${moveItemsLabel}`,
      state.itemsNote ? `- 가구·가전 기타사항: ${state.itemsNote}` : null,
      state.throwEnabled && state.throwNote ? `- 버리기 기타사항: ${state.throwNote}` : null,
      `- 버려주세요 모드: ${state.throwEnabled ? "사용" : "미사용"}`,
      `- 사다리차: ${ladderLabel}`,
      `- 청소 옵션: ${cleaningLabel}`,
      state.moveType === "storage" ? `- 보관료(옵션): ₩${storageFee.toLocaleString("ko-KR")}` : null,
      "",
      "[예상금액]",
      `₩${total.toLocaleString("ko-KR")}`,
      `[예약금(20%)] ₩${deposit.toLocaleString("ko-KR")}`,
      `[잔금(80%)] ₩${balance.toLocaleString("ko-KR")}`,
      "",
      "※ 예약금 입금 시 예약 확정되며, 잔금은 운송 당일 결제합니다.",
      "※ 예약금은 일정 확보 및 기사 배정을 위한 비용으로, 입금 후 고객 사정에 의한 취소/변경 시 환불이 어렵습니다.",
      "※ 현장 상황에 따라 금액이 변동될 수 있습니다.",
      "",
    ].filter(Boolean);

    return lines.join("\n");
  }

  /* =========================
     ✅ 가격 계산 + 요약 렌더
  ========================= */
  function calc() {
    // ✅ 스티키바는 항상 표시
    if (stickyBarEl) {
      stickyBarEl.style.display = "block";
      stickyBarEl.setAttribute("aria-hidden", "false");
    }

    // ✅ 높이 재측정 (텍스트 줄바꿈/반응형 대비)
    syncStickyBarHeightVar();

    if (!state.vehicle) {
      lastPrice = 0;
      if (priceEl) priceEl.innerText = "₩0";
      if (stickyPriceEl) stickyPriceEl.innerText = "₩0";
      if (summaryEl) summaryEl.innerHTML = "조건을 선택하세요";
      syncWizardButtons();
      return;
    }

    const key = VEHICLE_MAP[state.vehicle];
    if (!key) return;

    const base = toNumberSafe(BASE_PRICE[key], 0);
    const perKm = toNumberSafe(PER_KM_PRICE[key], 0);
    const dist = Math.max(0, toNumberSafe(state.distance, 0));

    // 표시용(“13.8% 저렴” 문구 느낌)
    const DISPLAY_MULTIPLIER = 0.95;

    // 반포장 프리미엄
    const HALF_PREMIUM_MULTIPLIER = 1.18;

    // 기본(차량+거리)
    let subtotal = base + dist * perKm;

    // 이사 방식(보관 포함)
    const effectiveMoveType = state.moveType === "storage" ? state.storageBase : state.moveType;

    if (effectiveMoveType === "half") {
      subtotal = Math.round(subtotal * HALF_PREMIUM_MULTIPLIER);
    }

    // 짐양(박스)
    const loadMap = getLoadMap(effectiveMoveType);
    const loadPrice = state.load && loadMap[state.load] ? toNumberSafe(loadMap[state.load].price, 0) : 0;
    subtotal += loadPrice;

    // 가구/가전(버리기 포함 합산)
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);

    let itemsCost = 0;
    Object.entries(mergedAllItems).forEach(([k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      if (!q) return;
      const unit = toNumberSafe(FURNITURE_PRICE[k]?.price, 0);
      itemsCost += unit * q;
    });
    subtotal += itemsCost;

    // 계단(엘베 없음)
    const stairFromCost = state.noFrom ? stairExtraByFloor(state.fromFloor) : 0;
    const stairToCost = state.noTo ? stairExtraByFloor(state.toFloor) : 0;
    subtotal += stairFromCost + stairToCost;

    // 직접 나르기 어려움
    const cantCarryCost =
      (state.cantCarryFrom ? 30000 : 0) +
      (state.cantCarryTo ? 30000 : 0);
    subtotal += cantCarryCost;

    // 인부 추가
    const helperCost =
      (state.helperFrom ? 40000 : 0) +
      (state.helperTo ? 40000 : 0);
    subtotal += helperCost;

    // 동승
    const rideCost = Math.max(0, Number(state.ride) || 0) * 10000;
    subtotal += rideCost;

    // 사다리차
    const ladderFromCost = state.ladderFromEnabled ? ladderPriceByFloor(state.ladderFromFloor) : 0;
    const ladderToCost = state.ladderToEnabled ? ladderPriceByFloor(state.ladderToFloor) : 0;
    const ladderCost = ladderFromCost + ladderToCost;
    subtotal += ladderCost;

    // ✅ 청소 옵션
    const cleaning = getCleaningInfo();
    subtotal += cleaning.cost;

    // 보관료(옵션)
    const storageFee =
      state.moveType === "storage"
        ? Math.max(1, parseInt(String(state.storageDays || 1), 10) || 1) * STORAGE_PER_DAY
        : 0;
    subtotal += storageFee;

    // 최종 배율
    subtotal = Math.round(subtotal * PRICE_MULTIPLIER);
    const displayPrice = Math.round(subtotal * DISPLAY_MULTIPLIER);

    lastPrice = subtotal;

    // UI 업데이트
    const priceText = `₩${displayPrice.toLocaleString("ko-KR")}`;
    if (priceEl) priceEl.innerText = priceText;
    if (stickyPriceEl) stickyPriceEl.innerText = priceText;

    // 요약 렌더
    const vehicleLabel = state.vehicle || "미선택";
    const moveLabel = moveTypeLabel(state.moveType, state.storageBase, state.storageDays);

    const stairsFrom = state.noFrom ? `${state.fromFloor}층(엘베없음)` : "엘베있음";
    const stairsTo = state.noTo ? `${state.toFloor}층(엘베없음)` : "엘베있음";

    const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "미선택";
    const itemsLabel = getSelectedQtyLabel(mergedAllItems);
    const scheduleLabel = state.moveDate || "미선택";
    const timeSlotLabel = formatTimeSlotKR(state.timeSlot);

    const ladderParts = [];
    if (state.ladderFromEnabled) ladderParts.push(`출발 ${state.ladderFromFloor}층`);
    if (state.ladderToEnabled) ladderParts.push(`도착 ${state.ladderToFloor}층`);
    const ladderLabel = ladderParts.length ? `${ladderParts.join(" / ")} (₩${ladderCost.toLocaleString("ko-KR")})` : "불필요";

    const cleaningLabel = cleaning.enabled
      ? `${cleaning.label} (₩${cleaning.cost.toLocaleString("ko-KR")})`
      : "미사용";

    const startAddr = escapeHtml((startAddressInput?.value || "").trim() || "미입력");
    const endAddr = escapeHtml((endAddressInput?.value || "").trim() || "미입력");
    const wpAddr = escapeHtml((waypointAddressInput?.value || "").trim());

    const distLabel = dist > 0 ? `${dist} km` : "미계산";

    const html = `
      <div class="sum">
        <div><b>차량</b>: ${escapeHtml(vehicleLabel)}</div>
        <div><b>이사 방식</b>: ${escapeHtml(moveLabel)}</div>
        <div><b>일정</b>: ${escapeHtml(scheduleLabel)} / ${escapeHtml(timeSlotLabel)}</div>
        <div><b>이동</b>: ${startAddr}${state.hasWaypoint && wpAddr ? ` → ${wpAddr}` : ""} → ${endAddr}</div>
        <div><b>거리</b>: ${escapeHtml(distLabel)}</div>
        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(255,255,255,.12);" />
        <div><b>계단</b>: 출발 ${escapeHtml(stairsFrom)} / 도착 ${escapeHtml(stairsTo)}</div>
        <div><b>짐양</b>: ${escapeHtml(loadLabel)}</div>
        <div><b>가구·가전(합산)</b>: ${escapeHtml(itemsLabel)}</div>
        ${state.itemsNote ? `<div><b>가구·가전 기타사항</b>: ${escapeHtml(state.itemsNote)}</div>` : ""}
        ${state.throwEnabled ? `<div><b>버려주세요</b>: 사용</div>` : `<div><b>버려주세요</b>: 미사용</div>`}
        ${state.throwEnabled && state.throwNote ? `<div><b>버리기 기타사항</b>: ${escapeHtml(state.throwNote)}</div>` : ""}
        <div><b>사다리차</b>: ${escapeHtml(ladderLabel)}</div>
        <div><b>청소 옵션</b>: ${escapeHtml(cleaningLabel)}</div>
        ${state.moveType === "storage" ? `<div><b>보관료</b>: ₩${storageFee.toLocaleString("ko-KR")}</div>` : ""}
        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(255,255,255,.12);" />
        <div><b>예상 금액(표시)</b>: ${priceText}</div>
        <div class="hint" style="margin-top:10px;">
          ※ 예약금 20% 입금 시 예약 확정 (입금 후 고객 사정 취소/변경 환불 어려움)<br/>
          ※ 현장 상황(주차/이동거리/엘베 사용 제한/가구 추가 등)에 따라 변동될 수 있습니다.
        </div>
      </div>
    `;
    if (summaryEl) summaryEl.innerHTML = html;

    syncWizardButtons();
  }
})();
