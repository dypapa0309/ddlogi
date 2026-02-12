// /assets/js/app.js
(() => {
  /* ==================================================
     디디운송 견적 계산기 (KR)
     - 거리 자동계산(카카오 지오코더) + 플로팅 가격바
     - 예약정보(날짜/시간) 필수
     - "버려주세요!" 토글 섹션
       ✅ 출발/도착 작업 체크
       ✅ throwQty(from/to) + 기존 itemQty 합산 → 가격/요약/SMS 반영
     - 확정 슬롯 조회(confirmed_slots) 연동
     - 스텝퍼 공통 처리:
       1) data-stepper="id"
       2) data-stepper-item="키" (기존 itemQty)
       3) data-stepper-loc="from|to" + data-stepper-item="키" (throwQty)
  ================================================== */

  // Supabase client
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

  /* =========================
     확정 슬롯 조회/반영
     - DB time_slot 값이 "7"~"15" (문자/숫자) 라고 가정
  ========================= */
  async function fetchConfirmedSlots(dateStr) {
    if (!supabase || !dateStr) return new Set();

    const { data, error } = await supabase
      .from('confirmed_slots')
      .select('time_slot')
      .eq('date', dateStr)
      .eq('status', 'confirmed');

    if (error) {
      console.error('fetchConfirmedSlots error:', error);
      return new Set();
    }

    // "7" / 7 둘 다 대응
    return new Set((data || []).map(x => String(x.time_slot)));
  }

  function setTimeSlotDisabled(slotValue, disabled) {
    const el = document.querySelector(`input[name="timeSlot"][value="${slotValue}"]`);
    if (!el) return;

    el.disabled = !!disabled;

    const label = el.closest('label');
    if (!label) return;

    const textDiv = label.querySelector('div');
    if (!textDiv) return;

    const baseText = textDiv.getAttribute('data-base-text') || textDiv.textContent.replace(' (마감)', '');
    textDiv.setAttribute('data-base-text', baseText);
    textDiv.textContent = disabled ? `${baseText} (마감)` : baseText;

    if (disabled && el.checked) el.checked = false;
  }

  /* =========================
     가격 테이블
  ========================= */
  const VEHICLE_MAP = {
    '1톤 카고': 'truck',
    '1톤 저상탑': 'van',
    '1톤 카고+저상탑': 'lorry'
  };

  const BASE_PRICE   = { truck: 50000, van: 50000, lorry: 90000 };
  const PER_KM_PRICE = { truck: 1500,  van: 1500,  lorry: 1500 };

  // 기존 itemQty + throwQty가 "같은 키"를 공유해야 합산이 됨
  const FURNITURE_PRICE = {
    // 가전
    '전자레인지': { label: '전자레인지', price: 1500 },
    '공기청정기': { label: '공기청정기', price: 2000 },
    '청소기': { label: '청소기', price: 1000 },
    'TV/모니터': { label: 'TV/모니터', price: 2500 },
    '정수기(이동만)': { label: '정수기(이동만)', price: 2500 },

    '세탁기(12kg이하)': { label: '세탁기(12kg 이하)', price: 7000 },
    '건조기(12kg이하)': { label: '건조기(12kg 이하)', price: 7000 },
    '냉장고(380L이하)': { label: '냉장고(380L 이하)', price: 7000 },

    // 가구
    '의자': { label: '의자', price: 500 },
    '행거': { label: '행거', price: 1500 },
    '협탁/사이드테이블(소형)': { label: '협탁/사이드테이블(소형)', price: 2500 },
    '화장대(소형)': { label: '화장대(소형)', price: 2500 },
    '책상/테이블(일반)': { label: '책상/테이블(일반)', price: 3000 },
    '서랍장(3~5단)': { label: '서랍장(3~5단)', price: 5000 },
    '책장(일반)': { label: '책장(일반)', price: 10000 },
    '수납장/TV장(일반)': { label: '수납장/TV장(일반)', price: 10000 },
    '소파(2~3인)': { label: '소파(2~3인)', price: 10000 },
    '소파(4인이상)': { label: '소파(4인 이상)', price: 15000 },
    '침대매트리스(킹제외)': { label: '침대 매트리스(킹 제외)', price: 10000 },
    '침대프레임(분해/조립)': { label: '침대 프레임 분해/조립', price: 30000 },
  };

  const LOAD_MAP_GENERAL = {
    1: { label: '1~5개',  price: 10000 },
    2: { label: '6~10개', price: 20000 },
    3: { label: '11~15개', price: 30000 },
    4: { label: '16~20개', price: 40000 }
  };

  const LOAD_MAP_HALF = {
    1: { label: '1~5개',  price: 20000 },
    2: { label: '6~10개', price: 35000 },
    3: { label: '11~15개', price: 50000 },
    4: { label: '16~20개', price: 65000 }
  };

  /* =========================
     유틸
  ========================= */
  function toNumberSafe(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function getLoadMap(moveType) {
    return moveType === 'half' ? LOAD_MAP_HALF : LOAD_MAP_GENERAL;
  }

  function moveTypeLabel(moveType) {
    return moveType === 'half'
      ? '반포장 이사 (웬만한 짐은 다 박스 포장 해놓으시고 당일까지 사용하실 짐을 포장하실 박스를 최대 5개까지 제공합니다.)'
      : '일반이사 (고객님이 전부 박스포장 해놓으셔야 합니다.)';
  }

  function moveTypeShortLabel(moveType) {
    return moveType === 'half' ? '반포장 이사' : '일반이사';
  }

  // ✅ 시간 슬롯: "7"~"15"
  function formatTimeSlotKR(v) {
    const s = String(v || '');
    if (!s) return '미선택';
    const hour = toNumberSafe(s, NaN);
    if (!Number.isFinite(hour)) return '미선택';

    // 12는 "오후 12시"
    if (hour === 12) return '오후 12시';
    if (hour >= 13) return `오후 ${hour - 12}시`;
    return `오전 ${hour}시`;
  }

  function buildLaborLabel(st) {
    const parts = [];
    if (st.cantCarryFrom) parts.push('출발지 기사 혼자 나르기 어려움(+3만)');
    if (st.cantCarryTo)   parts.push('도착지 기사 혼자 나르기 어려움(+3만)');
    if (st.helperFrom)    parts.push('출발지 인부 추가(+4만)');
    if (st.helperTo)      parts.push('도착지 인부 추가(+4만)');
    return parts.length ? parts.join(', ') : '없음';
  }

  function sumQtyMaps(...maps) {
    const out = {};
    maps.forEach(m => {
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
    return labels.length ? labels.join(', ') : '없음';
  }

  /* =========================
     상태
  ========================= */
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

    cantCarryFrom: false,
    cantCarryTo: false,
    helperFrom: false,
    helperTo: false,

    ride: 0,
    load: null,

    // ✅ 기존 옵션 itemQty (전자레인지 등)
    itemQty: {}, // key -> qty

    // ✅ 버려주세요 섹션
    throwEnabled: false,
    workFrom: false,
    workTo: false,
    throwFromQty: {},
    throwToQty: {},
  };

  /* =========================
     DOM 요소
  ========================= */
  const priceEl        = document.getElementById('price');
  const summaryEl      = document.getElementById('summary');
  const stickyBarEl    = document.getElementById('stickyPriceBar');
  const stickyPriceEl  = document.getElementById('stickyPrice');
  const quoteSectionEl = document.getElementById('quoteSection');

  const distanceText       = document.getElementById('distanceText');
  const startAddressInput  = document.getElementById('startAddress');
  const endAddressInput    = document.getElementById('endAddress');
  const calcDistanceBtn    = document.getElementById('calcDistance');

  const moveDateEl  = document.getElementById('moveDate');
  const timeSlotEls = document.querySelectorAll('input[name="timeSlot"]');

  const noFromEl    = document.getElementById('noFrom');
  const noToEl      = document.getElementById('noTo');
  const fromFloorEl = document.getElementById('fromFloor');
  const toFloorEl   = document.getElementById('toFloor');
  const ladderEl    = document.getElementById('ladder');
  const nightEl     = document.getElementById('night');

  const cantCarryFromEl = document.getElementById('cantCarryFrom');
  const cantCarryToEl   = document.getElementById('cantCarryTo');
  const helperFromEl    = document.getElementById('helperFrom');
  const helperToEl      = document.getElementById('helperTo');

  const rideEl        = document.getElementById('ride');
  const smsInquiryBtn = document.getElementById('smsInquiry');

  // throw
  const throwToggleEl = document.getElementById('throwToggle');
  const throwBodyEl   = document.getElementById('throwBody');
  const workFromEl    = document.getElementById('workFrom');
  const workToEl      = document.getElementById('workTo');

  let geocoder = null;
  let lastPrice = 0;

  // ✅ HTML 값 기준
  const TIME_SLOTS = ['7','8','9','10','11','12','13','14','15'];

  /* =========================
     초기화
  ========================= */
  window.addEventListener('DOMContentLoaded', async () => {
    // 1) 첫 차량 자동 선택
    const firstVehicle = document.querySelector('.vehicle');
    if (firstVehicle) {
      firstVehicle.classList.add('active');
      state.vehicle = firstVehicle.dataset.vehicle;
    }

    // 2) 이사 방식
    document.querySelectorAll('input[name="moveType"]').forEach(el => {
      el.addEventListener('change', e => {
        state.moveType = e.target.value;
        calc();
      });
    });

    // 3) 차량 선택
    document.querySelectorAll('.vehicle').forEach(v => {
      v.addEventListener('click', () => {
        document.querySelectorAll('.vehicle').forEach(x => x.classList.remove('active'));
        v.classList.add('active');
        state.vehicle = v.dataset.vehicle;
        calc();
      });
    });

    // 4) 날짜 변경 시: 마감 반영
    if (moveDateEl) {
      moveDateEl.addEventListener('change', async e => {
        state.moveDate = e.target.value || '';

        const confirmed = await fetchConfirmedSlots(state.moveDate);
        TIME_SLOTS.forEach(slot => setTimeSlotDisabled(slot, confirmed.has(slot)));

        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : '';

        calc();
      });
    }

    // 5) 시간 선택
    if (timeSlotEls?.length) {
      timeSlotEls.forEach(el => {
        el.addEventListener('change', e => {
          state.timeSlot = e.target.value || '';
          calc();
        });
      });
    }

    // 6) 옵션 이벤트
    if (noFromEl)  noFromEl.addEventListener('change', e => { state.noFrom = e.target.checked; calc(); });
    if (noToEl)    noToEl.addEventListener('change',   e => { state.noTo   = e.target.checked; calc(); });
    if (fromFloorEl) fromFloorEl.addEventListener('input', e => { state.fromFloor = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });
    if (toFloorEl)   toFloorEl.addEventListener('input',   e => { state.toFloor   = Math.max(1, toNumberSafe(e.target.value, 1)); calc(); });

    if (ladderEl) ladderEl.addEventListener('change', e => { state.ladder = e.target.checked; calc(); });
    if (nightEl)  nightEl.addEventListener('change',  e => { state.night  = e.target.checked; calc(); });

    if (cantCarryFromEl) cantCarryFromEl.addEventListener('change', e => { state.cantCarryFrom = e.target.checked; calc(); });
    if (cantCarryToEl)   cantCarryToEl  .addEventListener('change', e => { state.cantCarryTo   = e.target.checked; calc(); });
    if (helperFromEl)    helperFromEl   .addEventListener('change', e => { state.helperFrom    = e.target.checked; calc(); });
    if (helperToEl)      helperToEl     .addEventListener('change', e => { state.helperTo      = e.target.checked; calc(); });

    if (rideEl) rideEl.addEventListener('input', e => { state.ride = Math.max(0, toNumberSafe(e.target.value, 0)); calc(); });

    // 7) 짐양
    document.querySelectorAll('input[name="load"]').forEach(el => {
      el.addEventListener('change', e => {
        state.load = e.target.value;
        calc();
      });
    });

    // ✅ 8) 기존 itemQty 입력 감지
    document.querySelectorAll('.itemQty').forEach(el => {
      el.addEventListener('input', e => {
        const key = e.target.getAttribute('data-item');
        if (!key) return;
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        state.itemQty[key] = v;
        calc();
      });
      // 초기값 주입
      const key = el.getAttribute('data-item');
      if (key) state.itemQty[key] = Math.max(0, toNumberSafe(el.value, 0));
    });

    // ✅ 9) 버려주세요 토글 (중복 코드 제거: 이 블록만 사용)
    if (throwToggleEl && throwBodyEl) {
      throwToggleEl.addEventListener('change', e => {
        state.throwEnabled = !!e.target.checked;
        throwBodyEl.style.display = state.throwEnabled ? 'block' : 'none';
        calc();
      });
      state.throwEnabled = !!throwToggleEl.checked;
      throwBodyEl.style.display = state.throwEnabled ? 'block' : 'none';
    }

    if (workFromEl) workFromEl.addEventListener('change', e => { state.workFrom = e.target.checked; calc(); });
    if (workToEl)   workToEl  .addEventListener('change', e => { state.workTo   = e.target.checked; calc(); });

    // ✅ 10) throwQty 입력 감지
    document.querySelectorAll('.throwQty').forEach(el => {
      el.addEventListener('input', e => {
        const loc = e.target.getAttribute('data-loc');   // from | to
        const key = e.target.getAttribute('data-item');  // item key
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        if (!loc || !key) return;

        if (loc === 'from') state.throwFromQty[key] = v;
        if (loc === 'to')   state.throwToQty[key] = v;

        calc();
      });

      // 초기값 주입
      const loc = el.getAttribute('data-loc');
      const key = el.getAttribute('data-item');
      if (loc && key) {
        const v = Math.max(0, toNumberSafe(el.value, 0));
        if (loc === 'from') state.throwFromQty[key] = v;
        if (loc === 'to')   state.throwToQty[key] = v;
      }
    });

    // 11) 스텝퍼 버튼 공통 처리 (여기서 3종 다 처리)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;

      const dir = Number(btn.getAttribute('data-dir') || '0');
      if (!dir) return;

      // (1) id 기반
      const targetId = btn.getAttribute('data-stepper');
      if (targetId) {
        const input = document.getElementById(targetId);
        if (!input) return;

        const min = Number(input.min || '0');
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || '0');
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // (2) itemQty (기존)
      const itemKey = btn.getAttribute('data-stepper-item');
      const loc = btn.getAttribute('data-stepper-loc'); // throw 전용이면 있음

      if (itemKey && !loc) {
        const input = document.querySelector(`.itemQty[data-item="${CSS.escape(itemKey)}"]`);
        if (!input) return;

        const min = Number(input.min || '0');
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || '0');
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // (3) throwQty (loc + item)
      if (loc && itemKey) {
        const input = document.querySelector(`.throwQty[data-loc="${loc}"][data-item="${CSS.escape(itemKey)}"]`);
        if (!input) return;

        const min = Number(input.min || '0');
        const max = input.max ? Number(input.max) : Infinity;
        const cur = Number(input.value || '0');
        const next = Math.min(max, Math.max(min, cur + dir));

        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    });

    // 12) 플로팅바
    if (quoteSectionEl && stickyBarEl) {
      const io = new IntersectionObserver(entries => {
        const entry = entries[0];
        stickyBarEl.style.display = entry.isIntersecting ? 'none' : (state.vehicle ? 'block' : 'none');
      }, { threshold: 0.12 });
      io.observe(quoteSectionEl);
    }

    // 13) 카카오 SDK 로드 (autoload=false)
    if (typeof kakao !== 'undefined' && kakao.maps && typeof kakao.maps.load === 'function') {
      kakao.maps.load(() => {
        try {
          if (!kakao.maps.services) {
            console.error('카카오 services 미로드: sdk.js에 libraries=services 확인 필요');
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
      console.error('카카오 SDK 로드 실패: 스크립트 태그/도메인 등록 확인');
      calc();
    }

    // 14) 초기 로드 시 날짜 선택돼 있으면 마감 반영
    if (moveDateEl?.value) {
      state.moveDate = moveDateEl.value;
      const confirmed = await fetchConfirmedSlots(state.moveDate);
      TIME_SLOTS.forEach(slot => setTimeSlotDisabled(slot, confirmed.has(slot)));
      const checked = document.querySelector('input[name="timeSlot"]:checked');
      state.timeSlot = checked ? checked.value : '';
    }

    calc();
  });

  /* =========================
     거리 계산
  ========================= */
  if (calcDistanceBtn) {
    calcDistanceBtn.addEventListener('click', async () => {
      const start = (startAddressInput?.value || '').trim();
      const end   = (endAddressInput?.value || '').trim();

      if (!start || !end) {
        alert('출발지와 도착지를 모두 입력해주세요.');
        return;
      }
      if (!geocoder) {
        alert('거리 계산을 위한 카카오맵 초기화에 실패했습니다.\n(카카오 개발자센터에 localhost 등록/도메인 등록 확인 필요)');
        return;
      }

      calcDistanceBtn.textContent = '계산 중...';
      calcDistanceBtn.disabled = true;

      try {
        const startCoord = await getCoordinates(start);
        const endCoord   = await getCoordinates(end);

        const distance = calculateDistance(startCoord, endCoord);
        state.distance = Math.max(0, Math.round(distance));

        if (distanceText) distanceText.textContent = `${state.distance} km`;
        calc();
      } catch (error) {
        alert(error.message || '주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.');
      } finally {
        calcDistanceBtn.textContent = '거리 계산하기';
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

  function calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLng = toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /* =========================
     SMS 바디 생성
     - ✅ 기존 itemQty + throwQty 합산 품목 표시
  ========================= */
  function buildSmsBody(priceNumber) {
    const startAddr = (startAddressInput?.value || '').trim();
    const endAddr   = (endAddressInput?.value || '').trim();

    const vehicleLabel = state.vehicle || '미선택';
    const moveLabel    = moveTypeLabel(state.moveType);

    const stairsFrom = state.noFrom ? `${state.fromFloor}층(엘베없음)` : '엘베있음';
    const stairsTo   = state.noTo ? `${state.toFloor}층(엘베없음)` : '엘베있음';

    const loadMap = getLoadMap(state.moveType);
    const loadLabel = state.load && loadMap[state.load] ? loadMap[state.load].label : '미선택';

    const ladderLabel = state.ladder ? '필요' : '불필요';
    const nightLabel  = state.night  ? '해당' : '미해당';
    const rideLabel   = state.ride > 0 ? `${state.ride}명` : '없음';
    const distanceLabel = state.distance > 0 ? `${state.distance}km` : '미계산';

    const scheduleLabel = state.moveDate || '미선택';
    const timeSlotLabel = formatTimeSlotKR(state.timeSlot);

    const laborLabel = buildLaborLabel(state);

    // ✅ 핵심: 기존 itemQty + throwQty 합산
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const allItemsLabel = getSelectedQtyLabel(mergedAllItems);

    const throwModeLabel = state.throwEnabled ? '사용' : '미사용';
    const workLabel = state.throwEnabled
      ? `출발지 작업:${state.workFrom ? '있음' : '없음'} / 도착지 작업:${state.workTo ? '있음' : '없음'}`
      : '미사용';

    const disclaimer =
      '※ 안내된 예상금액은 현장 상황(짐량/동선/주차/추가 작업)에 따라 변동될 수 있습니다.';

    const lines = [
      '디디운송 예상견적 문의드립니다.',
      '',
      `이사 방식: ${moveLabel}`,
      `차량: ${vehicleLabel}`,
      `거리: ${distanceLabel}`,
      `일정: ${scheduleLabel}`,
      `희망 시간: ${timeSlotLabel}`,
      startAddr ? `출발지: ${startAddr}` : null,
      endAddr ? `도착지: ${endAddr}` : null,
      `계단: 출발 ${stairsFrom} / 도착 ${stairsTo}`,
      `짐양(박스): ${loadLabel}`,
      '',
      `버려주세요 모드: ${throwModeLabel}`,
      state.throwEnabled ? `작업 여부: ${workLabel}` : null,
      `가구·가전(합산): ${allItemsLabel}`,
      '',
      `사다리차: ${ladderLabel}`,
      `야간/주말: ${nightLabel}`,
      `동승: ${rideLabel}`,
      `인부/작업: ${laborLabel}`,
      '',
      `예상금액: ₩${Number(priceNumber).toLocaleString()}`,
      disclaimer,
      '',
      '상담 부탁드립니다.'
    ].filter(Boolean);

    return lines.join('\n');
  }

  /* =========================
     가격 계산
     - ✅ 기존 itemQty + throwQty 합산하여 품목 비용 반영
  ========================= */
  function calc() {
    if (!state.vehicle) return;

    const key = VEHICLE_MAP[state.vehicle];
    if (!key) return;

    const base  = toNumberSafe(BASE_PRICE[key], 0);
    const perKm = toNumberSafe(PER_KM_PRICE[key], 0);
    const dist  = Math.max(0, toNumberSafe(state.distance, 0));

    let price = base + (dist * perKm);

    // 계단 비용 (층당 7,000원)
    const stairCount =
      (state.noFrom ? toNumberSafe(state.fromFloor, 1) : 0) +
      (state.noTo   ? toNumberSafe(state.toFloor,   1) : 0);
    price += Math.max(0, stairCount) * 7000;

    // ✅ 품목 비용: 기존 + throw 합산
    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);

    price += Object.entries(mergedAllItems).reduce((sum, [k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      return sum + (FURNITURE_PRICE[k]?.price || 0) * q;
    }, 0);

    // ✅ 짐양(박스)
    const loadMap = getLoadMap(state.moveType);
    if (state.load && loadMap[state.load]) {
      let loadPrice = loadMap[state.load].price;

      // 반포장 + 엘베없음 체크 시 박스 구간 1.2배
      const hasStairs = !!(state.noFrom || state.noTo);
      if (state.moveType === 'half' && hasStairs) {
        loadPrice = Math.round(loadPrice * 1.2);
      }

      price += loadPrice;
    }

    // 추가 옵션
    if (state.ladder) price += 80000;
    price += toNumberSafe(state.ride, 0) * 20000;

    if (state.cantCarryFrom) price += 30000;
    if (state.cantCarryTo)   price += 30000;

    if (state.helperFrom) price += 40000;
    if (state.helperTo)   price += 40000;

    // 반포장 1.2배 (전체)
    if (state.moveType === 'half') {
      price = Math.round(price * 1.2);
    }

    lastPrice = price;

    // ✅ 요약
    if (summaryEl) {
      const loadLabel  = state.load && loadMap[state.load] ? loadMap[state.load].label : '미선택';
      const laborLabel = buildLaborLabel(state);

      const throwModeLabel = state.throwEnabled ? '사용' : '미사용';
      const workLabel = state.throwEnabled
        ? `출발지:${state.workFrom ? '있음' : '없음'} / 도착지:${state.workTo ? '있음' : '없음'}`
        : '-';

      const allItemsLabel = getSelectedQtyLabel(mergedAllItems);

      summaryEl.innerHTML = `
        <b>🚚 이사 조건 요약</b><br><br>

        ▪ 이사 방식: ${moveTypeShortLabel(state.moveType)}<br><br>

        ▪ 차량: ${state.vehicle}<br>
        ▪ 거리: ${dist > 0 ? dist + ' km' : '미계산'}<br><br>

        ▪ 일정: ${state.moveDate ? state.moveDate : '미선택'}<br>
        ▪ 희망 시간: ${formatTimeSlotKR(state.timeSlot)}<br><br>

        ▪ 계단:<br>
        &nbsp;&nbsp;- 출발지: ${state.noFrom ? `${state.fromFloor}층 (엘베 없음)` : '엘베 있음'}<br>
        &nbsp;&nbsp;- 도착지: ${state.noTo ? `${state.toFloor}층 (엘베 없음)` : '엘베 있음'}<br><br>

        ▪ 짐양: ${loadLabel}<br><br>

        <b>🧹 버려주세요 모드</b><br>
        ▪ 사용: ${throwModeLabel}<br>
        ▪ 작업 여부: ${workLabel}<br><br>

        ▪ 가구·가전(합산): ${allItemsLabel}<br><br>

        ▪ 사다리차: ${state.ladder ? '필요' : '불필요'}<br>
        ▪ 야간/주말: ${state.night ? '해당' : '미해당'}<br>
        ▪ 동승 인원: ${state.ride > 0 ? `${state.ride}명` : '없음'}<br><br>

        ▪ 인부/작업: ${laborLabel}
      `;
    }

    // 가격 표시
    const formatted = `₩${price.toLocaleString()}`;
    if (priceEl) priceEl.innerText = formatted;
    if (stickyPriceEl) stickyPriceEl.innerText = formatted;

    // 플로팅바 표시
    if (stickyBarEl && quoteSectionEl) {
      const rect = quoteSectionEl.getBoundingClientRect();
      const quoteVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
      stickyBarEl.style.display = quoteVisible ? 'none' : 'block';
    }
  }

  /* =========================
     SMS 문의 버튼
  ========================= */
  if (smsInquiryBtn) {
    smsInquiryBtn.addEventListener('click', async e => {
      e.preventDefault();

      if (!state.moveDate) {
        alert('이사 날짜를 선택해주세요.');
        return;
      }
      if (!state.timeSlot) {
        alert('시간을 선택해주세요.');
        return;
      }

      const confirmed = await fetchConfirmedSlots(state.moveDate);
      if (confirmed.has(String(state.timeSlot))) {
        alert('방금 해당 시간이 마감되었습니다. 다른 시간을 선택해주세요.');
        setTimeSlotDisabled(String(state.timeSlot), true);
        const checked = document.querySelector('input[name="timeSlot"]:checked');
        state.timeSlot = checked ? checked.value : '';
        return;
      }

      const body = buildSmsBody(lastPrice);
      location.href = `sms:01040941666?body=${encodeURIComponent(body)}`;
    });
  }
})();

const moveToggleEl = document.getElementById('moveToggle');
const moveBodyEl = document.getElementById('moveBody');

if (moveToggleEl && moveBodyEl) {
  const syncMoveUI = () => {
    // ON(checked) = 전체 옵션 보기
    moveBodyEl.style.display = moveToggleEl.checked ? 'block' : 'none';
  };
  moveToggleEl.addEventListener('change', syncMoveUI);
  syncMoveUI();
}

