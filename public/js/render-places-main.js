/***********************
 * render-places-main.js
 * 메인 로직 (지도, 탭, 리스트 렌더링)
 ***********************/

import { addFavorite, removeFavorite, getFavorites, checkIsFavorite, RTDB_BASE } from "./firebase.js";
import { 
  fallbackImg, 
  BUSAN, 
  isKoreanTag, 
  buildTags, 
  getAddressFromPlace,
  normalizeKto,
  normalizeKakao,
  normalizeRtdb,
  normalizeFav,
  fetchKtoList,
  fetchKakaoList,
  fetchRtdbList,
  waitForKakaoSDK,
  escapeHtml
} from './place-utils.js';
import { initModals, updateGlobalVars, openPlace, initSliderControls } from './place-modals.js';

/***********************
 * 전역 변수 및 상수
 ***********************/
const API_BASE = "";
const SERVER_URL = "/api/busan";

// DOM 요소
const tabs = document.getElementById("tabs");
const track = document.getElementById("track");
const badge = document.getElementById("countBadge");
const listTitle = document.getElementById("listTitle");
const list = document.getElementById("list");
const modal = document.getElementById("modal");
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
let infoWindow;
let currentTab = null;

// 사용자 위치
let userLat = null, userLng = null;
navigator.geolocation.getCurrentPosition(pos => {
  userLat = pos.coords.latitude;
  userLng = pos.coords.longitude;
  // 모달에서 사용할 수 있도록 업데이트
  updateGlobalVars({ userLat, userLng });
});

// 쿼리 파라미터 및 localStorage
const qp = new URLSearchParams(location.search);
const selectedTag = qp.get("tag") || localStorage.getItem("selectedTag");

const TAG_TO_TAB = {
  culture: "tour",
  photo: "photo",
  activity: "activity",
  food: "food",
  cafe: "cafe",
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

if (selectedTag && TAG_TO_TAB[selectedTag]) {
  activeKey = TAG_TO_TAB[selectedTag];
}

console.log("selectedTag:", selectedTag);
console.log("selectedTagData length:", Array.isArray(selectedTagData) ? selectedTagData.length : null);
console.log("SELECTED_CATEGORIES:", window.SELECTED_CATEGORIES);

// 콘텐츠 타입
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

// 탭 설정
let TAB_CONFIG = [
  { key: "tour",     label: "관광지",   source: "KTO",   contentTypeId: CONTENT.KTO.TOUR },
  { key: "food",     label: "맛집",     source: "RTDB", rtdbPath: "restaurants", categoryGroupCode: CONTENT.KAKAO.FOOD, query: "부산" },
  { key: "cafe",     label: "카페",     source: "RTDB", rtdbPath: "cafes", categoryGroupCode: CONTENT.KAKAO.CAFE, query: "부산" },
  { key: "activity", label: "액티비티", source: "RTDB", rtdbPath: "activities",  contentTypeId: CONTENT.KTO.ACTIVITY },
  { key: "photo",    label: "인생샷",   source: "RTDB", rtdbPath: "photos",  contentTypeId: CONTENT.KTO.TOUR, arrange: "P"},
  { key: "fav",      label: "즐겨찾기", source: "FAV" }
];

/***********************
 * 지도 초기화
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
    
    if (window.SELECTED_CATEGORIES && window.SELECTED_CATEGORIES.length > 0) {
      const wanted = new Set([...window.SELECTED_CATEGORIES, "fav"]);
      const filtered = TAB_CONFIG.filter(tab => wanted.has(tab.key));
      
      if (filtered.length > 0) {
        TAB_CONFIG = filtered;
        if (!TAB_CONFIG.some(t => t.key === activeKey)) {
          activeKey = TAB_CONFIG[0].key;
        }
      } else {
        console.warn("SELECTED_CATEGORIES 매칭 실패:", window.SELECTED_CATEGORIES);
      }
    }
    
    renderTabs();
    loadAndRender(activeKey);
  });
}

/***********************
 * 탭 렌더링
 ***********************/
function renderTabs() {
  tabs.innerHTML = "";
  
  TAB_CONFIG.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "tab" + (t.key === activeKey ? " active" : "");
    btn.textContent = t.label;
    
    btn.addEventListener("click", () => {
      activeKey = t.key;
      updateGlobalVars({ activeKey });
      renderTabs();
      loadAndRender(activeKey);
    });
    
    tabs.appendChild(btn);
  });
}

/***********************
 * 유틸리티
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
  map.setCenter(new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng));
  map.setLevel(7);
}

/***********************
 * 리스트 렌더링
 ***********************/
function renderList(places, tab) {
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
    const tags = ["#부산", guTag, nameTag, ...dynamicTags].filter(isKoreanTag);
    
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
    
    const iconImg = card.querySelector(".icon");
    checkIsFavorite(p.id).then(isFav => {
      if (isFav) iconImg.classList.add("active");
    });
    
    card.addEventListener("click", () => {
      openPlace(p);
    });
    
    const iconBox = card.querySelector(".icon-box");
    iconBox.addEventListener("click", async (e) => {
      e.stopPropagation();
      
      const isCurrentlyFav = iconImg.classList.contains("active");
      
      if (isCurrentlyFav) {
        const success = await removeFavorite(p.id);
        if (success) {
          alert("즐겨찾기에서 삭제되었습니다.");
          iconImg.classList.remove("active");
          
          if (activeKey === "fav") {
            card.remove();
            setCount(list.children.length);
          }
        }
      } else {
        const success = await addFavorite(p);
        if (success) {
          alert("즐겨찾기에 추가되었습니다!");
          iconImg.classList.add("active");
        }
      }
    });
    
    list.appendChild(card);
  });
}

/***********************
 * 마커 렌더링
 ***********************/
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
      infoWindow.setContent(`<div style="padding:6px 8px;font-size:12px;">${escapeHtml(p.title)}</div>`);
      infoWindow.open(map, marker);
      openPlace(p);
    });
  });
  
  map.setBounds(bounds);
}

/***********************
 * 데이터 로드 및 렌더링
 ***********************/
async function loadAndRender(key) {
  const tab = TAB_CONFIG.find(t => t.key === key);
  currentTab = tab;
  updateGlobalVars({ currentTab });
  
  if (!tab) return;
  
  try {
    let places = [];
    
    const isSelectedTab =
      tab.source === "KTO" &&
      selectedTag &&
      TAG_TO_TAB[selectedTag] === key &&
      Array.isArray(selectedTagData) &&
      selectedTagData.length > 0;
    
    if (isSelectedTab) {
      places = normalizeKto(selectedTagData);
    } else {
      if (tab.source === "KTO") {
        const items = await fetchKtoList(tab);
        places = normalizeKto(items);
      } else if (tab.source === "RTDB") {
        const tree = await fetchRtdbList(tab, RTDB_BASE);
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
 * 즐겨찾기 로드
 ***********************/
async function loadFavorites() {
  const data = await getFavorites();
  
  return data.map(item => ({
    id: item.id,
    title: item.title,
    lat: item.mapy,
    lng: item.mapx,
    image: item.firstimage || fallbackImg,
    source: "FAV",
    raw: item
  }));
}

/***********************
 * 모달 닫기
 ***********************/
document.getElementById("closeBtn").onclick = () => {
  modal.style.display = "none";
};
modal.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};

/***********************
 * 초기화
 ***********************/
window.addEventListener("load", async () => {
  try {
    // 모달 초기화
    initModals({
      modal, sliderTrack, mTitle, mAddress, mDistance, mTags, modalMapBtn
    }, {
      userLat, userLng, fallbackImg, currentTab, TAB_CONFIG, activeKey
    });
    
    // 슬라이더 컨트롤 초기화
    document.addEventListener("DOMContentLoaded", () => {
      initSliderControls();
    });
    
    // 카카오맵 SDK 대기 및 초기화
    await waitForKakaoSDK();
    initKakaoMap();
  } catch (e) {
    console.error(e.message);
    const mapEl = document.getElementById("map");
    if (mapEl) {
      mapEl.innerHTML = `<div style="padding:16px;color:#555">카카오맵 SDK 로드 실패. 네트워크/키/도메인 설정을 확인하세요.</div>`;
    }
  }
});
