/* ==================================================
   DD Logistics Price Calculator - Auto Distance + MoveType/Load Split
   + SMS Disclaimer + Floating Price Bar
   + Reservation (date/time slot) required
================================================== */

// Calculator state
const state = {
  vehicle: null,
  distance: 0,
  moveType: 'general',
  moveDate: '',
  timeSlot: '',
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

/* ===== Vehicle types ===== */
const VEHICLE_MAP = {
  '1-Ton Cargo': 'truck',
  '1-Ton Low-Top': 'van',
  'Cargo+Low-Top': 'lorry'
};

const BASE_PRICE   = { truck: 50000, van: 50000, lorry: 90000 };
const PER_KM_PRICE = { truck: 1500,  van: 1500,  lorry: 1500 };

/* ===== Furniture pricing (calculation only) ===== */
const FURNITURE_PRICE = {
  Small:  { label: 'Small (chairs, side tables)',        price: 20000 },
  Medium: { label: 'Medium (tables, small fridge)',       price: 40000 },
  Large:  { label: 'Large (wardrobe, washer, dryer)',     price: 70000 }
};

/* ===== Load volume pricing ===== */
const LOAD_MAP_GENERAL = {
  '1': { label: '1–5 boxes',  price: 10000 },
  '2': { label: '6–10 boxes', price: 20000 },
  '3': { label: '11–15 boxes',price: 30000 },
  '4': { label: '16–20 boxes',price: 40000 }
};

const LOAD_MAP_HALF = {
  '1': { label: '1–5 boxes',  price: 20000 },
  '2': { label: '6–10 boxes', price: 35000 },
  '3': { label: '11–15 boxes',price: 50000 },
  '4': { label: '16–20 boxes',price: 65000 }
};

function getLoadMap() {
  return state.moveType === 'half' ? LOAD_MAP_HALF : LOAD_MAP_GENERAL;
}

function moveTypeLabel() {
  if (state.moveType === 'half') {
    return 'Semi-Packing Move (Please pack most items; we provide up to 5 boxes for items you use until moving day.)';
  }
  return 'General Move (You must pack all items into boxes in advance.)';
}

/* ✅ Time slot label */
function formatTimeSlotEN(v) {
  if (!v) return 'Not selected';
  if (v === 'before9') return 'Before 9 AM';
  if (v === '9to12')   return '9 AM – 12 PM';
  if (v === '12to15')  return '12 PM – 3 PM';
  return 'Not selected';
}

/* ===== DOM elements ===== */
const priceEl      = document.getElementById('price');
const summaryEl    = document.getElementById('summary');
const stickyBarEl  = document.getElementById('stickyPriceBar');
const stickyPriceEl= document.getElementById('stickyPrice');
const quoteSection = document.getElementById('quoteSection');

const distanceText = document.getElementById('distanceText');
const startAddress = document.getElementById('startAddress');
const endAddress   = document.getElementById('endAddress');
const calcDistanceBtn = document.getElementById('calcDistance');

const moveDateEl   = document.getElementById('moveDate');
const timeSlotEls  = document.querySelectorAll('input[name="timeSlot"]');

const noFromEl     = document.getElementById('noFrom');
const noToEl       = document.getElementById('noTo');
const fromFloorEl  = document.getElementById('fromFloor');
const toFloorEl    = document.getElementById('toFloor');
const ladderEl     = document.getElementById('ladder');
const nightEl      = document.getElementById('night');
const cantCarryEl  = document.getElementById('cantCarry');
const rideEl       = document.getElementById('ride');

let geocoder;
let lastPrice = 0;

/* ===== Utility ===== */
function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getSelectedFurnitureLabels() {
  if (!state.furniture.length) return 'None';
  return state.furniture.map(v => FURNITURE_PRICE[v]?.label || v).join(', ');
}

/* =========================
   DOM initialization
========================= */
window.addEventListener('DOMContentLoaded', () => {
  // Auto select first vehicle
  const firstVehicle = document.querySelector('.vehicle');
  if (firstVehicle) {
    firstVehicle.classList.add('active');
    state.vehicle = firstVehicle.dataset.vehicle;
  }

  document.querySelectorAll('input[name="moveType"]').forEach(el => {
    el.addEventListener('change', e => {
      state.moveType = e.target.value;
      calc();
    });
  });

  document.querySelectorAll('.vehicle').forEach(v => {
    v.addEventListener('click', () => {
      document.querySelectorAll('.vehicle').forEach(x => x.classList.remove('active'));
      v.classList.add('active');
      state.vehicle = v.dataset.vehicle;
      calc();
    });
  });

  if (moveDateEl) {
    moveDateEl.addEventListener('change', e => {
      state.moveDate = e.target.value || '';
      calc();
    });
  }

  if (timeSlotEls && timeSlotEls.length) {
    timeSlotEls.forEach(el => {
      el.addEventListener('change', e => {
        state.timeSlot = e.target.value || '';
        calc();
      });
    });
  }

  if (noFromEl) noFromEl.addEventListener('change', e => { state.noFrom = e.target.checked; calc(); });
  if (noToEl)   noToEl.addEventListener('change',   e => { state.noTo   = e.target.checked; calc(); });
  if (fromFloorEl) fromFloorEl.addEventListener('input', e => { state.fromFloor = toNumberSafe(e.target.value,1) || 1; calc(); });
  if (toFloorEl)   toFloorEl.addEventListener('input',   e => { state.toFloor   = toNumberSafe(e.target.value,1) || 1; calc(); });
  if (ladderEl)    ladderEl.addEventListener('change',   e => { state.ladder = e.target.checked; calc(); });
  if (nightEl)     nightEl.addEventListener('change',    e => { state.night  = e.target.checked; calc(); });
  if (cantCarryEl) cantCarryEl.addEventListener('change',e => { state.cantCarry = e.target.checked; calc(); });
  if (rideEl)      rideEl.addEventListener('input',      e => { state.ride   = toNumberSafe(e.target.value,0); calc(); });

  document.querySelectorAll('.furniture').forEach(el => {
    el.addEventListener('change', e => {
      state.furniture = [...document.querySelectorAll('.furniture:checked')].map(x => x.value);
      calc();
    });
  });

  document.querySelectorAll('input[name="load"]').forEach(el => {
    el.addEventListener('change', e => {
      state.load = e.target.value;
      calc();
    });
  });

  if (quoteSection && stickyBarEl) {
    const io = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        stickyBarEl.style.display = 'none';
      } else {
        if (state.vehicle) stickyBarEl.style.display = 'block';
      }
    }, { threshold: 0.12 });
    io.observe(quoteSection);
  }

  if (typeof kakao !== 'undefined' && kakao.maps) {
    kakao.maps.load(() => {
      if (kakao.maps.services) {
        geocoder = new kakao.maps.services.Geocoder();
        calc();
      } else {
        console.error('Kakao Map services not loaded. Check libraries=services.');
        calc();
      }
    });
  } else {
    console.error('Kakao Map API not loaded.');
    calc();
  }
});

/* =========================
   Distance calculation button
========================= */
if (calcDistanceBtn) {
  calcDistanceBtn.addEventListener('click', async () => {
    const start = (startAddress?.value || '').trim();
    const end   = (endAddress?.value   || '').trim();
    if (!start || !end) {
      alert('Please enter both pickup and drop-off addresses.');
      return;
    }
    if (!geocoder) {
      alert('Kakao Map API not loaded. Please refresh.');
      return;
    }

    calcDistanceBtn.textContent = 'Calculating...';
    calcDistanceBtn.disabled = true;

    try {
      const startCoord = await getCoordinates(start);
      const endCoord   = await getCoordinates(end);
      const distance   = calculateDistance(startCoord, endCoord);
      state.distance   = Math.round(distance);
      if (distanceText) distanceText.textContent = `${state.distance} km`;
      calc();
    } catch (err) {
      alert(err.message || 'Address not found. Please enter a valid address.');
    } finally {
      calcDistanceBtn.textContent = 'Calculate Distance';
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
          lng: parseFloat(result[0].x)
        });
      } else {
        reject(new Error(`Address "${address}" not found.`));
      }
    });
  });
}

function calculateDistance(coord1, coord2) {
  const R = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/* ===== SMS body ===== */
function buildSmsBody(priceNumber) {
  const startAddr = (startAddress?.value || '').trim();
  const endAddr   = (endAddress?.value   || '').trim();

  const vehicleLabel = state.vehicle || 'Not selected';
  const moveLabel    = moveTypeLabel();

  const stairsFrom = state.noFrom ? `${state.fromFloor} floor(s) (no elevator)` : 'Elevator available';
  const stairsTo   = state.noTo   ? `${state.toFloor} floor(s) (no elevator)`   : 'Elevator available';

  const furnitureLabel = state.furniture.length ? getSelectedFurnitureLabels() : 'None';

  const loadMap  = getLoadMap();
  const loadLabel= state.load && loadMap[state.load] ? loadMap[state.load].label : 'Not selected';

  const ladderLabel = state.ladder ? 'Yes' : 'No';
  const nightLabel  = state.night  ? 'Yes' : 'No';
  const rideLabel   = state.ride > 0 ? `${state.ride} person(s)` : 'None';
  const laborLabel  = state.cantCarry ? 'Required (confirm)' : 'Not required';

  const distanceLabel = state.distance > 0 ? `${state.distance}km` : 'Not calculated';

  const scheduleLabel = state.moveDate || 'Not selected';
  const timeSlotLabel = formatTimeSlotEN(state.timeSlot);

  const disclaimer = '※ The estimated price may change depending on on-site conditions (load size, route, parking, extra work).';

  const lines = [
    'DD Logistics estimate inquiry.',
    '',
    `Move type: ${moveLabel}`,
    `Vehicle: ${vehicleLabel}`,
    `Distance: ${distanceLabel}`,
    `Date: ${scheduleLabel}`,
    `Preferred time slot: ${timeSlotLabel}`,
    startAddr ? `Pickup: ${startAddr}` : null,
    endAddr ? `Drop-off: ${endAddr}` : null,
    `Stairs: Pickup ${stairsFrom} / Drop-off ${stairsTo}`,
    `Furniture: ${furnitureLabel}`,
    `Load: ${loadLabel}`,
    '',
    `Ladder truck: ${ladderLabel}`,
    `Night/Weekend: ${nightLabel}`,
    `Passengers: ${rideLabel}`,
    `Labor help: ${laborLabel}`,
    '',
    `Estimated price: ₩${Number(priceNumber).toLocaleString()}`,
    disclaimer,
    '',
    'Please advise.'
  ].filter(Boolean);

  return lines.join('\n');
}

/* ===== Calculation ===== */
function calc() {
  if (!state.vehicle) return;
  const key = VEHICLE_MAP[state.vehicle];
  if (!key) return;

  let price  = BASE_PRICE[key] + state.distance * PER_KM_PRICE[key];
  price += ((state.noFrom ? state.fromFloor : 0) + (state.noTo ? state.toFloor : 0)) * 7000;
  price += state.furniture.reduce((sum, v) => sum + (FURNITURE_PRICE[v]?.price || 0), 0);

  const loadMap = getLoadMap();
  if (state.load) price += loadMap[state.load].price;
  if (state.ladder) price += 80000;
  price += state.ride * 20000;

  lastPrice = price;

  if (summaryEl) {
    const furnitureLabel = state.furniture.length ? getSelectedFurnitureLabels() : 'None';
    const loadLabel = state.load ? (loadMap[state.load]?.label || 'Not selected') : 'Not selected';

    summaryEl.innerHTML = `
      <b>🚚 Moving Conditions Summary</b><br><br>

      ▪ Move type: ${moveTypeLabel()}<br><br>

      ▪ Vehicle: ${state.vehicle}<br>
      ▪ Distance: ${state.distance > 0 ? state.distance + ' km' : 'Not calculated'}<br><br>

      ▪ Date: ${state.moveDate ? state.moveDate : 'Not selected'}<br>
      ▪ Preferred time slot: ${formatTimeSlotEN(state.timeSlot)}<br><br>

      ▪ Stairs:<br>
      &nbsp;&nbsp;- Pickup: ${state.noFrom ? `${state.fromFloor} floor(s) (no elevator)` : 'Elevator available'}<br>
      &nbsp;&nbsp;- Drop-off: ${state.noTo ? `${state.toFloor} floor(s) (no elevator)` : 'Elevator available'}<br><br>

      ▪ Furniture: ${furnitureLabel}<br>
      ▪ Load volume: ${loadLabel}<br><br>

      ▪ Ladder truck: ${state.ladder ? 'Yes' : 'No'}<br>
      ▪ Night/Weekend: ${state.night ? 'Yes' : 'No'}<br>
      ▪ Passengers: ${state.ride > 0 ? `${state.ride} person(s)` : 'None'}<br><br>

      ▪ Labor assistance: ${state.cantCarry ? 'Required (to be confirmed)' : 'Not required'}
    `;
  }

  const formatted = `₩${price.toLocaleString()}`;
  if (priceEl) priceEl.innerText = formatted;
  if (stickyPriceEl) stickyPriceEl.innerText = formatted;
  if (stickyBarEl && quoteSection) {
    const rect = quoteSection.getBoundingClientRect();
    const quoteVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
    stickyBarEl.style.display = quoteVisible ? 'none' : 'block';
  }
}

/* ===== SMS ===== */
const smsInquiryBtn = document.getElementById('smsInquiry');
if (smsInquiryBtn) {
  smsInquiryBtn.addEventListener('click', e => {
    e.preventDefault();
    if (!state.moveDate) {
      alert('Please select the moving date.');
      return;
    }
    if (!state.timeSlot) {
      alert('Please select the preferred time slot.');
      return;
    }
    const body = buildSmsBody(lastPrice);
    location.href = 'sms:01040941666?body=' + encodeURIComponent(body);
  });
}
