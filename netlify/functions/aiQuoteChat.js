function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function buildSystemPrompt({ serviceType, snapshot }) {
  const today = new Date().toISOString().slice(0, 10);
  const availableItems = Array.isArray(snapshot?.available_items) ? snapshot.available_items : [];
  const availableYongdalItems = Array.isArray(snapshot?.available_yongdal_items) ? snapshot.available_yongdal_items : [];

  return `
너는 당고 견적 계산기 AI 상담원이다.
목표는 사용자의 자연어를 읽고 현재 서비스 견적 폼에 넣을 값을 구조화해서 채우는 것이다.
반드시 한국어로 짧고 자연스럽게 답한다.

오늘 날짜 기준: ${today}
현재 서비스 타입: ${serviceType}

중요 규칙:
1. 절대 금액을 임의로 계산하지 마라. 기존 계산기가 계산한다.
2. 사용자가 말한 정보만 updates에 넣어라.
3. 불명확하면 추정하지 말고 reply에서 다시 물어라.
4. 누락된 값이 있으면 reply에서 이어서 질문하라.
5. 예/아니오로 답하기 쉬운 항목은 짧게 물어라.
6. 날짜 표현(내일, 모레, 이번주 토요일 등)은 가능한 경우 YYYY-MM-DD 로 변환해라.
7. time_slot은 24시간 숫자 문자열(예: "14")로 넣어라.
8. boolean은 true/false로 넣어라.
9. 수량은 정수만 넣어라.
10. items는 반드시 허용된 항목명만 사용해라.

서비스별 updates 스키마:
- small_move:
  vehicle, move_type, start_address, end_address, has_waypoint, waypoint_address, move_date, time_slot,
  load_level, no_from, from_floor, no_to, to_floor, helper_from, helper_to,
  cant_carry_from, cant_carry_to, ladder_from_enabled, ladder_from_floor, ladder_to_enabled, ladder_to_floor,
  ride, items, mattress_sizes, items_note
- cleaning:
  clean_type, clean_soil, clean_pyeong, clean_rooms, clean_baths, clean_balconies, clean_wardrobes,
  clean_address, move_date, time_slot, clean_parking_hard, clean_no_elevator, clean_floor,
  clean_outer_window_enabled, clean_outer_window_pyeong, clean_phytoncide_enabled, clean_disinfect_enabled, clean_note
- yongdal:
  start_address, end_address, move_date, time_slot, helper_from, helper_to, ride_along, items

small_move 허용 품목:
${availableItems.join(', ')}

yongdal 허용 품목:
${availableYongdalItems.join(', ')}

현재 폼 상태:
${JSON.stringify(snapshot || {}, null, 2)}

반드시 아래 JSON만 반환:
{
  "reply": "사용자에게 보여줄 한국어 답변",
  "updates": {},
  "missing_fields": ["..."],
  "suggested_replies": ["...", "...", "..."]
}
`;
}

async function callOpenAI({ apiKey, model, messages, serviceType, snapshot }) {
  const payload = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt({ serviceType, snapshot }) },
      ...messages.slice(-12).map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: String(message.content || ''),
      })),
    ],
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI request failed');
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    if (!apiKey) return json(500, { ok: false, error: 'Missing OPENAI_API_KEY' });

    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const serviceType = String(body.serviceType || 'small_move');
    const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {};

    if (!messages.length) {
      return json(400, { ok: false, error: 'messages required' });
    }

    const result = await callOpenAI({ apiKey, model, messages, serviceType, snapshot });
    return json(200, { ok: true, ...result });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
}
