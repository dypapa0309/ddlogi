(() => {
  "use strict";

  /* =========================
     Global pricing knobs
  ========================= */
  const PRICE_MULTIPLIER = 1;     // 운영 중 조정
  const DISPLAY_MULTIPLIER = 0.95; // 표시가(“13.8% 저렴” 문구 톤)

  /* =========================
     Services
  ========================= */
  const SERVICE = {
    MOVE: "move",
    CLEAN: "clean",
  };

  /* =========================
     Supabase client (optional)
  ========================= */
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

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
     Helpers
  ========================= */
  function toNumberSafe(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
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

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function getSelectedQtyLabelFromMap(qtyMap = {}, priceMap = {}, emptyLabel = "없음") {
    const labels = [];
    Object.entries(qtyMap).forEach(([k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      if (q > 0) labels.push(`${priceMap[k]?.label || k}×${q}`);
    });
    return labels.length ? labels.join(", ") : emptyLabel;
  }

  /* =========================
     MOVE: vehicle + base pricing
  ========================= */
  const VEHICLE_MAP = {
    "1톤 카고": "truck",
    "1톤 저상탑": "van",
    "1톤 카고+저상탑": "lorry",
  };

  const BASE_PRICE = { truck: 50000, van: 50000, lorry: 90000 };
  const PER_KM_PRICE = { truck: 1550, van: 1550, lorry: 1550 };

  /* =========================
     MOVE: furniture & appliance add-ons (expanded)
  ========================= */
  const FURNITURE_PRICE = {
    // appliances
    "전자레인지": { label: "전자레인지", price: 1500 },
    "공기청정기": { label: "공기청정기", price: 3500 },
    "청소기": { label: "청소기", price: 2500 },

    "TV(55이하)": { label: "TV(55인치 이하)", price: 20000 },
    "TV(65이상)": { label: "TV(65인치 이상)", price: 40000 },
    "모니터": { label: "모니터", price: 9000 },

    "데스크탑": { label: "데스크탑 본체", price: 4000 },
    "프린터": { label: "프린터/복합기", price: 3000 },

    "정수기(이동만)": { label: "정수기(이동만)", price: 3000 },

    "세탁기(12kg이하)": { label: "세탁기(12kg 이하)", price: 20000 },
    "세탁기(12kg초과)": { label: "세탁기(12kg 초과)", price: 60000 },

    "건조기(12kg이하)": { label: "건조기(12kg 이하)", price: 20000 },
    "건조기(12kg초과)": { label: "건조기(12kg 초과)", price: 60000 },

    "냉장고(380L이하)": { label: "냉장고(380L 이하)", price: 30000 },
    "냉장고(600L이하)": { label: "냉장고(381~600L)", price: 12000 },
    "냉장고(600L초과)": { label: "냉장고(601L 이상)", price: 180000 },

    "김치냉장고": { label: "김치냉장고", price: 60000 },
    "스타일러": { label: "스타일러", price: 120000 },

    // furniture
    "의자": { label: "의자", price: 3000 },
    "행거": { label: "행거", price: 3000 },
    "협탁/사이드테이블(소형)": { label: "협탁/사이드테이블(소형)", price: 5000 },
    "화장대(소형)": { label: "화장대(소형)", price: 9000 },
    "책상/테이블(일반)": { label: "책상/테이블(일반)", price: 8000 },
    "서랍장(3~5단)": { label: "서랍장(3~5단)", price: 8000 },
    "책장(일반)": { label: "책장(일반)", price: 10000 },
    "수납장/TV장(일반)": { label: "수납장/TV장(일반)", price: 10000 },
    "소파(2~3인)": { label: "소파(2~3인)", price: 15000 },
    "소파(4인이상)": { label: "소파(4인 이상)", price: 30000 },
    "침대매트리스(킹제외)": { label: "침대 매트리스(킹 제외)", price: 10000 },
    "침대프레임(분해/조립)": { label: "침대프레임 분해/조립", price: 40000 },
  };

  /* =========================
     MOVE: load / move type
  ========================= */
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

  /* =========================
     MOVE: storage / ladder / stairs rules
  ========================= */
  const STORAGE_PER_DAY = 20000;

  function ladderPriceByFloor(floor) {
    const f = Math.max(1, parseInt(String(floor || 1), 10) || 1);
    if (f <= 6) return 100000;
    if (f <= 12) return 120000;
    return 140000;
  }

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
     MOVE: cleaning add-on (existing step 10)
  ========================= */
  const MOVE_CLEANING_PRICE = { light: 30000, deep: 60000 };

  function getMoveCleaningInfo() {
    if (!state.cleaningEnabled) {
      return { enabled: false, cost: 0, label: "미사용", unit: 0, count: 0, type: "light" };
    }
    const type = state.cleaningType === "deep" ? "deep" : "light";
    const typeLabel = type === "deep" ? "집중 청소" : "간단 청소";
    const unit = toNumberSafe(MOVE_CLEANING_PRICE[type], 0);
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
     CLEAN: base pricing (national average-ish)
     - 최소금액 + 평당단가
  ========================= */
  const CLEAN_PER_PYEONG = 12000;
  const CLEAN_MIN_PRICE = 140000;

  const CLEAN_SOIL_MULT = { light: 1.0, normal: 1.1, heavy: 1.2 };
  const CLEAN_TYPE_MULT = { movein: 1.0, moveout: 1.0, occupied: 1.15 };

  // 구조/현장 가산 (운영에서 튜닝)
  const CLEAN_BATH_EXTRA_EACH = 20000;      // 화장실 2개 이상부터 개당
  const CLEAN_PARKING_HARD_EXTRA = 20000;   // 주차 어려움
  const CLEAN_NO_ELEVATOR_PER_FLOOR = 5000; // 엘베 없음: 층당(1층은 0)
  const CLEAN_BALCONY_3P_EXTRA = 50000;     // 베란다 3개 이상
  const CLEAN_WARDROBE_2P_EXTRA = 50000;    // 붙박이장 2세트 이상

  /* =========================
     CLEAN: option price maps
     - basic modal
  ========================= */
  const CLEAN_BASIC_PRICE = {
    "곰팡이제거": { label: "곰팡이 제거(부위)", price: 40000 },
    "스티커제거": { label: "스티커/뽁뽁이 제거(부위)", price: 40000 },
    "페인트잔여": { label: "페인트/실리콘 잔여물(부위)", price: 50000 },
    "니코틴케어": { label: "니코틴/찌든때 케어", price: 50000 },
    "반려동물케어": { label: "반려동물 털/냄새 케어", price: 40000 },
    "피톤치드(평)": { label: "피톤치드/탈취(평)", price: 5000 },
  };

  /* =========================
     CLEAN: appliance/fabric price maps
     - appliance modal (based on market averages where available)
  ========================= */
  const CLEAN_APPLIANCE_PRICE = {
    "에어컨(벽걸이)": { label: "에어컨(벽걸이) 분해청소", price: 70000 },
    "에어컨(스탠드)": { label: "에어컨(스탠드) 분해청소", price: 140000 },
    "에어컨(천장1way)": { label: "에어컨(천장 1way) 분해청소", price: 90000 },
    "에어컨(천장4way)": { label: "에어컨(천장 4way) 분해청소", price: 140000 },

    "세탁기청소": { label: "세탁기 분해청소", price: 85000 },
    "건조기청소": { label: "건조기 청소", price: 100000 },

    "냉장고청소": { label: "냉장고 청소(내부 분해)", price: 120000 },
    "후드청소": { label: "주방 후드 청소", price: 263000 },

    "매트리스청소": { label: "매트리스 청소", price: 80000 },
    "소파청소": { label: "소파 청소", price: 90000 },
    "비데청소": { label: "비데 청소/살균", price: 60000 },
  };

  /* =========================
     State
  ========================= */
  const state = {
    // NEW: service
    service: "", // move | clean

    // MOVE
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

    // MOVE cleaning add-on
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

    // CLEAN
    cleanType: "movein",     // movein | moveout | occupied
    cleanSoil: "light",      // light | normal | heavy
    cleanPyeong: 9,
    cleanRooms: 1,
    cleanBaths: 1,
    cleanBalconies: 1,
    cleanWardrobes: 0,

    cleanAddress: "",
    cleanAddressNote: "",

    cleanParkingHard: false,
    cleanNoElevator: false,
    cleanFloor: 1,

    cleanOuterWindowEnabled: false,
    cleanOuterWindowPyeong: 9,

    cleanPhytoncideEnabled: false,
    cleanDisinfectEnabled: false,

    cleanTrashBags: 0,

    cleanBasicQty: {},
    cleanApplianceQty: {},

    cleanNote: "",
  };

  /* =========================
     DOM
  ========================= */
  const priceEl = document.getElementById("price");
  const summaryEl = document.getElementById("summary");
  const stickyBarEl = document.getElementById("stickyPriceBar");
  const stickyPriceEl = document.getElementById("stickyPrice");

  const wizardProgressBar = document.getElementById("wizardProgressBar");
  const wizardStepText = document.getElementById("wizardStepText");
  const wizardPrev = document.getElementById("wizardPrev");
  const wizardNext = document.getElementById("wizardNext");
  const heroStartBtn = document.getElementById("heroStartBtn");

  const serviceCards = document.querySelectorAll(".service-card");

  // MOVE DOM
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

  const cleaningToggleEl = document.getElementById("cleaningToggle");
  const cleaningBodyEl = document.getElementById("cleaningBody");
  const cleaningFromEl = document.getElementById("cleaningFrom");
  const cleaningToEl = document.getElementById("cleaningTo");
  const cleaningTypeEls = document.querySelectorAll('input[name="cleaningType"]');

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
  const itemsNoteEl = document.getElementById("itemsNote");
  const itemsNotePreviewEl = document.getElementById("itemsNotePreview");

  const throwModalEl = document.getElementById("throwModal");
  const openThrowModalBtn = document.getElementById("openThrowModalBtn");
  const throwMiniWrapEl = document.getElementById("throwMiniWrap");
  const throwMiniSummaryEl = document.getElementById("throwMiniSummary");
  const throwToggleEl = document.getElementById("throwToggle");
  const workFromEl = document.getElementById("workFrom");
  const workToEl = document.getElementById("workTo");
  const throwNoteEl = document.getElementById("throwNote");
  const throwNotePreviewEl = document.getElementById("throwNotePreview");

  // CLEAN DOM
  const cleanTypeEls = document.querySelectorAll('input[name="cleanType"]');
  const cleanSoilEls = document.querySelectorAll('input[name="cleanSoil"]');

  const cleanPyeongEl = document.getElementById("cleanPyeong");
  const cleanRoomsEl = document.getElementById("cleanRooms");
  const cleanBathsEl = document.getElementById("cleanBaths");
  const cleanBalconiesEl = document.getElementById("cleanBalconies");
  const cleanWardrobesEl = document.getElementById("cleanWardrobes");

  const cleanAddressEl = document.getElementById("cleanAddress");
  const cleanAddressNoteEl = document.getElementById("cleanAddressNote");

  const cleanParkingHardEl = document.getElementById("cleanParkingHard");
  const cleanNoElevatorEl = document.getElementById("cleanNoElevator");
  const cleanFloorEl = document.getElementById("cleanFloor");

  const cleanOuterWindowEnabledEl = document.getElementById("cleanOuterWindowEnabled");
  const cleanOuterWindowBodyEl = document.getElementById("cleanOuterWindowBody");
  const cleanOuterWindowPyeongEl = document.getElementById("cleanOuterWindowPyeong");

  const cleanPhytoncideEnabledEl = document.getElementById("cleanPhytoncideEnabled");
  const cleanDisinfectEnabledEl = document.getElementById("cleanDisinfectEnabled");
  const cleanTrashBagsEl = document.getElementById("cleanTrashBags");

  const cleanBasicModalEl = document.getElementById("cleanBasicModal");
  const openCleanBasicModalBtn = document.getElementById("openCleanBasicModalBtn");
  const cleanBasicMiniSummaryEl = document.getElementById("cleanBasicMiniSummary");
  const cleanNoteEl = document.getElementById("cleanNote");
  const cleanNotePreviewEl = document.getElementById("cleanNotePreview");

  const cleanApplianceModalEl = document.getElementById("cleanApplianceModal");
  const openCleanApplianceModalBtn = document.getElementById("openCleanApplianceModalBtn");
  const cleanApplianceMiniSummaryEl = document.getElementById("cleanApplianceMiniSummary");

  // season popup
  const seasonPopupEl = document.getElementById("seasonPopup");
  const popupGoQuoteBtn = document.getElementById("popupGoQuote");
  const popupTodayEl = document.getElementById("popupToday");

  const channelInquiryBtn = document.getElementById("channelInquiry");

  const TIME_SLOTS = ["7", "8", "9", "10", "11", "12", "13", "14", "15"];

  /* =========================
     Scroll lock (iOS safe)
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
     Focus trap
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
      try { target.focus({ preventScroll: true }); } catch (_) {}
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
     Sticky bar height -> CSS var
  ========================= */
  function syncStickyBarHeightVar() {
    if (!stickyBarEl) return;
    const inner = stickyBarEl.querySelector(".sticky-inner") || stickyBarEl;
    const h = Math.ceil(inner.getBoundingClientRect().height || 0);
    if (h > 0) document.documentElement.style.setProperty("--stickybar-h", `${h}px`);
  }

  /* =========================
     Wizard
  ========================= */
  const STEP_ORDER = ["service", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let currentStepIndex = 0;

  function getStepEl(stepNo) {
    return document.querySelector(`.step-card[data-step="${String(stepNo)}"]`);
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
    // service step
    if (stepNo === "service") return state.service === SERVICE.MOVE || state.service === SERVICE.CLEAN;

    if (state.service === SERVICE.CLEAN) {
      if (stepNo === 1) return Number(state.cleanPyeong) > 0;
      if (stepNo === 2) return !!String(state.cleanAddress || "").trim();
      if (stepNo === 3) return !!state.moveDate && !!state.timeSlot;
      return true;
    }

    // default: MOVE
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
     Service mode apply (data-only)
  ========================= */
  function applyServiceMode() {
    // empty state => default show move blocks (but cannot proceed past service step)
    const s = state.service || SERVICE.MOVE;

    document.body.dataset.service = s;

    const moveEls = document.querySelectorAll('[data-only="move"]');
    const cleanEls = document.querySelectorAll('[data-only="clean"]');

    moveEls.forEach((el) => { el.style.display = s === SERVICE.MOVE ? "" : "none"; });
    cleanEls.forEach((el) => { el.style.display = s === SERVICE.CLEAN ? "" : "none"; });

    // toggle heading/cards active UI
    serviceCards.forEach((btn) => {
      const v = btn.getAttribute("data-service");
      if (!v) return;
      btn.classList.toggle("is-active", state.service === v);
    });

    calc();
    syncWizardButtons();
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

      if (itemsModalEl?.getAttribute("aria-hidden") === "false") closeModal("itemsModal");
      else if (throwModalEl?.getAttribute("aria-hidden") === "false") closeModal("throwModal");
      else if (cleanBasicModalEl?.getAttribute("aria-hidden") === "false") closeModal("cleanBasicModal");
      else if (cleanApplianceModalEl?.getAttribute("aria-hidden") === "false") closeModal("cleanApplianceModal");
      else if (seasonPopupEl?.getAttribute("aria-hidden") === "false") hideSeasonPopup(true);
    });
  }

  function syncMiniSummaries() {
    // MOVE summaries
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);

    if (itemsMiniSummaryEl) itemsMiniSummaryEl.textContent = getSelectedQtyLabelFromMap(mergedAllItems, FURNITURE_PRICE, "선택 없음");
    if (throwMiniSummaryEl) throwMiniSummaryEl.textContent = getSelectedQtyLabelFromMap(mergedThrow, FURNITURE_PRICE, "선택 없음");

    if (itemsNotePreviewEl) itemsNotePreviewEl.textContent = `기타사항: ${state.itemsNote ? state.itemsNote : "없음"}`;
    if (throwNotePreviewEl) {
      const txt = state.throwEnabled && state.throwNote ? state.throwNote : "";
      throwNotePreviewEl.textContent = `기타사항: ${txt ? txt : "없음"}`;
    }

    // CLEAN summaries
    if (cleanBasicMiniSummaryEl) cleanBasicMiniSummaryEl.textContent = getSelectedQtyLabelFromMap(state.cleanBasicQty, CLEAN_BASIC_PRICE, "선택 없음");
    if (cleanApplianceMiniSummaryEl) cleanApplianceMiniSummaryEl.textContent = getSelectedQtyLabelFromMap(state.cleanApplianceQty, CLEAN_APPLIANCE_PRICE, "선택 없음");

    if (cleanNotePreviewEl) cleanNotePreviewEl.textContent = `기타사항: ${state.cleanNote ? state.cleanNote : "없음"}`;
  }

  /* =========================
     ChannelTalk boot + clipboard
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
     Date picker helper
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
     Season popup (today hide)
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

    if (hideDate !== todayKey()) showSeasonPopup();

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
        else setActiveStep("service");
      });
    }
  }

  /* =========================
     Query param: ?service=clean|move
  ========================= */
  function initServiceFromQuery() {
    try {
      const u = new URL(window.location.href);
      const s = (u.searchParams.get("service") || "").toLowerCase();
      if (s === "move" || s === "clean") state.service = s;
    } catch (_) {}
  }

  /* =========================
     Init
  ========================= */
  let geocoder = null;
  let lastPrice = 0;

  window.addEventListener("DOMContentLoaded", async () => {
    bindModalClosers();
    initSeasonPopup();

    initServiceFromQuery();
    applyServiceMode();

    // sticky bar always show
    if (stickyBarEl) {
      stickyBarEl.style.display = "block";
      stickyBarEl.setAttribute("aria-hidden", "false");
    }
    syncStickyBarHeightVar();
    window.addEventListener("resize", syncStickyBarHeightVar);

    // full click date picker
    const dateWrapEl = document.querySelector(".date-wrap");
    if (dateWrapEl && moveDateEl) {
      dateWrapEl.addEventListener("click", (e) => { e.preventDefault(); openDatePickerSafe(moveDateEl); });
      dateWrapEl.addEventListener("pointerup", (e) => { e.preventDefault(); openDatePickerSafe(moveDateEl); });
    }

    // hero show first
    const heroEl = getStepEl(0);
    if (heroEl) {
      document.querySelectorAll(".step-card").forEach((el) => el.classList.remove("is-active"));
      heroEl.classList.add("is-active");
      if (wizardPrev) wizardPrev.disabled = true;
      if (wizardNext) wizardNext.disabled = true;
    } else {
      setActiveStep("service");
    }

    // hero start => if service preselected -> step1 else service step
    if (heroStartBtn) {
      heroStartBtn.addEventListener("click", () => {
        if (state.service === SERVICE.MOVE || state.service === SERVICE.CLEAN) setActiveStep(1);
        else setActiveStep("service");
      });
    }

    if (wizardPrev) wizardPrev.addEventListener("click", gotoPrev);
    if (wizardNext) wizardNext.addEventListener("click", gotoNext);

    // service select
    serviceCards.forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-service");
        if (v !== SERVICE.MOVE && v !== SERVICE.CLEAN) return;
        state.service = v;
        applyServiceMode();
        // on service step -> next
        const curStep = STEP_ORDER[currentStepIndex];
        if (curStep === "service") gotoNext();
      });
    });

    /* =========================
       MOVE: vehicle selection
    ========================= */
    const firstVehicle = document.querySelector(".vehicle");
    if (firstVehicle) {
      firstVehicle.classList.add("active");
      state.vehicle = firstVehicle.dataset.vehicle || null;
    }

    document.querySelectorAll(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        document.querySelectorAll(".vehicle").forEach((x) => x.classList.remove("active"));
        v.classList.add("active");
        state.vehicle = v.dataset.vehicle || null;
        calc();
        syncWizardButtons();
      });
    });

    // waypoint toggle
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

    // storageDays
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

    // items note
    if (itemsNoteEl) {
      itemsNoteEl.addEventListener("input", (e) => {
        state.itemsNote = String(e.target.value || "").trim();
        syncMiniSummaries();
        calc();
      });
      state.itemsNote = String(itemsNoteEl.value || "").trim();
    }

    // throw note
    if (throwNoteEl) {
      throwNoteEl.addEventListener("input", (e) => {
        state.throwNote = String(e.target.value || "").trim();
        syncMiniSummaries();
        calc();
      });
      state.throwNote = String(throwNoteEl.value || "").trim();
    }

    // CLEAN note
    if (cleanNoteEl) {
      cleanNoteEl.addEventListener("input", (e) => {
        state.cleanNote = String(e.target.value || "").trim();
        syncMiniSummaries();
        calc();
      });
      state.cleanNote = String(cleanNoteEl.value || "").trim();
    }

    // clean type
    if (cleanTypeEls?.length) {
      cleanTypeEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.cleanType = e.target.value || "movein";
          calc();
          syncWizardButtons();
        });
        if (el.checked) state.cleanType = el.value;
      });
    }

    // clean soil
    if (cleanSoilEls?.length) {
      cleanSoilEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.cleanSoil = e.target.value || "light";
          calc();
        });
        if (el.checked) state.cleanSoil = el.value;
      });
    }

    // clean base inputs
    if (cleanPyeongEl) cleanPyeongEl.addEventListener("input", (e) => { state.cleanPyeong = Math.max(1, toNumberSafe(e.target.value, 9)); calc(); syncWizardButtons(); });
    if (cleanRoomsEl) cleanRoomsEl.addEventListener("input", (e) => { state.cleanRooms = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });
    if (cleanBathsEl) cleanBathsEl.addEventListener("input", (e) => { state.cleanBaths = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });
    if (cleanBalconiesEl) cleanBalconiesEl.addEventListener("input", (e) => { state.cleanBalconies = Math.max(0, toNumberSafe(e.target.value, 1)); calc(); });
    if (cleanWardrobesEl) cleanWardrobesEl.addEventListener("input", (e) => { state.cleanWardrobes = Math.max(0, toNumberSafe(e.target.value, 0)); calc(); });

    // clean address
    if (cleanAddressEl) cleanAddressEl.addEventListener("input", (e) => { state.cleanAddress = String(e.target.value || "").trim(); calc(); syncWizardButtons(); });
    if (cleanAddressNoteEl) cleanAddressNoteEl.addEventListener("input", (e) => { state.cleanAddressNote = String(e.target.value || "").trim(); calc(); });

    // clean parking / elevator
    if (cleanParkingHardEl) cleanParkingHardEl.addEventListener("change", (e) => { state.cleanParkingHard = !!e.target.checked; calc(); });
    if (cleanNoElevatorEl) cleanNoElevatorEl.addEventListener("change", (e) => { state.cleanNoElevator = !!e.target.checked; calc(); });
    if (cleanFloorEl) cleanFloorEl.addEventListener("input", (e) => { state.cleanFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });

    // clean outer window option
    if (cleanOuterWindowEnabledEl && cleanOuterWindowBodyEl) {
      const syncOuter = () => {
        state.cleanOuterWindowEnabled = !!cleanOuterWindowEnabledEl.checked;
        cleanOuterWindowBodyEl.hidden = !state.cleanOuterWindowEnabled;
        // default suggestion
        if (state.cleanOuterWindowEnabled && cleanOuterWindowPyeongEl) {
          const v = Math.max(0, parseInt(String(cleanOuterWindowPyeongEl.value || "0"), 10) || 0);
          if (v === 0) {
            cleanOuterWindowPyeongEl.value = String(Math.max(0, state.cleanPyeong || 0));
            state.cleanOuterWindowPyeong = Math.max(0, state.cleanPyeong || 0);
          }
        }
        calc();
      };
      cleanOuterWindowEnabledEl.addEventListener("change", syncOuter);
      syncOuter();
    }
    if (cleanOuterWindowPyeongEl) {
      cleanOuterWindowPyeongEl.addEventListener("input", (e) => {
        state.cleanOuterWindowPyeong = Math.max(0, toNumberSafe(e.target.value, 0));
        calc();
      });
    }

    // clean phytoncide / disinfect
    if (cleanPhytoncideEnabledEl) cleanPhytoncideEnabledEl.addEventListener("change", (e) => { state.cleanPhytoncideEnabled = !!e.target.checked; calc(); });
    if (cleanDisinfectEnabledEl) cleanDisinfectEnabledEl.addEventListener("change", (e) => { state.cleanDisinfectEnabled = !!e.target.checked; calc(); });

    if (cleanTrashBagsEl) cleanTrashBagsEl.addEventListener("input", (e) => { state.cleanTrashBags = Math.max(0, toNumberSafe(e.target.value, 0)); calc(); });

    // open modals
    if (openItemsModalBtn) openItemsModalBtn.addEventListener("click", () => openModal("itemsModal"));
    if (openCleanBasicModalBtn) openCleanBasicModalBtn.addEventListener("click", () => openModal("cleanBasicModal"));
    if (openCleanApplianceModalBtn) openCleanApplianceModalBtn.addEventListener("click", () => openModal("cleanApplianceModal"));

    // throw toggle + modal
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
    if (openThrowModalBtn) openThrowModalBtn.addEventListener("click", () => { if (state.throwEnabled) openModal("throwModal"); });

    if (workFromEl) workFromEl.addEventListener("change", (e) => { state.workFrom = !!e.target.checked; calc(); });
    if (workToEl) workToEl.addEventListener("change", (e) => { state.workTo = !!e.target.checked; calc(); });

    // cleaning add-on (move)
    if (cleaningToggleEl && cleaningBodyEl) {
      const syncCleaning = () => {
        state.cleaningEnabled = !!cleaningToggleEl.checked;
        cleaningBodyEl.hidden = !state.cleaningEnabled;
        calc();
      };
      cleaningToggleEl.addEventListener("change", syncCleaning);
      syncCleaning();
    }
    if (cleaningFromEl) cleaningFromEl.addEventListener("change", (e) => { state.cleaningFrom = !!e.target.checked; calc(); });
    if (cleaningToEl) cleaningToEl.addEventListener("change", (e) => { state.cleaningTo = !!e.target.checked; calc(); });
    if (cleaningTypeEls?.length) {
      cleaningTypeEls.forEach((el) => {
        el.addEventListener("change", (e) => { state.cleaningType = e.target.value || "light"; calc(); });
        if (el.checked) state.cleaningType = el.value;
      });
    }

    // stairs / elevator for move
    if (noFromEl) noFromEl.addEventListener("change", (e) => { state.noFrom = !!e.target.checked; calc(); });
    if (noToEl) noToEl.addEventListener("change", (e) => { state.noTo = !!e.target.checked; calc(); });

    if (fromFloorEl) fromFloorEl.addEventListener("input", (e) => { state.fromFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });
    if (toFloorEl) toFloorEl.addEventListener("input", (e) => { state.toFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });

    // cantCarry / helper
    if (cantCarryFromEl) cantCarryFromEl.addEventListener("change", (e) => { state.cantCarryFrom = !!e.target.checked; calc(); });
    if (cantCarryToEl) cantCarryToEl.addEventListener("change", (e) => { state.cantCarryTo = !!e.target.checked; calc(); });
    if (helperFromEl) helperFromEl.addEventListener("change", (e) => { state.helperFrom = !!e.target.checked; calc(); });
    if (helperToEl) helperToEl.addEventListener("change", (e) => { state.helperTo = !!e.target.checked; calc(); });

    // night / ride
    if (nightEl) nightEl.addEventListener("change", (e) => { state.night = !!e.target.checked; calc(); });
    if (rideEl) rideEl.addEventListener("input", (e) => { state.ride = Math.max(0, toNumberSafe(e.target.value, 0)); calc(); });

    // ladder toggles
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

    // load
    document.querySelectorAll('input[name="load"]').forEach((el) => {
      el.addEventListener("change", (e) => { state.load = e.target.value; calc(); });
      if (el.checked) state.load = el.value;
    });

    // stepper common handling (+ clean modals)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".stepper-btn");
      if (!btn) return;

      const dir = Number(btn.getAttribute("data-dir") || "0");
      if (!dir) return;

      // 1) id based
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

      // 2) MOVE itemQty
      const itemKey = btn.getAttribute("data-stepper-item");
      const loc = btn.getAttribute("data-stepper-loc");
      if (itemKey && !loc && !btn.hasAttribute("data-stepper-clean")) {
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

      // 3) MOVE throwQty
      if (loc && itemKey) {
        const input = document.querySelector(`.throwQty[data-loc="${CSS.escape(loc)}"][data-item="${CSS.escape(itemKey)}"]`);
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

      // 4) CLEAN qty
      if (btn.getAttribute("data-stepper-clean") === "1") {
        const group = btn.getAttribute("data-clean-group") || "";
        const key = btn.getAttribute("data-clean-item") || "";
        if (!group || !key) return;

        const input = document.querySelector(`.cleanQty[data-clean-group="${CSS.escape(group)}"][data-clean-item="${CSS.escape(key)}"]`);
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

      // 5) fallback number input in wrapper
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

    // MOVE itemQty input
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

    // MOVE throwQty input
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

    // CLEAN qty inputs
    document.querySelectorAll(".cleanQty").forEach((el) => {
      el.addEventListener("input", (e) => {
        const group = e.target.getAttribute("data-clean-group");
        const key = e.target.getAttribute("data-clean-item");
        if (!group || !key) return;
        const v = Math.max(0, toNumberSafe(e.target.value, 0));

        if (group === "basic") state.cleanBasicQty[key] = v;
        if (group === "appliance") state.cleanApplianceQty[key] = v;

        calc();
        syncMiniSummaries();
      });

      const group = el.getAttribute("data-clean-group");
      const key = el.getAttribute("data-clean-item");
      if (group && key) {
        const v = Math.max(0, toNumberSafe(el.value, 0));
        if (group === "basic") state.cleanBasicQty[key] = v;
        if (group === "appliance") state.cleanApplianceQty[key] = v;
      }
    });

    // date change -> slots
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

    // time select
    if (timeSlotEls?.length) {
      timeSlotEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.timeSlot = e.target.value || "";
          calc();
          syncWizardButtons();
        });
      });
    }

    // if date already selected -> apply slot disable
    if (moveDateEl?.value) {
      state.moveDate = moveDateEl.value;
      const confirmed = await fetchConfirmedSlots(state.moveDate);
      TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));
      const checked = document.querySelector('input[name="timeSlot"]:checked');
      state.timeSlot = checked ? checked.value : "";
    }

    // load note
    if (cleanPyeongEl && cleanOuterWindowPyeongEl) {
      // keep outer window pyeong in sync when user changes base pyeong (only if outer window is enabled and user hasn't edited)
      cleanPyeongEl.addEventListener("change", () => {
        if (state.cleanOuterWindowEnabled) {
          // do not force overwrite if user already set non-zero manually
          const cur = Math.max(0, toNumberSafe(cleanOuterWindowPyeongEl.value, 0));
          if (cur === 0) {
            cleanOuterWindowPyeongEl.value = String(Math.max(0, state.cleanPyeong || 0));
            state.cleanOuterWindowPyeong = Math.max(0, state.cleanPyeong || 0);
          }
        }
      });
    }

    // Kakao geocoder init (MOVE distance)
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

    // ChannelTalk boot
    const ok = await waitForChannelIO(6000);
    if (ok) bootChannelIO();

    // Inquiry button
    if (channelInquiryBtn) {
      channelInquiryBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const msg = buildInquiryMessage(lastPrice || 0);
        const copied = await copyToClipboardSafe(msg);

        try { if (window.ChannelIO) window.ChannelIO("showMessenger"); } catch (_) {}

        if (copied) alert("견적 메시지를 복사했어요.\n채널톡에 붙여넣기만 하면 됩니다.");
        else alert("클립보드 복사에 실패했습니다.\n아래 메시지를 수동으로 복사해 주세요:\n\n" + msg);
      });
    }

    syncMiniSummaries();
    calc();
    syncWizardButtons();
  });

  /* =========================
     MOVE distance calculation (Kakao)
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
          resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
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

    const res = await fetch(`/.netlify/functions/kakaoDirections?${params.toString()}`, { method: "GET" });
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
     Inquiry message (service aware)
  ========================= */
  function buildInquiryMessage(priceNumber) {
    const total = Math.max(0, Number(priceNumber) || 0);
    const deposit = Math.round(total * 0.2);
    const balance = total - deposit;

    const scheduleLabel = state.moveDate || "미선택";
    const timeSlotLabel = formatTimeSlotKR(state.timeSlot);

    if (state.service === SERVICE.CLEAN) {
      const typeLabel =
        state.cleanType === "occupied" ? "거주청소(짐있음)" :
        state.cleanType === "moveout" ? "이사청소(퇴거)" : "입주청소(공실)";

      const optsBasic = getSelectedQtyLabelFromMap(state.cleanBasicQty, CLEAN_BASIC_PRICE, "없음");
      const optsAppl = getSelectedQtyLabelFromMap(state.cleanApplianceQty, CLEAN_APPLIANCE_PRICE, "없음");

      const outerWin = state.cleanOuterWindowEnabled
        ? `사용 (${state.cleanOuterWindowPyeong || 0}평)`
        : "미사용";

      const lines = [
        "안녕하세요. 디디운송 입주청소 견적 문의드립니다.",
        "",
        "[조건]",
        `- 서비스: 입주청소`,
        `- 청소 유형: ${typeLabel}`,
        `- 평수: ${state.cleanPyeong || "미입력"}평`,
        `- 구조: 방 ${state.cleanRooms} / 화장실 ${state.cleanBaths} / 베란다 ${state.cleanBalconies} / 붙박이장 ${state.cleanWardrobes}`,
        `- 주소: ${state.cleanAddress || "미입력"}`,
        state.cleanAddressNote ? `- 주소/출입 메모: ${state.cleanAddressNote}` : null,
        `- 일정: ${scheduleLabel}`,
        `- 희망 시간: ${timeSlotLabel}`,
        `- 주차: ${state.cleanParkingHard ? "어려움" : "보통/가능"}`,
        `- 엘리베이터: ${state.cleanNoElevator ? `없음(${state.cleanFloor}층)` : "있음"}`,
        `- 오염도: ${state.cleanSoil}`,
        `- 외창: ${outerWin}`,
        `- 피톤치드: ${state.cleanPhytoncideEnabled ? "사용" : "미사용"}`,
        `- 살균/소독: ${state.cleanDisinfectEnabled ? "사용" : "미사용"}`,
        `- 폐기/정리(봉투): ${state.cleanTrashBags || 0}개`,
        `- 청소 옵션(특수): ${optsBasic}`,
        `- 가전·가구 클리닝: ${optsAppl}`,
        state.cleanNote ? `- 기타사항: ${state.cleanNote}` : null,
        "",
        "[예상금액]",
        `₩${total.toLocaleString("ko-KR")}`,
        `[예약금(20%)] ₩${deposit.toLocaleString("ko-KR")}`,
        `[잔금(80%)] ₩${balance.toLocaleString("ko-KR")}`,
        "",
        "※ 예약금 입금 시 예약 확정되며, 잔금은 작업 당일 결제합니다.",
        "※ 현장 상태(오염/주차/동선/외창/옵션 범위)에 따라 금액이 변동될 수 있습니다.",
        "",
      ].filter(Boolean);

      return lines.join("\n");
    }

    // MOVE message
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

    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const moveItemsLabel = getSelectedQtyLabelFromMap(mergedAllItems, FURNITURE_PRICE, "없음");

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

    const storageFee =
      state.moveType === "storage"
        ? Math.max(1, parseInt(String(state.storageDays || 1), 10) || 1) * STORAGE_PER_DAY
        : 0;

    const cleaning = getMoveCleaningInfo();
    const cleaningLabel = cleaning.enabled
      ? `${cleaning.label} (₩${cleaning.cost.toLocaleString("ko-KR")})`
      : "미사용";

    const lines = [
      "안녕하세요. 디디운송 견적 문의드립니다.",
      "",
      "[조건]",
      `- 서비스: 이사·용달`,
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
     Total calculation
  ========================= */
  function calcMoveTotal() {
    if (!state.vehicle) return { subtotal: 0, displayPrice: 0, html: "조건을 선택하세요" };

    const key = VEHICLE_MAP[state.vehicle];
    if (!key) return { subtotal: 0, displayPrice: 0, html: "조건을 선택하세요" };

    const base = toNumberSafe(BASE_PRICE[key], 0);
    const perKm = toNumberSafe(PER_KM_PRICE[key], 0);
    const dist = Math.max(0, toNumberSafe(state.distance, 0));

    const HALF_PREMIUM_MULTIPLIER = 1.18;

    let subtotal = base + dist * perKm;

    const effectiveMoveType = state.moveType === "storage" ? state.storageBase : state.moveType;
    if (effectiveMoveType === "half") subtotal = Math.round(subtotal * HALF_PREMIUM_MULTIPLIER);

    // load
    const loadMap = getLoadMap(effectiveMoveType);
    const loadPrice = state.load && loadMap[state.load] ? toNumberSafe(loadMap[state.load].price, 0) : 0;
    subtotal += loadPrice;

    // items (merged with throw)
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

    // stairs
    const stairFromCost = state.noFrom ? stairExtraByFloor(state.fromFloor) : 0;
    const stairToCost = state.noTo ? stairExtraByFloor(state.toFloor) : 0;
    subtotal += stairFromCost + stairToCost;

    // cantCarry
    subtotal += (state.cantCarryFrom ? 30000 : 0) + (state.cantCarryTo ? 30000 : 0);

    // helper
    subtotal += (state.helperFrom ? 40000 : 0) + (state.helperTo ? 40000 : 0);

    // ride
    subtotal += Math.max(0, Number(state.ride) || 0) * 10000;

    // ladder
    const ladderFromCost = state.ladderFromEnabled ? ladderPriceByFloor(state.ladderFromFloor) : 0;
    const ladderToCost = state.ladderToEnabled ? ladderPriceByFloor(state.ladderToFloor) : 0;
    const ladderCost = ladderFromCost + ladderToCost;
    subtotal += ladderCost;

    // move cleaning add-on
    const cleaning = getMoveCleaningInfo();
    subtotal += cleaning.cost;

    // storage fee
    const storageFee =
      state.moveType === "storage"
        ? Math.max(1, parseInt(String(state.storageDays || 1), 10) || 1) * STORAGE_PER_DAY
        : 0;
    subtotal += storageFee;

    subtotal = Math.round(subtotal * PRICE_MULTIPLIER);
    const displayPrice = Math.round(subtotal * DISPLAY_MULTIPLIER);

    // summary html
    const vehicleLabel = state.vehicle || "미선택";
    const moveLabel = moveTypeLabel(state.moveType, state.storageBase, state.storageDays);

    const stairsFrom = state.noFrom ? `${state.fromFloor}층(엘베없음)` : "엘베있음";
    const stairsTo = state.noTo ? `${state.toFloor}층(엘베없음)` : "엘베있음";

    const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "미선택";
    const itemsLabel = getSelectedQtyLabelFromMap(mergedAllItems, FURNITURE_PRICE, "없음");
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
    const priceText = `₩${displayPrice.toLocaleString("ko-KR")}`;

    const html = `
      <div class="sum">
        <div><b>서비스</b>: 이사·용달</div>
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

    return { subtotal, displayPrice, html };
  }

  function calcCleanTotal() {
    const pyeong = Math.max(1, parseInt(String(state.cleanPyeong || 0), 10) || 0);
    if (!pyeong) return { subtotal: 0, displayPrice: 0, html: "조건을 선택하세요" };

    // base: min + per pyeong
    let base = Math.max(CLEAN_MIN_PRICE, pyeong * CLEAN_PER_PYEONG);

    // type multiplier (occupied etc)
    const typeMult = CLEAN_TYPE_MULT[state.cleanType] ?? 1.0;
    base = Math.round(base * typeMult);

    // soil multiplier
    const soilMult = CLEAN_SOIL_MULT[state.cleanSoil] ?? 1.0;
    base = Math.round(base * soilMult);

    // structure extras
    let extra = 0;

    const bath = Math.max(1, parseInt(String(state.cleanBaths || 1), 10) || 1);
    if (bath > 1) extra += (bath - 1) * CLEAN_BATH_EXTRA_EACH;

    const bal = Math.max(0, parseInt(String(state.cleanBalconies || 0), 10) || 0);
    if (bal >= 3) extra += CLEAN_BALCONY_3P_EXTRA;

    const wd = Math.max(0, parseInt(String(state.cleanWardrobes || 0), 10) || 0);
    if (wd >= 2) extra += CLEAN_WARDROBE_2P_EXTRA;

    // parking / stairs
    if (state.cleanParkingHard) extra += CLEAN_PARKING_HARD_EXTRA;

    if (state.cleanNoElevator) {
      const f = Math.max(1, parseInt(String(state.cleanFloor || 1), 10) || 1);
      extra += Math.max(0, f - 1) * CLEAN_NO_ELEVATOR_PER_FLOOR;
    }

    // outer window (simple per pyeong pricing)
    // 여기서는 “평당 8,000” 근사치로 잡고, 실제는 상담 후 조정될 수 있게 메시지/힌트로 커버
    if (state.cleanOuterWindowEnabled) {
      const ow = Math.max(0, parseInt(String(state.cleanOuterWindowPyeong || 0), 10) || 0);
      extra += ow * 8000;
    }

    // phytoncide toggle: if enabled and user didn't set qty in modal, default apply by pyeong
    if (state.cleanPhytoncideEnabled) {
      const q = Math.max(0, parseInt(String(state.cleanBasicQty["피톤치드(평)"] || 0), 10) || 0);
      if (q <= 0) {
        // auto apply by pyeong
        extra += pyeong * 5000;
      }
    }

    // disinfect toggle (flat)
    if (state.cleanDisinfectEnabled) extra += 80000;

    // trash bags
    extra += Math.max(0, parseInt(String(state.cleanTrashBags || 0), 10) || 0) * 5000;

    // modal options: basic + appliance
    Object.entries(state.cleanBasicQty || {}).forEach(([k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      if (!q) return;
      const unit = toNumberSafe(CLEAN_BASIC_PRICE[k]?.price, 0);
      extra += unit * q;
    });

    Object.entries(state.cleanApplianceQty || {}).forEach(([k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      if (!q) return;
      const unit = toNumberSafe(CLEAN_APPLIANCE_PRICE[k]?.price, 0);
      extra += unit * q;
    });

    let subtotal = base + extra;
    subtotal = Math.round(subtotal * PRICE_MULTIPLIER);
    const displayPrice = Math.round(subtotal * DISPLAY_MULTIPLIER);

    const typeLabel =
      state.cleanType === "occupied" ? "거주청소(짐있음)" :
      state.cleanType === "moveout" ? "이사청소(퇴거)" : "입주청소(공실)";

    const outerWinLabel = state.cleanOuterWindowEnabled
      ? `사용 (${state.cleanOuterWindowPyeong || 0}평)`
      : "미사용";

    const scheduleLabel = state.moveDate || "미선택";
    const timeSlotLabel = formatTimeSlotKR(state.timeSlot);

    const basicLabel = getSelectedQtyLabelFromMap(state.cleanBasicQty, CLEAN_BASIC_PRICE, "없음");
    const applLabel = getSelectedQtyLabelFromMap(state.cleanApplianceQty, CLEAN_APPLIANCE_PRICE, "없음");

    const priceText = `₩${displayPrice.toLocaleString("ko-KR")}`;

    const html = `
      <div class="sum">
        <div><b>서비스</b>: 입주청소</div>
        <div><b>청소 유형</b>: ${escapeHtml(typeLabel)}</div>
        <div><b>평수</b>: ${escapeHtml(String(pyeong))}평</div>
        <div><b>구조</b>: 방 ${escapeHtml(String(state.cleanRooms))} / 화장실 ${escapeHtml(String(state.cleanBaths))} / 베란다 ${escapeHtml(String(state.cleanBalconies))} / 붙박이장 ${escapeHtml(String(state.cleanWardrobes))}</div>
        <div><b>주소</b>: ${escapeHtml(state.cleanAddress || "미입력")}</div>
        ${state.cleanAddressNote ? `<div><b>출입/주차 메모</b>: ${escapeHtml(state.cleanAddressNote)}</div>` : ""}
        <div><b>일정</b>: ${escapeHtml(scheduleLabel)} / ${escapeHtml(timeSlotLabel)}</div>

        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(255,255,255,.12);" />

        <div><b>오염도</b>: ${escapeHtml(state.cleanSoil)}</div>
        <div><b>외창</b>: ${escapeHtml(outerWinLabel)}</div>
        <div><b>주차</b>: ${escapeHtml(state.cleanParkingHard ? "어려움" : "보통/가능")}</div>
        <div><b>엘리베이터</b>: ${escapeHtml(state.cleanNoElevator ? `없음(${state.cleanFloor}층)` : "있음")}</div>
        <div><b>피톤치드</b>: ${escapeHtml(state.cleanPhytoncideEnabled ? "사용" : "미사용")}</div>
        <div><b>살균/소독</b>: ${escapeHtml(state.cleanDisinfectEnabled ? "사용" : "미사용")}</div>
        <div><b>폐기/정리(봉투)</b>: ${escapeHtml(String(state.cleanTrashBags || 0))}개</div>

        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(255,255,255,.12);" />

        <div><b>청소 옵션(특수)</b>: ${escapeHtml(basicLabel)}</div>
        <div><b>가전·가구 클리닝</b>: ${escapeHtml(applLabel)}</div>
        ${state.cleanNote ? `<div><b>기타사항</b>: ${escapeHtml(state.cleanNote)}</div>` : ""}

        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(255,255,255,.12);" />

        <div><b>예상 금액(표시)</b>: ${priceText}</div>
        <div class="hint" style="margin-top:10px;">
          ※ 입주청소는 현장 상태(오염/스티커/곰팡이/외창/주차·동선)에 따라 변동될 수 있습니다.<br/>
          ※ 예약금 20% 입금 시 예약 확정, 잔금은 작업 당일 결제합니다.
        </div>
      </div>
    `;

    return { subtotal, displayPrice, html };
  }

  function calc() {
    // sticky bar always visible + height sync
    if (stickyBarEl) {
      stickyBarEl.style.display = "block";
      stickyBarEl.setAttribute("aria-hidden", "false");
    }
    syncStickyBarHeightVar();

    // if service not selected -> show 0
    if (state.service !== SERVICE.MOVE && state.service !== SERVICE.CLEAN) {
      lastPrice = 0;
      if (priceEl) priceEl.innerText = "₩0";
      if (stickyPriceEl) stickyPriceEl.innerText = "₩0";
      if (summaryEl) summaryEl.innerHTML = "조건을 선택하세요";
      syncWizardButtons();
      return;
    }

    const res = state.service === SERVICE.CLEAN ? calcCleanTotal() : calcMoveTotal();

    lastPrice = res.subtotal;

    const priceText = `₩${res.displayPrice.toLocaleString("ko-KR")}`;
    if (priceEl) priceEl.innerText = priceText;
    if (stickyPriceEl) stickyPriceEl.innerText = priceText;
    if (summaryEl) summaryEl.innerHTML = res.html;

    syncWizardButtons();
  }
})();
