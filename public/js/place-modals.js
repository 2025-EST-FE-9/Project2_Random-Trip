/***********************
 * place-modals.js
 * 모달 관련 함수들
 ***********************/

import { calcDistance, openMap, escapeHtml, buildTags, isKoreanTag } from './place-utils.js';

// 전역 변수 (메인에서 전달받음)
let modal, sliderTrack, mTitle, mAddress, mDistance, mTags, modalMapBtn;
let userLat, userLng, fallbackImg, currentTab, TAB_CONFIG, activeKey;
let currentIndex = 0;
let images = [];

// 초기화 함수
export function initModals(domElements, globalVars) {
  modal = domElements.modal;
  sliderTrack = domElements.sliderTrack;
  mTitle = domElements.mTitle;
  mAddress = domElements.mAddress;
  mDistance = domElements.mDistance;
  mTags = domElements.mTags;
  modalMapBtn = domElements.modalMapBtn;
  
  userLat = globalVars.userLat;
  userLng = globalVars.userLng;
  fallbackImg = globalVars.fallbackImg;
  currentTab = globalVars.currentTab;
  TAB_CONFIG = globalVars.TAB_CONFIG;
  activeKey = globalVars.activeKey;
}

// 전역 변수 업데이트
export function updateGlobalVars(vars) {
  if (vars.userLat !== undefined) userLat = vars.userLat;
  if (vars.userLng !== undefined) userLng = vars.userLng;
  if (vars.currentTab !== undefined) currentTab = vars.currentTab;
  if (vars.activeKey !== undefined) activeKey = vars.activeKey;
}

// 메인 모달 열기 함수
export function openPlace(place) {
  if (place.source === "KTO") {
    openKtoModal(place);
  } else if (place.source === "KAKAO") {
    openKakaoModal(place);
  } else if (place.source === "FAV") {
    openFavModal(place);
  } else if (place.source === "RTDB") {
    openRtdbModal(place);
  }
}

// KTO 모달
function openKtoModal(place) {
  modal.style.display = "flex";
  
  currentIndex = 0;
  images = [];
  
  const contentid = place.id;
  const title = place.title;
  
  mTitle.innerText = title;
  
  const rawData = place.raw || {};
  const addr = rawData.addr1 || "주소 없음";
  const lat = Number(rawData.mapy);
  const lng = Number(rawData.mapx);
  
  if (mAddress) mAddress.innerText = addr;
  
  if (mDistance) {
    if (userLat != null && userLng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      mDistance.innerText = `나와의 거리: 약 ${calcDistance(userLat, userLng, lat, lng)} km`;
    } else {
      mDistance.innerText = "나와의 거리: 계산 불가";
    }
  }
  
  if (modalMapBtn) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      modalMapBtn.disabled = false;
      modalMapBtn.onclick = () => openMap(lat, lng, title);
    } else {
      modalMapBtn.disabled = true;
      modalMapBtn.onclick = null;
    }
  }
  
  const guMatch = addr.match(/부산광역시\s(\S+)구/);
  const guTag = guMatch ? `#${guMatch[1]}` : "#부산구";
  const nameTag = `#${title.replace(/\s/g, "")}`;
  const tab = TAB_CONFIG.find(t => t.key === activeKey);
  const dynamic = buildTags(place, tab);
  const modalTags = ["#부산", guTag, nameTag, ...dynamic].filter(isKoreanTag);
  
  mTags.innerHTML = modalTags
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
  
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
  
  if (rawData.overview) {
    mDesc.innerText = rawData.overview;
    mDesc.style.display = "block";
  } else {
    mDesc.style.display = "none";
  }
  
  const firstImg = rawData.firstimage || rawData.firstimage2 || place.image || fallbackImg;
  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${firstImg}" alt="" style="width:100%;flex:0 0 100%;">`;
    sliderTrack.style.transform = "translateX(0%)";
  }
  
  const cid = encodeURIComponent(contentid);
  fetch(`/api/tour/detailImage?contentId=${cid}`)
    .then(r => r.json())
    .then(imgs => {
      const urls = Array.isArray(imgs)
        ? imgs.map(i => i.originimgurl).filter(Boolean)
        : [];
      
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

// Kakao 모달
function openKakaoModal(place) {
  modal.style.display = "flex";
  
  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${fallbackImg}" style="width:100%; flex:0 0 100%;">`;
    currentIndex = 0;
    updateSlider();
  }
  
  mTitle.innerText = place.title;
  
  const d = place.raw || {};
  const addr = d.road_address_name || d.address_name || "";
  const phone = d.phone || "";
  const url = d.place_url || "";
  
  const mDesc = document.getElementById("mDesc");
  if (mDesc) {
    mDesc.innerHTML = `
      <div style="line-height:1.6">
        <div><b>주소</b>: ${escapeHtml(addr || "정보 없음")}</div>
        <div><b>전화</b>: ${escapeHtml(phone || "정보 없음")}</div>
        ${url ? `<div><b>링크</b>: <a href="${url}" target="_blank" rel="noreferrer">카카오 장소 보기</a></div>` : ""}
      </div>
    `;
  }
  
  const dynamic = buildTags(place, currentTab);
  const modalTags = ["#부산", ...dynamic];
  
  mTags.innerHTML = modalTags
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
}

// 즐겨찾기 모달
function openFavModal(place) {
  modal.style.display = "flex";
  const imgUrl = place.image || fallbackImg;
  
  if (sliderTrack) {
    sliderTrack.innerHTML = `<img src="${imgUrl}" style="width:100%; flex:0 0 100%;">`;
    currentIndex = 0;
    updateSlider();
  }
  
  mTitle.innerText = place.title;
  
  const mDesc = document.getElementById("mDesc");
  if (mDesc) {
    mDesc.innerText = "즐겨찾기 항목입니다.";
  }
  
  mTags.innerHTML = `<span class="tag">#즐겨찾기</span>`;
}

// RTDB 모달
function openRtdbModal(place) {
  modal.style.display = "flex";
  
  const raw = place.raw || {};
  
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
  
  mTitle.innerText = place.title || raw.title || "제목 없음";
  
  const addr =
    raw.addr1 ||
    raw.address ||
    raw.roadAddress ||
    raw.road_address ||
    raw.location ||
    "주소 없음";
  
  if (mAddress) mAddress.innerText = addr;
  
  if (mDistance) {
    if (userLat != null && userLng != null && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      mDistance.innerText = `나와의 거리: 약 ${calcDistance(userLat, userLng, place.lat, place.lng)} km`;
    } else {
      mDistance.innerText = "나와의 거리: 계산 불가";
    }
  }
  
  if (modalMapBtn) {
    if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      modalMapBtn.disabled = false;
      modalMapBtn.onclick = () => openMap(place.lat, place.lng, place.title);
    } else {
      modalMapBtn.disabled = true;
      modalMapBtn.onclick = null;
    }
  }
  
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
  
  const dynamic = buildTags(place, currentTab);
  const modalTags = ["#부산", ...dynamic];
  
  mTags.innerHTML = modalTags
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
}

// 슬라이더 업데이트
function updateSlider() {
  if (!sliderTrack) return;
  sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
}

// 슬라이더 컨트롤 초기화
export function initSliderControls() {
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
      if (!images || images.length <= 1) return;
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateSlider();
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!images || images.length <= 1) return;
      currentIndex = (currentIndex + 1) % images.length;
      updateSlider();
    };
  }
  
  syncSliderControls();
  window.syncSliderControls = syncSliderControls;
}
