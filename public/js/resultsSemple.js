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
  const slider = document.getElementById("slider");
  const mTitle = document.getElementById("mTitle");
  const mDesc = document.getElementById("mDesc");
  const mTags = document.getElementById("mTags");

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
    { key: "food",     label: "맛집",     source: "KAKAO", categoryGroupCode: CONTENT.KAKAO.FOOD, query: "부산" },
    { key: "cafe",     label: "카페",     source: "KAKAO", categoryGroupCode: CONTENT.KAKAO.CAFE, query: "부산" },
    { key: "activity", label: "액티비티", source: "KTO",   contentTypeId: CONTENT.KTO.ACTIVITY },
    { key: "photo",    label: "인생샷",   source: "KTO",   contentTypeId: CONTENT.KTO.TOUR, arrange: "P"},
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
  function renderList(places, tab) {
    listTitle.textContent = tab.label;
    track.textContent = "";
    list.innerHTML = "";
    setCount(places.length);

    places.forEach(p => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="${p.image || fallbackImg}" class="card-bg">
        <div class="overlay">
          <div class="icon-box">
            <img src="./IMG/wishlist2.png" class="icon">
          </div>
          <h3>${escapeHtml(p.title)}</h3>
          <div class="tags">
            <span class="tag">#부산</span>
            <span class="tag">#${escapeHtml(tab.label)}</span>
          </div>
        </div>
      `;

      card.onclick = () => openPlace(p);
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
  async function loadAndRender(key) {
    const tab = TAB_CONFIG.find(t => t.key === key);
    if (!tab) return;

    try {
      let places = [];

      if (tab.source === "KTO") {
        const items = await fetchKtoList(tab);
        places = normalizeKto(items);
      } else if (tab.source === "KAKAO") {
        const docs = await fetchKakaoList(tab);
        places = normalizeKakao(docs);
      } else if (tab.source === "FAV") {
        const fav = loadFavorites();
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

  /***********************
   * 8) 모달: 소스별 열기
   ***********************/
  function openPlace(place) {
    if (place.source === "KTO") {
      openKtoModal(place.id, place.title);
    } else if (place.source === "KAKAO") {
      openKakaoModal(place);
    } else if (place.source === "FAV") {
      openFavModal(place);
    }
  }

  // KTO 모달(기존 로직)
  function openKtoModal(contentid, title) {
    modal.style.display = "flex";
    slider.innerHTML = "";
    mTitle.innerText = title;
    mDesc.innerText = "불러오는 중입니다...";
    mTags.innerHTML = `<span class="tag">#부산</span><span class="tag">#관광</span>`;

    const cid = encodeURIComponent(contentid);

    fetch(`${API_BASE}/api/tour/detailCommon?contentId=${cid}`)
      .then(r => r.json())
      .then(d => {
        mDesc.innerText = d?.overview || "상세 설명 없음";
      })
      .catch(() => {
        mDesc.innerText = "상세 설명을 불러오지 못했습니다.";
      });

    fetch(`${API_BASE}/api/tour/detailImage?contentId=${cid}`)
      .then(r => r.json())
      .then(imgs => {
        slider.innerHTML = "";

        if (!Array.isArray(imgs) || imgs.length === 0) {
          slider.innerHTML = `<img src="${fallbackImg}">`;
          return;
        }

        imgs.slice(0, 4).forEach(i => {
          if (i?.originimgurl) slider.innerHTML += `<img src="${i.originimgurl}">`;
        });

        if (!slider.innerHTML) slider.innerHTML = `<img src="${fallbackImg}">`;
      })
      .catch(() => {
        slider.innerHTML = `<img src="${fallbackImg}">`;
      });
  }

  // Kakao 모달(간단 버전: 원본 필드 보여주기)
  function openKakaoModal(place) {
    modal.style.display = "flex";
    slider.innerHTML = `<img src="${fallbackImg}">`;
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

    mTags.innerHTML = `<span class="tag">#부산</span><span class="tag">#카카오</span>`;
  }

  function openFavModal(place) {
    modal.style.display = "flex";
    slider.innerHTML = `<img src="${place.image || fallbackImg}">`;
    mTitle.innerText = place.title;
    mDesc.innerText = "즐겨찾기 항목입니다.";
    mTags.innerHTML = `<span class="tag">#즐겨찾기</span>`;
  }

  /***********************
   * 9) 즐겨찾기(샘플)
   ***********************/
  function loadFavorites() {
    // TODO: 로컬스토리지/서버 연동으로 교체
    // 샘플 데이터(좌표 넣으면 마커/카드 확인 가능)
    return [
      // { id: "fav1", title: "샘플 즐겨찾기", lat: 35.1796, lng: 129.0756, image: fallbackImg }
    ];
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
