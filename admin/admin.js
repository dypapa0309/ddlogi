// /admin/admin.js
/* ==================================================
   디디운송 Admin - 확정 슬롯 관리
   - 로그인 필수 + 이메일 화이트리스트
   - 확정 등록/취소 + 오늘/내일 목록
================================================== */

(() => {
  const CFG = window.DDLOGI_CONFIG || {};
  const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

  if (!supabase) {
    console.error('Supabase 초기화 실패: config.js 확인');
    return;
  }

  const el = id => document.getElementById(id);

  const loginSection  = el('loginSection');
  const adminSection  = el('adminSection');

  const adminEmail    = el('adminEmail');
  const adminPassword = el('adminPassword');
  const loginBtn      = el('loginBtn');
  const loginMsg      = el('loginMsg');

  const adminDate     = el('adminDate');
  const adminMemo     = el('adminMemo');
  const confirmBtn    = el('confirmBtn');
  const logoutBtn     = el('logoutBtn');

  const tabToday      = el('tabToday');
  const tabTomorrow   = el('tabTomorrow');
  const listTitle     = el('listTitle');
  const slotList      = el('slotList');

  const btn_before9   = el('btn_before9');
  const btn_9to12     = el('btn_9to12');
  const btn_12to15    = el('btn_12to15');

  const selectedSlotInfo = el('selectedSlotInfo');

  let selectedSlot = null;
  let activeListMode = 'today';

  // ✅ 관리자 이메일 화이트리스트
  const ADMIN_EMAILS = [
    'dypapa0309@gmail.com'
  ];

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function addDaysStr(baseStr, days) {
    const d = new Date(baseStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function slotLabelKR(val) {
    const found = (CFG.timeSlots || []).find(item => item.value === val);
    return found ? found.labelKR : val;
  }

  async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('getSession error:', error);
      return null;
    }
    return data?.session || null;
  }

  function isAdminEmail(email) {
    return !!(email && ADMIN_EMAILS.includes(email));
  }

  function showUnauthorized(msg) {
    document.body.innerHTML = `
      <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0b1220; color:#fff; padding:24px;">
        <div style="max-width:520px; width:100%; background:#0f172a; border-radius:18px; padding:22px; box-shadow:0 10px 30px rgba(0,0,0,0.35);">
          <div style="font-weight:900; font-size:18px; margin-bottom:10px;">접근 권한이 없습니다.</div>
          <div style="opacity:0.85; line-height:1.6;">${msg || '관리자 전용 페이지입니다.'}</div>
        </div>
      </div>
    `;
  }

  function setToggleState(slot, state) {
    const btnMap = { before9: btn_before9, '9to12': btn_9to12, '12to15': btn_12to15 };
    const btn = btnMap[slot];
    if (!btn) return;

    if (state === 'disabled') {
      btn.disabled = true;
      btn.textContent = '확정됨';
      btn.className = 'cta sub';
      btn.style.opacity = '0.6';
    } else if (state === 'selected') {
      btn.disabled = false;
      btn.textContent = '선택됨';
      btn.className = 'cta primary';
      btn.style.opacity = '1';
    } else {
      btn.disabled = false;
      btn.textContent = '선택';
      btn.className = 'cta sub';
      btn.style.opacity = '1';
    }
  }

  function resetAllTogglesNormal() {
    setToggleState('before9', 'normal');
    setToggleState('9to12', 'normal');
    setToggleState('12to15', 'normal');
  }

  async function refreshForDate(dateStr) {
    selectedSlot = null;
    resetAllTogglesNormal();
    if (selectedSlotInfo) selectedSlotInfo.textContent = '';

    const { data, error } = await supabase
      .from('confirmed_slots')
      .select('time_slot')
      .eq('date', dateStr)
      .eq('status', 'confirmed');

    if (error) {
      console.error('refreshForDate error:', error);
      return;
    }

    const confirmed = new Set((data || []).map(x => x.time_slot));
    ['before9', '9to12', '12to15'].forEach(slot => {
      if (confirmed.has(slot)) setToggleState(slot, 'disabled');
    });
  }

  function pickSlot(slot) {
    const btnMap = { before9: btn_before9, '9to12': btn_9to12, '12to15': btn_12to15 };
    const btn = btnMap[slot];
    if (btn && btn.disabled) return;

    selectedSlot = slot;

    ['before9', '9to12', '12to15'].forEach(s => {
      if (btnMap[s]?.disabled) return;
      setToggleState(s, s === slot ? 'selected' : 'normal');
    });

    if (selectedSlotInfo) {
      selectedSlotInfo.textContent = `선택된 시간대: ${slotLabelKR(slot)}`;
    }
  }

  async function refreshList() {
    const base = todayStr();
    const targetDate = activeListMode === 'today' ? base : addDaysStr(base, 1);

    listTitle.textContent = `${activeListMode === 'today' ? '오늘' : '내일'} 확정 목록 (${targetDate})`;
    slotList.textContent = '불러오는 중...';

    const { data, error } = await supabase
      .from('confirmed_slots')
      .select('id, time_slot, memo, created_at')
      .eq('date', targetDate)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true });

    if (error) {
      slotList.textContent = '목록 로딩 실패';
      console.error('refreshList error:', error);
      return;
    }

    if (!data || data.length === 0) {
      slotList.textContent = '확정된 슬롯이 없습니다.';
      return;
    }

    slotList.innerHTML = data.map(row => {
      const memo = row.memo || '';
      return `
        <div class="card" style="margin:12px 0; background:#0f172a;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div>
              <div style="font-weight:800; font-size:16px;">${slotLabelKR(row.time_slot)}</div>
              <div class="sub" style="margin-top:6px; white-space:pre-wrap;">${memo}</div>
            </div>
            <button class="cta sub" data-cancel-id="${row.id}" style="padding:12px; border-radius:14px; width:auto;">
              취소
            </button>
          </div>
        </div>
      `;
    }).join('');

    [...slotList.querySelectorAll('[data-cancel-id]')].forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-cancel-id');
        if (!id) return;
        if (!confirm('이 슬롯을 취소(확정 해제)할까요?')) return;

        const { error: upErr } = await supabase
          .from('confirmed_slots')
          .update({ status: 'canceled' })
          .eq('id', id);

        if (upErr) {
          alert('취소 실패');
          console.error('cancel update error:', upErr);
          return;
        }

        await refreshForDate(adminDate.value);
        await refreshList();
      });
    });
  }

  async function ensureSessionUI() {
    const session = await getSession();
    const loggedIn = !!session;

    loginSection.style.display = loggedIn ? 'none' : 'block';
    adminSection.style.display = loggedIn ? 'block' : 'none';

    if (!loggedIn) {
      loginMsg.textContent = '';
      selectedSlot = null;
      if (selectedSlotInfo) selectedSlotInfo.textContent = '';
      return;
    }

    const email = session.user?.email || '';
    if (!isAdminEmail(email)) {
      showUnauthorized('관리자 계정이 아닙니다. 올바른 관리자 계정으로 로그인해주세요.');
      throw new Error('Not admin');
    }

    if (!adminDate.value) adminDate.value = todayStr();

    await refreshForDate(adminDate.value);
    await refreshList();
  }

  /* =========================
     이벤트 바인딩
  ========================= */
  loginBtn.addEventListener('click', async () => {
    loginMsg.textContent = '';
    const email = (adminEmail.value || '').trim();
    const password = (adminPassword.value || '').trim();

    if (!email || !password) {
      loginMsg.textContent = '이메일/비밀번호를 입력해주세요.';
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginMsg.textContent = '로그인 실패. 이메일/비번 확인';
      console.error('signIn error:', error);
      return;
    }
    await ensureSessionUI();
  });

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    await ensureSessionUI();
  });

  adminDate.addEventListener('change', async () => {
    const d = adminDate.value;
    if (!d) return;
    await refreshForDate(d);
  });

  btn_before9.addEventListener('click', () => pickSlot('before9'));
  btn_9to12.addEventListener('click', () => pickSlot('9to12'));
  btn_12to15.addEventListener('click', () => pickSlot('12to15'));

  confirmBtn.addEventListener('click', async () => {
    const d = adminDate.value;
    if (!d) return alert('날짜를 선택해주세요.');
    if (!selectedSlot) return alert('시간대를 선택해주세요.');

    const session = await getSession();
    if (!session) return alert('세션이 만료되었습니다. 다시 로그인해주세요.');

    const email = session.user?.email || '';
    if (!isAdminEmail(email)) return alert('관리자 권한이 없습니다.');

    const memo = (adminMemo.value || '').trim();

    const { error } = await supabase
      .from('confirmed_slots')
      .insert([{ date: d, time_slot: selectedSlot, status: 'confirmed', memo }]);

    if (error) {
      alert('이미 확정된 시간대이거나 등록에 실패했습니다.');
      console.error('insert error:', error);
      return;
    }

    adminMemo.value = '';
    selectedSlot = null;
    if (selectedSlotInfo) selectedSlotInfo.textContent = '';

    await refreshForDate(d);
    await refreshList();
  });

  tabToday.addEventListener('click', async () => {
    activeListMode = 'today';
    tabToday.className = 'cta primary';
    tabTomorrow.className = 'cta sub';
    await refreshList();
  });

  tabTomorrow.addEventListener('click', async () => {
    activeListMode = 'tomorrow';
    tabTomorrow.className = 'cta primary';
    tabToday.className = 'cta sub';
    await refreshList();
  });

  supabase.auth.onAuthStateChange(async () => {
    try { await ensureSessionUI(); } catch (e) { console.error(e); }
  });

  window.addEventListener('DOMContentLoaded', async () => {
    try { await ensureSessionUI(); } catch (e) { console.error(e); }
  });
})();
