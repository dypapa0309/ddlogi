// /assets/js/app.js
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    /* 날짜 입력칸 전체 클릭 시 달력 열기 */
    const wrap = document.querySelector(".date-wrap");
    const input = document.querySelector("#moveDate");

    if (wrap && input) {
      wrap.addEventListener("click", () => {
        input.focus();
        if (input.showPicker) input.showPicker();
        else input.click();
      });
    }

    /* =========================================================
       Global knobs
    ========================================================= */
    const PRICE_MULTIPLIER = 0.85;
    const DISPLAY_MULTIPLIER = 0.95;
    const SERVICE = { MOVE: "move", CLEAN: "clean" };

    /* =========================================================
       DOM helpers
    ========================================================= */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const safeText = (v) => (v == null ? "" : String(v));
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    function formatWon(n) {
      const x = Math.trunc(Number(n) || 0); // ✅ 반올림 X (원단위 버림)
      return "₩" + x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function toInt(v, d = 0) {
      const n = parseInt(String(v ?? ""), 10);
      return Number.isFinite(n) ? n : d;
    }

    function toNum(v, d = 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    }

    function setHidden(el, hidden) {
      if (!el) return;
      el.hidden = !!hidden;
      el.style.display = hidden ? "none" : "";
    }
function normalizeItemKey(k) {
  // 항목 키의 공백을 없애서 가격표에서 일치하도록 보정
  return String(k || "").replace(/\s+/g, "");
}
    /* =========================================================
       Config / Supabase
    ========================================================= */
    const CFG = window.DDLOGI_CONFIG || {};
    const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

    async function fetchConfirmedSlots(dateStr) {
      if (!supabase || !dateStr) return new Set();
      try {
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
      } catch (e) {
        console.error("fetchConfirmedSlots exception:", e);
        return new Set();
      }
    }

    function setTimeSlotDisabled(slotValue, disabled) {
      const v = String(slotValue);
      const r = document.querySelector('input[name="timeSlot"][value="' + v + '"]');
      if (!r) return;
      r.disabled = !!disabled;

      const chip = r.closest(".time-chip");
      if (chip) {
        chip.classList.toggle("disabled", !!disabled);
        chip.setAttribute("aria-disabled", disabled ? "true" : "false");
      }

      // ✅ disable되면 체크 해제 + state 반영
      if (disabled && r.checked) {
        r.checked = false;
        state.timeSlot = null;
      }
    }

    async function refreshTimeSlotAvailability() {
      const dateStr = state.moveDate;
      const all = $$('input[name="timeSlot"]');
      all.forEach((r) => setTimeSlotDisabled(r.value, false));

      if (!dateStr) return;

      const confirmed = await fetchConfirmedSlots(dateStr);
      confirmed.forEach((slot) => setTimeSlotDisabled(slot, true));
    }

    /* =========================================================
       State
    ========================================================= */
    const state = {
      activeService: null,
      stepIndex: 0,
      moveDate: "",
      timeSlot: null,

      vehicle: "",
      startAddress: "",
      waypointAddress: "",
      endAddress: "",
      hasWaypoint: false,
      distanceKm: 0,

      moveType: "general",
      storageBase: "general",
      storageDays: 1,

      noFrom: false,
      fromFloor: 1,
      noTo: false,
      toFloor: 1,

      loadLevel: 0,

      cantCarryFrom: false,
      cantCarryTo: false,
      helperFrom: false,
      helperTo: false,

      ladderFromEnabled: false,
      ladderFromFloor: 6,
      ladderToEnabled: false,
      ladderToFloor: 6,

      night: false,
      ride: 0,

      cleaningToggle: false,
      cleaningFrom: false,
      cleaningTo: false,
      cleaningType: "light",

      throwToggle: false,
      workFrom: false,
      workTo: false,

      items: {},
      itemsNote: "",
      mattressSizes: { S: 0, SS: 0, D: 0, Q: 0, K: 0 },

      throwFrom: {},
      throwTo: {},
      throwNote: "",

      cleanType: "movein",
      cleanSoil: "light",
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
      cleanOuterWindowPyeong: 0,
      cleanPhytoncideEnabled: false,
      cleanDisinfectEnabled: false,
      cleanTrashBags: 0,
      cleanBasic: {},
      cleanAppliance: {},
      cleanNote: "",
    };

    /* =========================================================
       Wizard step model (DOM-driven)
    ========================================================= */
    const sections = $$(".step-card");

    function getStepToken(sectionEl) {
      const raw = sectionEl.getAttribute("data-step");
      if (raw == null) return null;
      if (/^\d+$/.test(raw.trim())) return Number(raw.trim());
      return raw.trim();
    }

    function computeVisibleSteps() {
      const svc = state.activeService;
      const visible = [];

      for (const sec of sections) {
        const token = getStepToken(sec);
        if (token == null) continue;

        const secOnly = sec.getAttribute("data-only");
        if (!svc) {
          if (token === 0 || token === "service") visible.push(sec);
        } else {
          if (secOnly && secOnly !== svc) continue;
          visible.push(sec);
        }
      }
      return visible;
    }

    function showOnlySection(activeSec) {
      for (const sec of sections) {
        const isActive = sec === activeSec;
        sec.style.display = isActive ? "" : "none";
        sec.setAttribute("aria-hidden", isActive ? "false" : "true");
        sec.classList.toggle("is-active", isActive);

        const svc = state.activeService;
        const innerOnly = $$("[data-only]", sec);
        innerOnly.forEach((node) => {
          const only = node.getAttribute("data-only");
          if (!only) return;
          if (!svc) node.style.display = "none";
          else node.style.display = only === svc ? "" : "none";
        });
      }
    }

    function gotoStep(index, opts = {}) {
      const visible = computeVisibleSteps();
      const maxIdx = Math.max(0, visible.length - 1);
      const nextIdx = clamp(index, 0, maxIdx);
      state.stepIndex = nextIdx;

      const sec = visible[nextIdx];
      showOnlySection(sec);
      updateWizardUI(visible);

      const token = getStepToken(sec);
      if (token === 3) refreshTimeSlotAvailability();
      if (token === 12) renderAll();

      if (!opts.noScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function updateWizardUI(visibleSteps) {
      const stepText = $("#wizardStepText");
      const bar = $("#wizardProgressBar");
      const nav = $("#wizardNav");
      const prevBtn = $("#wizardPrev");
      const nextBtn = $("#wizardNext");

      const activeSec = visibleSteps[state.stepIndex];
      const token = getStepToken(activeSec);

      const totalDisplay = Math.max(1, visibleSteps.filter((s) => getStepToken(s) !== 0).length);
      const currentDisplay =
        getStepToken(activeSec) === 0
          ? 1
          : visibleSteps.filter((s) => getStepToken(s) !== 0).indexOf(activeSec) + 1;

      if (stepText) stepText.textContent = `${currentDisplay} / ${totalDisplay}`;

      const pct =
        totalDisplay <= 1 ? 100 : Math.round(((currentDisplay - 1) / (totalDisplay - 1)) * 100);
      if (bar) bar.style.width = `${clamp(pct, 0, 100)}%`;

      if (prevBtn) prevBtn.disabled = state.stepIndex <= 0;

      let nextLabel = "다음";
      if (token === 0) nextLabel = "시작";
      if (token === 12) nextLabel = "처음으로";

      if (nextBtn) nextBtn.textContent = nextLabel;
      if (nav) nav.style.display = "";
    }

    function canGoNext() {
      const visible = computeVisibleSteps();
      const sec = visible[state.stepIndex];
      const token = getStepToken(sec);

      if (token === 0) return true;
      if (token === "service") return !!state.activeService;

      if (state.activeService === SERVICE.MOVE) {
        if (token === 1) return !!state.vehicle;
        if (token === 2) return state.distanceKm > 0 && !!state.startAddress && !!state.endAddress;
        if (token === 3) return !!state.moveDate && !!state.timeSlot;
        if (token === 4) return !!state.moveType;
        if (token === 6) return state.loadLevel > 0;
      }

      if (state.activeService === SERVICE.CLEAN) {
        if (token === 1) return true;
        if (token === 2) return !!state.cleanAddress;
        if (token === 3) return !!state.moveDate && !!state.timeSlot;
        if (token === 4) return true;
      }

      return true;
    }

    function flashRequiredHint(sec) {
      if (!sec) return;
      sec.classList.add("shake");
      setTimeout(() => sec.classList.remove("shake"), 350);

      const token = getStepToken(sec);
      if (token === "service" && !state.activeService) {
        alert("서비스를 먼저 선택해주세요.");
        return;
      }
      if (state.activeService === SERVICE.MOVE) {
        if (token === 1 && !state.vehicle) alert("차량을 선택해주세요.");
        if (token === 2 && state.distanceKm <= 0) alert("거리 계산하기를 눌러주세요.");
        if (token === 3 && (!state.moveDate || !state.timeSlot)) alert("날짜와 시간을 선택해주세요.");
        if (token === 6 && state.loadLevel <= 0) alert("짐양(박스 기준)을 선택해주세요.");
      }
      if (state.activeService === SERVICE.CLEAN) {
        if (token === 2 && !state.cleanAddress) alert("청소 주소를 입력해주세요.");
        if (token === 3 && (!state.moveDate || !state.timeSlot)) alert("날짜와 시간을 선택해주세요.");
      }
    }

    function goNext() {
      const visible = computeVisibleSteps();
      const sec = visible[state.stepIndex];
      const token = getStepToken(sec);

      if (token === 12) {
        state.activeService = null;
        gotoStep(0);
        return;
      }

      if (!canGoNext()) {
        flashRequiredHint(sec);
        return;
      }
      gotoStep(state.stepIndex + 1);
    }

    function goPrev() {
      gotoStep(state.stepIndex - 1);
    }

    /* =========================================================
       Bind wizard nav
    ========================================================= */
    $("#wizardPrev")?.addEventListener("click", goPrev);
    $("#wizardNext")?.addEventListener("click", goNext);
    $("#heroStartBtn")?.addEventListener("click", () => {
      state.activeService = null;
      const visible = computeVisibleSteps();
      const idx = visible.findIndex((s) => getStepToken(s) === "service");
      gotoStep(idx >= 0 ? idx : 0);
    });

    /* =========================================================
       Service selection
    ========================================================= */
    $$(".service-card").forEach((card) => {
      card.addEventListener("click", () => {
        const svc = card.getAttribute("data-service");
        if (svc !== SERVICE.MOVE && svc !== SERVICE.CLEAN) return;
        state.activeService = svc;

        $$(".service-card").forEach((c) => c.classList.remove("is-active"));
        card.classList.add("is-active");

        const visible = computeVisibleSteps();
        const first = visible.findIndex((s) => {
          const t = getStepToken(s);
          return t !== 0 && t !== "service";
        });

        gotoStep(first >= 0 ? first : 0);
        renderAll();
      });
    });

    /* =========================================================
       Modal system
    ========================================================= */
    function openModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.setAttribute("aria-hidden", "false");
      m.classList.add("open");
      document.body.classList.add("modal-open");
    }

    function closeModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.setAttribute("aria-hidden", "true");
      m.classList.remove("open");
      document.body.classList.remove("modal-open");
    }

    $$("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    $$(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", () => {
        const id = bd.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    $("#openItemsModalBtn")?.addEventListener("click", () => openModal("itemsModal"));
    $("#openThrowModalBtn")?.addEventListener("click", () => openModal("throwModal"));
    $("#openCleanBasicModalBtn")?.addEventListener("click", () => openModal("cleanBasicModal"));
    $("#openCleanApplianceModalBtn")?.addEventListener("click", () => openModal("cleanApplianceModal"));

    /* =========================================================
       Popup (season)
    ========================================================= */
    const seasonPopup = $("#seasonPopup");
    const popupToday = $("#popupToday");
    const popupGoQuote = $("#popupGoQuote");

    function popupKey() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `ddlogi_popup_hide_${yyyy}${mm}${dd}`;
    }

    function openSeasonPopup() {
      if (!seasonPopup) return;
      seasonPopup.setAttribute("aria-hidden", "false");
      seasonPopup.classList.add("open");
    }

    function closeSeasonPopup() {
      if (!seasonPopup) return;
      seasonPopup.setAttribute("aria-hidden", "true");
      seasonPopup.classList.remove("open");
    }

    if (seasonPopup) {
      try {
        if (!localStorage.getItem(popupKey())) openSeasonPopup();
      } catch (_) {}

      $$("[data-popup-close]").forEach((x) => x.addEventListener("click", closeSeasonPopup));

      popupGoQuote?.addEventListener("click", () => {
        closeSeasonPopup();
        $("#heroStartBtn")?.click();
      });

      popupToday?.addEventListener("change", (e) => {
        if (e.target.checked) {
          try {
            localStorage.setItem(popupKey(), "1");
          } catch (_) {}
        }
      });
    }

    /* =========================================================
       Inputs binding (MOVE)
    ========================================================= */
    $$(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        state.vehicle = v.getAttribute("data-vehicle") || "";
        $$(".vehicle").forEach((x) => x.classList.remove("selected"));
        v.classList.add("selected");
        renderAll();
      });
    });

    $("#startAddress")?.addEventListener("input", (e) => (state.startAddress = e.target.value.trim()));
    $("#waypointAddress")?.addEventListener("input", (e) => (state.waypointAddress = e.target.value.trim()));
    $("#endAddress")?.addEventListener("input", (e) => (state.endAddress = e.target.value.trim()));

    $("#hasWaypoint")?.addEventListener("change", (e) => {
      state.hasWaypoint = !!e.target.checked;
      const wrap = $("#waypointWrap");
      if (wrap) wrap.style.display = state.hasWaypoint ? "" : "none";
      if (!state.hasWaypoint) state.waypointAddress = "";
    });

    let kakaoReady = false;
    function ensureKakaoReady(cb) {
      if (kakaoReady) return cb();
      if (!window.kakao || !window.kakao.maps) {
        alert("카카오맵 SDK 로딩에 실패했어. 잠깐 뒤 새로고침 해줘.");
        return;
      }
      window.kakao.maps.load(() => {
        kakaoReady = true;
        cb();
      });
    }

    function haversineKm(a, b) {
      const R = 6371;
      const toRad = (x) => (x * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);

      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
      return R * c;
    }

    function geocode(geocoder, addr) {
      return new Promise((resolve, reject) => {
        if (!addr) return reject(new Error("empty address"));
        geocoder.addressSearch(addr, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result && result[0]) {
            resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
          } else {
            reject(new Error("geocode failed"));
          }
        });
      });
    }

    async function calcDistanceKm() {
      const start = state.startAddress;
      const end = state.endAddress;
      const wp = state.hasWaypoint ? state.waypointAddress : "";

      if (!start || !end) {
        alert("출발지/도착지 주소를 입력해줘.");
        return;
      }
      if (state.hasWaypoint && !wp) {
        alert("경유지 체크했으면 경유지 주소도 입력해줘.");
        return;
      }

      const distanceText = $("#distanceText");
      if (distanceText) distanceText.textContent = "계산 중...";

      ensureKakaoReady(async () => {
        try {
          const geocoder = new window.kakao.maps.services.Geocoder();

          const a = await geocode(geocoder, start);
          const b = state.hasWaypoint ? await geocode(geocoder, wp) : null;
          const c = await geocode(geocoder, end);

          let base = 0;
          if (b) base = haversineKm(a, b) + haversineKm(b, c);
          else base = haversineKm(a, c);

          const roadish = base * 1.25;
          state.distanceKm = Math.max(0, Math.round(roadish * 10) / 10);

          if (distanceText) distanceText.textContent = `${state.distanceKm} km`;
          renderAll();
        } catch (e) {
          console.error(e);
          state.distanceKm = 0;
          if (distanceText) distanceText.textContent = "주소를 다시 확인해주세요";
          alert("거리 계산에 실패했어. 주소를 더 구체적으로 입력해줘 (도로명/건물명 추천).");
        }
      });
    }

    $("#calcDistance")?.addEventListener("click", calcDistanceKm);

    /* =========================================================
       Reservation bindings (common)
    ========================================================= */
    $("#moveDate")?.addEventListener("change", async (e) => {
      state.moveDate = e.target.value || "";
      await refreshTimeSlotAvailability();
      renderAll();
    });

    $$('input[name="timeSlot"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.timeSlot = String(e.target.value);
        renderAll();
      });
    });

    /* =========================================================
       Move type + storage
    ========================================================= */
    $$('input[name="moveType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.moveType = e.target.value;
        setHidden($("#storageBody"), state.moveType !== "storage");
        renderAll();
      });
    });

    $$('input[name="storageBase"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.storageBase = e.target.value;
        renderAll();
      });
    });

    /* =========================================================
       Steppers (generic)
    ========================================================= */
    function setStepperValue(inputEl, nextVal) {
      if (!inputEl) return;
      const min = toInt(inputEl.getAttribute("min"), 0);
      const max = toInt(inputEl.getAttribute("max"), 999999);
      const v = clamp(toInt(nextVal, min), min, max);
      inputEl.value = String(v);
      const id = inputEl.id;

      if (id === "storageDays") state.storageDays = v;
      if (id === "fromFloor") state.fromFloor = v;
      if (id === "toFloor") state.toFloor = v;
      if (id === "ladderFromFloor") state.ladderFromFloor = v;
      if (id === "ladderToFloor") state.ladderToFloor = v;
      if (id === "ride") state.ride = v;

      if (id === "cleanPyeong") state.cleanPyeong = v;
      if (id === "cleanRooms") state.cleanRooms = v;
      if (id === "cleanBaths") state.cleanBaths = v;
      if (id === "cleanBalconies") state.cleanBalconies = v;
      if (id === "cleanWardrobes") state.cleanWardrobes = v;
      if (id === "cleanFloor") state.cleanFloor = v;
      if (id === "cleanOuterWindowPyeong") state.cleanOuterWindowPyeong = v;
      if (id === "cleanTrashBags") state.cleanTrashBags = v;

      renderAll();
    }

    $$(".stepper-btn[data-stepper]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-stepper");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const input = document.getElementById(id);
        if (!input) return;
        const cur = toInt(input.value, toInt(input.getAttribute("min"), 0));
        setStepperValue(input, cur + dir);
      });
    });

    [
      "storageDays",
      "fromFloor",
      "toFloor",
      "ladderFromFloor",
      "ladderToFloor",
      "ride",
      "cleanPyeong",
      "cleanRooms",
      "cleanBaths",
      "cleanBalconies",
      "cleanWardrobes",
      "cleanFloor",
      "cleanOuterWindowPyeong",
      "cleanTrashBags",
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", (e) => setStepperValue(el, e.target.value));
    });

    /* =========================================================
       Elevator toggles (move)
    ========================================================= */
    $("#noFrom")?.addEventListener("change", (e) => {
      state.noFrom = !!e.target.checked;
      renderAll();
    });
    $("#noTo")?.addEventListener("change", (e) => {
      state.noTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Load radio (move)
    ========================================================= */
    $$('input[name="load"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.loadLevel = toInt(e.target.value, 0);
        renderAll();
      });
    });

    /* =========================================================
       Cant carry / helpers (move)
    ========================================================= */
    $("#cantCarryFrom")?.addEventListener("change", (e) => {
      state.cantCarryFrom = !!e.target.checked;
      renderAll();
    });
    $("#cantCarryTo")?.addEventListener("change", (e) => {
      state.cantCarryTo = !!e.target.checked;
      renderAll();
    });

    $("#helperFrom")?.addEventListener("change", (e) => {
      state.helperFrom = !!e.target.checked;
      renderAll();
    });
    $("#helperTo")?.addEventListener("change", (e) => {
      state.helperTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Ladder toggles (move)
    ========================================================= */
    $("#ladderFromEnabled")?.addEventListener("change", (e) => {
      state.ladderFromEnabled = !!e.target.checked;
      setHidden($("#ladderFromBody"), !state.ladderFromEnabled);
      renderAll();
    });
    $("#ladderToEnabled")?.addEventListener("change", (e) => {
      state.ladderToEnabled = !!e.target.checked;
      setHidden($("#ladderToBody"), !state.ladderToEnabled);
      renderAll();
    });

    /* =========================================================
       Extra options (move)
    ========================================================= */
    $("#night")?.addEventListener("change", (e) => {
      state.night = !!e.target.checked;
      renderAll();
    });

    $("#cleaningToggle")?.addEventListener("change", (e) => {
      state.cleaningToggle = !!e.target.checked;
      setHidden($("#cleaningBody"), !state.cleaningToggle);
      renderAll();
    });
    $("#cleaningFrom")?.addEventListener("change", (e) => {
      state.cleaningFrom = !!e.target.checked;
      renderAll();
    });
    $("#cleaningTo")?.addEventListener("change", (e) => {
      state.cleaningTo = !!e.target.checked;
      renderAll();
    });
    $$('input[name="cleaningType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleaningType = e.target.value;
        renderAll();
      });
    });

    /* =========================================================
       Throw toggle (move)
    ========================================================= */
    $("#throwToggle")?.addEventListener("change", (e) => {
      state.throwToggle = !!e.target.checked;
      const wrap = $("#throwMiniWrap");
      if (wrap) wrap.style.display = state.throwToggle ? "" : "none";
      renderAll();
    });

    $("#workFrom")?.addEventListener("change", (e) => {
      state.workFrom = !!e.target.checked;
      renderAll();
    });
    $("#workTo")?.addEventListener("change", (e) => {
      state.workTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Items modal steppers (move items)
    ========================================================= */
    function setItemQty(itemKey, qty) {
      const k = safeText(itemKey);
      const q = Math.max(0, toInt(qty, 0));
      if (!k) return;
      if (q <= 0) delete state.items[k];
      else state.items[k] = q;

      if (k === "침대매트리스(킹제외)") {
        const total = q;
        const sumSizes = Object.values(state.mattressSizes).reduce((a, b) => a + toInt(b, 0), 0);
        if (total > 0 && sumSizes === 0) openModal("mattressSizeModal");

        if (sumSizes > total) {
          state.mattressSizes.S = 0;
          state.mattressSizes.SS = 0;
          state.mattressSizes.D = 0;
          state.mattressSizes.Q = 0;
        }
      }
    }

    $$(".stepper-btn[data-stepper-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.getAttribute("data-stepper-item");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const modal = btn.closest(".modal") || document;
        const inp = modal.querySelector('.itemQty[data-item="' + item + '"]');
        if (!inp) return;
        const cur = toInt(inp.value, 0);
        const next = Math.max(0, cur + dir);
        inp.value = String(next);
        setItemQty(item, next);
        renderAll();
      });
    });

    $$(".itemQty").forEach((inp) => {
      inp.addEventListener("input", () => {
        const item = inp.getAttribute("data-item");
        setItemQty(item, inp.value);
        renderAll();
      });
    });

    $("#itemsNote")?.addEventListener("input", (e) => {
      state.itemsNote = e.target.value || "";
      renderAll();
    });

    /* =========================================================
       Mattress size modal (optional)
    ========================================================= */
    function totalMattressQty() {
      return toInt(state.items["침대매트리스(킹제외)"], 0);
    }

    function setMattressSize(sizeKey, qty) {
      const key = String(sizeKey);
      const v = Math.max(0, toInt(qty, 0));
      state.mattressSizes[key] = v;

      const total = totalMattressQty();
      const sum = Object.values(state.mattressSizes).reduce((a, b) => a + toInt(b, 0), 0);
      if (sum > total) {
        state.mattressSizes[key] = Math.max(0, v - (sum - total));
      }
    }

    $$(".stepper-btn[data-stepper-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const size = btn.getAttribute("data-stepper-size");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const inp = document.querySelector('#mattressSizeModal input[data-size="' + size + '"]');
        if (!inp) return;
        const cur = toInt(inp.value, 0);
        const next = Math.max(0, cur + dir);
        inp.value = String(next);
        setMattressSize(size, next);
        renderAll();
      });
    });

    $$("#mattressSizeModal input[data-size]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const size = inp.getAttribute("data-size");
        setMattressSize(size, inp.value);
        renderAll();
      });
    });

    /* =========================================================
       Throw modal steppers
    ========================================================= */
    function setThrowQty(loc, itemKey, qty) {
      const where = loc === "to" ? "to" : "from";
      const k = safeText(itemKey);
      const q = Math.max(0, toInt(qty, 0));
      if (!k) return;

      const target = where === "to" ? state.throwTo : state.throwFrom;
      if (q <= 0) delete target[k];
      else target[k] = q;
    }

    $$(".stepper-btn[data-stepper-loc][data-stepper-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loc = btn.getAttribute("data-stepper-loc");
        const item = btn.getAttribute("data-stepper-item");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const modal = btn.closest(".modal") || document;
        const inp = modal.querySelector(
          '.throwQty[data-loc="' + loc + '"][data-item="' + item + '"]'
        );
        if (!inp) return;
        const cur = toInt(inp.value, 0);
        const next = Math.max(0, cur + dir);
        inp.value = String(next);
        setThrowQty(loc, item, next);
        renderAll();
      });
    });

    $$(".throwQty").forEach((inp) => {
      inp.addEventListener("input", () => {
        const loc = inp.getAttribute("data-loc");
        const item = inp.getAttribute("data-item");
        setThrowQty(loc, item, inp.value);
        renderAll();
      });
    });

    $("#throwNote")?.addEventListener("input", (e) => {
      state.throwNote = e.target.value || "";
      renderAll();
    });

    /* =========================================================
       CLEAN bindings
    ========================================================= */
    $$('input[name="cleanType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanType = e.target.value;
        renderAll();
      });
    });

    $$('input[name="cleanSoil"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanSoil = e.target.value;
        renderAll();
      });
    });

    $("#cleanAddress")?.addEventListener("input", (e) => {
      state.cleanAddress = (e.target.value || "").trim();
      renderAll();
    });
    $("#cleanAddressNote")?.addEventListener("input", (e) => {
      state.cleanAddressNote = e.target.value || "";
      renderAll();
    });

    $("#cleanParkingHard")?.addEventListener("change", (e) => {
      state.cleanParkingHard = !!e.target.checked;
      renderAll();
    });
    $("#cleanNoElevator")?.addEventListener("change", (e) => {
      state.cleanNoElevator = !!e.target.checked;
      renderAll();
    });

    $("#cleanOuterWindowEnabled")?.addEventListener("change", (e) => {
      state.cleanOuterWindowEnabled = !!e.target.checked;
      setHidden($("#cleanOuterWindowBody"), !state.cleanOuterWindowEnabled);
      renderAll();
    });

    $("#cleanPhytoncideEnabled")?.addEventListener("change", (e) => {
      state.cleanPhytoncideEnabled = !!e.target.checked;
      renderAll();
    });
    $("#cleanDisinfectEnabled")?.addEventListener("change", (e) => {
      state.cleanDisinfectEnabled = !!e.target.checked;
      renderAll();
    });

    $("#cleanNote")?.addEventListener("input", (e) => {
      state.cleanNote = e.target.value || "";
      const prev = $("#cleanNotePreview");
      if (prev) prev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
      renderAll();
    });

    function setCleanQty(group, item, qty) {
      const g = group === "appliance" ? "appliance" : "basic";
      const k = safeText(item);
      const q = Math.max(0, toInt(qty, 0));
      const target = g === "appliance" ? state.cleanAppliance : state.cleanBasic;
      if (!k) return;
      if (q <= 0) delete target[k];
      else target[k] = q;
    }

    $$(".stepper-btn[data-clean-group][data-clean-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.getAttribute("data-clean-group");
        const item = btn.getAttribute("data-clean-item");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const modal = btn.closest(".modal") || document;
        const inp = modal.querySelector(
          '.cleanQty[data-clean-group="' + group + '"][data-clean-item="' + item + '"]'
        );
        if (!inp) return;
        const cur = toInt(inp.value, 0);
        const next = Math.max(0, cur + dir);
        inp.value = String(next);
        setCleanQty(group, item, next);
        renderAll();
      });
    });

    $$(".cleanQty").forEach((inp) => {
      inp.addEventListener("input", () => {
        const group = inp.getAttribute("data-clean-group");
        const item = inp.getAttribute("data-clean-item");
        setCleanQty(group, item, inp.value);
        renderAll();
      });
    });

    /* =========================================================
       Storage fee model
    ========================================================= */
    function calcStorageFee(days) {
      const d = Math.max(1, toInt(days, 1));
      const day1 = 20000;
      const day2to30 = 12000;
      let fee = day1 + Math.max(0, Math.min(d, 30) - 1) * day2to30;
      if (d >= 30) fee = 370000; // ✅ 상한
      return fee;
    }

    /* =========================================================
       Pricing model
    ========================================================= */
    function moveBaseByVehicle(vehicle) {
      if (vehicle.includes("저상탑") && vehicle.includes("카고")) return 95000;
      if (vehicle.includes("저상탑")) return 50000;
      if (vehicle.includes("카고")) return 50000;
      return 0;
    }

    function moveDistanceFee(km) {
      const d = Math.max(0, toNum(km, 0));
      const a = Math.min(d, 10) * 2000;
      const b = Math.max(0, d - 10) * 1550;
      return a + b;
    }

    function moveLoadFee(level) {
      const map = { 1: 10000, 2: 23000, 3: 40000, 4: 66000 };
      return map[level] ?? 0;
    }

    function stairsFee(noElevator, floor) {
      if (!noElevator) return 0;
      const f = Math.max(1, toInt(floor, 1));
      return Math.max(0, f - 1) * 10000;
    }

    function helperFee(helper) {
      return helper ? 40000 : 0;
    }

    function cantCarryFee(flag) {
      return flag ? 30000 : 0;
    }

    function ladderFee(enabled, floor) {
      if (!enabled) return 0;
      const f = Math.max(1, toInt(floor, 1));
      if (f <= 6) return 110000;
      if (f <= 12) return 140000;
      return 160000;
    }

    function rideFee(n) {
      const x = Math.max(0, toInt(n, 0));
      return x * 20000;
    }

    function moveCleaningFee() {
      if (!state.cleaningToggle) return 0;
      const unit = state.cleaningType === "deep" ? 60000 : 30000;
      let fee = 0;
      if (state.cleaningFrom) fee += unit;
      if (state.cleaningTo) fee += unit;
      return fee;
    }

   function itemsFee(items) {
  let fee = 0;
  const obj = items || {};

  // ✅ 가전·가구 가격표 (필요시 단가 조정 가능)
  const PRICE = {
    // 가전
    "전자레인지": 5000,
    "공기청정기": 5000,
    "청소기": 5000,
    "TV(55이하)": 15000,
    "TV(65이상)": 30000,
    "모니터": 5000,
    "데스크탑": 5000,
    "프린터": 5000,
    "정수기(이동만)": 20000,

    "세탁기(12kg이하)": 30000,
    "세탁기(12kg초과)": 50000,
    "건조기(12kg이하)": 30000,
    "건조기(12kg초과)": 50000,

    "냉장고(380L이하)": 30000,
    "냉장고(600L이하)": 50000,
    "냉장고(600L초과)": 80000,

    "김치냉장고": 30000,
    "스타일러": 80000,

    // 가구
    "의자": 5000,
    "행거": 10000,
    "협탁/사이드테이블(소형)": 10000,
    "화장대(소형)": 15000,
    "책상/테이블(일반)": 20000,
    "서랍장(3~5단)": 20000,
    "책장(일반)": 20000,
    "수납장/TV장(일반)": 25000,

    "소파(2~3인)": 30000,
    "소파(4인이상)": 50000,

    // 침대
    "침대매트리스(킹제외)": 20000,
    "침대프레임(분해/조립)": 60000
  };

  // 항목별 합산
  for (const [rawKey, qtyRaw] of Object.entries(obj)) {
    const k = normalizeItemKey(rawKey);
    const q = toInt(qtyRaw, 0);
    if (q <= 0) continue;
    const unit = PRICE[k] ?? 0;
    fee += unit * q;
  }

  // 매트리스 사이즈별 추가요금(퀸, 킹)
  const m = toInt(obj["침대매트리스(킹제외)"], 0) || toInt(obj[normalizeItemKey("침대 매트리스 (킹 제외)")], 0);
  if (m > 0) {
    const sizes = state.mattressSizes || {};
    fee += toInt(sizes.Q, 0) * 5000;
    fee += toInt(sizes.K, 0) * 10000;
  }

  return fee;
}

    function throwFeeTotal() {
      if (!state.throwToggle) return 0;
      const base = (state.workFrom ? 20000 : 0) + (state.workTo ? 20000 : 0);
      const sumFrom = Object.values(state.throwFrom).reduce((a, b) => a + toInt(b, 0), 0);
      const sumTo = Object.values(state.throwTo).reduce((a, b) => a + toInt(b, 0), 0);
      return base + (sumFrom + sumTo) * 5000;
    }

    function calcMovePrice() {
  if (!state.vehicle) return 0;

  const base = moveBaseByVehicle(state.vehicle);
  const load = moveLoadFee(state.loadLevel);

  const stairs =
    stairsFee(state.noFrom, state.fromFloor) +
    stairsFee(state.noTo, state.toFloor);

  const cantCarry =
    cantCarryFee(state.cantCarryFrom) +
    cantCarryFee(state.cantCarryTo);

  const helpers =
    helperFee(state.helperFrom) +
    helperFee(state.helperTo);

  // ✅ 작업비 덩어리(배율 대상)
  let workSubtotal = base + load + stairs + cantCarry + helpers;

  // ✅ 배율 제외(거리/사다리/동승/가전/폐기/청소옵션/보관비 등)
  const distance = moveDistanceFee(state.distanceKm);

  const ladders =
    ladderFee(state.ladderFromEnabled, state.ladderFromFloor) +
    ladderFee(state.ladderToEnabled, state.ladderToFloor);

  const ride = rideFee(state.ride);
  const cleanOpt = moveCleaningFee();
  const items = itemsFee(state.items);
  const throwFee = throwFeeTotal();

  let storageFee = 0;
  if (state.moveType === "storage") {
    storageFee = calcStorageFee(state.storageDays);
  }

  // ✅ 반포장 배율(작업비에만)
  const HALF_MULT = 1.36;
  const isHalf =
    (state.moveType === "half") ||
    (state.moveType === "storage" && state.storageBase === "half");

  if (isHalf) workSubtotal *= HALF_MULT;

  let price =
    workSubtotal +
    distance +
    ladders +
    ride +
    cleanOpt +
    items +
    throwFee +
    storageFee;

  price *= PRICE_MULTIPLIER;
  return price;
}

    function cleanBasePrice() {
      const p = Math.max(1, toInt(state.cleanPyeong, 9));
      const typeMul =
        state.cleanType === "moveout" ? 1.05 : state.cleanType === "occupied" ? 1.15 : 1.0;
      const soilMul =
        state.cleanSoil === "heavy" ? 1.2 : state.cleanSoil === "normal" ? 1.1 : 1.0;
      const per = 11000;
      return p * per * typeMul * soilMul;
    }

    function cleanOptionPrice() {
      let fee = 0;
      if (state.cleanParkingHard) fee += 10000;
      if (state.cleanNoElevator) fee += Math.max(0, toInt(state.cleanFloor, 1) - 1) * 7000;
      if (state.cleanOuterWindowEnabled) fee += Math.max(0, toInt(state.cleanOuterWindowPyeong, 0)) * 8000;
      if (state.cleanPhytoncideEnabled) fee += 30000;
      if (state.cleanDisinfectEnabled) fee += 30000;
      fee += Math.max(0, toInt(state.cleanTrashBags, 0)) * 2000;
      fee += Math.max(0, toInt(state.cleanWardrobes, 0)) * 8000;
      fee += Math.max(0, toInt(state.cleanRooms, 1) - 1) * 7000;
      fee += Math.max(0, toInt(state.cleanBaths, 1) - 1) * 12000;
      fee += Math.max(0, toInt(state.cleanBalconies, 0)) * 5000;

      const basic = state.cleanBasic || {};
      const appliance = state.cleanAppliance || {};

      fee += toInt(basic["곰팡이제거"], 0) * 15000;
      fee += toInt(basic["스티커제거"], 0) * 10000;
      fee += toInt(basic["페인트잔여"], 0) * 15000;
      fee += toInt(basic["니코틴케어"], 0) * 25000;
      fee += toInt(basic["반려동물케어"], 0) * 25000;
      fee += toInt(basic["피톤치드(평)"], 0) * 3000;

      fee += toInt(appliance["에어컨(벽걸이)"], 0) * 70000;
      fee += toInt(appliance["에어컨(스탠드)"], 0) * 90000;
      fee += toInt(appliance["에어컨(천장1way)"], 0) * 120000;
      fee += toInt(appliance["에어컨(천장4way)"], 0) * 150000;
      fee += toInt(appliance["세탁기청소"], 0) * 60000;
      fee += toInt(appliance["건조기청소"], 0) * 60000;
      fee += toInt(appliance["냉장고청소"], 0) * 70000;
      fee += toInt(appliance["후드청소"], 0) * 50000;
      fee += toInt(appliance["매트리스청소"], 0) * 40000;
      fee += toInt(appliance["소파청소"], 0) * 50000;
      fee += toInt(appliance["비데청소"], 0) * 30000;

      return fee;
    }

    function calcCleanPrice() {
      let price = 0;
      price += cleanBasePrice();
      price += cleanOptionPrice();
      price *= PRICE_MULTIPLIER;
      return price;
    }

    function calcCurrentPrice() {
      if (state.activeService === SERVICE.MOVE) return calcMovePrice();
      if (state.activeService === SERVICE.CLEAN) return calcCleanPrice();
      return 0;
    }

    /* =========================================================
       Summaries helpers  (✅ 여기로 빼서 문법 깨짐 방지)
    ========================================================= */
    function summarizeDict(obj) {
      const entries = Object.entries(obj || {}).filter(([, v]) => toInt(v, 0) > 0);
      if (!entries.length) return "선택 없음";
      // ✅ 요약에서 "외 N개"로 잘라내지 않고, 선택한 항목을 전부 보여줍니다.
      return entries.map(([k, v]) => `${k}×${toInt(v, 0)}`).join(", ");
    }

    function summarizeMattressSizes() {
      const sizes = state.mattressSizes || {};
      const order = ["S", "SS", "D", "Q", "K"];
      const parts = order
        .map((k) => (toInt(sizes[k], 0) > 0 ? `${k}×${toInt(sizes[k], 0)}` : null))
        .filter(Boolean);
      return parts.length ? `(${parts.join(", ")})` : "";
    }

    function summarizeItemsWithMattress(itemsObj) {
      const obj = itemsObj || {};
      const entries = Object.entries(obj).filter(([, v]) => toInt(v, 0) > 0);
      if (!entries.length) return "선택 없음";

      // ✅ "외 N개"로 잘라내지 않고, 선택한 항목을 전부 보여줍니다.
      const all = entries
        .map(([k, v]) => {
          const qty = toInt(v, 0);
          if (k === "침대매트리스(킹제외)") {
            const sizesText = summarizeMattressSizes();
            return sizesText ? `${k}×${qty} ${sizesText}` : `${k}×${qty}`;
          }
          return `${k}×${qty}`;
        })
        .join(", ");

      return all;
    }

    /* =========================================================
       Mini summaries + main summary
    ========================================================= */
    function renderMiniSummaries() {
      const itemsMini = $("#itemsMiniSummary");
      if (itemsMini) itemsMini.textContent = summarizeItemsWithMattress(state.items);

      const itemsNotePrev = $("#itemsNotePreview");
      if (itemsNotePrev) itemsNotePrev.textContent = `기타사항: ${state.itemsNote.trim() ? state.itemsNote.trim() : "없음"}`;

      const throwMini = $("#throwMiniSummary");
      if (throwMini) {
        const from = summarizeDict(state.throwFrom);
        const to = summarizeDict(state.throwTo);
        if (from === "선택 없음" && to === "선택 없음") throwMini.textContent = "선택 없음";
        else throwMini.textContent = `출발: ${from} / 도착: ${to}`;
      }

      const throwNotePrev = $("#throwNotePreview");
      if (throwNotePrev) throwNotePrev.textContent = `기타사항: ${state.throwNote.trim() ? state.throwNote.trim() : "없음"}`;

      const cleanBasicMini = $("#cleanBasicMiniSummary");
      if (cleanBasicMini) cleanBasicMini.textContent = summarizeDict(state.cleanBasic);

      const cleanApplianceMini = $("#cleanApplianceMiniSummary");
      if (cleanApplianceMini) cleanApplianceMini.textContent = summarizeDict(state.cleanAppliance);

      const cleanNotePrev = $("#cleanNotePreview");
      if (cleanNotePrev) cleanNotePrev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
    }

    function buildSummaryText() {
      const svc = state.activeService;
      if (!svc) return "조건을 선택하세요";

      if (svc === SERVICE.MOVE) {
        const lines = [];
        lines.push(`서비스: 이사·용달`);
        if (state.vehicle) lines.push(`차량: ${state.vehicle}`);

        if (state.moveType) {
          const mt =
            state.moveType === "general" ? "일반이사" :
            state.moveType === "half" ? "반포장이사" :
            "보관이사";
          lines.push(`이사 방식: ${mt}`);

          if (state.moveType === "storage") {
            const sb = state.storageBase === "half" ? "보관-반포장" : "보관-일반";
            lines.push(`보관 타입: ${sb}`);
            lines.push(`보관 일수: ${state.storageDays}일 (상한 37만원)`);
          }
        }

        if (state.moveDate) lines.push(`일정: ${state.moveDate} / ${state.timeSlot ? state.timeSlot + "시" : "시간 미선택"}`);
        if (state.distanceKm > 0) lines.push(`거리: ${state.distanceKm} km`);

        if (state.noFrom) lines.push(`출발: 엘베없음 ${state.fromFloor}층`);
        else lines.push(`출발: 엘베있음`);

        if (state.noTo) lines.push(`도착: 엘베없음 ${state.toFloor}층`);
        else lines.push(`도착: 엘베있음`);

        if (state.loadLevel > 0) {
          const map = { 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
          lines.push(`짐양: ${map[state.loadLevel] || "-"}`);
        }

        // 가구/가전 항목 요약
        const items = summarizeItemsWithMattress(state.items);
        if (items !== "선택 없음") {
          lines.push(`가구·가전: ${items}`);
        }

        // 선택한 가구/가전 관련 메모를 요약에 포함합니다. 사용자가 입력한 메모가 있을 경우만 추가합니다.
        if (state.itemsNote && state.itemsNote.trim()) {
          lines.push(`가구·가전 기타사항: ${state.itemsNote.trim()}`);
        }

        if (state.cantCarryFrom || state.cantCarryTo) {
          lines.push(`직접 나르기 어려움: ${state.cantCarryFrom ? "출발 " : ""}${state.cantCarryTo ? "도착" : ""}`.trim());
        }

        if (state.helperFrom || state.helperTo) {
          lines.push(`인부: ${state.helperFrom ? "출발 " : ""}${state.helperTo ? "도착" : ""}`.trim());
        }

        if (state.ladderFromEnabled || state.ladderToEnabled) {
          const a = state.ladderFromEnabled ? `출발(${state.ladderFromFloor}층)` : "";
          const b = state.ladderToEnabled ? `도착(${state.ladderToFloor}층)` : "";
          lines.push(`사다리차: ${[a, b].filter(Boolean).join(" / ")}`);
        }

        if (state.cleaningToggle) {
          const scope = [state.cleaningFrom ? "출발" : null, state.cleaningTo ? "도착" : null]
            .filter(Boolean)
            .join("/");
          lines.push(`청소옵션: ${state.cleaningType === "deep" ? "집중" : "간단"} (${scope || "범위 미선택"})`);
        }

        if (state.throwToggle) {
          lines.push(`버려주세요: ${summarizeDict(state.throwFrom)} / ${summarizeDict(state.throwTo)}`);
          // 버려주세요 모드에서도 메모를 포함합니다. 입력한 메모가 있을 경우에만 추가합니다.
          if (state.throwNote && state.throwNote.trim()) {
            lines.push(`버려주세요 기타사항: ${state.throwNote.trim()}`);
          }
        }

        if (state.ride > 0) lines.push(`동승: ${state.ride}명`);

        return lines.join("<br>");
      }

      if (svc === SERVICE.CLEAN) {
        const lines = [];
        lines.push(`서비스: 입주청소`);
        lines.push(
          `유형: ${
            state.cleanType === "movein"
              ? "입주청소(공실)"
              : state.cleanType === "moveout"
              ? "이사청소(퇴거)"
              : "거주청소(짐있음)"
          }`
        );
        lines.push(
          `오염도: ${
            state.cleanSoil === "light" ? "가벼움" : state.cleanSoil === "normal" ? "보통" : "심함"
          }`
        );
        lines.push(`평수/구성: ${state.cleanPyeong}평 · 방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies}`);
        if (state.cleanAddress) lines.push(`주소: ${state.cleanAddress}`);
        if (state.moveDate) lines.push(`희망 일정: ${state.moveDate} / ${state.timeSlot ? state.timeSlot + "시" : "시간 미선택"}`);

        const opts = [];
        if (state.cleanParkingHard) opts.push("주차 어려움");
        if (state.cleanNoElevator) opts.push(`엘베없음(${state.cleanFloor}층)`);
        if (state.cleanOuterWindowEnabled) opts.push(`외창(${state.cleanOuterWindowPyeong}평)`);
        if (state.cleanPhytoncideEnabled) opts.push("피톤치드/탈취");
        if (state.cleanDisinfectEnabled) opts.push("살균/소독");
        if (state.cleanTrashBags > 0) opts.push(`폐기봉투(${state.cleanTrashBags}개)`);
        if (state.cleanWardrobes > 0) opts.push(`붙박이장(${state.cleanWardrobes}세트)`);
        if (opts.length) lines.push(`옵션: ${opts.join(", ")}`);

        const basic = summarizeDict(state.cleanBasic);
        if (basic !== "선택 없음") lines.push(`특수청소: ${basic}`);

        const appl = summarizeDict(state.cleanAppliance);
        if (appl !== "선택 없음") lines.push(`가전/가구 클리닝: ${appl}`);

        if (state.cleanNote.trim()) lines.push(`기타: ${state.cleanNote.trim()}`);

        return lines.join("<br>");
      }

      return "조건을 선택하세요";
    }

    let compareChart = null;

    function buildCompetitorComparison(displayPrice) {
      const safeDisplay = Math.max(0, Number(displayPrice) || 0);
      const average = safeDisplay > 0 ? safeDisplay / 0.862 : 0;
      const multipliers = [0.94, 0.97, 0.99, 1.00, 1.02, 1.04, 1.04];
      const labels = ["업체1", "업체2", "업체3", "업체4", "업체5", "업체6", "업체7", "DDLOGI"];
      const vendors = multipliers.map((m) => Math.round(average * m));
      const mean = vendors.length ? vendors.reduce((a, b) => a + b, 0) / vendors.length : 0;
      return {
        labels,
        values: [...vendors, Math.round(safeDisplay)],
        average: Math.round(mean),
      };
    }

    function renderCompareChart(displayPrice) {
      const canvas = $("#priceCompareChart");
      const averageLabel = $("#compareAverageLabel");
      if (!canvas || !window.Chart) return;

      const comparison = buildCompetitorComparison(displayPrice);
      if (averageLabel) averageLabel.textContent = `7개 업체 평균 ${formatWon(comparison.average)}`;

      const vendorColors = comparison.labels.map((label) =>
        label === "DDLOGI" ? "rgba(110,231,255,0.95)" : "rgba(255,255,255,0.28)"
      );
      const borderColors = comparison.labels.map((label) =>
        label === "DDLOGI" ? "rgba(110,231,255,1)" : "rgba(255,255,255,0.18)"
      );

      if (!compareChart) {
        compareChart = new window.Chart(canvas, {
          type: "bar",
          data: {
            labels: comparison.labels,
            datasets: [{
              label: "가격 비교",
              data: comparison.values,
              backgroundColor: vendorColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 10,
              borderSkipped: false,
              barThickness: 18,
              maxBarThickness: 22,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.label}: ${formatWon(context.raw || 0)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: "rgba(230,237,246,0.72)",
                  font: { size: 11, weight: "700" },
                },
                border: { display: false },
              },
              y: {
                beginAtZero: false,
                suggestedMin: Math.max(0, Math.min(...comparison.values) * 0.9),
                suggestedMax: Math.max(...comparison.values) * 1.08,
                grid: { color: "rgba(255,255,255,0.08)" },
                border: { display: false },
                ticks: {
                  color: "rgba(230,237,246,0.58)",
                  font: { size: 11 },
                  callback(value) {
                    return `${Math.round(Number(value) / 1000)}k`;
                  },
                },
              },
            },
          },
        });
        return;
      }

      compareChart.data.labels = comparison.labels;
      compareChart.data.datasets[0].data = comparison.values;
      compareChart.data.datasets[0].backgroundColor = vendorColors;
      compareChart.data.datasets[0].borderColor = borderColors;
      compareChart.options.scales.y.suggestedMin = Math.max(0, Math.min(...comparison.values) * 0.9);
      compareChart.options.scales.y.suggestedMax = Math.max(...comparison.values) * 1.08;
      compareChart.update();
    }

    function renderPrice() {
      const raw = calcCurrentPrice();
      const display = raw * DISPLAY_MULTIPLIER;

      const priceEl = $("#price");
      const stickyPriceEl = $("#stickyPrice");

      if (priceEl) priceEl.textContent = formatWon(display);
      if (stickyPriceEl) stickyPriceEl.textContent = formatWon(display);

      const deposit = display * 0.2;
      const balance = display * 0.8;

      $("#deposit") && ($("#deposit").textContent = formatWon(deposit));
      $("#balance") && ($("#balance").textContent = formatWon(balance));
      $("#stickyDeposit") && ($("#stickyDeposit").textContent = formatWon(deposit));
      $("#stickyBalance") && ($("#stickyBalance").textContent = formatWon(balance));

      renderCompareChart(display);
    }

    function renderSummary() {
      const sum = $("#summary");
      if (sum) sum.innerHTML = buildSummaryText();
    }

    function renderAll() {
      renderMiniSummaries();
      renderSummary();
      renderPrice();

      setHidden($("#storageBody"), state.moveType !== "storage");
      setHidden($("#ladderFromBody"), !state.ladderFromEnabled);
      setHidden($("#ladderToBody"), !state.ladderToEnabled);
      setHidden($("#cleaningBody"), !state.cleaningToggle);
      setHidden($("#cleanOuterWindowBody"), !state.cleanOuterWindowEnabled);

      const throwWrap = $("#throwMiniWrap");
      if (throwWrap) throwWrap.style.display = state.throwToggle ? "" : "none";

      const distText = $("#distanceText");
      if (distText) distText.textContent = state.distanceKm > 0 ? `${state.distanceKm} km` : "주소를 입력해주세요";
    }

    /* =========================================================
       ChannelTalk / Inquiry flow
    ========================================================= */
    function ensureChannelBoot() {
      const key = CFG.channelTalkPluginKey || CFG.channelPluginKey || CFG.channelIOKey;
      if (!window.ChannelIO) return false;
      if (!key) return true;
      if (!window.__DDLOGI_CH_BOOTED__) {
        try {
          window.ChannelIO("boot", { pluginKey: key });
          window.__DDLOGI_CH_BOOTED__ = true;
        } catch (e) {
          console.warn("ChannelIO boot failed:", e);
        }
      }
      return true;
    }

    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.top = "-9999px";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch (_) {
          return false;
        }
      }
    }

    function buildInquiryMessage() {
      if (state.activeService === SERVICE.MOVE) {
        const vehicle = state.vehicle || "-";
        const moveType =
          state.moveType === "general" ? "일반이사" :
          state.moveType === "half" ? "반포장 이사" :
          "보관이사";

        const time = state.timeSlot ? `${state.timeSlot}시` : "-";
        const dist = state.distanceKm > 0 ? `${state.distanceKm}km` : "-";

        const loadMap = { 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
        const load = loadMap[state.loadLevel] || "-";

        const elevFrom = state.noFrom ? `출발 엘베없음(${state.fromFloor}층)` : "출발 엘베있음";
        const elevTo = state.noTo ? `도착 엘베없음(${state.toFloor}층)` : "도착 엘베있음";

        const items = summarizeItemsWithMattress(state.items);
        const itemsLine = `가구·가전: ${items}`;
        const itemsNoteLine = (state.itemsNote && state.itemsNote.trim()) ? `가구·가전 기타사항: ${state.itemsNote.trim()}` : null;
        const throwInfo = state.throwToggle
          ? `버려주세요: ${summarizeDict(state.throwFrom)} / ${summarizeDict(state.throwTo)}`
          : "버려주세요: 미사용";
        const throwNoteLine = (state.throwToggle && state.throwNote && state.throwNote.trim())
          ? `버려주세요 기타사항: ${state.throwNote.trim()}`
          : null;

        const ladderInfo =
          (state.ladderFromEnabled || state.ladderToEnabled)
            ? `사다리차: ${state.ladderFromEnabled ? `출발(${state.ladderFromFloor}층)` : ""}${state.ladderFromEnabled && state.ladderToEnabled ? " / " : ""}${state.ladderToEnabled ? `도착(${state.ladderToFloor}층)` : ""}`
            : "사다리차: 불필요";

        const helperInfo = (`인부: ${state.helperFrom ? "출발 " : ""}${state.helperTo ? "도착" : ""}`).trim() || "인부: 미사용";

        const cantCarryInfo =
          (state.cantCarryFrom || state.cantCarryTo)
            ? (`직접 나르기 어려움: ${state.cantCarryFrom ? "출발 " : ""}${state.cantCarryTo ? "도착" : ""}`).trim()
            : "직접 나르기 어려움: 없음";

        const cleanOpt = state.cleaningToggle
          ? `청소 옵션: ${state.cleaningType === "deep" ? "집중" : "간단"} (${[state.cleaningFrom ? "출발" : null, state.cleaningTo ? "도착" : null].filter(Boolean).join("/") || "-"})`
          : "청소 옵션: 미사용";

        const display = calcCurrentPrice() * DISPLAY_MULTIPLIER;
        const price = formatWon(display);
        const deposit = formatWon(display * 0.2);
        const balance = formatWon(display * 0.8);

        return [
          "디디운송 견적 문의",
          "",
          "서비스: 이사·용달",
          `차량: ${vehicle}`,
          `이사 방식: ${moveType}`,
          state.moveType === "storage" ? `보관: ${state.storageDays}일 (상한 37만원)` : null,
          `일정: ${state.moveDate || "-"} / ${time}`,
          `출발지: ${state.startAddress || "-"}`,
          state.hasWaypoint ? `경유지: ${state.waypointAddress || "-"}` : null,
          `도착지: ${state.endAddress || "-"}`,
          `거리: ${dist}`,
          elevFrom,
          elevTo,
          `짐양: ${load}`,
          itemsLine,
          itemsNoteLine,
          helperInfo,
          cantCarryInfo,
          ladderInfo,
          cleanOpt,
          throwInfo,
          throwNoteLine,
          state.ride > 0 ? `동승: ${state.ride}명` : null,
          "",
          `예상 견적: ${price}`,
          `예약금(20%): ${deposit}`,
          `잔금(80%): ${balance}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (state.activeService === SERVICE.CLEAN) {
        const type =
          state.cleanType === "movein" ? "입주청소(공실)" :
          state.cleanType === "moveout" ? "이사청소(퇴거)" : "거주청소(짐있음)";
        const soil =
          state.cleanSoil === "light" ? "가벼움" :
          state.cleanSoil === "normal" ? "보통" : "심함";
        const area = `${state.cleanPyeong}평`;
        const config = `방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies}`;
        const addr = state.cleanAddress || "-";
        const time = state.timeSlot ? `${state.timeSlot}시` : "-";

        const options =
          [
            state.cleanParkingHard ? "주차 어려움" : null,
            state.cleanNoElevator ? `엘베없음(${state.cleanFloor}층)` : null,
            state.cleanOuterWindowEnabled ? `외창(${state.cleanOuterWindowPyeong}평)` : null,
            state.cleanPhytoncideEnabled ? "피톤치드/탈취" : null,
            state.cleanDisinfectEnabled ? "살균/소독" : null,
            state.cleanTrashBags > 0 ? `폐기봉투(${state.cleanTrashBags}개)` : null,
            state.cleanWardrobes > 0 ? `붙박이장(${state.cleanWardrobes}세트)` : null,
          ].filter(Boolean).join(", ") || "없음";

        const special = summarizeDict(state.cleanBasic);
        const appliance = summarizeDict(state.cleanAppliance);
        const note = state.cleanNote.trim() || "-";
        const price = formatWon(calcCurrentPrice() * DISPLAY_MULTIPLIER);

        return [
          "디디운송 견적 문의 (입주청소)",
          "",
          `유형: ${type}`,
          `오염도: ${soil}`,
          `평수/구성: ${area} · ${config}`,
          `주소: ${addr}`,
          `희망 일정: ${state.moveDate || "-"} / ${time}`,
          options !== "없음" ? `옵션: ${options}` : null,
          special !== "선택 없음" ? `특수청소: ${special}` : null,
          appliance !== "선택 없음" ? `가전/가구 클리닝: ${appliance}` : null,
          note !== "-" ? `기타: ${note}` : null,
          "",
          `예상 견적: ${price}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return "";
    }

    $("#channelInquiry")?.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("confirmInquiryModal");
    });

    function openChannelTalkWithPrefill(text) {
      ensureChannelBoot();

      if (typeof window.ChannelIO !== "function") {
        alert("채널톡 로딩이 아직 안 됐어. 잠깐 후 다시 눌러줘.");
        return false;
      }

      try {
        window.ChannelIO("openChat", undefined, String(text || ""));
        return true;
      } catch (e) {
        console.warn("ChannelIO openChat failed:", e);
        window.ChannelIO?.("showMessenger");
        return false;
      }
    }

    $("#sendInquiry")?.addEventListener("click", async () => {
      const msg = buildInquiryMessage();
      closeModal("confirmInquiryModal");

      await copyToClipboard(msg);
      const ok = openChannelTalkWithPrefill(msg);

      if (!ok) {
        alert("채널톡을 열었어. 만약 메시지가 자동 입력 안 되면, 방금 복사된 내용을 붙여넣고 전송해줘!");
      }
    });

    $("#askClean")?.addEventListener("click", () => {
      closeModal("confirmInquiryModal");
      state.activeService = SERVICE.CLEAN;

      const visible = computeVisibleSteps();
      const first = visible.findIndex((s) => {
        const t = getStepToken(s);
        return t !== 0 && t !== "service";
      });

      gotoStep(first >= 0 ? first : 0);
      renderAll();
    });

    // Initial render
    gotoStep(0, { noScroll: true });
    renderAll();
  });
})();


// Footer biz toggle
(() => {
  const btn = document.querySelector(".dd-footer-toggle");
  const panel = document.getElementById("ddBizInfo");
  if (!btn || !panel) return;

  btn.addEventListener("click", () => {
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!isOpen));
    panel.hidden = isOpen;
  });
})();