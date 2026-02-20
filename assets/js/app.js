// /assets/js/app.js
(() => {
  const PRICE_MULTIPLIER = 1;

  /* =========================
     Supabase client
  ========================= */
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

  /* =========================
     확정 슬롯 조회/반영
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

  function setTimeSlotDisabled(slotValue, disabled) {
    const el = document.querySelector(`input[name="timeSlot"][value="${slotValue}"]`);
    if (!el) return;

    el.disabled = !!disabled;

    const label = el.closest("label");
    if (!label) return;

    const span = label.querySelector("span");
    if (!span) return;

    const baseText = span.getAttribute("data-base-text") || span.textContent.replace(" (마감)", "");
    span.setAttribute("data-base-text", baseText);
    span.textContent = disabled ? `${baseText} (마감)` : baseText;

    if (disabled && el.checked) el.checked = false;
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
    "침대프레임(분해/조립)": { label: "침대 프레임 분해/조립", price: 30000 },
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
      return `보관이사 (보관-${base}, ${Math.max(1, storageDays)}일 / 보관료 2만원×일수 옵션)`;
    }
    return moveType === "half"
      ? "반포장 이사"
      : "일반이사";
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

  function buildLaborLabel(st) {
    const parts = [];
    if (st.cantCarryFrom) parts.push("출발지 기사 혼자 나르기 어려움(+3만)");
    if (st.cantCarryTo) parts.push("도착지 기사 혼자 나르기 어려움(+3만)");
    if (st.helperFrom) parts.push("출발지 인부 추가(+4만)");
    if (st.helperTo) parts.push("도착지 인부 추가(+4만)");
    return parts.length ? parts.join(", ") : "없음";
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
     ✅ 보관이사/사다리차 규칙(확정)
  ========================= */
  const STORAGE_PER_DAY = 20000; // 하루 2만 (옵션비)
function ladderPriceByFloor(floor) {
  const f = Math.max(1, parseInt(floor || 1, 10));
  if (f <= 6) return 100000;      // 1~6층
  if (f <= 12) return 120000;     // 7~12층
  return 140000;                  // 13층 이상
}

  /* =========================
     상태
  ========================= */
  const state = {
    vehicle: null,
    distance: 0,

    // 경유지 모델 1
    hasWaypoint: false,
    waypointAddress: "",

    // moveType: general | half | storage
    moveType: "general",
    // storageBase: general | half
    storageBase: "general",
    storageDays: 1,

    moveDate: "",
    timeSlot: "",

    noFrom: false,
    fromFloor: 1,
    noTo: false,
    toFloor: 1,

    // 사다리차 분리
    ladderFromEnabled: false,
    ladderToEnabled: false,
    ladderFromFloor: 6,
    ladderToFloor: 6,

    night: false,

    cantCarryFrom: false,
    cantCarryTo: false,
    helperFrom: false,
    helperTo: false,

    ride: 0,
    load: null,

    itemQty: {},

    // throw
    throwEnabled: false,
    workFrom: false,
    workTo: false,
    throwFromQty: {},
    throwToQty: {},
  };

  /* =========================
     DOM 요소
  ========================= */
  const priceEl = document.getElementById("price");
  const summaryEl = document.getElementById("summary");
  const stickyBarEl = document.getElementById("stickyPriceBar");
  const stickyPriceEl = document.getElementById("stickyPrice");
  const quoteSectionEl = document.getElementById("quoteSection");

  const distanceText = document.getElementById("distanceText");
  const startAddressInput = document.getElementById("startAddress");
  const endAddressInput = document.getElementById("endAddress");
  const calcDistanceBtn = document.getElementById("calcDistance");

  // ✅ waypoint
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
  const channelInquiryBtn = document.getElementById("channelInquiry");

  const throwToggleEl = document.getElementById("throwToggle");
  const throwBodyEl = document.getElementById("throwBody");
  const workFromEl = document.getElementById("workFrom");
  const workToEl = document.getElementById("workTo");

  const moveToggleEl = document.getElementById("moveToggle");
  const moveBodyEl = document.getElementById("moveBody");

  // storage
  const storageBodyEl = document.getElementById("storageBody");
  const storageDaysEl = document.getElementById("storageDays");
  const storageBaseEls = document.querySelectorAll('input[name="storageBase"]');

  // ladder
  const ladderFromEnabledEl = document.getElementById("ladderFromEnabled");
  const ladderToEnabledEl = document.getElementById("ladderToEnabled");
  const ladderFromBodyEl = document.getElementById("ladderFromBody");
  const ladderToBodyEl = document.getElementById("ladderToBody");
  const ladderFromFloorEl = document.getElementById("ladderFromFloor");
  const ladderToFloorEl = document.getElementById("ladderToFloor");

  let geocoder = null;
  let lastPrice = 0;
  const TIME_SLOTS = ["7", "8", "9", "10", "11", "12", "13", "14", "15"];

  /* =========================
     채널톡
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

  /* =========================
     초기화
  ========================= */
  window.addEventListener("DOMContentLoaded", async () => {
    const ok = await waitForChannelIO(6000);
    if (ok) bootChannelIO();

    // 첫 차량 자동 선택
    const firstVehicle = document.querySelector(".vehicle");
    if (firstVehicle) {
      firstVehicle.classList.add("active");
      state.vehicle = firstVehicle.dataset.vehicle;
    }

    // ✅ 경유지 토글
    if (hasWaypointEl && waypointWrapEl) {
      const syncWaypointUI = () => {
        state.hasWaypoint = !!hasWaypointEl.checked;
        waypointWrapEl.style.display = state.hasWaypoint ? "block" : "none";
        calc();
      };
      hasWaypointEl.addEventListener("change", syncWaypointUI);
      syncWaypointUI();
    }
    if (waypointAddressInput) {
      waypointAddressInput.addEventListener("input", (e) => {
        state.waypointAddress = (e.target.value || "").trim();
      });
    }

    // moveType
    document.querySelectorAll('input[name="moveType"]').forEach((el) => {
      el.addEventListener("change", (e) => {
        state.moveType = e.target.value;
        if (storageBodyEl) storageBodyEl.hidden = state.moveType !== "storage";
        calc();
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

    // storageDays 기본 1일
    if (storageDaysEl) {
      const normalize = () => {
        const v = Math.max(1, parseInt(String(storageDaysEl.value || "1"), 10) || 1);
        storageDaysEl.value = String(v);
        state.storageDays = v;
      };
      storageDaysEl.addEventListener("input", () => { normalize(); calc(); });
      normalize();
    }

    // 차량 선택
    document.querySelectorAll(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        document.querySelectorAll(".vehicle").forEach((x) => x.classList.remove("active"));
        v.classList.add("active");
        state.vehicle = v.dataset.vehicle;
        calc();
      });
    });

    // 날짜 → 마감 반영
    if (moveDateEl) {
      moveDateEl.addEventListener("change", async (e) => {
        state.moveDate = e.target.value || "";
        const confirmed = await fetchConfirmedSlots(state.moveDate);
        TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));
        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : "";
        calc();
      });
    }

    // 시간 선택
    if (timeSlotEls?.length) {
      timeSlotEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.timeSlot = e.target.value || "";
          calc();
        });
      });
    }

    // 옵션 이벤트
    if (noFromEl) noFromEl.addEventListener("change", (e) => { state.noFrom = e.target.checked; calc(); });
    if (noToEl) noToEl.addEventListener("change", (e) => { state.noTo = e.target.checked; calc(); });
    if (fromFloorEl) fromFloorEl.addEventListener("input", (e) => { state.fromFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });
    if (toFloorEl) toFloorEl.addEventListener("input", (e) => { state.toFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });

    if (nightEl) nightEl.addEventListener("change", (e) => { state.night = e.target.checked; calc(); });

    if (cantCarryFromEl) cantCarryFromEl.addEventListener("change", (e) => { state.cantCarryFrom = e.target.checked; calc(); });
    if (cantCarryToEl) cantCarryToEl.addEventListener("change", (e) => { state.cantCarryTo = e.target.checked; calc(); });
    if (helperFromEl) helperFromEl.addEventListener("change", (e) => { state.helperFrom = e.target.checked; calc(); });
    if (helperToEl) helperToEl.addEventListener("change", (e) => { state.helperTo = e.target.checked; calc(); });

    if (rideEl) rideEl.addEventListener("input", (e) => { state.ride = Math.max(0, toNumberSafe(e.target.value, 0)); calc(); });

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
    if (ladderFromFloorEl) {
      ladderFromFloorEl.addEventListener("input", () => {
        const v = Math.max(1, parseInt(String(ladderFromFloorEl.value || "1"), 10) || 1);
        ladderFromFloorEl.value = String(v);
        state.ladderFromFloor = v;
        calc();
      });
      state.ladderFromFloor = Math.max(1, parseInt(String(ladderFromFloorEl.value || "6"), 10) || 6);
      ladderFromFloorEl.value = String(state.ladderFromFloor);
    }
    if (ladderToFloorEl) {
      ladderToFloorEl.addEventListener("input", () => {
        const v = Math.max(1, parseInt(String(ladderToFloorEl.value || "1"), 10) || 1);
        ladderToFloorEl.value = String(v);
        state.ladderToFloor = v;
        calc();
      });
      state.ladderToFloor = Math.max(1, parseInt(String(ladderToFloorEl.value || "6"), 10) || 6);
      ladderToFloorEl.value = String(state.ladderToFloor);
    }

    // 짐양
    document.querySelectorAll('input[name="load"]').forEach((el) => {
      el.addEventListener("change", (e) => { state.load = e.target.value; calc(); });
    });

    // itemQty
    document.querySelectorAll(".itemQty").forEach((el) => {
      el.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-item");
        if (!key) return;
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        state.itemQty[key] = v;
        calc();
      });
      const key = el.getAttribute("data-item");
      if (key) state.itemQty[key] = Math.max(0, toNumberSafe(el.value, 0));
    });

    // throw
    if (throwToggleEl && throwBodyEl) {
      throwToggleEl.addEventListener("change", (e) => {
        state.throwEnabled = !!e.target.checked;
        throwBodyEl.style.display = state.throwEnabled ? "block" : "none";
        calc();
      });
      state.throwEnabled = !!throwToggleEl.checked;
      throwBodyEl.style.display = state.throwEnabled ? "block" : "none";
    }
    if (workFromEl) workFromEl.addEventListener("change", (e) => { state.workFrom = e.target.checked; calc(); });
    if (workToEl) workToEl.addEventListener("change", (e) => { state.workTo = e.target.checked; calc(); });

    document.querySelectorAll(".throwQty").forEach((el) => {
      el.addEventListener("input", (e) => {
        const loc = e.target.getAttribute("data-loc");
        const key = e.target.getAttribute("data-item");
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        if (!loc || !key) return;
        if (loc === "from") state.throwFromQty[key] = v;
        if (loc === "to") state.throwToQty[key] = v;
        calc();
      });

      const loc = el.getAttribute("data-loc");
      const key = el.getAttribute("data-item");
      if (loc && key) {
        const v = Math.max(0, toNumberSafe(el.value, 0));
        if (loc === "from") state.throwFromQty[key] = v;
        if (loc === "to") state.throwToQty[key] = v;
      }
    });

    /* =========================
       ✅ 스텝퍼 공통 처리 (마이너스/플러스 전부 정상화)
       - 네가 쓰는 구조가 data-dir 방식이라 이걸 “단일 규칙”으로 통일
    ========================= */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".stepper-btn");
      if (!btn) return;

      const dir = Number(btn.getAttribute("data-dir") || "0");
      if (!dir) return;

      const targetId = btn.getAttribute("data-stepper");
      if (targetId) {
        const input = document.getElementById(targetId);
        if (!input) return;

        const min = Number(input.min || "0");
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      const itemKey = btn.getAttribute("data-stepper-item");
      const loc = btn.getAttribute("data-stepper-loc");

      if (itemKey && !loc) {
        const input = document.querySelector(`.itemQty[data-item="${CSS.escape(itemKey)}"]`);
        if (!input) return;

        const min = Number(input.min || "0");
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      if (loc && itemKey) {
        const input = document.querySelector(`.throwQty[data-loc="${loc}"][data-item="${CSS.escape(itemKey)}"]`);
        if (!input) return;

        const min = Number(input.min || "0");
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || "0");
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    });

    // 플로팅바
    if (quoteSectionEl && stickyBarEl) {
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          stickyBarEl.style.display = entry.isIntersecting ? "none" : state.vehicle ? "block" : "none";
        },
        { threshold: 0.12 }
      );
      io.observe(quoteSectionEl);
    }

    // kakao load
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

    // 날짜 선택돼 있으면 마감 반영
    if (moveDateEl?.value) {
      state.moveDate = moveDateEl.value;
      const confirmed = await fetchConfirmedSlots(state.moveDate);
      TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));
      const checked = document.querySelector('input[name="timeSlot"]:checked');
      state.timeSlot = checked ? checked.value : "";
    }

    // 옮겨주세요 토글
    if (moveToggleEl && moveBodyEl) {
      const syncMoveUI = () => { moveBodyEl.style.display = moveToggleEl.checked ? "block" : "none"; };
      moveToggleEl.addEventListener("change", syncMoveUI);
      syncMoveUI();
    }

    calc();
  });

  /* =========================
     거리 계산 (경유지 모델1 포함)
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
      } catch (error) {
        alert(error.message || "주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.");
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
      console.warn("[거리] 도로거리 실패 → 직선거리로 백업:", e);
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

  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

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
    const laborLabel = buildLaborLabel(state);

    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const moveItemsLabel = getSelectedQtyLabel(mergedAllItems);

    // 사다리차
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
    const ladderLabel = ladderParts.length ? `${ladderParts.join(" / ")} (합계 ₩${ladderCost.toLocaleString("ko-KR")})` : "불필요";

    // 보관료(옵션)
    const storageFee = state.moveType === "storage"
      ? Math.max(1, parseInt(state.storageDays || 1, 10)) * STORAGE_PER_DAY
      : 0;

    const total = Math.max(0, Number(priceNumber) || 0);
    const deposit = Math.round(total * 0.2);
    const balance = total - deposit;

    const lines = [
      "안녕하세요. 디디운송 견적 문의드립니다.",
      "",
      `[조건]`,
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
      `- 사다리차: ${ladderLabel}`,
      state.moveType === "storage" ? `- 보관료(옵션): ₩${storageFee.toLocaleString("ko-KR")}` : null,
      "",
      `[예상금액] ₩${total.toLocaleString("ko-KR")}`,
      `[예약금(20%)] ₩${deposit.toLocaleString("ko-KR")}`,
      `[잔금(80%)] ₩${balance.toLocaleString("ko-KR")}`,
      "※ 예약금 입금 시 예약 확정되며, 잔금은 운송 당일 결제합니다.",
      "※ 현장 상황에 따라 금액이 변동될 수 있습니다.",
      "",
    ].filter(Boolean);

    return lines.join("\n");
  }

  /* =========================
     가격 계산
     ✅ 보관이사: 보관료(2만원×일수)만 옵션비로 추가
     ✅ 사다리차: 출/도착 각각 합산
  ========================= */
  function calc() {
    if (!state.vehicle) return;
    const key = VEHICLE_MAP[state.vehicle];
    if (!key) return;

    const base = toNumberSafe(BASE_PRICE[key], 0);
    const perKm = toNumberSafe(PER_KM_PRICE[key], 0);
    const dist = Math.max(0, toNumberSafe(state.distance, 0));

    const DISPLAY_MULTIPLIER = 0.95;
    const HALF_PREMIUM_MULTIPLIER = 1.18;

    const LOAD_BAND_MULT = { 1: 1.0, 2: 1.25, 3: 1.55, 4: 1.95 };

    const STAIR_TIER_1 = 7000;
    const STAIR_TIER_2 = 9000;
    const STAIR_TIER_3 = 12000;

    const ITEM_PRICE_MULTIPLIER = 1.28;
    const ITEM_COUNT_GROWTH_RATE = 0.02;
    const FRAGILE_RISK_MULTIPLIER = 1.45;
    const APPLIANCE_RISK_MULTIPLIER = 1.25;

    // 1) core
    let core = base + dist * perKm;

    // 2) stairs
    function calcStairCostOneSide(floor) {
      const f = Math.max(1, toNumberSafe(floor, 1));
      const flights = Math.max(0, f - 1);
      const tier1 = Math.min(flights, 1);
      const tier2 = Math.min(Math.max(flights - 1, 0), 2);
      const tier3 = Math.max(flights - 3, 0);
      return tier1 * STAIR_TIER_1 + tier2 * STAIR_TIER_2 + tier3 * STAIR_TIER_3;
    }
    const stairCost =
      (state.noFrom ? calcStairCostOneSide(state.fromFloor) : 0) +
      (state.noTo ? calcStairCostOneSide(state.toFloor) : 0);

    // 3) items (기존+throw 합산)
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const totalItemCount = Object.values(mergedAllItems).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0);

    function getRiskMultiplier(itemKey) {
      if (itemKey === "TV/모니터") return FRAGILE_RISK_MULTIPLIER;
      if (itemKey === "냉장고(380L이하)" || itemKey === "세탁기(12kg이하)" || itemKey === "건조기(12kg이하)") {
        return APPLIANCE_RISK_MULTIPLIER;
      }
      return 1;
    }

    const rawItemCost = Object.entries(mergedAllItems).reduce((sum, [k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      const basePrice = (FURNITURE_PRICE[k]?.price || 0) * ITEM_PRICE_MULTIPLIER;
      const risk = getRiskMultiplier(k);
      return sum + Math.round(basePrice * risk) * q;
    }, 0);

    const itemCost =
      totalItemCount > 0
        ? Math.round(rawItemCost * Math.pow(1 + ITEM_COUNT_GROWTH_RATE, Math.max(0, totalItemCount - 1)))
        : 0;

    // 4) load (보관이면 storageBase 기준)
    const effectiveMoveType = state.moveType === "storage" ? state.storageBase : state.moveType;
    const loadMap = getLoadMap(effectiveMoveType);

    const loadBase = state.load && loadMap[state.load] ? toNumberSafe(loadMap[state.load].price, 0) : 0;
    const band = toNumberSafe(state.load, 0);
    const bandMult = LOAD_BAND_MULT[band] ?? 1.0;
    const loadCost = Math.round(loadBase * bandMult);

    const work = loadCost + itemCost + stairCost;

    // 5) optionCost
    let optionCost = 0;
    optionCost += toNumberSafe(state.ride, 0) * 20000;

    if (state.cantCarryFrom) optionCost += 30000;
    if (state.cantCarryTo) optionCost += 30000;
    if (state.helperFrom) optionCost += 40000;
    if (state.helperTo) optionCost += 40000;

    // ✅ 보관료: 2만원×일수 (옵션비로만)
    if (state.moveType === "storage") {
      const days = Math.max(1, parseInt(state.storageDays || 1, 10));
      optionCost += days * STORAGE_PER_DAY;
    }

    // ✅ 사다리차: 출/도착 각각 합산
    let ladderCost = 0;
    if (state.ladderFromEnabled) ladderCost += ladderPriceByFloor(state.ladderFromFloor);
    if (state.ladderToEnabled) ladderCost += ladderPriceByFloor(state.ladderToFloor);

    // 6) baseTotal
    let total = core + work + optionCost;

    // 반포장 프리미엄 (storageBase 포함)
    if (effectiveMoveType === "half") {
      total = Math.round(total * HALF_PREMIUM_MULTIPLIER);
    }

    // 표시배율
    total = Math.round(total * DISPLAY_MULTIPLIER);

    // 운영 배율
    total = Math.round(total * PRICE_MULTIPLIER);

    // 사다리차 합산
    total = Math.round(total + ladderCost);

    lastPrice = total;

    // -----------------------------
    // 요약
    // -----------------------------
    if (summaryEl) {
      const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "미선택";
      const laborLabel = buildLaborLabel(state);

      const ladderTextParts = [];
      if (state.ladderFromEnabled) ladderTextParts.push(`출발 ${state.ladderFromFloor}층`);
      if (state.ladderToEnabled) ladderTextParts.push(`도착 ${state.ladderToFloor}층`);
      const ladderText = ladderTextParts.length ? ladderTextParts.join(" / ") : "불필요";

      const storageText = state.moveType === "storage"
        ? ` / 보관 ${Math.max(1, parseInt(state.storageDays || 1, 10))}일(+${(Math.max(1, parseInt(state.storageDays || 1, 10))*STORAGE_PER_DAY).toLocaleString("ko-KR")}원)`
        : "";

      summaryEl.innerHTML = `
        <b>🚚 이사 조건 요약</b><br><br>

        ▪ 이사 방식: ${moveTypeLabel(state.moveType, state.storageBase, state.storageDays)}${storageText}<br><br>

        ▪ 차량: ${state.vehicle}<br>
        ▪ 거리: ${dist > 0 ? dist + " km" : "미계산"}<br>
        ▪ 경유지: ${state.hasWaypoint ? "있음(모델1)" : "없음"}<br><br>

        ▪ 일정: ${state.moveDate ? state.moveDate : "미선택"}<br>
        ▪ 희망 시간: ${formatTimeSlotKR(state.timeSlot)}<br><br>

        ▪ 계단:<br>
        &nbsp;&nbsp;- 출발지: ${state.noFrom ? `${state.fromFloor}층 (엘베 없음)` : "엘베 있음"}<br>
        &nbsp;&nbsp;- 도착지: ${state.noTo ? `${state.toFloor}층 (엘베 없음)` : "엘베 있음"}<br><br>

        ▪ 짐양: ${loadLabel}<br>
        ▪ 가구·가전(합산): ${getSelectedQtyLabel(mergedAllItems)}<br><br>

        ▪ 사다리차: ${ladderText}<br>
        ▪ 야간/주말: ${state.night ? "해당" : "미해당"}<br>
        ▪ 동승 인원: ${state.ride > 0 ? `${state.ride}명` : "없음"}<br><br>

        ▪ 인부/작업: ${laborLabel}
      `;
    }

    // 가격 표시
    const formatted = `₩${total.toLocaleString("ko-KR")}`;
    if (priceEl) priceEl.innerText = formatted;
    if (stickyPriceEl) stickyPriceEl.innerText = formatted;

    // 플로팅바 표시
    if (stickyBarEl && quoteSectionEl) {
      const rect = quoteSectionEl.getBoundingClientRect();
      const quoteVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
      stickyBarEl.style.display = quoteVisible ? "none" : "block";
    }
  }

  /* =========================
     채널톡 문의 버튼
  ========================= */
  if (channelInquiryBtn) {
    channelInquiryBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!state.moveDate) return alert("이사 날짜를 선택해주세요.");
      if (!state.timeSlot) return alert("시간을 선택해주세요.");

      const confirmed = await fetchConfirmedSlots(state.moveDate);
      if (confirmed.has(String(state.timeSlot))) {
        alert("방금 해당 시간이 마감되었습니다. 다른 시간을 선택해주세요.");
        setTimeSlotDisabled(String(state.timeSlot), true);
        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : "";
        return;
      }

      if (!window.ChannelIO) return alert("채널톡 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.");

      bootChannelIO();

      const msg = buildInquiryMessage(lastPrice);

      try {
        window.ChannelIO("openChat", undefined, msg);
      } catch (err) {
        console.error("ChannelIO openChat error:", err);
        try { window.ChannelIO("showMessenger"); } catch (_) {}
      }
    });
  }
})();