// /assets/js/app-en.js
(() => {
  const PRICE_MULTIPLIER = 1;

  /* =========================
     Supabase client
  ========================= */
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

  /* =========================
     Confirmed slots fetch/apply
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

    const baseText = span.getAttribute("data-base-text") || span.textContent.replace(" (Closed)", "");
    span.setAttribute("data-base-text", baseText);
    span.textContent = disabled ? `${baseText} (Closed)` : baseText;

    if (disabled && el.checked) el.checked = false;
  }

  /* =========================
     Price tables
  ========================= */
  const VEHICLE_MAP = {
    "1톤 카고": "truck",
    "1톤 저상탑": "van",
    "1톤 카고+저상탑": "lorry",
  };

  const BASE_PRICE = { truck: 50000, van: 50000, lorry: 90000 };
  const PER_KM_PRICE = { truck: 1550, van: 1550, lorry: 1550 };

  const FURNITURE_PRICE = {
    "전자레인지": { label: "Microwave", price: 1500 },
    "공기청정기": { label: "Air Purifier", price: 3000 },
    "청소기": { label: "Vacuum", price: 2000 },
    "TV/모니터": { label: "TV/Monitor", price: 5000 },
    "정수기(이동만)": { label: "Water Purifier (move only)", price: 3000 },

    "세탁기(12kg이하)": { label: "Washer (≤12kg)", price: 10000 },
    "건조기(12kg이하)": { label: "Dryer (≤12kg)", price: 10000 },
    "냉장고(380L이하)": { label: "Fridge (≤380L)", price: 10000 },

    "의자": { label: "Chair", price: 3000 },
    "행거": { label: "Clothes Rack", price: 3000 },
    "협탁/사이드테이블(소형)": { label: "Small Side Table", price: 3000 },
    "화장대(소형)": { label: "Small Vanity", price: 5000 },
    "책상/테이블(일반)": { label: "Desk/Table", price: 5000 },
    "서랍장(3~5단)": { label: "Drawer (3–5 tiers)", price: 5000 },
    "책장(일반)": { label: "Bookshelf", price: 10000 },
    "수납장/TV장(일반)": { label: "Cabinet/TV Stand", price: 10000 },
    "소파(2~3인)": { label: "Sofa (2–3 seater)", price: 10000 },
    "소파(4인이상)": { label: "Sofa (4+ seater)", price: 15000 },
    "침대매트리스(킹제외)": { label: "Mattress (except King)", price: 10000 },
    "침대프레임(분해/조립)": { label: "Bed Frame (disassembly/assembly)", price: 30000 },
  };

  const LOAD_MAP_GENERAL = {
    1: { label: "1–5 boxes", price: 10000 },
    2: { label: "6–10 boxes", price: 20000 },
    3: { label: "11–15 boxes", price: 30000 },
    4: { label: "16–20 boxes", price: 40000 },
  };

  const LOAD_MAP_HALF = {
    1: { label: "1–5 boxes", price: 20000 },
    2: { label: "6–10 boxes", price: 35000 },
    3: { label: "11–15 boxes", price: 50000 },
    4: { label: "16–20 boxes", price: 65000 },
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
      const base = storageBase === "half" ? "Semi-Packing" : "Standard";
      return `Storage Move (storage-${base}, ${Math.max(1, storageDays)} day(s) / storage fee option ₩20,000 × days)`;
    }
    return moveType === "half" ? "Semi-Packing Move" : "Standard Move";
  }

  function formatTimeSlotEN(v) {
    const s = String(v || "");
    if (!s) return "Not selected";
    const hour = toNumberSafe(s, NaN);
    if (!Number.isFinite(hour)) return "Not selected";

    // slots are 7..15 (KST), show like 7:00 AM / 1:00 PM
    const isPM = hour >= 12;
    const h12 = hour === 12 ? 12 : hour % 12;
    return `${h12}:00 ${isPM ? "PM" : "AM"}`;
  }

  function buildLaborLabel(st) {
    const parts = [];
    if (st.cantCarryFrom) parts.push("Pickup: hard to carry alone (+₩30,000)");
    if (st.cantCarryTo) parts.push("Drop-off: hard to carry alone (+₩30,000)");
    if (st.helperFrom) parts.push("Pickup: add helper (+₩40,000)");
    if (st.helperTo) parts.push("Drop-off: add helper (+₩40,000)");
    return parts.length ? parts.join(", ") : "None";
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
      if (q > 0) labels.push(`${FURNITURE_PRICE[k]?.label || k} × ${q}`);
    });
    return labels.length ? labels.join(", ") : "None";
  }

  /* =========================
     ✅ Storage / Ladder rules
  ========================= */
  const STORAGE_PER_DAY = 20000; // ₩20,000 per day (option)

  function ladderPriceByFloor(floor) {
    const f = Math.max(1, parseInt(floor || 1, 10));
    if (f <= 6) return 100000;  // 1–6F
    if (f <= 12) return 120000; // 7–12F
    return 140000;              // 13F+
  }

  /* =========================
     State
  ========================= */
  const state = {
    vehicle: null,
    distance: 0,

    // waypoint model 1
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

    // ladder separated
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
     DOM
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

  // waypoint
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
     ChannelTalk
  ========================= */
  function bootChannelIO() {
    const pluginKey = CFG.channelPluginKey;
    if (!pluginKey) return;
    if (!window.ChannelIO) return;
    try {
      window.ChannelIO("boot", { pluginKey, hideChannelButtonOnBoot: false });
    } catch (e) {
      console.error("[ChannelIO] boot failed:", e);
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
     Init
  ========================= */
  window.addEventListener("DOMContentLoaded", async () => {
    const ok = await waitForChannelIO(6000);
    if (ok) bootChannelIO();

    // auto pick first vehicle
    const firstVehicle = document.querySelector(".vehicle");
    if (firstVehicle) {
      firstVehicle.classList.add("active");
      state.vehicle = firstVehicle.dataset.vehicle;
    }

    // waypoint toggle
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

    // storageDays default 1
    if (storageDaysEl) {
      const normalize = () => {
        const v = Math.max(1, parseInt(String(storageDaysEl.value || "1"), 10) || 1);
        storageDaysEl.value = String(v);
        state.storageDays = v;
      };
      storageDaysEl.addEventListener("input", () => {
        normalize();
        calc();
      });
      normalize();
    }

    // vehicle select
    document.querySelectorAll(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        document.querySelectorAll(".vehicle").forEach((x) => x.classList.remove("active"));
        v.classList.add("active");
        state.vehicle = v.dataset.vehicle;
        calc();
      });
    });

    // date -> apply closed slots
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

    // time select
    if (timeSlotEls?.length) {
      timeSlotEls.forEach((el) => {
        el.addEventListener("change", (e) => {
          state.timeSlot = e.target.value || "";
          calc();
        });
      });
    }

    // options
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

    // load
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
       Stepper common handler
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

    // floating bar
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
            console.error("Kakao services not loaded: check sdk.js libraries=services");
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
      console.error("Kakao SDK load failed");
      calc();
    }

    // if date preselected
    if (moveDateEl?.value) {
      state.moveDate = moveDateEl.value;
      const confirmed = await fetchConfirmedSlots(state.moveDate);
      TIME_SLOTS.forEach((slot) => setTimeSlotDisabled(slot, confirmed.has(slot)));
      const checked = document.querySelector('input[name="timeSlot"]:checked');
      state.timeSlot = checked ? checked.value : "";
    }

    // move toggle (UI)
    if (moveToggleEl && moveBodyEl) {
      const syncMoveUI = () => { moveBodyEl.style.display = moveToggleEl.checked ? "block" : "none"; };
      moveToggleEl.addEventListener("change", syncMoveUI);
      syncMoveUI();
    }

    calc();
  });

  /* =========================
     Distance calc (waypoint model 1)
  ========================= */
  if (calcDistanceBtn) {
    calcDistanceBtn.addEventListener("click", async () => {
      const start = (startAddressInput?.value || "").trim();
      const end = (endAddressInput?.value || "").trim();
      const waypoint = (waypointAddressInput?.value || "").trim();

      if (!start || !end) {
        alert("Please enter both pickup and drop-off addresses.");
        return;
      }
      if (state.hasWaypoint && !waypoint) {
        alert("Waypoint is enabled. Please enter the waypoint address.");
        return;
      }
      if (!geocoder) {
        alert("Failed to initialize Kakao Maps.\n(Check domain registration in Kakao Developers).");
        return;
      }

      calcDistanceBtn.textContent = "Calculating...";
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
        alert(error.message || "Address not found. Please enter an accurate address.");
      } finally {
        calcDistanceBtn.textContent = "Calculate distance";
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
          reject(new Error(`Address not found: "${address}"`));
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
      throw new Error(`Road distance failed: ${res.status} ${t}`);
    }

    const data = await res.json();
    const meter = data?.routes?.[0]?.summary?.distance;
    if (!Number.isFinite(meter)) throw new Error("No road distance data.");
    return Math.max(0, Math.round(meter / 1000));
  }

  async function getBestDistanceKm(startCoord, endCoord) {
    try {
      return await getRoadDistanceKmByKakaoMobility(startCoord, endCoord);
    } catch (e) {
      console.warn("[distance] Road distance failed → fallback to straight line:", e);
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

    const vehicleLabel = state.vehicle || "Not selected";
    const moveLabel = moveTypeLabel(state.moveType, state.storageBase, state.storageDays);

    const stairsFrom = state.noFrom ? `${state.fromFloor}F (no elevator)` : "Elevator available";
    const stairsTo = state.noTo ? `${state.toFloor}F (no elevator)` : "Elevator available";

    const effectiveMoveType = state.moveType === "storage" ? state.storageBase : state.moveType;
    const loadMap = getLoadMap(effectiveMoveType);
    const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "Not selected";

    const distanceLabel = state.distance > 0 ? `${state.distance} km` : "Not calculated";
    const scheduleLabel = state.moveDate || "Not selected";
    const timeSlotLabel = formatTimeSlotEN(state.timeSlot);
    const laborLabel = buildLaborLabel(state);

    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const moveItemsLabel = getSelectedQtyLabel(mergedAllItems);

    // ladder
    const ladderParts = [];
    let ladderCost = 0;
    if (state.ladderFromEnabled) {
      const p = ladderPriceByFloor(state.ladderFromFloor);
      ladderCost += p;
      ladderParts.push(`Pickup ${state.ladderFromFloor}F (₩${p.toLocaleString("ko-KR")})`);
    }
    if (state.ladderToEnabled) {
      const p = ladderPriceByFloor(state.ladderToFloor);
      ladderCost += p;
      ladderParts.push(`Drop-off ${state.ladderToFloor}F (₩${p.toLocaleString("ko-KR")})`);
    }
    const ladderLabel = ladderParts.length
      ? `${ladderParts.join(" / ")} (Total ₩${ladderCost.toLocaleString("ko-KR")})`
      : "Not needed";

    // storage fee option
    const storageFee = state.moveType === "storage"
      ? Math.max(1, parseInt(state.storageDays || 1, 10)) * STORAGE_PER_DAY
      : 0;

    const total = Math.max(0, Number(priceNumber) || 0);
    const deposit = Math.round(total * 0.2);
    const balance = total - deposit;

    const lines = [
      "Hello, I'd like to request a DDLOGI moving quote.",
      "",
      "[Details]",
      `- Move type: ${moveLabel}`,
      `- Vehicle: ${vehicleLabel}`,
      `- Distance: ${distanceLabel}`,
      `- Date: ${scheduleLabel}`,
      `- Preferred time: ${timeSlotLabel}`,
      startAddr ? `- Pickup: ${startAddr}` : null,
      state.hasWaypoint && waypoint ? `- Waypoint: ${waypoint}` : null,
      endAddr ? `- Drop-off: ${endAddr}` : null,
      `- Stairs/Elevator: Pickup ${stairsFrom} / Drop-off ${stairsTo}`,
      `- Boxes (est.): ${loadLabel}`,
      `- Furniture/Appliances (total): ${moveItemsLabel}`,
      `- Ladder truck: ${ladderLabel}`,
      state.moveType === "storage" ? `- Storage fee (option): ₩${storageFee.toLocaleString("ko-KR")}` : null,
      "",
      `[Estimated total] ₩${total.toLocaleString("ko-KR")}`,
      `[Deposit (20%)] ₩${deposit.toLocaleString("ko-KR")}`,
      `[Balance (80%)] ₩${balance.toLocaleString("ko-KR")}`,
      "※ Reservation is confirmed after deposit. Balance is paid on moving day.",
      "※ Price may change depending on on-site conditions.",
      "",
    ].filter(Boolean);

    return lines.join("\n");
  }

  /* =========================
     Price calc
     - Storage: add ₩20,000×days as option
     - Ladder: sum pickup+drop-off
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

    // 3) items (itemQty + throw)
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

    // 4) load (for storage, use storageBase)
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

    // storage fee option
    if (state.moveType === "storage") {
      const days = Math.max(1, parseInt(state.storageDays || 1, 10));
      optionCost += days * STORAGE_PER_DAY;
    }

    // ladder cost (sum)
    let ladderCost = 0;
    if (state.ladderFromEnabled) ladderCost += ladderPriceByFloor(state.ladderFromFloor);
    if (state.ladderToEnabled) ladderCost += ladderPriceByFloor(state.ladderToFloor);

    // 6) baseTotal
    let total = core + work + optionCost;

    // semi-packing premium (including storageBase)
    if (effectiveMoveType === "half") {
      total = Math.round(total * HALF_PREMIUM_MULTIPLIER);
    }

    // display multiplier
    total = Math.round(total * DISPLAY_MULTIPLIER);

    // operation multiplier
    total = Math.round(total * PRICE_MULTIPLIER);

    // add ladder
    total = Math.round(total + ladderCost);

    lastPrice = total;

    // -----------------------------
    // Summary (EN)
    // -----------------------------
    if (summaryEl) {
      const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : "Not selected";
      const laborLabel = buildLaborLabel(state);

      const ladderTextParts = [];
      if (state.ladderFromEnabled) ladderTextParts.push(`Pickup ${state.ladderFromFloor}F`);
      if (state.ladderToEnabled) ladderTextParts.push(`Drop-off ${state.ladderToFloor}F`);
      const ladderText = ladderTextParts.length ? ladderTextParts.join(" / ") : "Not needed";

      const storageText = state.moveType === "storage"
        ? ` / Storage ${Math.max(1, parseInt(state.storageDays || 1, 10))} day(s) (+₩${(Math.max(1, parseInt(state.storageDays || 1, 10)) * STORAGE_PER_DAY).toLocaleString("ko-KR")})`
        : "";

      summaryEl.innerHTML = `
        <b>🚚 Move Summary</b><br><br>

        ▪ Move type: ${moveTypeLabel(state.moveType, state.storageBase, state.storageDays)}${storageText}<br><br>

        ▪ Vehicle: ${state.vehicle}<br>
        ▪ Distance: ${dist > 0 ? dist + " km" : "Not calculated"}<br>
        ▪ Waypoint: ${state.hasWaypoint ? "Yes (Model 1)" : "No"}<br><br>

        ▪ Date: ${state.moveDate ? state.moveDate : "Not selected"}<br>
        ▪ Time: ${formatTimeSlotEN(state.timeSlot)}<br><br>

        ▪ Stairs/Elevator:<br>
        &nbsp;&nbsp;- Pickup: ${state.noFrom ? `${state.fromFloor}F (no elevator)` : "Elevator available"}<br>
        &nbsp;&nbsp;- Drop-off: ${state.noTo ? `${state.toFloor}F (no elevator)` : "Elevator available"}<br><br>

        ▪ Boxes: ${loadLabel}<br>
        ▪ Furniture/Appliances (total): ${getSelectedQtyLabel(mergedAllItems)}<br><br>

        ▪ Ladder truck: ${ladderText}<br>
        ▪ Night/Weekend: ${state.night ? "Yes" : "No"}<br>
        ▪ Passengers: ${state.ride > 0 ? `${state.ride}` : "None"}<br><br>

        ▪ Helpers/Notes: ${laborLabel}
      `;
    }

    // price UI
    const formatted = `₩${total.toLocaleString("ko-KR")}`;
    if (priceEl) priceEl.innerText = formatted;
    if (stickyPriceEl) stickyPriceEl.innerText = formatted;

    // floating bar visibility
    if (stickyBarEl && quoteSectionEl) {
      const rect = quoteSectionEl.getBoundingClientRect();
      const quoteVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
      stickyBarEl.style.display = quoteVisible ? "none" : "block";
    }
  }

  /* =========================
     Channel inquiry button
  ========================= */
  if (channelInquiryBtn) {
    channelInquiryBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!state.moveDate) return alert("Please select a moving date.");
      if (!state.timeSlot) return alert("Please select a time.");

      const confirmed = await fetchConfirmedSlots(state.moveDate);
      if (confirmed.has(String(state.timeSlot))) {
        alert("That time slot has just been closed. Please choose another time.");
        setTimeSlotDisabled(String(state.timeSlot), true);
        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : "";
        return;
      }

      if (!window.ChannelIO) return alert("ChannelTalk failed to load. Please try again.");

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