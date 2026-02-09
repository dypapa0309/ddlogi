// /config.js
// ✅ 배포/로컬 공통 설정
// ⚠️ 로컬 테스트(5500): 카카오 개발자센터 Web 플랫폼에
//    http://127.0.0.1:5500, http://localhost:5500 등록 필요

window.DDLOGI_CONFIG = {
  supabaseUrl: "https://hsgoaqhqwesfhxehyokb.supabase.co",
  supabaseKey: "sb_publishable_DbJF69dpT9Qly2w5LHKqhQ_xS9NAAfZ",

  timeSlots: [
    { value: "before9", labelKR: "9시 이전" },
    { value: "9to12",   labelKR: "9~12시" },
    { value: "12to15",  labelKR: "12~3시" }
  ]
};
