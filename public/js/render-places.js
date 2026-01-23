import { addFavorite, removeFavorite, getFavorites, checkIsFavorite, RTDB_BASE } from "./firebase.js";
// ✅ Kakao SDK를 확실히 로드 (없으면 주입)
function loadKakaoSdk({ appkey, libraries = "services", autoload = false } = {}) {
  return new Promise((resolve, reject) => {
    // 이미 로드됨
    if (window.kakao && window.kakao.maps) return resolve();

    // 이미 script 태그가 있으면 대기만
    const existing = document.querySelector('script[data-kakao-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Kakao SDK script load error")));
      return;
    }

    if (!appkey) {
      return reject(new Error("Kakao appkey가 없습니다. render-places.js에 appkey를 넣거나 HTML에 SDK script를 넣어주세요."));
    }

    const s = document.createElement("script");
    s.dataset.kakaoSdk = "true";
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}&libraries=${encodeURIComponent(libraries)}&autoload=${autoload ? "true" : "false"}`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Kakao SDK script load error"));
    document.head.appendChild(s);
  });
}

// ===== 즐겨찾기 상태 캐시(Set) =====
let favIdSet = new Set();
let favLoaded = false;

// 앱 시작 시 1회만 서버에서 즐겨찾기 목록 동기화
async function ensureFavoritesLoaded() {
  if (favLoaded) return;
  try {
    const favs = await getFavorites();
    favIdSet = new Set((favs || []).map(x => String(x.id)));
    favLoaded = true;
  } catch (e) {
    console.warn("즐겨찾기 초기 로드 실패:", e);
    favIdSet = new Set();
    favLoaded = true; // 무한 재시도 방지
  }
}

/***********************
 * 0) 기본 설정/상수
 ***********************/
const API_BASE = "";
const BUSAN = { lat: 35.1795543, lng: 129.0756416 };
const SERVER_URL = "/api/busan";  // 중요: 상대경로
const fallbackImg = "https://placehold.co/400x260?text=No+Image";

// DOM
const tabs = document.getElementById("tabs");
const track = document.getElementById("track");
const badge = document.getElementById("countBadge");
const listTitle = document.getElementById("listTitle");

const list = document.getElementById("list");
const modal = document.getElementById("modal");

// 슬라이더는 컨테이너/트랙 분리
const slider = document.getElementById("slider");
const sliderTrack = document.getElementById("sliderTrack");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const mTitle = document.getElementById("mTitle");
const mAddress = document.getElementById("mAddress");
const mDistance = document.getElementById("mDistance");
const mTags = document.getElementById("mTags");
const modalMapBtn = document.getElementById("modalMapBtn");

let map;
let markers = [];
let activeKey = "tour";

// (선택) 인포윈도우 하나만 재사용
let infoWindow;

const qp = new URLSearchParams(location.search);
const selectedTag = qp.get("tag") || localStorage.getItem("selectedTag");

// result.js의 태그 → result3의 탭 key 매핑
const TAG_TO_TAB = {
  culture: "tour",
  photo: "photo",
  activity: "activity",
  food: "food",
  cafe: "cafe",
  // 장소태그(바다/산/도심)는 “탭”이 아니라 “필터”라서 일단 tour로 보여주고,
  // (필요하면 산/바다/도심 필터도 results.js에 추가 가능)
  mountain: "tour",
  ocean: "tour",
  city: "tour",
};

let selectedTagData = null;
try {
  selectedTagData = JSON.parse(localStorage.getItem("selectedTagData") || "null");
} catch (_) {
  selectedTagData = null;
}
console.log(localStorage.getItem("selectedTagData"));

// ✅ 첫 진입 탭을 넘어온 태그 기준으로 설정
if (selectedTag && TAG_TO_TAB[selectedTag]) {
  activeKey = TAG_TO_TAB[selectedTag];
}
 
const categoriesParam = qp.get("categories") || "";
const SELECTED_CATEGORIES = categoriesParam.split(",").map(s => s.trim()).filter(Boolean);


  const CONTENT = {
    KTO: {
      TOUR: 12,
      ACTIVITY: 28,
      CULTURE: 14
    },
    KAKAO: {
      FOOD: "FD6",
      CAFE: "CE7",
      PARK: "PK6"
    }
  };

  /***********************
   * 1) 탭 설정(단일 진실)
   ***********************/
  let TAB_CONFIG = [
  { key: "tour",     label: "관광지",   source: "KTO",  contentTypeId: CONTENT.KTO.TOUR },
  { key: "food",     label: "맛집",     source: "RTDB", rtdbPath: "restaurants" },
  { key: "cafe",     label: "카페",     source: "RTDB", rtdbPath: "cafes" },
  { key: "activity", label: "액티비티", source: "RTDB", rtdbPath: "activities" },
  { key: "photo",    label: "인생샷",   source: "RTDB", rtdbPath: "photos" },
  { key: "fav",      label: "즐겨찾기", source: "FAV" }
];

  /***********************
   * 2) 지도 초기화
   ***********************/
  function initKakaoMap() {
  if (!window.kakao || !window.kakao.maps) {
    console.error("❌ Kakao SDK not loaded");
    return;
  }

  // ✅ autoload=false 대응: 항상 load로 감싸기
  kakao.maps.load(() => {
    const container = document.getElementById("map");
    if (!container) {
      console.error("❌ map 요소를 찾을 수 없습니다");
      return;
    }

    const options = {
      center: new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng),
      level: 7,
    };

    map = new kakao.maps.Map(container, options);
    infoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

    // 탭 필터링 로직 그대로
    if (SELECTED_CATEGORIES.length > 0) {
      const wanted = new Set([...(window.SELECTED_CATEGORIES || []), "fav"]);
      const filtered = TAB_CONFIG.filter(tab => wanted.has(tab.key));
      if (filtered.length > 0) {
        TAB_CONFIG = filtered;
        if (!TAB_CONFIG.some(t => t.key === activeKey)) activeKey = TAB_CONFIG[0].key;
      }
    }

    renderTabs();
    loadAndRender(activeKey);
  });
}


  /***********************
   * 3) 탭 렌더 + 클릭
   ***********************/
  function renderTabs() {
    tabs.innerHTML = "";

    TAB_CONFIG.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "tab" + (t.key === activeKey ? " active" : "");
      btn.textContent = t.label;

      btn.addEventListener("click", () => {
        activeKey = t.key;
        renderTabs();
        loadAndRender(activeKey);
      });

      tabs.appendChild(btn);
    });
  }

  /***********************
   * 4) 공통 렌더 유틸
   ***********************/
  function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
  }

  function setCount(n) {
    badge.textContent = `${n}개`;
  }

  function setEmpty(msg) {
    track.textContent = msg || "결과가 없습니다.";
    list.innerHTML = "";
    clearMarkers();
    setCount(0);
    // 지도는 부산 중심으로 원복
    map.setCenter(new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng));
    map.setLevel(7);
  }

  function isKoreanTag(tag) {
  // #으로 시작하는 태그 기준
  const v = tag.replace(/^#/, "");

  // ❌ 영문만 있거나 영문+숫자 조합이면 제거
  if (/^[A-Za-z0-9_]+$/.test(v)) return false;

  // ❌ 카테고리 코드 (A01011200 같은 것)
  if (/^A\d{7,}$/.test(v)) return false;

  return true;
}

  // 공통 Place 모델:
  // { id, title, lat, lng, image, source, raw }
  let userLat = null, userLng = null;
  navigator.geolocation.getCurrentPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
  });

  function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
  }

  function openMap(lat, lng, title) {
    window.open(`https://map.kakao.com/link/map/${title},${lat},${lng}`);
  }

  function buildTags(place, tab) {
  if (place.source === "KTO") return buildKtoTags(place, tab);
  if (place.source === "KAKAO") return buildKakaoTags(place);
  if (place.source === "RTDB") return buildRtdbTags(place, tab); // ✅ 추가
  if (place.source === "FAV") return ["#즐겨찾기"];
  return [];
}

function buildKtoTags(place, tab) {
  const tags = [];

  // 인생샷 탭
  if (tab?.key === "photo") tags.push("#인생샷");

  // content type 기반 태그
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

  // 탭 기반 기본 태그
  if (tab?.key === "food") tags.push("#맛집");
  if (tab?.key === "cafe") tags.push("#카페");
  if (tab?.key === "activity") tags.push("#액티비티");
  if (tab?.key === "photo") tags.push("#인생샷");

  // RTDB에 tags/keywords 등이 있으면 추가
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
  const cn = place.raw?.category_name; // "음식점 > 한식 > ..."
  if (cn) {
    const last = cn.split(">").map(s => s.trim()).filter(Boolean).pop();
    if (last) tags.push(`#${last.replace(/\s+/g, "")}`);
  }
  return tags;
}

function getAddressFromPlace(p) {
  const raw = p?.raw || {};
  return (
    raw.addr1 ||                 // KTO
    raw.road_address_name ||     // Kakao
    raw.address_name ||          // Kakao
    raw.address ||               // RTDB
    raw.roadAddress ||           // RTDB
    raw.road_address ||          // RTDB
    raw.location ||              // RTDB
    ""
  );
}

function renderList(places, tab) {
  if (tab.source === "KTO") places = places.slice(0, 15);
  listTitle.textContent = tab.label;
  track.textContent = "";
  list.innerHTML = "";
  setCount(places.length);

  places.forEach(p => {
    const addr = getAddressFromPlace(p);
    const guMatch = addr ? addr.match(/부산광역시\s(\S+)구/) : null;
    const guTag = guMatch ? `#${guMatch[1]}` : "#부산구";
    const nameTag = `#${p.title.replace(/\s/g, "")}`;
    const dynamicTags = buildTags(p, tab); 
    const tags = ["#부산", guTag, nameTag, ...dynamicTags]
    .filter(isKoreanTag);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image || fallbackImg}" class="card-bg">
    <div class="overlay">
      <div class="icon-box">
        <img src="./IMG/wishlist2.png" class="icon" alt="위시리스트">
      </div>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="address">${addr || "주소 없음"}</p>
      <div class="tags">
        ${tags.map(t => `<span class="tag">${t}</span>`).join("")}
      </div>
    </div>
    `;

    // 1. [중요] 이미 즐겨찾기인지 서버에 확인 후 노란색 칠하기
  // (비동기라서 화면이 먼저 뜨고 0.x초 뒤에 색이 칠해질 수 있습니다)
  const iconImg = card.querySelector(".icon");
  const id = String(p.id);
const isFavTab = (tab.key === "fav" || tab.source === "FAV");

// ✅ 즐겨찾기 탭은 항상 노란색 유지
if (isFavTab) {
  iconImg.classList.add("active");
} else {
  // ✅ 일반 탭은 캐시 기준으로 상태 표시
  if (favIdSet.has(id)) iconImg.classList.add("active");
  else iconImg.classList.remove("active");
}

  // 2. 카드 클릭 (모달 열기)
  card.addEventListener("click", () => {
    openPlace(p);
  });

  // 3. 하트 아이콘 클릭 (Firebase 저장/삭제)
  const iconBox = card.querySelector(".icon-box");

iconBox.addEventListener("click", async (e) => {
  e.stopPropagation();

  const id = String(p.id);
  const isFavTab = (tab.key === "fav" || tab.source === "FAV");

  // ✅ fav 탭: "삭제"만 허용 + 삭제되면 카드 제거
  if (isFavTab) {
    const ok = await removeFavorite(id);
    if (ok) {
      favIdSet.delete(id);
      alert("즐겨찾기에서 삭제되었습니다.");

      // ✅ 화면에서 즉시 제거 + 카운트 갱신
      card.remove();
      setCount(list.children.length);
    } else {
      alert("삭제에 실패했습니다.");
    }
    return;
  }

  // ✅ 일반 탭: 토글(추가/삭제)
  const isCurrentlyFav = favIdSet.has(id);

  // 1) 낙관적 UI(즉시 색 유지)
  if (isCurrentlyFav) {
    favIdSet.delete(id);
    iconImg.classList.remove("active");
  } else {
    favIdSet.add(id);
    iconImg.classList.add("active");
  }

  // 2) 서버 반영 + 실패 시 롤백
  try {
    if (isCurrentlyFav) {
      const ok = await removeFavorite(id);
      if (!ok) throw new Error("removeFavorite failed");
      alert("즐겨찾기에서 삭제되었습니다.");
    } else {
      const ok = await addFavorite(p);
      if (!ok) throw new Error("addFavorite failed");
      alert("즐겨찾기에 추가되었습니다!");
    }
  } catch (err) {
    // 롤백
    if (isCurrentlyFav) {
      favIdSet.add(id);
      iconImg.classList.add("active");
    } else {
      favIdSet.delete(id);
      iconImg.classList.remove("active");
    }
    alert("즐겨찾기 처리 실패(네트워크/권한 확인)");
    console.error(err);
  }
});

    list.appendChild(card);
  });
}

  function renderMarkers(places) {
    clearMarkers();

    if (!places.length) return;

    const bounds = new kakao.maps.LatLngBounds();

    places.forEach(p => {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const marker = new kakao.maps.Marker({ map, position: pos });
      markers.push(marker);
      bounds.extend(pos);

      kakao.maps.event.addListener(marker, "click", () => {
        // 인포윈도우 + 모달
        infoWindow.setContent(`<div style="padding:6px 8px;font-size:12px;">${escapeHtml(p.title)}</div>`);
        infoWindow.open(map, marker);
        openPlace(p);
      });
    });

    map.setBounds(bounds);
  }

  /***********************
   * 5) 메인: 탭 보여주기
   ***********************/
  let currentTab = null;
  async function loadAndRender(key) {
    const tab = TAB_CONFIG.find(t => t.key === key);
    currentTab = tab;
    if (!tab) return;

    try {
    await ensureFavoritesLoaded();

    let places = [];
      // ✅ result.js에서 넘어온 데이터가 있으면, 첫 진입 탭에서는 그걸 그대로 쓴다
    const isSelectedTab =
    tab.source === "KTO" &&               // ✅ KTO 탭에서만 허용
    selectedTag &&
    TAG_TO_TAB[selectedTag] === key &&
    Array.isArray(selectedTagData) &&
    selectedTagData.length > 0;

  if (isSelectedTab) {
    places = normalizeKto(selectedTagData).slice(0, 15);
  } else {
    if (tab.source === "KTO") {
      const items = await fetchKtoList(tab);
      places = normalizeKto(items);
    } else if (tab.source === "RTDB") {
      const tree = await fetchRtdbList(tab);
      places = normalizeRtdb(tree, tab);

      if (!places.length && tab.fallbackToKakao) {
        const docs = await fetchKakaoList(tab.fallbackToKakao);
        places = normalizeKakao(docs);
      }

    } else if (tab.source === "KAKAO") {
      const docs = await fetchKakaoList(tab);
      places = normalizeKakao(docs);
    } else if (tab.source === "FAV") {
      const fav = await loadFavorites();
      places = normalizeFav(fav);
    }
  }

      if (!places.length) {
        setEmpty("결과가 없습니다.");
        return;
      }

      renderList(places, tab);
      renderMarkers(places);
    } catch (e) {
      console.error("loadAndRender error:", e);
      setEmpty("데이터를 불러오지 못했습니다.");
    }
  }

  /***********************
   * 6) fetch: 소스별
   ***********************/
  // KTO: 너가 기존에 쓰던 /api/busan 재사용
  async function fetchKtoList(tab) {
  // contentTypeId가 있으면 쿼리 파라미터로 추가
  const params = new URLSearchParams();
  if (tab.contentTypeId) {
    params.append('contentTypeId', tab.contentTypeId);
  }
  // "유명한" 기준을 인기순으로 보겠다는 의미로 P를 명시 (서버 기본도 P)
  params.append("arrange", tab.arrange || "P");

  // ✅ 여기서 양을 줄이면 됨
  params.append("pages", "1");
  params.append("numOfRows", "15");

  const url = `/api/busan?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.response?.body?.items?.item ?? [];
}

  // Kakao: 프록시 필요 (예: /api/kakao/search?category=FD6&query=부산)
  async function fetchKakaoList(tab) {
    const category = encodeURIComponent(tab.categoryGroupCode);
    const query = encodeURIComponent(tab.query || "부산");

    const res = await fetch(`/api/kakao/search?category=${category}&query=${query}`);
    const data = await res.json();
    return data?.documents ?? [];
  }
  
  // RTDB: Realtime Database에서 목록 가져오기
async function fetchRtdbList(tab) {
  const categoryPath = tab.rtdbPath;       // restaurants | cafes | activities | photos
  const companionKey = getCompanionKey(); // friends | family | couple

  // 1) 권장 구조: /restaurants/family.json
  const url1 = `${RTDB_BASE}/${categoryPath}/${companionKey}.json`;
  const r1 = await fetch(url1);
  if (r1.ok) {
    const d1 = await r1.json();
    if (d1) return d1;
  }

  // 2) fallback 구조: /restaurants.json 안에 {family,friends,couple}
  const url2 = `${RTDB_BASE}/${categoryPath}.json`;
  const r2 = await fetch(url2);
  if (!r2.ok) throw new Error(`RTDB fetch failed: ${r2.status}`);
  return await r2.json();
}

  /***********************
   * 7) normalize: 공통 모델로
   ***********************/
  function normalizeKto(items) {
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

  function normalizeKakao(docs) {
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
          image: fallbackImg, // 카카오는 이미지 필드가 거의 없음
          source: "KAKAO",
          raw: d
        };
      })
      .filter(Boolean);
  }

  function normalizeFav(items) {
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
  
  function normalizeRtdb(tree, tab) {
  if (!tree) return [];

  const companionKey = getCompanionKey(); // friends|family|couple

  // tree가 {family,friends,couple}면 해당 버킷으로 내려가고,
  // 이미 버킷이면 그대로 사용
  const bucket =
    (tree.family || tree.friends || tree.couple)
      ? (tree[companionKey] || tree.family || tree.friends || tree.couple || {})
      : tree;

  return Object.entries(bucket)
    .map(([id, x]) => {
      const lat = Number(x.lat);
      const lng = Number(x.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        id: String(x.id ?? x.contentid ?? x.contentId ?? id),
        title: x.title || "",
        lat,
        lng,
        image: x.firstimage || x.firstimage2 || fallbackImg,
        source: "RTDB",
        raw: x,
      };
    })
    .filter(Boolean);
}


  /***********************
   * 8) 모달: 소스별 열기
   ***********************/
  function openPlace(place) {
    if (place.source === "KTO") {
      openKtoModal(place);
    } else if (place.source === "KAKAO") {
      openKakaoModal(place);
    } else if (place.source === "FAV") {
      openFavModal(place);
    }else if (place.source === "RTDB") openRtdbModal(place);
  }

  // KTO 모달(기존 로직)
  
  let currentIndex = 0, images = [];
  
  // 545-636번 줄 수정된 openKtoModal 함수
function openKtoModal(place) {
  modal.style.display = "flex";
  
  // 상태 초기화
  currentIndex = 0;
  images = [];
  
  const contentid = place.id;
  const title = place.title;
  
  mTitle.innerText = title;
  
  // place.raw에서 직접 데이터 가져오기
  const rawData = place.raw || {};
  const addr = rawData.addr1 || "주소 없음";
  const lat = Number(rawData.mapy);
  const lng = Number(rawData.mapx);
  
  // 주소 표시
  const mAddress = document.getElementById("mAddress");
  if (mAddress) mAddress.innerText = addr;
  
  // 거리 계산
  const mDistance = document.getElementById("mDistance");
  if (mDistance) {
    if (userLat != null && userLng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      mDistance.innerText = `나와의 거리: 약 ${calcDistance(userLat, userLng, lat, lng)} km`;
    } else {
      mDistance.innerText = "나와의 거리: 계산 불가";
    }
  }
  
  // 카카오맵 버튼
  const modalMapBtn = document.getElementById("modalMapBtn");
  if (modalMapBtn) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      modalMapBtn.disabled = false;
      modalMapBtn.onclick = () => openMap(lat, lng, title);
    } else {
      modalMapBtn.disabled = true;
      modalMapBtn.onclick = null;
    }
  }
  
  // 태그 생성
  const guMatch = addr.match(/부산광역시\s(\S+)구/);
  const guTag = guMatch ? `#${guMatch[1]}` : "#부산구";
  const nameTag = `#${title.replace(/\s/g, "")}`;
  const currentTab = TAB_CONFIG.find(t => t.key === activeKey);
  const dynamic = buildTags(place, currentTab);
  const modalTags = ["#부산", guTag, nameTag, ...dynamic].filter(isKoreanTag);
  
  mTags.innerHTML = modalTags
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
  
  // 설명 영역
  let mDesc = document.getElementById("mDesc");
  if (!mDesc) {
    mDesc = document.createElement("p");
    mDesc.id = "mDesc";
    mDesc.style.fontSize = "15px";
    mDesc.style.color = "#ddd";
    mDesc.style.lineHeight = "1.6";
    mDesc.style.margin = "12px 0";
    const modalBody = document.querySelector(".modal-body");
    if (modalBody && mTags) {
      modalBody.insertBefore(mDesc, mTags);
    }
  }
  
  // overview가 있으면 표시
  if (rawData.overview) {
    mDesc.innerText = rawData.overview;
    mDesc.style.display = "block";
  } else {
    mDesc.style.display = "none";
  }
  
  // 슬라이더 기본 이미지 설정 - firstimage 우선 사용
  const firstImg = rawData.firstimage || rawData.firstimage2 || place.image || fallbackImg;
  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${firstImg}" alt="" style="width:100%;flex:0 0 100%;">`;
    sliderTrack.style.transform = "translateX(0%)";
  }

  // ✅ 추가 이미지들을 서버 프록시로 가져오기
  const cid = encodeURIComponent(contentid);
  fetch(`/api/tour/detailImage?contentId=${cid}`)
    .then(r => r.json())
    .then(imgs => {
      console.log("detailImage 응답:", imgs);
      
      const urls = Array.isArray(imgs)
        ? imgs.map(i => i.originimgurl).filter(Boolean)
        : [];

      // 대표 이미지도 포함하고 중복 제거
      if (firstImg && firstImg !== fallbackImg) urls.unshift(firstImg);

      images = [...new Set(urls)].slice(0, 20);
      if (images.length === 0) images = [fallbackImg];

      sliderTrack.innerHTML = images
        .map(img => `<img src="${img}" alt="">`)
        .join("");

      currentIndex = 0;
      updateSlider();
      if (window.syncSliderControls) window.syncSliderControls();
    })
    .catch(err => {
      console.error("detailImage 에러:", err);
      images = [firstImg];
      sliderTrack.innerHTML = `<img src="${firstImg}" alt="">`;
    });
}



  // Kakao 모달(간단 버전: 원본 필드 보여주기)
  function openKakaoModal(place) {
    modal.style.display = "flex";
    
    if (sliderTrack) {
      sliderTrack.innerHTML = `<img src="${fallbackImg}" style="width:100%; flex:0 0 100%;">`;
      // 슬라이더 위치 초기화
      currentIndex = 0;
      updateSlider();
    }

    mTitle.innerText = place.title;

    const d = place.raw || {};
    const addr = d.road_address_name || d.address_name || "";
    const phone = d.phone || "";
    const url = d.place_url || "";

    mDesc.innerHTML = `
      <div style="line-height:1.6">
        <div><b>주소</b>: ${escapeHtml(addr || "정보 없음")}</div>
        <div><b>전화</b>: ${escapeHtml(phone || "정보 없음")}</div>
        ${url ? `<div><b>링크</b>: <a href="${url}" target="_blank" rel="noreferrer">카카오 장소 보기</a></div>` : ""}
      </div>
    `;

    const dynamic = buildTags(place, currentTab);
    const modalTags = ["#부산", ...dynamic];

    mTags.innerHTML = modalTags
      .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
  }

  function openFavModal(place) {
    modal.style.display = "flex";
    const imgUrl = place.image || fallbackImg;
      if (sliderTrack) {
        sliderTrack.innerHTML = `<img src="${imgUrl}" style="width:100%; flex:0 0 100%;">`;
        currentIndex = 0;
        updateSlider();
      }
    mTitle.innerText = place.title;
    mDesc.innerText = "즐겨찾기 항목입니다.";
    mTags.innerHTML = `<span class="tag">#즐겨찾기</span>`;
  }
  function openRtdbModal(place) {
  modal.style.display = "flex";

  const raw = place.raw || {};

  // 이미지
  const imgUrl =
    raw.firstimage ||
    raw.firstimage2 ||
    place.image ||
    fallbackImg;

  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${imgUrl}" style="width:100%; flex:0 0 100%;">`;
    currentIndex = 0;
    updateSlider();
    if (window.syncSliderControls) window.syncSliderControls();
  }

  // 제목
  mTitle.innerText = place.title || raw.title || "제목 없음";

  // 주소 (네 RTDB 데이터 키에 맞춰서 후보를 여러 개 둠)
  const addr =
    raw.addr1 ||
    raw.address ||
    raw.roadAddress ||
    raw.road_address ||
    raw.location ||
    "주소 없음";

  // 기존 변수 mAddress는 const로 위에서 잡혀있음
  if (mAddress) mAddress.innerText = addr;

  // 거리
  if (mDistance) {
    if (userLat != null && userLng != null && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      mDistance.innerText = `나와의 거리: 약 ${calcDistance(userLat, userLng, place.lat, place.lng)} km`;
    } else {
      mDistance.innerText = "나와의 거리: 계산 불가";
    }
  }

  // 지도 버튼
  if (modalMapBtn) {
    if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      modalMapBtn.disabled = false;
      modalMapBtn.onclick = () => openMap(place.lat, place.lng, place.title);
    } else {
      modalMapBtn.disabled = true;
      modalMapBtn.onclick = null;
    }
  }

  // 설명 (mDesc는 전역 변수가 아닐 수 있어서 안전하게 getElementById로 처리)
  const mDescEl = document.getElementById("mDesc");
  const desc =
    raw.overview ||
    raw.description ||
    raw.desc ||
    raw.content ||
    "";

  if (mDescEl) {
    mDescEl.innerHTML = desc ? escapeHtml(desc) : "설명 정보 없음";
    mDescEl.style.display = "block";
  }

  // 태그
  const dynamic = buildTags(place, currentTab);
  const modalTags = ["#부산", ...dynamic];

  mTags.innerHTML = modalTags
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
}


  // ===== 추가: 슬라이더 컨트롤 =====
function updateSlider() {
  if (!sliderTrack) return;
  sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
}

// 이전/다음 버튼 이벤트
// 이전/다음 버튼 이벤트 (한 번만 바인딩)
document.addEventListener("DOMContentLoaded", () => {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  function syncSliderControls() {
    const canSlide = Array.isArray(images) && images.length > 1;

    if (prevBtn) {
      prevBtn.style.display = canSlide ? "flex" : "none";
      prevBtn.disabled = !canSlide;
    }
    if (nextBtn) {
      nextBtn.style.display = canSlide ? "flex" : "none";
      nextBtn.disabled = !canSlide;
    }
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (!images || images.length <= 1) return; // ✅ 1장이면 이동 금지
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateSlider();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!images || images.length <= 1) return; // ✅ 1장이면 이동 금지
      currentIndex = (currentIndex + 1) % images.length;
      updateSlider();
    };
  }

  // ✅ 처음 로드 시에도 버튼 상태 1회 반영
  syncSliderControls();

  // ✅ 모달에서 images가 바뀔 때마다 호출할 수 있게 전역으로 노출
  window.syncSliderControls = syncSliderControls;
});



  /***********************
   * 9) 즐겨찾기(샘플)
   ***********************/
  async function loadFavorites() { 
  // 기존에는 배열을 바로 리턴했지만, 이제는 DB에서 가져오므로 await가 필요합니다.
  // 이 함수를 호출하는 loadAndRender 쪽도 수정이 필요할 수 있습니다.
  const data = await getFavorites();
  
  // normalizeFav에 맞게 변환 (Firebase 저장 구조가 이미 비슷하다면 그대로 써도 됨)
  // 저장할 때 필드명을 맞춰서 저장했으므로 바로 리턴해도 되지만, 
  // 안전하게 map을 한번 돌려줍니다.
  return data.map(item => ({
     id: item.id,
     title: item.title,
     lat: item.mapy,   // 저장할 때 mapy로 저장했으므로
     lng: item.mapx,   // 저장할 때 mapx로 저장했으므로
     image: item.firstimage || fallbackImg,
     source: "FAV",
     raw: item
  }));
}

  /***********************
   * 10) 모달 닫기
   ***********************/
  document.getElementById("closeBtn").onclick = () => {
    modal.style.display = "none";
  };
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  /***********************
   * 11) XSS 방지용 최소 escape
   ***********************/
  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function waitForKakaoSDK(timeoutMs = 15000) {
  console.log("⏳ Kakao SDK 로딩 대기 중...");
  
  return new Promise((resolve, reject) => {
    // 이미 로드되어 있으면 바로 resolve
    if (window.kakao && window.kakao.maps) {
      console.log("✅ Kakao SDK already loaded");
      return resolve();
    }

    const start = Date.now();
    let attempts = 0;
    
    (function tick() {
      attempts++;
      
      if (window.kakao && window.kakao.maps) {
        console.log(`✅ Kakao SDK loaded (${attempts}번째 시도, ${Date.now() - start}ms)`);
        return resolve();
      }
      
      if (Date.now() - start > timeoutMs) {
        console.error(`❌ Kakao SDK timeout (${attempts}번 시도)`);
        return reject(new Error("Kakao SDK not loaded (timeout)"));
      }
      
      setTimeout(tick, 200);
    })();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
await waitForKakaoSDK();
  initKakaoMap();
});

/**
 * [복구] 지역과 카테고리를 받아 데이터를 호출하는 핵심 함수
 */
async function fetchPlaces(region, category) {
  console.log(`🔍 데이터 요청 시작: ${region} > ${category}`);
  
  // 1. 기존 리스트 비우고 로딩 표시
  const listContainer = document.getElementById("list");
  if (listContainer) {
    listContainer.innerHTML = '<div class="loading">데이터를 불러오는 중입니다...</div>';
  }

  // 2. 카카오 장소 검색 실행
  // region(예: 부산) + category(예: 카페) 조합으로 검색
  searchKakaoPlaces(`${region} ${category}`);

  // 3. (옵션) 관광공사 API 호출 로직이 서버(SERVER_URL)에 있다면 실행
  try {
    const response = await fetch(`${SERVER_URL}?region=${encodeURIComponent(region)}&category=${encodeURIComponent(category)}`);
    if (response.ok) {
      const ktoData = await response.json();
      console.log("✅ KTO 데이터 로드 성공:", ktoData);
      // 데이터 변환 후 리스트에 추가 (append 모드)
      if (ktoData && ktoData.length > 0) {
        renderList(normalizeKto(ktoData), true); 
      }
    }
  } catch (err) {
    console.warn("⚠️ KTO API 호출 실패 또는 구현되지 않음:", err);
  }
}

/**
 * [복구] 카카오 SDK를 이용한 키워드 검색
 */
function searchKakaoPlaces(keyword) {
  if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
    console.error("❌ 카카오 SDK가 로드되지 않았습니다.");
    return;
  }

  const ps = new kakao.maps.services.Places();
  ps.keywordSearch(keyword, (data, status) => {
    if (status === kakao.maps.services.Status.OK) {
      console.log("✅ 카카오 검색 성공:", data.length, "건");
      
      // 카카오 데이터를 우리 시스템 형식으로 변환
      const normalizedKakao = data.map(item => ({
        id: item.id,
        title: item.place_name,
        address: item.address_name,
        lat: parseFloat(item.y),
        lng: parseFloat(item.x),
        image: fallbackImg, // 카카오 기본검색은 이미지를 주지 않음
        source: "kakao"
      }));

      // 리스트 그리기
      renderList(normalizedKakao);
    } else {
      console.warn("❌ 카카오 검색 결과가 없습니다:", status);
    }
  });
}

// 외부에서 호출할 수 있도록 window 객체에 등록 (중요)
window.fetchPlaces = fetchPlaces;