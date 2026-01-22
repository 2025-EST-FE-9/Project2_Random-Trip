import { addFavorite, removeFavorite, getFavorites, checkIsFavorite, RTDB_BASE } from "./firebase.js";

/***********************
 * 0) 기본 설정/상수
 ***********************/
const BUSAN = { lat: 35.1795543, lng: 129.0756416 };
// 너 프록시 서버 베이스
const API_BASE = "http://localhost:3000";
// KTO(관광공사) 기본 목록(현재 너가 쓰고 있는 endpoint)
const SERVER_URL = `${API_BASE}/api/busan`;
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
  const TAB_CONFIG = [
    { key: "tour",     label: "관광지",   source: "KTO",   contentTypeId: CONTENT.KTO.TOUR },
    { key: "food",     label: "맛집",     source: "RTDB", categoryGroupCode: CONTENT.KAKAO.FOOD, query: "부산", rtdbPath: "restaurants"},
    { key: "cafe",     label: "카페",     source: "RTDB", categoryGroupCode: CONTENT.KAKAO.CAFE, query: "부산",rtdbPath: "cafes"},
    { key: "activity", label: "액티비티", source: "RTDB",   contentTypeId: CONTENT.KTO.ACTIVITY, rtdbPath: "activities" },
    { key: "photo",    label: "인생샷",   source: "RTDB",   contentTypeId: CONTENT.KTO.TOUR, arrange: "P", rtdbPath: "photos"},
    { key: "fav", label: "즐겨찾기", source: "FAV" }
  ];

  /***********************
   * 2) 지도 초기화
   ***********************/
  function initKakaoMap() {
    if (!window.kakao || !kakao.maps) {
      console.error("Kakao SDK not loaded");
      return;
    }

    kakao.maps.load(() => {
      const container = document.getElementById("map");
      const options = {
        center: new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng),
        level: 7,
      };

      map = new kakao.maps.Map(container, options);
      infoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

      renderTabs();
      loadAndRender(activeKey); //첫 렌더는 activeKey 기준 -> 결과창에서 넘어오는 데이터 3개중 클릭한 값으로 바꿔야함/ 출력되는 탭도 들어온 3개 값으로 바꿔서 출력
      
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
  // KTO / KAKAO / FAV 공통으로 쓸 태그 생성
  if (place.source === "KTO") return buildKtoTags(place, tab);
  if (place.source === "KAKAO") return buildKakaoTags(place);
  if (place.source === "FAV") return ["#즐겨찾기"];
  return [];
}

function buildKtoTags(place, tab) {
  const tags = [];

  // 1) 탭 키 기반 (인생샷 탭이면 사진성격 태그)
  if (tab?.key === "photo") tags.push("#인생샷");

  // 2) content type 기반
  const ct = Number(tab?.contentTypeId ?? place.raw?.contenttypeid);
  const typeMap = {
    12: "#관광지",
    14: "#문화",
    28: "#액티비티"
    // 필요하면 15(#축제), 32(#숙박) 등 추가
  };
  if (typeMap[ct]) tags.push(typeMap[ct]);

  // 3) TourAPI 카테고리 코드 기반 (cat1/cat2/cat3)
  // 실제 “명칭”으로 바꾸려면 categoryCode API로 맵핑 캐싱을 붙이는게 정석인데,
  // 우선은 코드라도 태그로 노출(개발중 확인용)하거나, 일부만 매핑해도 됨.
  const cat3 = place.raw?.cat3;
  if (cat3) tags.push(`#${cat3}`); // 예: #A02070100 같은 식 (원하면 명칭 매핑도 붙여줄게)

  return tags;
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

  function renderList(places, tab) {
    listTitle.textContent = tab.label;
    track.textContent = "";
    list.innerHTML = "";
    setCount(places.length);

    places.forEach(p => {
      const addr = p.raw?.addr1 || "";
      const guMatch = addr ? addr.match(/부산광역시\s(\S+)구/) : null;
      const guTag = guMatch ? `#${guMatch[1]}` : "#부산구";
      const nameTag = `#${p.title.replace(/\s/g, "")}`;
      const dynamicTags = buildTags(p, tab); 
      const tags = ["#부산", guTag, nameTag, ...dynamicTags];

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
    checkIsFavorite(p.id).then(isFav => {
      if (isFav) iconImg.classList.add("active");
    });

    // 2. 카드 클릭 (모달 열기)
    card.addEventListener("click", () => {
      openPlace(p);
    });

    // 3. 하트 아이콘 클릭 (Firebase 저장/삭제)
    const iconBox = card.querySelector(".icon-box");
    
    iconBox.addEventListener("click", async (e) => { // async 추가
      e.stopPropagation();

      // 현재 상태 확인 (클래스가 있으면 이미 즐겨찾기 상태)
      const isCurrentlyFav = iconImg.classList.contains("active");

      if (isCurrentlyFav) {
        // 이미 있으니 -> 삭제 시도
        const success = await removeFavorite(p.id);
        if (success) {
          alert("즐겨찾기에서 삭제되었습니다.");
          iconImg.classList.remove("active");
          
          // 즐겨찾기 탭 보고 있었으면 화면에서 바로 지워주기
          if (activeKey === "fav") {
             card.remove();
             setCount(list.children.length);
          }
        }
      } else {
        // 없으니 -> 추가 시도
        const success = await addFavorite(p);
        if (success) {
          alert("즐겨찾기에 추가되었습니다!");
          iconImg.classList.add("active"); // 노란색 변경
        }
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
      let places = [];

      if (tab.source === "KTO") {
      const items = await fetchKtoList(tab);
      places = normalizeKto(items);
    } else if (tab.source === "KAKAO") {
      const docs = await fetchKakaoList(tab);
      places = normalizeKakao(docs);
    } else if (tab.source === "RTDB") {
       const tree = await fetchRtdbList(tab);
       places = normalizeRtdb(tree, tab);
    } else if (tab.source === "FAV") {
      const fav = await loadFavorites();
      places = normalizeFav(fav);
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
    // tab에 따라 다른 endpoint가 있으면 여기서 분기하면 됨
    // 예) `${API_BASE}/api/tour/list?contentTypeId=${tab.contentTypeId}`
    const res = await fetch(SERVER_URL);
    const data = await res.json();
    return data?.response?.body?.items?.item ?? [];
  }

  // Kakao: 프록시 필요 (예: /api/kakao/search?category=FD6&query=부산)
  async function fetchKakaoList(tab) {
    const category = encodeURIComponent(tab.categoryGroupCode);
    const query = encodeURIComponent(tab.query || "부산");

    const res = await fetch(`${API_BASE}/api/kakao/search?category=${category}&query=${query}`);
    const data = await res.json();
    return data?.documents ?? [];
  }
  // RTDB: Realtime Database에서 목록 가져오기
  async function fetchRtdbList(tab) {
    const path = tab.rtdbPath; // 예: "restaurants", "cafes", "photos", "activities"
    const res = await fetch(`${RTDB_BASE}/${path}.json`);
    if (!res.ok) throw new Error(`RTDB fetch failed: ${res.status}`);
    return await res.json(); // object(tree)
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

  let items = [];

  // 네 data.json 구조 기준:
  // restaurants/cafes는 restaurants.family 아래에 데이터가 있고,
  // photos/activities는 바로 아래에 아이템이 있음.
  if (tab.rtdbPath === "restaurants" || tab.rtdbPath === "cafes") {
    const family = tree.family || {};
    items = Object.entries(family).map(([id, v]) => ({ id, ...v }));
  } else {
    items = Object.entries(tree).map(([id, v]) => ({ id, ...v }));
  }

  // Place 모델로 변환
  return items
    .map(x => {
      const lat = Number(x.lat);
      const lng = Number(x.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        id: String(x.id ?? x.contentid ?? x.contentId ?? ""), // 데이터에 맞게
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
  
  function openKtoModal(place) {
  modal.style.display = "flex";

  const sliderTrack = document.getElementById("sliderTrack");
  const mAddress = document.getElementById("mAddress");
  const mDistance = document.getElementById("mDistance");
  const modalMapBtn = document.getElementById("modalMapBtn");

  // 상태 초기화
  currentIndex = 0;
  images = [];

  mTitle.innerText = place.title;

  const addr = place.raw?.addr1 || "주소 없음";
  const lat = Number(place.raw?.mapy);
  const lng = Number(place.raw?.mapx);

  if (mAddress) mAddress.innerText = addr;

  // 거리(모달)
  if (mDistance) {
    if (userLat != null && userLng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      mDistance.innerText = `나와의 거리: 약 ${calcDistance(userLat, userLng, lat, lng)} km`;
    } else {
      mDistance.innerText = "나와의 거리: 계산 불가";
    }
  }

  // 카카오맵 버튼(모달)
  if (modalMapBtn) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      modalMapBtn.disabled = false;
      modalMapBtn.onclick = () => openMap(lat, lng, place.title);
    } else {
      modalMapBtn.disabled = true;
      modalMapBtn.onclick = null;
    }
  }

  // 태그
  const guMatch = addr.match(/부산광역시\s(\S+)구/);
  const guTag = guMatch ? `#${guMatch[1]}` : "#부산구";
  const nameTag = `#${place.title.replace(/\s/g, "")}`;
  const tab = currentTab; // ✅ 현재 활성 탭 기준
  const dynamic = buildTags(place, tab);
  const modalTags = ["#부산", guTag, nameTag, ...dynamic];

  mTags.innerHTML = modalTags
  .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
  .join("");
  // 설명(overview)은 목록에 없으니 "없으면 숨김" or "간단 안내"
  let mDesc = document.getElementById("mDesc");
  if (!mDesc) {
    mDesc = document.createElement("p");
    mDesc.id = "mDesc";
    document.querySelector(".modal-body").insertBefore(mDesc, mTags);
  }
  mDesc.style.display = "none"; // 우선 숨김

  // 슬라이더 기본
  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${place.image || fallbackImg}" alt="" style="width:100%;flex:0 0 100%;">`;
    sliderTrack.style.transform = "translateX(0%)";
  }

  // ✅ 이미지들만 서버 프록시로 가져오기
  const cid = encodeURIComponent(place.id);
  fetch(`${API_BASE}/api/tour/detailImage?contentId=${cid}`)
    .then(r => r.json())
    .then(imgs => {
      const urls = Array.isArray(imgs)
      ? imgs.map(i => i.originimgurl).filter(Boolean)
      : [];

    // 대표 이미지도 후보로 넣고 중복 제거
    if (place.image) urls.push(place.image);

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

  /***********************
   * 12) 시작
   ***********************/
  window.onload = () => {
    initKakaoMap();
  };

