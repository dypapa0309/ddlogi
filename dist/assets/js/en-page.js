(() => {
  const originalAlert = window.alert?.bind(window);
  const replacements = [
    ["소형이사 계산기", "Small Move Calculator"],
    ["입주청소 계산기", "Cleaning Calculator"],
    ["홈화면", "Home"],
    ["English Page", "English Page"],
    ["서비스 선택", "Service"],
    ["이사·용달", "Small Move"],
    ["원룸·소형 집 청소 서비스", "Studio / small-home cleaning service"],
    ["1톤 카고/저상탑, 용달·소형이사", "1-ton cargo / box truck, small move service"],
    ["먼저 서비스를 선택해주세요.", "Please choose a service first."],
    ["차량 선택", "Vehicle"],
    ["이동 거리", "Distance"],
    ["예약 정보", "Schedule"],
    ["옮겨주세요!", "Move Details"],
    ["청소 기본 정보", "Cleaning Basics"],
    ["청소 장소", "Cleaning Address"],
    ["엘리베이터", "Elevator"],
    ["가구·가전", "Furniture & Appliances"],
    ["직접 나르기 어려움", "Hard to Carry"],
    ["인부 추가", "Add Helper"],
    ["사다리차", "Ladder Truck"],
    ["추가 옵션", "Extra Options"],
    ["버려주세요!", "Throw Away"],
    ["예상 견적", "Estimated Quote"],
    ["사업자정보", "Business Info"],
    ["기숙사·사택 시즌 이벤트", "Dormitory / Company Housing Season Event"],
    ["이사업체 피해사례 보기", "View Real Moving Scam Cases"],
    ["가구·가전 선택하기", "Choose Furniture & Appliances"],
    ["버릴 물건 선택하기", "Choose Throw-Away Items"],
    ["특수 청소 선택", "Special Cleaning Options"],
    ["가전·가구 클리닝 선택", "Appliance / Furniture Cleaning"],
    ["견적 전송 안내", "Quote Send Guide"],
    ["견적 전송하기", "Send Quote"],
    ["경유지 상세 설정", "Stopover Details"],
    ["실제 고객 리뷰 사진", "Real Customer Review Photos"],
    ["이미지 확대 보기", "Image Preview"],
    ["선택 완료", "Done"],
    ["닫기", "Close"],
    ["이전", "Previous"],
    ["다음", "Next"],
    ["없음", "None"],
    ["선택 없음", "None"],
    ["불필요", "Not needed"],
    ["필요", "Required"],
    ["출발지", "Pickup"],
    ["도착지", "Drop-off"],
    ["경유지", "Stopover"],
    ["주소를 입력해주세요", "Please enter the address"],
    ["거리 계산하기", "Calculate Distance"],
    ["계산된 거리:", "Calculated distance:"],
    ["출발지 주소", "Pickup address"],
    ["도착지 주소", "Drop-off address"],
    ["경유지 주소", "Stopover address"],
    ["경유지 있을시 체크해주세요", "Check if you have a stopover"],
    ["출발 → 경유 → 도착 거리 합산 계산", "Start -> stopover -> destination total distance"],
    ["경유지 상세 설정하기", "Open stopover settings"],
    ["경유지 짐양:", "Stopover load:"],
    ["경유지 가구·가전:", "Stopover items:"],
    ["경유지 짐 기타사항:", "Stopover note:"],
    ["경유지 버려주세요:", "Stopover throw-away:"],
    ["경유지 버려주세요 기타사항:", "Stopover throw-away note:"],
    ["경유지 계단:", "Stopover stairs:"],
    ["경유지 사다리차:", "Stopover ladder truck:"],
    ["이사 날짜", "Moving date"],
    ["이사 희망 시간", "Preferred time"],
    ["배차 상황에 따라 확정 시간은 상담 후 안내됩니다.", "Final time is confirmed after consultation depending on driver availability."],
    ["이사 방식", "Move type"],
    ["일반이사", "Basic move"],
    ["반포장 이사", "Semi-packed move"],
    ["보관이사", "Storage move"],
    ["보관이사 타입", "Storage move type"],
    ["보관-일반이사", "Storage + basic"],
    ["보관-반포장이사", "Storage + semi-packed"],
    ["보관 일수", "Storage days"],
    ["보관료는 일수에 따라 차등 적용 됩니다. (1일 20,000원이며 이후 일수는 점차 감소)", "Storage pricing changes by duration. Day 1 starts at KRW 20,000 and later days are discounted."],
    ["청소 추가 옵션", "Cleaning options"],
    ["주차 어려움", "Hard parking"],
    ["엘리베이터 없음", "No elevator"],
    ["외창 청소", "Exterior window cleaning"],
    ["외창 면적(평)", "Exterior window area (pyeong)"],
    ["피톤치드/탈취", "Phytoncide / deodorizing"],
    ["살균/소독", "Disinfection / sterilization"],
    ["폐기/정리(봉투)", "Trash bags"],
    ["필요 수량", "Required quantity"],
    ["기타사항", "Notes"],
    ["출발지에서 어려움", "Hard at pickup"],
    ["도착지에서 어려움", "Hard at drop-off"],
    ["출발지 인부 추가", "Add helper at pickup"],
    ["도착지 인부 추가", "Add helper at drop-off"],
    ["사다리차 필요 여부", "Need ladder truck?"],
    ["출발지에서 필요", "Needed at pickup"],
    ["도착지에서 필요", "Needed at drop-off"],
    ["출발지 층수", "Pickup floor"],
    ["도착지 층수", "Drop-off floor"],
    ["야간/주말 (무료)", "Night / weekend (free)"],
    ["동승 인원 있을 시 체크해주세요", "Add ride-along passengers if any"],
    ["청소 서비스 추가", "Add cleaning service"],
    ["현재 이사 견적에서는 비활성화되어 있습니다.", "Currently disabled in this moving quote."],
    ["이사하며 1층에 버리실 물건!", "Items to leave on the first floor during the move"],
    ["출발/도착지 작업 여부", "Pickup / drop-off work"],
    ["출발지 작업 있음", "Work needed at pickup"],
    ["도착지 작업 있음", "Work needed at drop-off"],
    ["조건을 선택하세요", "Select conditions to see your estimate"],
    ["현재 예상 금액", "Current estimated amount"],
    ["예상 견적은", "This estimate is"],
    ["7개 업체 평균 가격보다", "than the average of 7 providers"],
    ["약 13.8% 저렴합니다", "about 13.8% lower"],
    ["7개 업체 평균가격보다", "than the average of 7 providers"],
    ["7개 업체 평균 가격 비교", "Average price comparison across 7 providers"],
    ["7개 업체 평균", "Average of 7 providers"],
    ["동일 조건 기준 7개 업체 평균 가격과 비교한 값입니다.", "Compared with the average price of 7 providers under the same conditions."],
    ["견적이 마음에 든다면 버튼을 눌러서 견적을 보내주세요!", "If you like the quote, send it now."],
    ["전화 문의하기", "Call now"],
    ["문자 접수 가능", "Text inquiry available"],
    ["24시간 동일 견적", "Same quote for 24 hours"],
    ["이 조건으로 접수할까요?", "Would you like to submit this request?"],
    ["버튼을 누르면 견적서가 정리되어 바로 문자 접수됩니다.", "Tap to prepare the quote and open a text inquiry right away."],
    ["예약 가능 여부와 다음 절차를 바로 안내받을 수 있습니다.", "You can immediately receive availability and next-step guidance."],
    ["친구에게 공유하기", "Share this page"],
    ["청소도 필요하시다면 클릭해주세요", "Need cleaning too?"],
    ["이사도 필요하시다면 클릭해주세요", "Need a small move too?"],
    ["이사업체 피해사례", "Real moving scam cases"],
    ["현장 추가금, 저가 미끼 견적, 일정 지연 같은 실제 피해 유형을 미리 확인해보세요.", "Review common real-world issues such as hidden on-site surcharges, bait pricing, and schedule delays."],
    ["현장에서 갑자기 추가금을 요구한 사례", "Case: surprise surcharge at the site"],
    ["너무 싼 업체를 골랐다가 작업 품질이 무너진 사례", "Case: choosing the cheapest option led to poor quality"],
    ["예약 때와 다른 조건으로 진행된 사례", "Case: service was different from the original booking"],
    ["실제 고객 리뷰 사진", "Real customer review photos"],
    ["문자 상담과 실제 작업 후 고객이 남겨준 리뷰 캡처입니다. 사진을 누르면 더 크게 볼 수 있어요.", "These are real review screenshots sent after actual jobs. Tap a photo to enlarge it."],
    ["기숙사·사택 이사 시즌", "Dormitory / company housing season"],
    ["AI로 계산된 이사비용,", "AI-assisted pricing,"],
    ["숨겨진 추가비 없이", "with no hidden add-ons,"],
    ["고객이 직접 확인하는 투명 견적.", "and a transparent quote checked directly by the customer."],
    ["10초 견적 확인하기", "Check quote in 10 seconds"],
    ["오늘은 그만 보기", "Hide for today"],
    ["가전", "Appliances"],
    ["가구", "Furniture"],
    ["전자레인지", "Microwave"],
    ["공기청정기", "Air purifier"],
    ["청소기", "Vacuum"],
    ["TV (55인치 이하)", "TV (up to 55 inch)"],
    ["TV (65인치 이상)", "TV (65 inch or larger)"],
    ["모니터", "Monitor"],
    ["데스크탑 본체", "Desktop tower"],
    ["프린터/복합기", "Printer / copier"],
    ["정수기(이동만)", "Water purifier (move only)"],
    ["세탁기 (12kg 이하)", "Washer (up to 12kg)"],
    ["세탁기 (12kg 초과)", "Washer (over 12kg)"],
    ["건조기 (12kg 이하)", "Dryer (up to 12kg)"],
    ["건조기 (12kg 초과)", "Dryer (over 12kg)"],
    ["냉장고 (380L 이하)", "Refrigerator (up to 380L)"],
    ["냉장고 (381~600L)", "Refrigerator (381-600L)"],
    ["냉장고 (601L 이상)", "Refrigerator (601L or larger)"],
    ["김치냉장고", "Kimchi refrigerator"],
    ["스타일러", "Styler"],
    ["의자", "Chair"],
    ["행거", "Clothing rack"],
    ["협탁/사이드테이블(소형)", "Small side table"],
    ["화장대(소형)", "Small vanity"],
    ["책상/테이블(일반)", "Desk / table"],
    ["서랍장(3~5단)", "Chest (3-5 drawers)"],
    ["책장(일반)", "Bookshelf"],
    ["수납장/TV장(일반)", "Cabinet / TV stand"],
    ["소파 (2~3인)", "Sofa (2-3 seats)"],
    ["소파 (4인 이상)", "Sofa (4+ seats)"],
    ["침대 매트리스 (킹 제외)", "Mattress (excluding king)"],
    ["침대 프레임 분해조립", "Bed frame assembly / disassembly"],
    ["기타사항 (가구·가전 관련)", "Notes (furniture / appliances)"],
    ["기타사항 (버리기 관련)", "Notes (throw-away items)"],
    ["매트리스 사이즈 선택", "Choose mattress size"],
    ["사이즈별 수량", "Quantity by size"],
    ["싱글 (S) — 100×200cm", "Single (S) - 100x200cm"],
    ["슈퍼싱글 (SS) — 110×200cm", "Super single (SS) - 110x200cm"],
    ["더블 (D) — 140×200cm", "Double (D) - 140x200cm"],
    ["퀸 (Q) — 150~160×200cm", "Queen (Q) - 150-160x200cm"],
    ["킹 (K) — 165~180×200cm", "King (K) - 165-180x200cm"],
    ["사이즈별 수량 합계만 맞으면 여러 개 선택할 수 있습니다.", "You can select multiple sizes as long as the total quantity matches."],
    ["가구·가전 선택", "Furniture & appliance selection"],
    ["버릴 물건 선택", "Throw-away item selection"],
    ["특수 청소 옵션", "Special cleaning options"],
    ["가전·가구 클리닝", "Appliance / furniture cleaning"],
    ["옵션 선택", "Choose options"],
    ["클리닝 항목", "Cleaning items"],
    ["기사님", "driver"],
    ["기사", "driver"],
    ["인부", "helper"],
    ["엘리베이터 있음", "Elevator available"],
    ["엘베있음", "Elevator available"],
    ["엘베없음", "No elevator"],
    ["명이 견적 확인 중", "visitors are checking quotes"],
    ["지금", "Now"],
    ["최근 30분 조회", "Views in last 30m"],
    ["업데이트", "Updated"],
    ["확인", "OK"],
  ];

  const patternReplacements = [
    [/(\d+)\s*층/g, "$1F"],
    [/(\d+)\s*평/g, "$1 pyeong"],
    [/(\d+)\s*세트/g, "$1 set(s)"],
    [/(\d+)\s*일/g, "$1 day(s)"],
    [/7시/g, "7 AM"],
    [/8시/g, "8 AM"],
    [/9시/g, "9 AM"],
    [/10시/g, "10 AM"],
    [/11시/g, "11 AM"],
    [/12시/g, "12 PM"],
    [/13시/g, "1 PM"],
    [/14시/g, "2 PM"],
    [/15시/g, "3 PM"],
  ];

  function translateText(value) {
    let out = String(value || "");
    replacements.forEach(([from, to]) => {
      out = out.split(from).join(to);
    });
    patternReplacements.forEach(([pattern, replacement]) => {
      out = out.replace(pattern, replacement);
    });
    return out;
  }

  function translateNodeTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach((textNode) => {
      const parent = textNode.parentElement;
      if (!parent) return;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) return;
      const original = textNode.nodeValue;
      const translated = translateText(original);
      if (translated !== original) textNode.nodeValue = translated;
    });
  }

  function translateAttributes() {
    const placeholderMap = new Map([
      ["#startAddress", "Enter pickup address"],
      ["#endAddress", "Enter drop-off address"],
      ["#waypointAddress", "Enter stopover address"],
      ["#itemsNote", "Example: Wall-mounted TV disassembly / refrigerator door removal / elevator reservation / parking note"],
      ["#throwNote", "Example: First-floor disposal area / elevator restriction time / call before arrival"],
      ["#moveCleanAddress", "Enter cleaning address"],
      ["#moveCleanAddressNote", "Extra note about the address"],
      ["#moveCleanNote", "Extra cleaning notes"],
    ]);

    placeholderMap.forEach((value, selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if ("placeholder" in el) el.placeholder = value;
      });
    });

    document.querySelectorAll("[aria-label],[title],[alt],[placeholder]").forEach((el) => {
      ["aria-label", "title", "alt", "placeholder"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const translated = translateText(value);
        if (translated !== value) el.setAttribute(attr, translated);
      });
    });
  }

  function applyTranslation(root = document.body) {
    translateNodeTree(root);
    translateAttributes();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (originalAlert) {
      window.alert = (message) => originalAlert(translateText(message));
    }

    applyTranslation();
    document.documentElement.classList.remove("en-pending");

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) applyTranslation(node);
        });
        if (mutation.type === "characterData" && mutation.target?.parentElement) {
          applyTranslation(mutation.target.parentElement);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
})();
