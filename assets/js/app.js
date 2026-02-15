// /assets/js/app.js
(() => {
  // ✅ 내가 임의로 조정하는 전체 가격 배율
  // 기본값 1 (변화 없음)
  // 예: 1.05 → 5% 인상 / 0.97 → 3% 인하
  const PRICE_MULTIPLIER = 1;

  /* ==================================================
     디디운송 견적 계산기 (KR)
     - 거리 자동계산(카카오 지오코더) + 플로팅 가격바
     - 예약정보(날짜/시간) 필수
     - "버려주세요!" 토글 섹션
       ✅ 출발/도착 작업 체크
       ✅ throwQty(from/to) + 기존 itemQty 합산 → 가격/요약/문의 반영
     - 확정 슬롯 조회(confirmed_slots) 연동
     - 스텝퍼 공통 처리:
       1) data-stepper="id"
       2) data-stepper-item="키" (기존 itemQty)
       3) data-stepper-loc="from|to" + data-stepper-item="키" (throwQty)
     - ✅ SMS 문의 → ✅ 채널톡 문의로 교체
     - ✅ 2026-02-15 정책 반영
       1) 박스(짐양): "구간별 퍼센트 가중치" 적용 (16~20은 1.95)
       2) 계단: 1→2는 7,000 / 이후 구간별 단가 상승 + (층수-1)로 이동층수 계산
       3) 품목(가전/가구): 퍼센트 인상 + 고위험 품목 가중치 + 품목 개수에 따른 복리 가산
  ================================================== */

  /* =========================
     Supabase client
  ========================= */
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
  const PER_KM_PRICE = { truck: 1550,  van: 1550,  lorry: 1550 };

  const FURNITURE_PRICE = {
    // 가전
    '전자레인지': { label: '전자레인지', price: 1500 },
    '공기청정기': { label: '공기청정기', price: 3000 },
    '청소기': { label: '청소기', price: 2000 },
    'TV/모니터': { label: 'TV/모니터', price: 5000 },
    '정수기(이동만)': { label: '정수기(이동만)', price: 3000 },

    '세탁기(12kg이하)': { label: '세탁기(12kg 이하)', price: 10000 },
    '건조기(12kg이하)': { label: '건조기(12kg 이하)', price: 10000 },
    '냉장고(380L이하)': { label: '냉장고(380L 이하)', price: 10000 },

    // 가구
    '의자': { label: '의자', price: 3000 },
    '행거': { label: '행거', price: 3000 },
    '협탁/사이드테이블(소형)': { label: '협탁/사이드테이블(소형)', price: 3000 },
    '화장대(소형)': { label: '화장대(소형)', price: 5000 },
    '책상/테이블(일반)': { label: '책상/테이블(일반)', price: 5000 },
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

  function formatTimeSlotKR(v) {
    const s = String(v || '');
    if (!s) return '미선택';
    const hour = toNumberSafe(s, NaN);
    if (!Number.isFinite(hour)) return '미선택';

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

    itemQty: {},

    // throw
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

  const rideEl           = document.getElementById('ride');

  // ✅ 채널톡 문의 버튼
  const channelInquiryBtn = document.getElementById('channelInquiry');

  // throw
  const throwToggleEl = document.getElementById('throwToggle');
  const throwBodyEl   = document.getElementById('throwBody');
  const workFromEl    = document.getElementById('workFrom');
  const workToEl      = document.getElementById('workTo');

  // move toggle (옮겨주세요)
  const moveToggleEl = document.getElementById('moveToggle');
  const moveBodyEl   = document.getElementById('moveBody');

  let geocoder = null;
  let lastPrice = 0;

  const TIME_SLOTS = ['7','8','9','10','11','12','13','14','15'];

  /* =========================
     ✅ 채널톡 부팅 (필수)
  ========================= */
  function bootChannelIO() {
    const pluginKey = CFG.channelPluginKey; // ✅ config.js에 넣어라
    if (!pluginKey) {
      console.warn('[ChannelIO] pluginKey가 없습니다. config.js에 DDLOGI_CONFIG.channelPluginKey를 추가하세요.');
      return;
    }
    if (!window.ChannelIO) {
      console.warn('[ChannelIO] 로더가 아직 준비되지 않았습니다. (index.html 스니펫 위치/오타 확인)');
      return;
    }
    try {
      window.ChannelIO('boot', { pluginKey });
    } catch (e) {
      console.error('[ChannelIO] boot 실패:', e);
    }
  }

  // ChannelIO 로더가 늦게 붙는 경우를 대비한 대기
  function waitForChannelIO(timeoutMs = 5000) {
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
     초기화
  ========================= */
  window.addEventListener('DOMContentLoaded', async () => {
    // ✅ 채널톡 준비/부팅
    const ok = await waitForChannelIO(6000);
    if (ok) bootChannelIO();

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

    // 8) 기존 itemQty 입력 감지
    document.querySelectorAll('.itemQty').forEach(el => {
      el.addEventListener('input', e => {
        const key = e.target.getAttribute('data-item');
        if (!key) return;
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        state.itemQty[key] = v;
        calc();
      });
      const key = el.getAttribute('data-item');
      if (key) state.itemQty[key] = Math.max(0, toNumberSafe(el.value, 0));
    });

    // 9) 버려주세요 토글
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

    // 10) throwQty 입력 감지
    document.querySelectorAll('.throwQty').forEach(el => {
      el.addEventListener('input', e => {
        const loc = e.target.getAttribute('data-loc');
        const key = e.target.getAttribute('data-item');
        const v = Math.max(0, toNumberSafe(e.target.value, 0));
        if (!loc || !key) return;

        if (loc === 'from') state.throwFromQty[key] = v;
        if (loc === 'to')   state.throwToQty[key] = v;

        calc();
      });

      const loc = el.getAttribute('data-loc');
      const key = el.getAttribute('data-item');
      if (loc && key) {
        const v = Math.max(0, toNumberSafe(el.value, 0));
        if (loc === 'from') state.throwFromQty[key] = v;
        if (loc === 'to')   state.throwToQty[key] = v;
      }
    });

    // 11) 스텝퍼 버튼 공통 처리
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

      // (2) itemQty
      const itemKey = btn.getAttribute('data-stepper-item');
      const loc = btn.getAttribute('data-stepper-loc');

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

      // (3) throwQty
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

    // 12) 플로팅바 (견적 섹션 보이면 숨김)
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

    // ✅ 15) 옮겨주세요 토글 UI
    if (moveToggleEl && moveBodyEl) {
      const syncMoveUI = () => {
        moveBodyEl.style.display = moveToggleEl.checked ? 'block' : 'none';
      };
      moveToggleEl.addEventListener('change', syncMoveUI);
      syncMoveUI();
    }

    calc();
  });

  /* =========================
   거리 계산 (✅ 도로 주행거리 기준)
   - 주소 → 좌표(카카오 지오코더)
   - 좌표 → 도로거리(Netlify Function → Kakao Mobility Directions)
   - 실패 시 직선거리로 백업
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

        // ✅ 도로거리(주행거리) 우선, 실패 시 직선거리 백업
        const km = await getBestDistanceKm(startCoord, endCoord);
        state.distance = km;

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

  /* ====== 도로거리 (Kakao Mobility Directions via Netlify Function) ====== */
  async function getRoadDistanceKmByKakaoMobility(origin, destination) {
    // ✅ 주의: origin/destination은 "경도,위도" 순서
    const params = new URLSearchParams({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
    });

    const res = await fetch(`/.netlify/functions/kakaoDirections?${params.toString()}`, {
      method: 'GET',
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`도로거리 계산 실패: ${res.status} ${t}`);
    }

    const data = await res.json();
    const meter = data?.routes?.[0]?.summary?.distance;

    if (!Number.isFinite(meter)) throw new Error('도로거리 데이터가 없습니다.');

    return Math.max(0, Math.round(meter / 1000)); // km 정수
  }

  async function getBestDistanceKm(startCoord, endCoord) {
    try {
      return await getRoadDistanceKmByKakaoMobility(startCoord, endCoord);
    } catch (e) {
      console.warn('[거리] 도로거리 실패 → 직선거리로 백업:', e);
      const straight = calculateDistance(startCoord, endCoord);
      return Math.max(0, Math.round(straight));
    }
  }

  /* ====== 직선거리(백업용) ====== */
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
     ✅ 문의 메시지 생성 (채널톡용)
  ========================= */
  function buildInquiryMessage(priceNumber) {
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

    const mergedThrow = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);
    const allItemsLabel = getSelectedQtyLabel(mergedAllItems);

    const throwModeLabel = state.throwEnabled ? '사용' : '미사용';
    const workLabel = state.throwEnabled
      ? `출발지 작업:${state.workFrom ? '있음' : '없음'} / 도착지 작업:${state.workTo ? '있음' : '없음'}`
      : '-';

    // ✅ 결제 금액 계산
    const total = Math.max(0, Number(priceNumber) || 0);
    const deposit = Math.round(total * 0.2);
    const balance = Math.max(0, total - deposit);

    const lines = [
      '안녕하세요. 디디운송 견적 문의드립니다.',
      '',
      `[조건]`,
      `- 이사 방식: ${moveLabel}`,
      `- 차량: ${vehicleLabel}`,
      `- 거리: ${distanceLabel}`,
      `- 일정: ${scheduleLabel}`,
      `- 희망 시간: ${timeSlotLabel}`,
      startAddr ? `- 출발지: ${startAddr}` : null,
      endAddr ? `- 도착지: ${endAddr}` : null,
      `- 계단: 출발 ${stairsFrom} / 도착 ${stairsTo}`,
      `- 짐양(박스): ${loadLabel}`,
      `- 버려주세요: ${throwModeLabel}`,
      `- 작업 여부: ${workLabel}`,
      `- 가구·가전(합산): ${allItemsLabel}`,
      `- 사다리차: ${ladderLabel}`,
      `- 야간/주말: ${nightLabel}`,
      `- 동승: ${rideLabel}`,
      `- 인부/작업: ${laborLabel}`,
      '',
      `[예상금액] ₩${total.toLocaleString('ko-KR')}`,
      `[예약금(20%)] ₩${deposit.toLocaleString('ko-KR')}`,
      `[잔금(80%)] ₩${balance.toLocaleString('ko-KR')}`,
      '※ 예약금 입금 시 예약 확정되며, 잔금은 운송 당일 결제합니다.',
      '※ 현장 상황(짐량/동선/주차/추가 작업)에 따라 금액이 변동될 수 있습니다.',
      '',
    ].filter(Boolean);

    return lines.join('\n');
  }

  /* =========================
     가격 계산 (✅ 옵션 A - 거리밴드 제거ver)
  ========================= */
  function calc() {
    if (!state.vehicle) return;

    const key = VEHICLE_MAP[state.vehicle];
    if (!key) return;

    const base  = toNumberSafe(BASE_PRICE[key], 0);
    const perKm = toNumberSafe(PER_KM_PRICE[key], 0);
    const dist  = Math.max(0, toNumberSafe(state.distance, 0));

    // =========================
    // ✅ 옵션 A 레버(여기만 조절)
    // =========================
    const DISPLAY_MULTIPLIER = 0.95;      // 표시가 배율
    const HALF_PREMIUM_MULTIPLIER = 1.18; // 반포장 프리미엄

    // =========================
    // ✅ 정책 레버 (이번 반영분)
    // =========================

    // ✅ 박스(짐양) 구간별 퍼센트 가중치 (16~20은 1.95 확정)
    const LOAD_BAND_MULT = { 1: 1.00, 2: 1.25, 3: 1.55, 4: 1.95 };

    // ✅ 계단 구간 단가 (층수 올라갈수록 단가 상승)
    // - 이동층수 = (층수 - 1)
    // - 1개 층(1→2) : 7,000
    // - 다음 2개 층(2→3, 3→4): 9,000
    // - 이후: 12,000
    const STAIR_TIER_1 = 7000;
    const STAIR_TIER_2 = 9000;
    const STAIR_TIER_3 = 12000;

    // ✅ 품목(가전/가구) 인상/가중치/복리
    const ITEM_PRICE_MULTIPLIER = 1.28;      // 전체 단가 28% 인상
    const ITEM_COUNT_GROWTH_RATE = 0.02;     // 품목 개수(총합) 늘 때마다 복리 2%
    const FRAGILE_RISK_MULTIPLIER = 1.45;    // TV/모니터 등
    const APPLIANCE_RISK_MULTIPLIER = 1.25;  // 냉장고/세탁기/건조기 등

    // =========================
    // ✅ 1) Core: 차량 + 거리
    // =========================
    let core = base + (dist * perKm);

    // =========================
    // ✅ 2) Work: (짐양 + 품목 + 계단)
    // =========================

    // ✅ 계단 비용(한쪽)
    function calcStairCostOneSide(floor) {
      const f = Math.max(1, toNumberSafe(floor, 1));
      const flights = Math.max(0, f - 1); // ✅ 이동층수(1층은 0)

      const tier1 = Math.min(flights, 1);                      // 첫 1개 층
      const tier2 = Math.min(Math.max(flights - 1, 0), 2);     // 다음 2개 층
      const tier3 = Math.max(flights - 3, 0);                  // 이후

      return (tier1 * STAIR_TIER_1) + (tier2 * STAIR_TIER_2) + (tier3 * STAIR_TIER_3);
    }

    const stairCost =
      (state.noFrom ? calcStairCostOneSide(state.fromFloor) : 0) +
      (state.noTo   ? calcStairCostOneSide(state.toFloor)   : 0);

    // ✅ 품목 비용: 기존 + throw 합산
    const mergedThrow    = sumQtyMaps(state.throwFromQty, state.throwToQty);
    const mergedAllItems = sumQtyMaps(state.itemQty, mergedThrow);

    // ✅ 품목 총 개수
    const totalItemCount = Object.values(mergedAllItems).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0);

    // ✅ 위험 가중치
    function getRiskMultiplier(itemKey) {
      if (itemKey === 'TV/모니터') return FRAGILE_RISK_MULTIPLIER;

      if (
        itemKey === '냉장고(380L이하)' ||
        itemKey === '세탁기(12kg이하)' ||
        itemKey === '건조기(12kg이하)'
      ) {
        return APPLIANCE_RISK_MULTIPLIER;
      }
      return 1;
    }

    // ✅ 1) 단가 인상 + 2) 위험가중치
    const rawItemCost = Object.entries(mergedAllItems).reduce((sum, [k, qty]) => {
      const q = Math.max(0, Number(qty) || 0);
      const basePrice = (FURNITURE_PRICE[k]?.price || 0) * ITEM_PRICE_MULTIPLIER;
      const risk = getRiskMultiplier(k);
      return sum + Math.round(basePrice * risk) * q;
    }, 0);

    // ✅ 3) 품목 개수 늘수록 복리 가산
    const itemCost = totalItemCount > 0
      ? Math.round(rawItemCost * Math.pow(1 + ITEM_COUNT_GROWTH_RATE, Math.max(0, totalItemCount - 1)))
      : 0;

    // ✅ 짐양(박스): 구간별 퍼센트 가중치 적용
    const loadMap = getLoadMap(state.moveType);
    const loadBase =
      (state.load && loadMap[state.load]) ? toNumberSafe(loadMap[state.load].price, 0) : 0;

    const band = toNumberSafe(state.load, 0);
    const bandMult = LOAD_BAND_MULT[band] ?? 1.00;

    const loadCost = Math.round(loadBase * bandMult);

    const work = loadCost + itemCost + stairCost;

    // =========================
    // ✅ 3) 추가 옵션 (배율 적용 X, 그대로 더함)
    // =========================
    let optionCost = 0;
    if (state.ladder) optionCost += 80000;
    optionCost += toNumberSafe(state.ride, 0) * 20000;

    if (state.cantCarryFrom) optionCost += 30000;
    if (state.cantCarryTo)   optionCost += 30000;

    if (state.helperFrom) optionCost += 40000;
    if (state.helperTo)   optionCost += 40000;

    // ✅ 야간/주말(night)은 0원 유지 → 반영 안 함

    // =========================
    // ✅ 4) 일반/반포장 최종
    // =========================
    let total = core + work + optionCost;

    // 반포장 프리미엄
    if (state.moveType === 'half') {
      total = Math.round(total * HALF_PREMIUM_MULTIPLIER);
    }

    // 표시가 배율
    total = Math.round(total * DISPLAY_MULTIPLIER);

    // 운영용 전체 배율
    total = Math.round(total * PRICE_MULTIPLIER);

    lastPrice = total;

    // -----------------------------
    // 요약(기존 UI 유지)
    // -----------------------------
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
    const formatted = `₩${total.toLocaleString()}`;
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
     ✅ 채널톡 문의 버튼
  ========================= */
  if (channelInquiryBtn) {
    channelInquiryBtn.addEventListener('click', async (e) => {
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

      // ChannelIO 준비 체크
      if (!window.ChannelIO) {
        alert('채널톡 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 혹시 boot가 안 된 상태면 한 번 더 시도
      bootChannelIO();

      const msg = buildInquiryMessage(lastPrice);

      // ✅ 채널톡 열기 + 메시지 입력
      try {
        window.ChannelIO('openChat', undefined, msg);
      } catch (err) {
        console.error('ChannelIO openChat error:', err);
        try { window.ChannelIO('showMessenger'); } catch (_) {}
      }
    });
  }
})();
