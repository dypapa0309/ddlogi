(() => {
  "use strict";

  const PHONE_NUMBER = "01075416143";
  const HELPER_FEE = 10000;
  const RIDE_ALONG_FEE = 20000;
  const BASE_VEHICLE_FEE = 27000;

  function trackEvent(action, extra = {}) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", action, {
      event_category: "conversion",
      service_type: "yongdal",
      page_path: window.location.pathname,
      ...extra,
    });
  }

  const state = {
    startAddress: "",
    endAddress: "",
    distanceKm: 0,
    distanceMeta: "카카오 주소 기준으로 계산됩니다.",
    selected: {},
    helperFrom: false,
    helperTo: false,
    rideAlong: false,
    moveDate: "",
    timeSlot: "",
  };

  const ITEM_GROUPS = {
    small: {
      title: "소형짐",
      copy: "혼자 들 수 있지만 승용차로 옮기기 애매한 짐들이에요.",
      items: [
        ["리빙박스", "정리박스, 수납박스"],
        ["이민가방 / 대형가방", "대형 여행가방 포함"],
        ["컴퓨터 본체", "데스크톱 본체"],
        ["모니터", "개별 모니터"],
        ["프린터", "가정용 / 소형"],
        ["선풍기", "스탠드형 포함"],
        ["소형 공기청정기", "일반 가정용"],
        ["전자레인지", "소형 가전"],
        ["청소기", "유선 / 무선"],
        ["소형 선반", "작은 조립 선반"],
        ["접이식 의자", "캠핑 / 보조 의자"],
        ["소형 화분", "작은 화분류"],
      ],
    },
    medium: {
      title: "중형짐",
      copy: "승용차로는 어렵고 용달차가 필요한 대표 짐들이에요.",
      items: [
        ["책상", "소형 / 일반 책상"],
        ["행거", "이동형 행거"],
        ["싱글 매트리스", "1인용 매트리스"],
        ["TV", "중소형 TV"],
        ["TV다이", "작은 거실장"],
        ["서랍장", "소형 / 중형"],
        ["소형 냉장고", "원룸 냉장고"],
        ["소형 세탁기", "통돌이 / 소형"],
        ["자전거", "일반 자전거"],
        ["소형 소파", "1~2인용"],
        ["2인용 식탁", "소형 식탁"],
        ["책장", "일반 책장"],
      ],
    },
    large: {
      title: "대형짐",
      copy: "부피가 크고 작업 판단이 필요한 대형 짐들이에요.",
      items: [
        ["일반 냉장고", "가정용 냉장고"],
        ["드럼 세탁기", "대형 세탁기"],
        ["건조기", "스탠드형 포함"],
        ["퀸 / 킹 매트리스", "대형 매트리스"],
        ["침대 프레임", "분해 여부 별도 확인"],
        ["3인용 이상 소파", "거실용 대형 소파"],
        ["장롱", "의류장"],
        ["대형 서랍장", "부피 큰 수납장"],
        ["안마의자", "고중량"],
        ["4인 이상 식탁", "중대형 식탁"],
        ["쇼케이스 / 업소장비", "매장 장비류"],
        ["대형 화분", "무게 큰 화분"],
      ],
    },
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    start: $("#startAddress"),
    end: $("#endAddress"),
    calcBtn: $("#calcDistanceBtn"),
    distanceText: $("#distanceText"),
    distanceMeta: $("#distanceMeta"),
    summary: $("#selectedItemsSummary"),
    moveDate: $("#moveDate"),
    helpFrom: $("#helpFrom"),
    helpTo: $("#helpTo"),
    rideAlong: $("#rideAlong"),
    distanceFeeText: $("#distanceFeeText"),
    helperFeeText: $("#helperFeeText"),
    rideFeeText: $("#rideFeeText"),
    totalFeeText: $("#totalFeeText"),
    smsBtn: $("#smsBtn"),
    modal: $("#itemsModal"),
    modalTitle: $("#modalTitle"),
    modalCopy: $("#modalCopy"),
    modalList: $("#modalList"),
    modalConfirmBtn: $("#modalConfirmBtn"),
  };

  let kakaoReadyPromise = null;

  function ensureKakaoReady() {
    if (kakaoReadyPromise) return kakaoReadyPromise;
    kakaoReadyPromise = new Promise((resolve, reject) => {
      if (!window.kakao || !window.kakao.maps) {
        reject(new Error("Kakao Maps SDK not loaded"));
        return;
      }
      window.kakao.maps.load(() => {
        if (window.kakao?.maps?.services) resolve(window.kakao);
        else reject(new Error("Kakao services not available"));
      });
    });
    return kakaoReadyPromise;
  }

  function formatWon(v) {
    return `${Math.round(v || 0).toLocaleString()}원`;
  }

  function moveDistanceFee(km) {
    const d = Math.max(0, Number(km) || 0);
    const a = Math.min(d, 10) * 2000;
    const b = Math.max(0, d - 10) * 1550;
    return Math.round(BASE_VEHICLE_FEE + a + b);
  }

  function helperFee() {
    return (state.helperFrom ? HELPER_FEE : 0) + (state.helperTo ? HELPER_FEE : 0);
  }

  function rideFee() {
    return state.rideAlong ? RIDE_ALONG_FEE : 0;
  }

  function totalFee() {
    return moveDistanceFee(state.distanceKm) + helperFee() + rideFee();
  }

  function currentSelectedEntries() {
    return Object.entries(state.selected)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => `${name}${qty > 1 ? ` ×${qty}` : ""}`);
  }

  function renderSummary() {
    const items = currentSelectedEntries();
    if (!items.length) {
      els.summary.textContent = "아직 선택한 짐이 없어요.";
      return;
    }
    els.summary.textContent = items.join(", ");
  }

  function renderFees() {
    els.distanceFeeText.textContent = formatWon(moveDistanceFee(state.distanceKm));
    els.helperFeeText.textContent = formatWon(helperFee());
    els.rideFeeText.textContent = formatWon(rideFee());
    els.totalFeeText.textContent = formatWon(totalFee());
  }

  function renderDistance() {
    els.distanceText.textContent = state.distanceKm > 0 ? `${state.distanceKm.toFixed(1)} km` : "주소를 입력해주세요";
    els.distanceMeta.textContent = state.distanceMeta;
  }

  function renderAll() {
    renderDistance();
    renderSummary();
    renderFees();
  }

  function cleanQuery(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeRegionText(value) {
    let v = cleanQuery(value);
    const swaps = [
      [/서울시/g, "서울"], [/인천시/g, "인천"], [/부산시/g, "부산"], [/대구시/g, "대구"],
      [/광주시/g, "광주"], [/대전시/g, "대전"], [/울산시/g, "울산"], [/세종시/g, "세종"],
      [/경기도/g, "경기"], [/강원도/g, "강원"], [/충청북도/g, "충북"], [/충청남도/g, "충남"],
      [/전라북도/g, "전북"], [/전라남도/g, "전남"], [/경상북도/g, "경북"], [/경상남도/g, "경남"],
      [/제주특별자치도/g, "제주"], [/제주도/g, "제주"],
    ];
    for (const [from, to] of swaps) v = v.replace(from, to);
    return cleanQuery(v);
  }

  function uniqueQueries(address) {
    const base = normalizeRegionText(address);
    const list = [base];
    const parts = base.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      list.push(parts.slice(-2).join(" "));
      list.push(parts.slice(-1).join(" "));
      list.push(parts.slice(0, 2).join(" "));
    }
    if (parts.length >= 3) {
      list.push(parts.slice(0, 3).join(" "));
      list.push(parts.slice(1, 3).join(" "));
      list.push(parts.slice(-3).join(" "));
    }
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const prev = parts[parts.length - 2];
      list.push(`${prev} ${last}`);
      list.push(last);
      if (parts[0] && last) list.push(`${parts[0]} ${last}`);
    }
    return [...new Set(list.map(cleanQuery).filter(Boolean))];
  }

  function scorePlaceName(place, query) {
    const hay = [place.place_name, place.address_name, place.road_address_name].filter(Boolean).join(" ");
    const parts = cleanQuery(query).split(" ").filter(Boolean);
    let score = 0;
    for (const part of parts) if (hay.includes(part)) score += part.length;
    if (place.address_name && cleanQuery(place.address_name).includes(cleanQuery(query))) score += 20;
    if (place.road_address_name && cleanQuery(place.road_address_name).includes(cleanQuery(query))) score += 10;
    return score;
  }

  async function geocode(geocoder, address) {
    const kakao = window.kakao;
    const queries = uniqueQueries(address);
    const places = new kakao.maps.services.Places();

    const tryAddressSearch = (query) => new Promise((resolve, reject) => {
      geocoder.addressSearch(query, (result, status) => {
        if (status === kakao.maps.services.Status.OK && result?.[0]) {
          resolve({
            x: Number(result[0].x),
            y: Number(result[0].y),
            matchedAddress: result[0].address_name || result[0].road_address?.address_name || query,
            method: "address",
          });
          return;
        }
        reject(new Error(`addressSearch failed: ${query}`));
      });
    });

    const tryKeywordSearch = (query) => new Promise((resolve, reject) => {
      places.keywordSearch(query, (result, status) => {
        if (status === kakao.maps.services.Status.OK && result?.length) {
          const best = [...result].sort((a, b) => scorePlaceName(b, query) - scorePlaceName(a, query))[0];
          resolve({
            x: Number(best.x),
            y: Number(best.y),
            matchedAddress: best.address_name || best.road_address_name || best.place_name || query,
            method: "keyword",
          });
          return;
        }
        reject(new Error(`keywordSearch failed: ${query}`));
      });
    });

    let lastError = null;
    for (const query of queries) {
      const rough = query.split(" ").length <= 2;
      const attempts = rough ? [tryKeywordSearch, tryAddressSearch] : [tryAddressSearch, tryKeywordSearch];
      for (const attempt of attempts) {
        try {
          return await attempt(query);
        } catch (err) {
          lastError = err;
        }
      }
    }
    throw lastError || new Error(`주소 검색 실패: ${address}`);
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b.y - a.y) * Math.PI) / 180;
    const dLon = ((b.x - a.x) * Math.PI) / 180;
    const lat1 = (a.y * Math.PI) / 180;
    const lat2 = (b.y * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function fetchRoadDistanceKm(origin, destination) {
    const params = new URLSearchParams({
      origin: `${origin.x},${origin.y}`,
      destination: `${destination.x},${destination.y}`,
    });
    const res = await fetch(`/.netlify/functions/kakaoDirections?${params.toString()}`);
    if (!res.ok) throw new Error(`Road distance failed: ${res.status}`);
    const data = await res.json();
    const meter = data?.routes?.[0]?.summary?.distance;
    if (!Number.isFinite(meter)) throw new Error("No road distance data");
    return Math.round((meter / 1000) * 10) / 10;
  }

  async function calculateDistance() {
    trackEvent("distance_calculate", { event_label: "yongdal_distance" });
    state.startAddress = (els.start.value || "").trim();
    state.endAddress = (els.end.value || "").trim();
    if (!state.startAddress || !state.endAddress) {
      alert("출발지와 도착지 주소를 모두 입력해줘.");
      return;
    }

    els.calcBtn.disabled = true;
    els.calcBtn.textContent = "계산 중...";
    state.distanceMeta = "주소를 확인하고 있어요.";
    renderDistance();

    try {
      await ensureKakaoReady();
      const geocoder = new window.kakao.maps.services.Geocoder();
      const origin = await geocode(geocoder, state.startAddress);
      const destination = await geocode(geocoder, state.endAddress);

      if (origin?.matchedAddress) {
        state.startAddress = origin.matchedAddress;
        els.start.value = origin.matchedAddress;
      }
      if (destination?.matchedAddress) {
        state.endAddress = destination.matchedAddress;
        els.end.value = destination.matchedAddress;
      }

      try {
        state.distanceKm = await fetchRoadDistanceKm(origin, destination);
        state.distanceMeta = `카카오 ${origin.method === "keyword" || destination.method === "keyword" ? "키워드/주소" : "주소"} 기준으로 계산됐어요.`;
      } catch (roadError) {
        console.warn("Road distance fallback:", roadError);
        state.distanceKm = Math.round(haversineKm(origin, destination) * 1.25 * 10) / 10;
        state.distanceMeta = "카카오 검색 좌표 기준 보정거리로 계산됐어요.";
      }

      renderAll();
    } catch (error) {
      console.error(error);
      state.distanceKm = 0;
      state.distanceMeta = "입력하신 주소를 다시 확인해주세요. 동 이름이나 역 이름, 건물명만 넣어도 다시 시도할 수 있어요.";
      renderAll();
      alert("거리 계산에 실패했어. 동 이름, 역 이름, 건물명 기준으로 다시 시도해줘.");
    } finally {
      els.calcBtn.disabled = false;
      els.calcBtn.textContent = "거리 계산하기";
    }
  }

  function openModal(sizeKey) {
    const group = ITEM_GROUPS[sizeKey];
    if (!group) return;
    els.modalTitle.textContent = group.title;
    els.modalCopy.textContent = group.copy;
    els.modalList.innerHTML = "";

    $$(".yd-size-card").forEach((card) => card.classList.toggle("is-active", card.dataset.size === sizeKey));

    group.items.forEach(([name, desc]) => {
      const qty = state.selected[name] || 0;
      const row = document.createElement("div");
      row.className = "yd-item-row";
      row.innerHTML = `
        <div class="yd-item-label">
          <strong>${name}</strong>
          <small>${desc}</small>
        </div>
        <div class="stepper">
          <button type="button" data-item-minus="${name}">−</button>
          <input type="number" min="0" value="${qty}" data-item-input="${name}" />
          <button type="button" data-item-plus="${name}">+</button>
        </div>
      `;
      els.modalList.appendChild(row);
    });

    els.modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    els.modal.setAttribute("aria-hidden", "true");
    renderSummary();
  }

  function setItemQty(name, next) {
    const value = Math.max(0, parseInt(next, 10) || 0);
    if (value <= 0) delete state.selected[name];
    else state.selected[name] = value;
    renderSummary();
  }

  function smsBody() {
    const items = currentSelectedEntries();
    const helperText = [state.helperFrom ? "출발지 도움" : null, state.helperTo ? "도착지 도움" : null].filter(Boolean).join(", ") || "없음";
    const schedule = `${state.moveDate || "-"} / ${state.timeSlot ? `${state.timeSlot}시` : "-"}`;
    const total = totalFee();
    const deposit = Math.round(total * 0.2);
    const balance = total - deposit;
    return [
      "당고 용달 예약 문의",
      `이동 일정: ${schedule}`,
      `출발지: ${state.startAddress || "-"}`,
      `도착지: ${state.endAddress || "-"}`,
      `거리: ${state.distanceKm > 0 ? `${state.distanceKm.toFixed(1)}km` : "-"}`,
      `선택 품목: ${items.length ? items.join(", ") : "없음"}`,
      `기사 도움: ${helperText}`,
      `동승자: ${state.rideAlong ? "1명" : "없음"}`,
      `예상 용달비: ${formatWon(total)}`,
      `예약금(20%): ${formatWon(deposit)}`,
      `잔금(80%): ${formatWon(balance)}`,
    ].join("\n");
  }

  function validateBeforeSubmit() {
    if (!state.startAddress || !state.endAddress || state.distanceKm <= 0) {
      alert("먼저 출발지와 도착지를 입력하고 거리 계산을 해줘.");
      return false;
    }
    if (!state.moveDate || !state.timeSlot) {
      alert("이동 날짜와 시간을 선택해줘.");
      return false;
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

  function redirectToLeadclearPage(text) {
    const message = String(text || "").trim();
    if (!message) return false;

    try {
      sessionStorage.setItem("ddlogiLeadSmsPayload", message);
    } catch (err) {
      console.warn("Leadclear payload save failed:", err);
    }

    window.location.href = "/ddyd/leadclear/";
    return true;
  }

  async function goSms() {
    if (!validateBeforeSubmit()) return;
    trackEvent("quote_submit_click", { contact_channel: "sms", event_label: "yongdal_result_cta" });
    const message = smsBody();
    await copyToClipboard(message);
    redirectToLeadclearPage(message);
  }

  $$(".yd-size-card").forEach((btn) => btn.addEventListener("click", () => openModal(btn.dataset.size)));
  els.calcBtn?.addEventListener("click", calculateDistance);
  if (els.moveDate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    els.moveDate.min = `${yyyy}-${mm}-${dd}`;
    els.moveDate.addEventListener("change", (e) => {
      state.moveDate = e.target.value || "";
    });
  }
  $$('input[name="timeSlot"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) state.timeSlot = String(e.target.value || "");
    });
  });
  els.helpFrom?.addEventListener("change", (e) => { state.helperFrom = e.target.checked; renderFees(); });
  els.helpTo?.addEventListener("change", (e) => { state.helperTo = e.target.checked; renderFees(); });
  els.rideAlong?.addEventListener("change", (e) => { state.rideAlong = e.target.checked; renderFees(); });
  els.smsBtn?.addEventListener("click", goSms);
  els.modalConfirmBtn?.addEventListener("click", closeModal);
  document.querySelectorAll('a[href^="tel:"]').forEach((el) => {
    el.addEventListener("click", () => trackEvent("contact_click", { contact_channel: "phone", event_label: el.textContent.trim().slice(0, 60) }));
  });
  document.querySelectorAll('a[href^="sms:"]').forEach((el) => {
    el.addEventListener("click", () => trackEvent("contact_click", { contact_channel: "sms", event_label: el.textContent.trim().slice(0, 60) }));
  });

  els.modal?.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) {
      closeModal();
      return;
    }
    const minusBtn = e.target.closest("[data-item-minus]");
    if (minusBtn) {
      const name = minusBtn.getAttribute("data-item-minus");
      const input = els.modalList.querySelector(`[data-item-input="${CSS.escape(name)}"]`);
      const next = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
      input.value = String(next);
      setItemQty(name, next);
      return;
    }
    const plusBtn = e.target.closest("[data-item-plus]");
    if (plusBtn) {
      const name = plusBtn.getAttribute("data-item-plus");
      const input = els.modalList.querySelector(`[data-item-input="${CSS.escape(name)}"]`);
      const next = (parseInt(input.value, 10) || 0) + 1;
      input.value = String(next);
      setItemQty(name, next);
    }
  });

  els.modalList?.addEventListener("input", (e) => {
    const input = e.target.closest("[data-item-input]");
    if (!input) return;
    setItemQty(input.getAttribute("data-item-input"), input.value);
  });

  renderAll();
})();
