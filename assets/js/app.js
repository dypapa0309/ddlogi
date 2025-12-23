const lang = document.body.dataset.lang || "ko";

/* ===== 문구 ===== */
const TEXT = {
  ko: {
    smsAlert: "견적 화면을 캡처해 문자로 보내주세요",
    smsBody: "디디운송 견적 문의드립니다.\n캡처 이미지 기준으로 상담 요청드립니다.",
    summaryEmpty: "조건을 선택하세요",
    none: "없음",
    unselected: "미선택"
  },
  en: {
    smsAlert: "Please capture the estimate and send it via SMS",
    smsBody: "Hello, I'd like to inquire about a moving quote.\nPlease see the attached screenshot.",
    summaryEmpty: "Please select options",
    none: "None",
    unselected: "Not selected"
  }
};

/* ===== 상태 ===== */
const state = {
  vehicle:null,
  distance:10,
  noFrom:false,
  fromFloor:1,
  noTo:false,
  toFloor:1,
  ladder:false,
  ride:0,
  furniture:[],
  load:0
};

/* ===== 가격 ===== */
const base = { van:30000, truck:40000, lorry:60000 };
const perKm = { van:1000, truck:1200, lorry:1500 };
const furniturePrice = { small:20000, medium:40000, large:70000 };
const loadPrice = { 1:10000, 2:20000, 3:30000, 4:40000 };

/* ===== DOM ===== */
const priceEl = document.getElementById("price");
const summaryEl = document.getElementById("summary");

/* ===== 차량 ===== */
document.querySelectorAll(".vehicle").forEach(v => {
  v.onclick = () => {
    document.querySelectorAll(".vehicle").forEach(x=>x.classList.remove("active"));
    v.classList.add("active");
    state.vehicle = v.dataset.vehicle;
    calc();
  };
});

/* ===== 거리 ===== */
if (window.distance) {
  distance.oninput = e => {
    state.distance = +e.target.value;
    distanceText.innerText = `${state.distance}km`;
    calc();
  };
}

/* ===== 옵션 ===== */
if (window.noFrom) noFrom.onchange = e => { state.noFrom = e.target.checked; calc(); };
if (window.noTo) noTo.onchange = e => { state.noTo = e.target.checked; calc(); };
if (window.fromFloor) fromFloor.oninput = e => { state.fromFloor = +e.target.value; calc(); };
if (window.toFloor) toFloor.oninput = e => { state.toFloor = +e.target.value; calc(); };
if (window.ladder) ladder.onchange = e => { state.ladder = e.target.checked; calc(); };
if (window.ride) ride.oninput = e => { state.ride = +e.target.value; calc(); };

/* 가구 */
document.querySelectorAll(".furniture").forEach(el=>{
  el.onchange = e => {
    const v = e.target.value;
    e.target.checked
      ? state.furniture.push(v)
      : state.furniture = state.furniture.filter(x=>x!==v);
    calc();
  };
});

/* 짐 */
document.querySelectorAll("input[name='load']").forEach(el=>{
  el.onchange = e => {
    state.load = +e.target.value;
    calc();
  };
});

/* ===== 계산 ===== */
function calc() {
  if (!state.vehicle) return;

  let price =
    base[state.vehicle] +
    state.distance * perKm[state.vehicle];

  let stair =
    ((state.noFrom ? state.fromFloor : 0) +
     (state.noTo ? state.toFloor : 0)) * 7000;

  price += stair;
  price += state.furniture.reduce((a,v)=>a + furniturePrice[v], 0);
  price += loadPrice[state.load] || 0;
  if (state.ladder) price += 80000;
  price += state.ride * 20000;

  summaryEl.innerHTML = `
    차량: ${state.vehicle}<br>
    거리: ${state.distance}km<br>
    가구: ${state.furniture.join(", ") || TEXT[lang].none}<br>
    짐양: ${state.load || TEXT[lang].unselected}
  `;

  priceEl.innerText = `₩${price.toLocaleString()}`;
}

/* ===== 문자 ===== */
if (window.smsInquiry) {
  smsInquiry.onclick = () => {
    alert(TEXT[lang].smsAlert);
    location.href = `sms:01040941666?body=${encodeURIComponent(TEXT[lang].smsBody)}`;
  };
}
