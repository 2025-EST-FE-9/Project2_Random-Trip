/***********************
 * place-utils.js
 * 유틸리티 함수 모음
 ***********************/

// 상수
export const fallbackImg = "https://placehold.co/400x260?text=No+Image";
export const BUSAN = { lat: 35.1795543, lng: 129.0756416 };

// 한글 태그 필터링
export function isKoreanTag(tag) {
  const v = tag.replace(/^#/, "");
  if (/^[A-Za-z0-9_]+$/.test(v)) return false;
  if (/^A\d{7,}$/.test(v)) return false;
  return true;
}

// 거리 계산 (Haversine)
export function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

// 카카오맵 열기
export function openMap(lat, lng, title) {
  window.open(`https://map.kakao.com/link/map/${title},${lat},${lng}`);
}

// XSS 방지
export function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 주소 추출
export function getAddressFromPlace(p) {
  const raw = p?.raw || {};
  return (
    raw.addr1 ||
    raw.road_address_name ||
    raw.address_name ||
    raw.address ||
    raw.roadAddress ||
    raw.road_address ||
    raw.location ||
    ""
  );
}

// 태그 생성 (소스별 분기)
export function buildTags(place, tab) {
  if (place.source === "KTO") return buildKtoTags(place, tab);
  if (place.source === "KAKAO") return buildKakaoTags(place);
  if (place.source === "RTDB") return buildRtdbTags(place, tab);
  if (place.source === "FAV") return ["#즐겨찾기"];
  return [];
}

function buildKtoTags(place, tab) {
  const tags = [];
  
  if (tab?.key === "photo") tags.push("#인생샷");
  
  const ct = Number(tab?.contentTypeId ?? place.raw?.contenttypeid);
  const typeMap = {
    12: "#관광지",
    14: "#문화",
    28: "#액티비티",
  };
  if (typeMap[ct]) tags.push(typeMap[ct]);
  
  return tags;
}

function buildRtdbTags(place, tab) {
  const tags = [];
  const raw = place.raw || {};
  
  if (tab?.key === "food") tags.push("#맛집");
  if (tab?.key === "cafe") tags.push("#카페");
  if (tab?.key === "activity") tags.push("#액티비티");
  if (tab?.key === "photo") tags.push("#인생샷");
  
  const extra = raw.tags || raw.keywords || raw.tag || raw.keyword || [];
  
  if (Array.isArray(extra)) {
    extra.forEach(t => {
      const v = String(t || "").trim();
      if (!v) return;
      tags.push(v.startsWith("#") ? v : `#${v}`);
    });
  } else if (typeof extra === "string") {
    extra
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(v => tags.push(v.startsWith("#") ? v : `#${v}`));
  }
  
  return [...new Set(tags)];
}

function buildKakaoTags(place) {
  const tags = ["#카카오"];
  const cn = place.raw?.category_name;
  if (cn) {
    const last = cn.split(">").map(s => s.trim()).filter(Boolean).pop();
    if (last) tags.push(`#${last.replace(/\s+/g, "")}`);
  }
  return tags;
}

// 데이터 정규화 함수들
export function normalizeKto(items) {
  return (items || [])
    .map(i => {
      const lat = Number(i.mapy);
      const lng = Number(i.mapx);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      
      return {
        id: String(i.contentid),
        title: i.title || "",
        lat,
        lng,
        image: i.firstimage || i.firstimage2 || fallbackImg,
        source: "KTO",
        raw: i
      };
    })
    .filter(Boolean);
}

export function normalizeKakao(docs) {
  return (docs || [])
    .map(d => {
      const lat = Number(d.y);
      const lng = Number(d.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      
      return {
        id: String(d.id),
        title: d.place_name || "",
        lat,
        lng,
        image: fallbackImg,
        source: "KAKAO",
        raw: d
      };
    })
    .filter(Boolean);
}

export function normalizeRtdb(tree, tab) {
  if (!tree) return [];
  
  let items = [];
  
  if (tab.rtdbPath === "restaurants" || tab.rtdbPath === "cafes") {
    const family = tree.family || {};
    items = Object.entries(family).map(([id, v]) => ({ id, ...v }));
  } else {
    items = Object.entries(tree).map(([id, v]) => ({ id, ...v }));
  }
  
  return items
    .map(x => {
      const lat = Number(x.lat);
      const lng = Number(x.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      
      return {
        id: String(x.id ?? x.contentid ?? x.contentId ?? ""),
        title: x.title || "",
        lat,
        lng,
        image: x.firstimage || x.firstimage2 || fallbackImg,
        source: "RTDB",
        raw: x
      };
    })
    .filter(Boolean);
}

export function normalizeFav(items) {
  return (items || [])
    .map(x => {
      const lat = Number(x.lat);
      const lng = Number(x.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      
      return {
        id: String(x.id),
        title: x.title || "",
        lat,
        lng,
        image: x.image || fallbackImg,
        source: "FAV",
        raw: x
      };
    })
    .filter(Boolean);
}

// API 호출 함수들
export async function fetchKtoList(tab) {
  const params = new URLSearchParams();
  if (tab.contentTypeId) {
    params.append('contentTypeId', tab.contentTypeId);
  }
  params.append("arrange", tab.arrange || "P");
  params.append("pages", "1");
  params.append("numOfRows", "15");
  
  const url = `/api/busan?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.response?.body?.items?.item ?? [];
}

export async function fetchKakaoList(tab) {
  const category = encodeURIComponent(tab.categoryGroupCode);
  const query = encodeURIComponent(tab.query || "부산");
  
  const res = await fetch(`/api/kakao/search?category=${category}&query=${query}`);
  const data = await res.json();
  return data?.documents ?? [];
}

export async function fetchRtdbList(tab, RTDB_BASE) {
  const path = tab.rtdbPath;
  const res = await fetch(`${RTDB_BASE}/${path}.json`);
  if (!res.ok) throw new Error(`RTDB fetch failed: ${res.status}`);
  return await res.json();
}

// Kakao SDK 대기
export function waitForKakaoSDK(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tick() {
      if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === "function") {
        return resolve();
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Kakao SDK not loaded (timeout)"));
      }
      setTimeout(tick, 50);
    })();
  });
}
