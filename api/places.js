// Vercel 서버 함수: 공공데이터포털(odcloud) 제주역사문화 API 두 개를 호출해서 합쳐 돌려준다.
// API 키는 환경변수(JEJU_INFO_API_KEY, JEJU_LOCATION_API_KEY)에만 있고 브라우저로는 나가지 않는다.
const BASE = "https://api.odcloud.kr/api";
const INFO_PATH = "/15109587/v1/uddi:56c2b3a4-4b4b-46cd-a1fa-f928ef731ffb";
const LOC_PATH = "/15109570/v1/uddi:8781448b-81a8-487c-bc95-d26335bafa82";

const enc = k => (k.includes("%") ? k : encodeURIComponent(k)); // Encoding 키/Decoding 키 둘 다 허용

async function fetchAll(path, key) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${BASE}${path}?page=${page}&perPage=200&returnType=JSON&serviceKey=${enc(key)}`);
    if (!res.ok) throw new Error(`API 응답 오류 ${res.status} (${path.split("/")[1]})`);
    const json = await res.json();
    rows.push(...json.data);
    if (rows.length >= json.totalCount || json.data.length === 0) break;
  }
  return rows;
}

const nv = s => { s = String(s ?? "").trim(); return s === "해당없음" ? "" : s; };

module.exports = async (req, res) => {
  const infoKey = process.env.JEJU_INFO_API_KEY, locKey = process.env.JEJU_LOCATION_API_KEY;
  if (!infoKey || !locKey) return res.status(500).json({ error: "환경변수(JEJU_INFO_API_KEY, JEJU_LOCATION_API_KEY)가 설정되지 않았습니다." });
  try {
    const [info, loc] = await Promise.all([fetchAll(INFO_PATH, infoKey), fetchAll(LOC_PATH, locKey)]);
    const locById = new Map(loc.map(r => [r["데이터 고유번호"], r]));
    const data = info.map(r => {
      const p = locById.get(r["데이터 고유번호"]) || {};
      return {
        id: r["데이터 고유번호"], name: nv(r["장소명"]), lat: parseFloat(r["위도"]), lng: parseFloat(r["경도"]),
        cat: nv(r["분류"]), d1: nv(r["디렉토리1"]), d2: nv(r["디렉토리2"]), title: nv(r["제목"]), sub: nv(r["부제목"]),
        author: nv(r["저작자"]), tags: nv(r["주제"]).split(".").map(t => t.trim()).filter(Boolean),
        content: nv(r["내용"]), abstract: nv(r["초록"]), date: nv(r["발행일"]), type: nv(r["자료유형"]),
        addr: nv(p["위치"]), zip: nv(p["우편번호"]), url: nv(r["링크"]),
      };
    });
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
