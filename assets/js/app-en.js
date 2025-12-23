/* ==================================================
   DD Logistics Price Calculator - English Version
================================================== */

const state = {
  vehicle: null,
  distance: 10,
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

/* ===== Vehicle Types ===== */
const VEHICLE_MAP = {
  "1-Ton Cargo": "truck",
  "1-Ton Low-Top": "van",
  "Cargo+Low-Top": "lorry"
};

const BASE_PRICE = {
  truck: 40000,
  van: 30000,
  lorry: 60000
};

const PER_KM_PRICE = {
  truck: 1200,
  van: 1000,
  lorry: 1500
};

/* ===== Furniture Pricing ===== */
const FURNITURE_PRICE = {
  "Small": { label: "Small (chairs, side tables)", price: 20000 },
  "Medium": { label: "Medium (tables, small fridge)", price: 40000 },
  "Large": { label: "Large (wardrobe, washer, dryer)", price: 70000 }
};

/* ===== Load Volume Pricing ===== */
const LOAD_MAP = {
  "1": { label: "1–5 boxes", price: 10000 },
  "2": { label: "6–10 boxes", price: 20000 },
  "3": { label: "11–15 boxes", price: 30000 },
  "4": { label: "16–20 boxes", price: 40000 }
};

/* ===== DOM Elements ===== */
const priceEl = document.getElementById("price");
const summaryEl = document.getElementById("summary");
const distanceInput = document.getElementById("distance");
const distanceText = document.getElementById("distanceText");

/* ===== Initialize Default Vehicle ===== */
window.addEventListener("DOMContentLoaded", () => {
  const first = document.querySelector(".vehicle");
  if (!first) return;
  first.classList.add("active");
  state.vehicle = first.dataset.vehicle;
  calc();
});

/* ===== Vehicle Selection ===== */
document.querySelectorAll(".vehicle").forEach(v => {
  v.onclick = () => {
    document.querySelectorAll(".vehicle").forEach(x => x.classList.remove("active"));
    v.classList.add("active");
    state.vehicle = v.dataset.vehicle;
    calc();
  };
});

/* ===== Distance Slider ===== */
distanceInput.oninput = e => {
  state.distance = +e.target.value;
  distanceText.innerText = `${state.distance} km`;
  calc();
};

/* ===== Options ===== */
noFrom.onchange = e => { state.noFrom = e.target.checked; calc(); };
noTo.onchange = e => { state.noTo = e.target.checked; calc(); };
fromFloor.oninput = e => { state.fromFloor = +e.target.value; calc(); };
toFloor.oninput = e => { state.toFloor = +e.target.value; calc(); };
ladder.onchange = e => { state.ladder = e.target.checked; calc(); };
night.onchange = e => { state.night = e.target.checked; calc(); };
cantCarry.onchange = e => { state.cantCarry = e.target.checked; calc(); };
ride.oninput = e => { state.ride = +e.target.value; calc(); };

/* ===== Furniture Selection ===== */
document.querySelectorAll(".furniture").forEach(el => {
  el.onchange = () => {
    state.furniture = [...document.querySelectorAll(".furniture:checked")]
      .map(x => x.value);
    calc();
  };
});

/* ===== Load Volume Selection ===== */
document.querySelectorAll("input[name='load']").forEach(el => {
  el.onchange = e => {
    state.load = e.target.value;
    calc();
  };
});

/* ===== Price Calculation ===== */
function calc() {
  if (!state.vehicle) return;

  const key = VEHICLE_MAP[state.vehicle];
  let price = BASE_PRICE[key] + state.distance * PER_KM_PRICE[key];

  // Stairs cost
  price += ((state.noFrom ? state.fromFloor : 0) +
            (state.noTo ? state.toFloor : 0)) * 7000;

  // Furniture cost
  price += state.furniture.reduce(
    (sum, v) => sum + (FURNITURE_PRICE[v]?.price || 0),
    0
  );

  // Load volume cost
  if (state.load) price += LOAD_MAP[state.load].price;

  // Additional options
  if (state.ladder) price += 80000;
  price += state.ride * 20000;

  /* ===== Summary Generation ===== */
  summaryEl.innerHTML = `
    <b>🚚 Moving Conditions Summary</b><br><br>

    ▪ Vehicle: ${state.vehicle}<br>
    ▪ Distance: ${state.distance} km<br><br>

    ▪ Stairs:<br>
    &nbsp;&nbsp;- Pickup: ${state.noFrom ? `${state.fromFloor} floor(s) (no elevator)` : "Elevator available"}<br>
    &nbsp;&nbsp;- Drop-off: ${state.noTo ? `${state.toFloor} floor(s) (no elevator)` : "Elevator available"}<br><br>

    ▪ Furniture: ${
      state.furniture.length
        ? state.furniture.map(v => FURNITURE_PRICE[v].label).join(", ")
        : "None"
    }<br>

    ▪ Load volume: ${state.load ? LOAD_MAP[state.load].label : "Not selected"}<br><br>

    ▪ Ladder truck: ${state.ladder ? "Yes" : "No"}<br>
    ▪ Night / Weekend: ${state.night ? "Yes" : "No"}<br>
    ▪ Passengers: ${state.ride > 0 ? `${state.ride} person(s)` : "None"}<br><br>

    ▪ Labor assistance: ${state.cantCarry ? "Required (to be confirmed)" : "Not required"}
  `;

  priceEl.innerText = `₩${price.toLocaleString()}`;
}

/* ===== SMS Inquiry ===== */
if (document.getElementById("smsInquiry")) {
  smsInquiry.onclick = (e) => {
    e.preventDefault();
    alert("Please capture the estimate screen and send it via SMS");
    location.href =
      "sms:01040941666?body=" +
      encodeURIComponent("DD Logistics estimate inquiry.\nPlease provide consultation based on captured estimate.");
  };
}