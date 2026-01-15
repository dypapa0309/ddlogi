/* ==================================================
   디디운송 견적 계산기 - 거리 자동계산 + 이사방식/박스 분기 + SMS 면책 + 플로팅 가격바
================================================== */

const state = {
  vehicle: null,
  distance: 0,
  moveType: "general", // general | half
  noFrom: false,
  fromFloor: 1,
  noTo: false,
  toFloor: 1,
  ladder: false,
  night: false,
  cantCarry: false,
  ride: 0,
  furniture: [],
  load: null
};

/* ===== 차량 타입 ===== */
const VEHICLE_MAP = {
  "1톤 카고": "truck",
  "1톤 저상탑": "van",
  "1톤 카고+저상탑": "lorry"
};

const BASE_PRICE = { truck: 50000, van: 50000, lorry: 90000 };
const PER_KM_PRICE = { truck: 1500, van: 1500, lorry: 1500 };

/* ===== 가구 가격 ===== */
const FURNITURE_PRICE = {
  "소형": { label: "소형 (의자, 협탁 등)", price: 20000 },
  "중형": { label: "중형 (테이블, 소형 냉장고 등)", price: 40000 },
  "대형": { label: "대형 (책장, 세탁기, 건조기 등)", price: 70000 }
};

/* ===== 짐양(박스) 가격: 일반/반포장 분리 ===== */
const LOAD_MAP_GENERAL = {
  "1": { label: "1~5개", price: 10000 },
  "2": { label: "6~10개", price: 20000 },
  "3": { label: "11~15개", price: 30000 },
  "4": { label: "16~20개", price: 40000 }
};

// 반포장: 구간별 추가금 (일반보다 높게)
const LOAD_MAP_HALF = {
  "1": { label: "1~5개", price: 20000 },
  "2": { label: "6~10개", price: 35000 },
  "3": { label: "11~15개", price: 50000 },
  "4": { label: "16~20개", price: 65000 }
};

function getLoadMap() {
  return state.moveType === "half" ? LOAD_MAP_HALF : LOAD_MAP_GENERAL;
}

function moveTypeLabel() {
  if (state.moveType === "half") {
    return `반포장 이사 (웬만한 짐은 다 박스 포장 해놓으시고 당일까지 사용하실 짐을 포장하실 박스를 최대 5개까지 제공합니다.)`;
  }
  return `일반이사 (고객님이 전부 박스포장 해놓으셔야 합니다.)`;
}

/* ===== DOM 요소 ===== */
const priceEl = document.getElementById("price");
const summaryEl = document.getElementById("summary");

const stickyBarEl = document.getElementById("stickyPriceBar");
const stickyPriceEl = document.getElementById("stickyPrice");
const quoteSectionEl = document.getElementById("quoteSection");

const distanceText = document.getElementById("distanceText");
const startAddressInput = document.getElementById("startAddress");
const endAddressInput = document.getElementById("endAddress");
const calcDistanceBtn = document.getElementById("calcDistance");

const noFromEl = document.getElementById("noFrom");
const noToEl = document.getElementById("noTo");
const fromFloorEl = document.getElementById("fromFloor");
const toFloorEl = document.getElementById("toFloor");
const ladderEl = document.getElementById("ladder");
const nightEl = document.getElementById("night");
const cantCarryEl = document.getElementById("cantCarry");
const rideEl = document.getElementById("ride");

let geocoder;
let lastPrice = 0;

window.addEventListener("DOMContentLoaded", () => {
  // 첫 번째 차량 자동 선택
  const first = document.querySelector(".vehicle");
  if (first) {
    first.classList.add("active");
    state.vehicle = first.dataset.vehicle;
  }

  // 이사 방식(라디오)
  document.querySelectorAll("input[name='moveType']").forEach(el => {
    el.addEventListener("change", (e) => {
      state.moveType = e.target.value;
      calc();
    });
  });

  // 차량 선택
  document.querySelectorAll(".vehicle").forEach(v => {
    v.addEventListener("click", () => {
      document.querySelectorAll(".vehicle").forEach(x => x.classList.remove("active"));
      v.classList.add("active");
      state.vehicle = v.dataset.vehicle;
      calc();
    });
  });

  // 옵션 이벤트
  if (noFromEl) noFromEl.addEventListener("change", e => { state.noFrom = e.target.checked; calc(); });
  if (noToEl) noToEl.addEventListener("change", e => { state.noTo = e.target.checked; calc(); });
  if (fromFloorEl) fromFloorEl.addEventListener("input", e => { state.fromFloor = +e.target.value || 1; calc(); });
  if (toFloorEl) toFloorEl.addEventListener("input", e => { state.toFloor = +e.target.value || 1; calc(); });
  if (ladderEl) ladderEl.addEventListener("change", e => { state.ladder = e.target.checked; calc(); });
  if (nightEl) nightEl.addEventListener("change", e => { state.night = e.target.checked; calc(); });
  if (cantCarryEl) cantCarryEl.addEventListener("change", e => { state.cantCarry = e.target.checked; calc(); });
  if (rideEl) rideEl.addEventListener("input", e => { state.ride = +e.target.value || 0; calc(); });

  // 가구 선택
  document.querySelectorAll(".furniture").forEach(el => {
    el.addEventListener("change", () => {
      state.furniture = [...document.querySelectorAll(".furniture:checked")].map(x => x.value);
      calc();
    });
  });

  // 짐양 선택
  document.querySelectorAll("input[name='load']").forEach(el => {
    el.addEventListener("change", e => {
      state.load = e.target.value;
      calc();
    });
  });

  // 플로팅바: 예상견적 섹션 들어오면 숨김
  if (quoteSectionEl && stickyBarEl) {
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        stickyBarEl.style.display = "none";
      } else {
        if (state.vehicle) stickyBarEl.style.display = "block";
      }
    }, { threshold: 0.12 });

    io.observe(quoteSectionEl);
  }

  // Kakao API 로드 후 Geocoder 초기화
  if (typeof kakao !== "undefined" && kakao.maps) {
    kakao.maps.load(() => {
      if (kakao.maps.services) {
        geocoder = new kakao.maps.services.Geocoder();
        calc();
      } else {
        console.error("Kakao Map services 라이브러리가 로드되지 않았습니다. libraries=services 확인 필요");
        calc();
      }
    });
  } else {
    console.error("카카오맵 API 객체(kakao.maps)가 없어 Geocoder 초기화 실패");
    calc();
  }
});

/* ===== 거리 계산 버튼 ===== */
if (calcDistanceBtn) {
  calcDistanceBtn.addEventListener("click", async () => {
    const start = (startAddressInput?.value || "").trim();
    const end = (endAddressInput?.value || "").trim();

    if (!start || !end) {
      alert("출발지와 도착지를 모두 입력해주세요.");
      return;
    }
    if (!geocoder) {
      alert("거리 계산을 위한 카카오맵 API 초기화에 실패했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }

    calcDistanceBtn.textContent = "계산 중...";
    calcDistanceBtn.disabled = true;

    try {
      const startCoord = await getCoordinates(start);
      const endCoord = await getCoordinates(end);

      const distance = calculateDistance(startCoord, endCoord);
      state.distance = Math.round(distance);

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

/* ===== 주소 → 좌표 변환 ===== */
function getCoordinates(address) {
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x)
        });
      } else {
        reject(new Error(`"${address}" 주소를 찾을 수 없습니다.`));
      }
    });
  });
}

/* ===== 두 좌표 간 거리 (Haversine) ===== */
function calculateDistance(coord1, coord2) {
  const R = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
    Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) { return deg * (Math.PI / 180); }

/* ===== SMS 바디 생성 (면책 포함) ===== */
function buildSmsBody(priceNumber) {
  const startAddr = (startAddressInput?.value || "").trim();
  const endAddr = (endAddressInput?.value || "").trim();

  const vehicleLabel = state.vehicle || "미선택";
  const moveLabel = moveTypeLabel();

  const stairsFrom = state.noFrom ? `${state.fromFloor}층(엘베없음)` : "엘베있음";
  const stairsTo = state.noTo ? `${state.toFloor}층(엘베없음)` : "엘베있음";

  const furnitureLabel = state.furniture.length
    ? state.furniture.map(v => FURNITURE_PRICE[v]?.label || v).join(", ")
    : "없음";

  const loadMap = getLoadMap();
  const loadLabel = state.load ? (loadMap[state.load]?.label || "미선택") : "미선택";

  const ladderLabel = state.ladder ? "필요" : "불필요";
  const nightLabel = state.night ? "해당" : "미해당";
  const rideLabel = state.ride > 0 ? `${state.ride}명` : "없음";
  const laborLabel = state.cantCarry ? "필요(상담)" : "불필요";

  const distanceLabel = state.distance > 0 ? `${state.distance}km` : "미계산";

  const disclaimer = "※ 안내된 예상금액은 현장 상황(짐량/동선/주차/추가 작업)에 따라 변동될 수 있습니다.";

  const lines = [
    "디디운송 예상견적 문의드립니다.",
    "",
    `이사 방식: ${moveLabel}`,
    `차량: ${vehicleLabel}`,
    `거리: ${distanceLabel}`,
    startAddr ? `출발지: ${startAddr}` : null,
    endAddr ? `도착지: ${endAddr}` : null,
    `계단: 출발 ${stairsFrom} / 도착 ${stairsTo}`,
    `가구: ${furnitureLabel}`,
    `짐양(박스): ${loadLabel}`,
    "",
    `사다리차: ${ladderLabel}`,
    `야간/주말: ${nightLabel}`,
    `동승: ${rideLabel}`,
    `인부지원: ${laborLabel}`,
    "",
    `예상금액: ₩${Number(priceNumber).toLocaleString()}`,
    disclaimer,
    "",
    "상담 부탁드립니다."
  ].filter(Boolean);

  return lines.join("\n");
}

/* ===== 가격 계산 ===== */
function calc() {
  if (!state.vehicle) return;

  const key = VEHICLE_MAP[state.vehicle];
  let price = BASE_PRICE[key] + (state.distance * PER_KM_PRICE[key]);

  // 계단 비용
  price += ((state.noFrom ? state.fromFloor : 0) + (state.noTo ? state.toFloor : 0)) * 7000;

  // 가구 비용
  price += state.furniture.reduce((sum, v) => sum + (FURNITURE_PRICE[v]?.price || 0), 0);

  // 짐양(박스) 비용 (일반/반포장 분기)
  const loadMap = getLoadMap();
  if (state.load) price += loadMap[state.load].price;

  // 추가 옵션
  if (state.ladder) price += 80000;
  price += (state.ride * 20000);

  lastPrice = price;

  // 요약
  if (summaryEl) {
    summaryEl.innerHTML = `
      <b>🚚 이사 조건 요약</b><br><br>

      ▪ 이사 방식: ${moveTypeLabel()}<br><br>

      ▪ 차량: ${state.vehicle}<br>
      ▪ 거리: ${state.distance > 0 ? state.distance + ' km' : '미계산'}<br><br>

      ▪ 계단:<br>
      &nbsp;&nbsp;- 출발지: ${state.noFrom ? `${state.fromFloor}층 (엘베 없음)` : "엘베 있음"}<br>
      &nbsp;&nbsp;- 도착지: ${state.noTo ? `${state.toFloor}층 (엘베 없음)` : "엘베 있음"}<br><br>

      ▪ 가구: ${
        state.furniture.length
          ? state.furniture.map(v => (FURNITURE_PRICE[v]?.label || v)).join(", ")
          : "없음"
      }<br>

      ▪ 짐양: ${state.load ? (loadMap[state.load]?.label || "미선택") : "미선택"}<br><br>

      ▪ 사다리차: ${state.ladder ? "필요" : "불필요"}<br>
      ▪ 야간/주말: ${state.night ? "해당" : "미해당"}<br>
      ▪ 동승 인원: ${state.ride > 0 ? `${state.ride}명` : "없음"}<br><br>

      ▪ 인부 지원: ${state.cantCarry ? "필요 (상담 시 확인)" : "불필요"}
    `;
  }

  // 가격 표시(정적 카드 + 플로팅바 둘 다)
  const formatted = `₩${price.toLocaleString()}`;
  if (priceEl) priceEl.innerText = formatted;
  if (stickyPriceEl) stickyPriceEl.innerText = formatted;

  // 플로팅바 초기 표시 조건(옵저버가 꺼져있거나 초기 렌더 시)
  if (stickyBarEl && quoteSectionEl) {
    const rect = quoteSectionEl.getBoundingClientRect();
    const quoteVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
    stickyBarEl.style.display = quoteVisible ? "none" : "block";
  }
}

/* ===== SMS 문의 버튼 ===== */
const smsInquiryBtn = document.getElementById("smsInquiry");
if (smsInquiryBtn) {
  smsInquiryBtn.addEventListener("click", (e) => {
    e.preventDefault();

    if (!state.vehicle) {
      alert("차량을 먼저 선택해주세요.");
      return;
    }

    const body = buildSmsBody(lastPrice);
    location.href = "sms:01040941666?body=" + encodeURIComponent(body);
  });
}
