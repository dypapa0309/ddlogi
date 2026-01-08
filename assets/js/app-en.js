/* ==================================================
   DD Logistics Price Calculator - Kakao Map Auto Distance
================================================== */

const state = {
  vehicle: null,
  distance: 0,
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
  truck: 50000,
  van: 50000,
  lorry: 90000
};

const PER_KM_PRICE = {
  truck: 1500,
  van: 1500,
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
const distanceText = document.getElementById("distanceText");
const startAddressInput = document.getElementById("startAddress");
const endAddressInput = document.getElementById("endAddress");
const calcDistanceBtn = document.getElementById("calcDistance");

/* ===== Kakao Map Distance Calculation ===== */
let geocoder;

window.addEventListener("DOMContentLoaded", () => {
  // Auto-select first vehicle
  const first = document.querySelector(".vehicle");
  if (first) {
    first.classList.add("active");
    state.vehicle = first.dataset.vehicle;
    calc();
  }

  // Initialize Kakao Map Geocoder
  if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
    geocoder = new kakao.maps.services.Geocoder();
  } else {
    console.error('Kakao Map API not loaded. Please check your API key.');
  }
});

/* ===== Calculate Distance Button ===== */
calcDistanceBtn.onclick = async () => {
  const start = startAddressInput.value.trim();
  const end = endAddressInput.value.trim();

  if (!start || !end) {
    alert("Please enter both pickup and drop-off addresses.");
    return;
  }

  if (!geocoder) {
    alert("Kakao Map API not loaded. Please refresh the page.");
    return;
  }

  calcDistanceBtn.textContent = "Calculating...";
  calcDistanceBtn.disabled = true;

  try {
    // Get pickup coordinates
    const startCoord = await getCoordinates(start);
    // Get drop-off coordinates
    const endCoord = await getCoordinates(end);

    // Calculate distance between two points (km)
    const distance = calculateDistance(startCoord, endCoord);
    
    state.distance = Math.round(distance);
    distanceText.textContent = `${state.distance} km`;
    
    calc();

    calcDistanceBtn.textContent = "Calculate Distance";
    calcDistanceBtn.disabled = false;

  } catch (error) {
    alert(error.message || "Address not found. Please enter a valid address.");
    calcDistanceBtn.textContent = "Calculate Distance";
    calcDistanceBtn.disabled = false;
  }
};

/* ===== Address to Coordinates Conversion ===== */
function getCoordinates(address) {
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x)
        });
      } else {
        reject(new Error(`Address "${address}" not found.`));
      }
    });
  });
}

/* ===== Calculate Distance Between Two Coordinates (Haversine Formula) ===== */
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth radius (km)
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/* ===== Vehicle Selection ===== */
document.querySelectorAll(".vehicle").forEach(v => {
  v.onclick = () => {
    document.querySelectorAll(".vehicle").forEach(x => x.classList.remove("active"));
    v.classList.add("active");
    state.vehicle = v.dataset.vehicle;
    calc();
  };
});

/* ===== Option Events ===== */
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
    ▪ Distance: ${state.distance > 0 ? state.distance + ' km' : 'Not calculated'}<br><br>

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
    ▪ Night/Weekend: ${state.night ? "Yes" : "No"}<br>
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