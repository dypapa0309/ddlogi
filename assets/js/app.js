/* ==================================================
    디디운송 견적 계산기 - 카카오맵 거리 자동계산 (수정 완료)
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

/* ===== 차량 타입 ===== */
const VEHICLE_MAP = {
    "1톤 카고": "truck",
    "1톤 저상탑": "van",
    "1톤 카고+저상탑": "lorry"
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

/* ===== 가구 가격 ===== */
const FURNITURE_PRICE = {
    "소형": { label: "소형 (의자, 협탁 등)", price: 20000 },
    "중형": { label: "중형 (테이블, 소형 냉장고 등)", price: 40000 },
    "대형": { label: "대형 (책장, 세탁기, 건조기 등)", price: 70000 }
};

/* ===== 짐양 가격 ===== */
const LOAD_MAP = {
    "1": { label: "1~5개", price: 10000 },
    "2": { label: "6~10개", price: 20000 },
    "3": { label: "11~15개", price: 30000 },
    "4": { label: "16~20개", price: 40000 }
};

/* ===== DOM 요소 ===== */
const priceEl = document.getElementById("price");
const summaryEl = document.getElementById("summary");
const distanceText = document.getElementById("distanceText");
const startAddressInput = document.getElementById("startAddress");
const endAddressInput = document.getElementById("endAddress");
const calcDistanceBtn = document.getElementById("calcDistance");

/* ===== 카카오맵 거리 계산 ===== */
let geocoder;

window.addEventListener("DOMContentLoaded", () => {
    // 첫 번째 차량 자동 선택
    const first = document.querySelector(".vehicle");
    if (first) {
        first.classList.add("active");
        state.vehicle = first.dataset.vehicle;
        // calc()는 Geocoder 초기화 후에 호출되도록 아래로 이동
    }

    // =======================================================
    // 💡 수정된 부분: Geocoder 초기화를 kakao.maps.load()로 감싸기
    // =======================================================
    if (typeof kakao !== 'undefined' && kakao.maps) {
        // Kakao API 스크립트가 로드되었는지 확인 후, load 이벤트 발생 시 Geocoder 초기화
        kakao.maps.load(() => {
            // services 라이브러리가 로드되었는지 최종 확인
            if (kakao.maps.services) {
                geocoder = new kakao.maps.services.Geocoder();
                calc(); // Geocoder 초기화 성공 후 가격 계산 시작
            } else {
                console.error('Kakao Map services 라이브러리가 로드되지 않았습니다. API 스크립트의 libraries=services를 확인하세요.');
                calc(); // API 없이 기본 계산이라도 수행 (거리=0)
            }
        });
    } else {
        // API 스크립트 로드 자체에 실패한 경우 (도메인 문제, API 키 문제 등)
        console.error('카카오맵 API 객체(kakao.maps)가 존재하지 않아 Geocoder 초기화에 실패했습니다.');
        calc(); // API 없이 기본 계산이라도 수행 (거리=0)
    }
});


/* ===== 거리 계산 버튼 클릭 ===== */
calcDistanceBtn.onclick = async () => {
    const start = startAddressInput.value.trim();
    const end = endAddressInput.value.trim();

    if (!start || !end) {
        alert("출발지와 도착지를 모두 입력해주세요.");
        return;
    }

    if (!geocoder) {
        // Geocoder 초기화에 실패한 경우
        alert("거리 계산을 위한 카카오맵 API 초기화에 실패했습니다. 페이지를 새로고침하거나 개발자 도구를 확인해주세요.");
        return;
    }

    calcDistanceBtn.textContent = "계산 중...";
    calcDistanceBtn.disabled = true;

    try {
        // 출발지 좌표 가져오기
        const startCoord = await getCoordinates(start);
        // 도착지 좌표 가져오기
        const endCoord = await getCoordinates(end);

        // 두 지점 간 거리 계산 (km)
        const distance = calculateDistance(startCoord, endCoord);
        
        state.distance = Math.round(distance);
        distanceText.textContent = `${state.distance} km`;
        
        calc();

        calcDistanceBtn.textContent = "거리 계산하기";
        calcDistanceBtn.disabled = false;

    } catch (error) {
        alert(error.message || "주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.");
        calcDistanceBtn.textContent = "거리 계산하기";
        calcDistanceBtn.disabled = false;
    }
};

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

/* ===== 두 좌표 간 거리 계산 (Haversine 공식) ===== */
function calculateDistance(coord1, coord2) {
    const R = 6371; // 지구 반지름 (km)
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

/* ===== 차량 선택 ===== */
document.querySelectorAll(".vehicle").forEach(v => {
    v.onclick = () => {
        document.querySelectorAll(".vehicle").forEach(x => x.classList.remove("active"));
        v.classList.add("active");
        state.vehicle = v.dataset.vehicle;
        calc();
    };
});

/* ===== 옵션 이벤트 ===== */
noFrom.onchange = e => { state.noFrom = e.target.checked; calc(); };
noTo.onchange = e => { state.noTo = e.target.checked; calc(); };
fromFloor.oninput = e => { state.fromFloor = +e.target.value; calc(); };
toFloor.oninput = e => { state.toFloor = +e.target.value; calc(); };
ladder.onchange = e => { state.ladder = e.target.checked; calc(); };
night.onchange = e => { state.night = e.target.checked; calc(); };
cantCarry.onchange = e => { state.cantCarry = e.target.checked; calc(); };
ride.oninput = e => { state.ride = +e.target.value; calc(); };

/* ===== 가구 선택 ===== */
document.querySelectorAll(".furniture").forEach(el => {
    el.onchange = () => {
        state.furniture = [...document.querySelectorAll(".furniture:checked")]
            .map(x => x.value);
        calc();
    };
});

/* ===== 짐양 선택 ===== */
document.querySelectorAll("input[name='load']").forEach(el => {
    el.onchange = e => {
        state.load = e.target.value;
        calc();
    };
});

/* ===== 가격 계산 ===== */
function calc() {
    if (!state.vehicle) return;

    const key = VEHICLE_MAP[state.vehicle];
    let price = BASE_PRICE[key] + state.distance * PER_KM_PRICE[key];

    // 계단 비용
    price += ((state.noFrom ? state.fromFloor : 0) +
                (state.noTo ? state.toFloor : 0)) * 7000;

    // 가구 비용
    price += state.furniture.reduce(
        (sum, v) => sum + (FURNITURE_PRICE[v]?.price || 0),
        0
    );

    // 짐양 비용
    if (state.load) price += LOAD_MAP[state.load].price;

    // 추가 옵션
    if (state.ladder) price += 80000;
    price += state.ride * 20000;

    /* ===== 견적 요약 ===== */
    summaryEl.innerHTML = `
        <b>🚚 이사 조건 요약</b><br><br>

        ▪ 차량: ${state.vehicle}<br>
        ▪ 거리: ${state.distance > 0 ? state.distance + ' km' : '미계산'}<br><br>

        ▪ 계단:<br>
        &nbsp;&nbsp;- 출발지: ${state.noFrom ? `${state.fromFloor}층 (엘베 없음)` : "엘베 있음"}<br>
        &nbsp;&nbsp;- 도착지: ${state.noTo ? `${state.toFloor}층 (엘베 없음)` : "엘베 있음"}<br><br>

        ▪ 가구: ${
            state.furniture.length
                ? state.furniture.map(v => FURNITURE_PRICE[v].label).join(", ")
                : "없음"
        }<br>

        ▪ 짐양: ${state.load ? LOAD_MAP[state.load].label : "미선택"}<br><br>

        ▪ 사다리차: ${state.ladder ? "필요" : "불필요"}<br>
        ▪ 야간/주말: ${state.night ? "해당" : "미해당"}<br>
        ▪ 동승 인원: ${state.ride > 0 ? `${state.ride}명` : "없음"}<br><br>

        ▪ 인부 지원: ${state.cantCarry ? "필요 (상담 시 확인)" : "불필요"}
    `;

    priceEl.innerText = `₩${price.toLocaleString()}`;
}

/* ===== SMS 문의 ===== */
if (document.getElementById("smsInquiry")) {
    smsInquiry.onclick = (e) => {
        e.preventDefault();
        alert("견적 화면을 캡처한 후 문자로 보내주세요");
        location.href =
            "sms:01040941666?body=" +
            encodeURIComponent("디디운송 견적 문의드립니다.\n캡처한 견적 기준으로 상담 부탁드립니다.");
    };
}