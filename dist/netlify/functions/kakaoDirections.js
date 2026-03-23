export async function handler(event) {
  try {
    const { origin, destination } = event.queryStringParameters || {};
    if (!origin || !destination) {
      return { statusCode: 400, body: JSON.stringify({ error: 'origin/destination required' }) };
    }

    const K = process.env.KAKAO_MOBILITY_REST_KEY; // ✅ Netlify 환경변수
    if (!K) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing KAKAO_MOBILITY_REST_KEY' }) };
    }

    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${K}` },
    });

    const body = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}
