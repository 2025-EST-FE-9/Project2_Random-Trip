
//버튼 클릭하면 result3.html로 이동하게되어있는데, result3.html은 임시이름이라 알아서 수정해주세요.
const tag = localStorage.getItem("selectedTag");
const places = JSON.parse(localStorage.getItem("selectedTagData"));
let isDataReady = false;


// ===========================
// 1. 상수 정의
// ===========================

const companionMap = {
  friend: "친구",
  family: "가족",
  couple: "연인"
};

const themeMap = {
  culture: "관광지",
  food: "맛집",
  cafe: "카페",
  photo: "인생샷",
  activity: "액티비티"
};

// TourAPI contentTypeId 매핑
const contentTypeMap = {
  culture: "12",    // 관광지
  food: "39",       // 음식점
  cafe: "39",       // 음식점 (카페도 음식점 카테고리)
  activity: "28"    // 레포츠
  // photo는 contentTypeId가 없으므로 키워드로 필터링
};
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
// 음식점(39) 내에서 세부 구분을 위한 키워드
const foodSubKeywords = {
  cafe: [
    "카페", "커피", "디저트", "베이커리",
    "브런치", "테라스", "루프탑",
    "뷰카페", "카페거리", "감성",
    "핸드드립", "라떼", "아메리카노",
    "coffee", "cafe", "dessert",
    // 완화된 키워드 추가
    "tea", "티", "차", "제과",
    "빵", "쿠키", "케이크", "마카롱",
    "와플", "팬케이크", "스콘",
    "분위기", "뷰", "오션뷰", "시티뷰"
  ],
  food: [
    "맛집", "식당", "음식점", "먹거리",
    "횟집", "고기", "국밥", "찌개",
    "전문점", "한식", "중식", "일식", "양식",
    "포차", "술집", "BBQ", "삼겹살",
    "해물", "생선", "조개", "전골",
    "정식", "백반", "비빔밥", "냉면"
  ]
};

const placeMap = {
  ocean: "바다",
  city: "도심",
  mountain: "산"
};

const TAG_DEFINITIONS = {
  culture: {
    keywords: [
      "문화", "역사", "전통", "유적", "유물",
      "박물관", "미술관", "기념관", "전시",
      "문화재", "사적", "근대", "역사관",
      "문화마을", "테마파크", "공연", "예술"
    ]
  },
  food: {
    keywords: [
      "시장", "맛집", "먹거리", "음식",
      "포장마차", "먹자골목", "식당",
      "횟집", "해산물", "어시장",
      "푸드", "먹방", "전통시장"
    ]
  },
  cafe: {
    keywords: [
      "카페", "커피", "디저트", "베이커리",
      "브런치", "테라스", "루프탑",
      "뷰카페", "카페거리", "감성",
      "핸드드립", "라떼", "아메리카노"
    ]
  },
  photo: {
    keywords: [
      // 기본 포토존 키워드
      "전망", "야경", "사진", "포토", "전경",
      "뷰", "포토존", "전망대",
      "일출", "일몰", "노을",
      "전망좋은", "경관", "뷰포인트",
      "전망로", "스카이", "브릿지",
      
      // 부산 유명 포토존
      "감천", "문화마을", "벽화", "마을",
      "타워", "전망대", "다리", "교량",
      "야경", "불꽃놀이", "조명",
      
      // 인스타/SNS 관련
      "SNS", "인스타", "핫플", "핫플레이스",
      "인증샷", "명소"
    ]
  },
  activity: {
    keywords: [
      "체험", "활동", "액티비티",
      "레포츠", "스포츠", "놀이",
      "수상", "익스트림",
      "체험관", "체험장",
      "탐방", "트레킹", "대회",
      "캠핑", "서핑", "패러글라이딩"
    ]
  },
  ocean: {
    keywords: [
      // 기본 바다 키워드
      "해수욕장", "바다", "해변", "해안",
      "해안로", "연안", "항구", "등대", "포구", "방파제",
      "비치", "마린", "워터", "어촌", "해양", "수변",
      
      // 부산 해변 지역
      "해운대", "광안리", "송정", "다대포", 
      "송도", "일광", "임랑", "기장",
      
      // 바다 관련 활동/시설
      "수족관", "아쿠아리움", "요트", "크루즈",
      "서핑", "해수욕", "물놀이", "낚시"
    ]
  },
  city: {
    keywords: [
      // 기본 도심 키워드
      "도심", "거리", "광장", "시내", "중심", "번화가",
      "상권", "쇼핑", "백화점", "지하상가", "상가", "타운", "도시",
      
      // 부산 주요 도심 지역명
      "해운대", "남포동", "광안리", "서면", "중앙동",
      "국제시장", "자갈치", "용두산", "부산역", "송정",
      "다대포", "영도", "태종대", "감천", "문화마을",
      
      // 도심 특징 키워드
      "야시장", "야경", "먹자골목", "카페거리", 
      "관광특구", "보행로", "산책로", "공원",
      "건물", "타워", "다리", "교", "브릿지",
      "거리", "로드", "스트리트", "길",
      
      // 문화/상업 시설
      "영화", "극장", "공연장", "전시관",
      "쇼핑몰", "마트", "시장", "센터",
      "호텔", "리조트", "숙박"
    ]
  },
  mountain: {
    keywords: [
      "산", "등산", "봉", "고개",
      "산책로", "숲", "자연휴양림",
      "트레킹", "둘레길",
      "전망봉", "정상", "계곡",
      "자연공원", "국립공원"
    ]
  }
};

// ===========================
// 2. 초기 데이터 가져오기
// ===========================

// localStorage에서 결과 가져오기
const result = JSON.parse(localStorage.getItem("travelResult"));

// 유효성 검사
if (!result || !result.companion || !result.theme || !result.place) {
  alert("잘못된 접근입니다. 테스트를 다시 진행해주세요.");
  location.href = "test.html";
}

console.log("전달받은 결과:", result);

// 사용자 태그 생성 (companion 제외!)
const userTags = [
  ...(Array.isArray(result.theme) ? result.theme : [result.theme]),
  result.place
];

console.log("사용자 선택 태그:", userTags);

// ===========================
// 3. DOM 요소
// ===========================

const titleEl = document.getElementById("resultTitle");
const tagContainer = document.getElementById("tagContainer");
const placeInfoEl = document.getElementById("placeInfo");
const track = document.querySelector(".carouselTrack");

// ===========================
// 4. 헤더 정보 렌더링
// ===========================

function renderHeader() {
  titleEl.textContent = "선택한 키워드";
}

// ===========================
// 5. 사용자 태그 렌더링
// ===========================

// 전역 변수로 필터링된 데이터 저장
let filteredPlacesData = {};

function renderUserTags(tags) {
  tagContainer.innerHTML = "";

  tags.forEach(tag => {
    const div = document.createElement("div");
    div.className = "tagItem";
    div.textContent = themeMap[tag] || placeMap[tag] || tag;
    
    // 클릭 이벤트 추가
    div.style.cursor = "pointer";
    div.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // 중복 핸들러까지 차단
      handleTagClick(tag);
    });
    
    tagContainer.appendChild(div);
  });
}

function handleTagClick(tag) {
  if (!isDataReady) {
    alert("데이터를 불러오는 중입니다. 잠시만 기다려주세요.");
    return;
  }

  const tagData = filteredPlacesData[tag];

  if (!Array.isArray(tagData) || tagData.length === 0) {
    console.warn("[tag click] no data", { tag, tagData });
    alert("해당 키워드에 맞는 장소가 없습니다.");
    return;
  }

  localStorage.setItem("selectedTag", tag);
  localStorage.setItem("selectedTagData", JSON.stringify(tagData));
  localStorage.setItem("selectedCompanion", result.companion); // ✅ 이 줄 추가

  const categories = [...new Set(
  [...userTags.map(t => TAG_TO_TAB[t]).filter(Boolean), "fav"]
)].join(",");
  const url =
    `./render-places.html?tag=${encodeURIComponent(tag)}&categories=${encodeURIComponent(categories)}`;

  // ✅ 저장 검증(선택): 혹시 다른 코드가 localStorage를 지우는 경우 방어
  const saved = localStorage.getItem("selectedTagData");
  if (!saved || saved === "null" || saved === "[]") {
    console.error("[tag click] localStorage save failed", { tag, saved });
    alert("데이터 저장에 실패했습니다. 다시 시도해주세요.");
    return;
  }

  location.href = url;
}

// ===========================
// 6. 필터링 로직
// ===========================

function isCafe(place) {
  const text = `${place.title} ${place.overview || ""} ${place.addr1 || ""}`.toLowerCase();
  const hasCafeKeyword = foodSubKeywords.cafe.some(keyword => text.includes(keyword));
  
  if (hasCafeKeyword) {
    const matchedKeywords = foodSubKeywords.cafe.filter(k => text.includes(k));
    console.log(`  ✓ 카페 매칭: ${place.title} (키워드: ${matchedKeywords.join(", ")})`);
  }
  
  return hasCafeKeyword;
}

function isFood(place) {
  const text = `${place.title} ${place.overview || ""} ${place.addr1 || ""}`.toLowerCase();
  const hasFoodKeyword = foodSubKeywords.food.some(keyword => text.includes(keyword));
  const hasCafeKeyword = foodSubKeywords.cafe.some(keyword => text.includes(keyword));
  
  return hasFoodKeyword && !hasCafeKeyword;
}

function filterByContentType(places, userThemes) {
  const filtered = [];
  
  userThemes.forEach(theme => {
    const contentTypeId = contentTypeMap[theme];
    
    if (contentTypeId) {
      let matched = places.filter(place => 
        String(place.contenttypeid) === String(contentTypeId)
      );
      
      if (contentTypeId === "39") {
        if (theme === "cafe") {
          matched = matched.filter(place => isCafe(place));
          console.log(`${themeMap[theme]} (카페 키워드 필터링): ${matched.length}개`);
        } else if (theme === "food") {
          matched = matched.filter(place => isFood(place));
          console.log(`${themeMap[theme]} (맛집 키워드 필터링): ${matched.length}개`);
        }
      } else {
        console.log(`${themeMap[theme]} (contentTypeId: ${contentTypeId}): ${matched.length}개`);
      }
      
      matched.forEach(place => {
        if (!filtered.find(p => p.contentid === place.contentid)) {
          place.matchedTheme = theme;
          filtered.push(place);
        }
      });
    } else {
      console.log(`${themeMap[theme]}: 키워드 방식으로 필터링`);
      
      const matched = places.filter(place => {
        const tags = generateTags(place);
        return tags.includes(theme);
      });
      
      console.log(`${themeMap[theme]} (키워드): ${matched.length}개`);
      
      matched.forEach(place => {
        if (!filtered.find(p => p.contentid === place.contentid)) {
          place.matchedTheme = theme;
          place.tags = generateTags(place);
          filtered.push(place);
        }
      });
    }
  });
  
  return filtered;
}

function filterByPlace(places, placeType) {
  return places.filter(place => {
    if (!place.tags) {
      place.tags = generateTags(place);
    }
    return place.tags.includes(placeType);
  });
}

function generateTags(item) {
  const tags = [];
  const text = `${item.title} ${item.overview || ""} ${item.addr1 || ""}`.toLowerCase();

  for (const tag in TAG_DEFINITIONS) {
    const keywords = TAG_DEFINITIONS[tag].keywords;
    
    if (keywords.some(keyword => text.includes(keyword))) {
      tags.push(tag);
    }
  }

  return tags;
}

// ===========================
// 7. 장소 렌더링 (정보 표시 안함)
// ===========================

function renderPlaces(places) {
  // 빈 함수 - 장소 정보 표시 안함
  console.log("선택된 장소:", places[0]?.title);
}

// ===========================
// 8. 로딩 표시 (제거)
// ===========================

function showLoading() {
  // 로딩 표시 안함
}

function showError(message) {
  console.error("에러:", message);
  alert(message);
}

// ===========================
// 9. API 호출 및 초기화
// ===========================

async function initResult() {
  try {
    showLoading();
    
    // 3페이지(300개) 데이터 요청
    let res = await fetch("/api/busan?pages=3");
    
    if (!res.ok) {
      throw new Error(`API 오류: ${res.status}`);
    }
    
    const data = await res.json();

    if (!data.response || !data.response.body || !data.response.body.items) {
      throw new Error("API 응답 형식이 올바르지 않습니다.");
    }

    const places = data.response.body.items.item;

    if (!Array.isArray(places)) {
      throw new Error("관광지 데이터가 배열 형식이 아닙니다.");
    }

    console.log(`✅ 전체 관광지 수: ${places.length}개`);
    
    console.log("=== contentTypeId 분포 ===");
    const typeCount = {};
    places.forEach(place => {
      const type = place.contenttypeid;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
      const typeName = {
        "12": "관광지",
        "14": "문화시설", 
        "28": "레포츠",
        "39": "음식점"
      }[type] || `기타(${type})`;
      console.log(`${typeName}: ${count}개`);
    });
    console.log("========================");

    console.log("\n=== 1단계: 테마 필터링 ===");
    const themeFiltered = filterByContentType(places, result.theme);
    console.log(`테마 필터링 결과: ${themeFiltered.length}개`);

    console.log("\n=== 2단계: 장소 필터링 ===");
    const finalFiltered = filterByPlace(themeFiltered, result.place);
    console.log(`최종 필터링 결과: ${finalFiltered.length}개`);

    if (finalFiltered.length === 0) {
      console.log("⚠️ 최종 필터링 결과 없음!");
      console.log("테마 필터링만 적용한 결과를 표시합니다.");
      
      if (themeFiltered.length > 0) {
        renderRandomResults(themeFiltered);
        return;
      }
    }

    renderRandomResults(finalFiltered);

  } catch (err) {
    console.error("결과 로딩 실패:", err);
    showError(err.message || "여행지 정보를 불러오는데 실패했습니다.");
  }
}

function renderRandomResults(filtered) {
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const randomized = shuffleArray(filtered);
  
  console.log("\n🎲 랜덤으로 섞인 순서 (상위 5개):");
  randomized.slice(0, 5).forEach((place, index) => {
    console.log(`${index + 1}. ${place.title} (테마: ${themeMap[place.matchedTheme] || "혼합"})`);
  });

  renderPlaces([randomized[0]]);
  
  if (randomized.length > 0) {
    updateMainImage(randomized[0]);
    console.log("\n메인 이미지 업데이트:", randomized[0].title);
  }
  
  // 태그별로 데이터 분류
  organizeDataByTag(randomized);
  isDataReady = true;

  console.log("[READY] keys:", Object.keys(filteredPlacesData));
  console.log("[READY] counts:", Object.fromEntries(
    Object.entries(filteredPlacesData).map(([k,v]) => [k, Array.isArray(v) ? v.length : -1])
  ));
}

// 태그별 데이터 분류 함수
function organizeDataByTag(places) {
  filteredPlacesData = {};
  
  userTags.forEach(tag => {
    if (themeMap[tag]) {
      // 테마 태그
      filteredPlacesData[tag] = places.filter(place => {
        const contentTypeId = contentTypeMap[tag];
        if (contentTypeId) {
          return String(place.contenttypeid) === String(contentTypeId);
        } else {
          if (!place.tags) place.tags = generateTags(place);
          return place.tags.includes(tag);
        }
      });
    } else if (placeMap[tag]) {
      // 장소 태그
      filteredPlacesData[tag] = places.filter(place => {
        if (!place.tags) place.tags = generateTags(place);
        return place.tags.includes(tag);
      });
    }
  });
  
  console.log("\n📊 태그별 데이터 분류:");
  Object.entries(filteredPlacesData).forEach(([tag, data]) => {
    const tagName = themeMap[tag] || placeMap[tag] || tag;
    console.log(`${tagName}: ${data.length}개`);
  });
}
console.log("isDataReady:", isDataReady);
console.log("filteredPlacesData keys:", Object.keys(filteredPlacesData));
console.log("counts:", Object.fromEntries(Object.entries(filteredPlacesData).map(([k,v]) => [k, v.length])));

// ===========================
// 10. 메인 이미지 업데이트
// ===========================

function updateMainImage(place) {
  const mainImg = document.querySelector(".carouselTrack .cItem");
  
  if (!mainImg) {
    console.warn("이미지 요소를 찾을 수 없습니다.");
    return;
  }

  // 부산 대표 이미지 고정
  mainImg.src = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTq4OUIayinHG3aAqJyWT8L4AkdGZxM7-rLkA&s";
  mainImg.alt = "부산 여행";
  mainImg.onerror = function() {
    this.src = "./IMG/travel.jpg";
    console.warn("부산 이미지 로딩 실패");
  };
}

// 1. 기존 로직이 끝나는 지점 혹은 하단에 추가
document.addEventListener("DOMContentLoaded", () => {
  // URL에서 ?region=부산&category=카페 같은 파라미터를 읽어옴
  const urlParams = new URLSearchParams(window.location.search);
  const region = urlParams.get("region");
  const category = urlParams.get("category");

  console.log("URL 파라미터 체크:", { region, category });

  if (region && category) {
    // 탭 UI를 현재 카테고리에 맞춰 활성화 (render-places.js에 있는 함수)
    if (typeof renderTabs === "function") {
      renderTabs(category);
    }
    
    // 핵심: 장소를 불러오는 함수 호출 (이 함수가 Kakao/KTO를 실행해야 함)
    if (typeof fetchPlaces === "function") {
      fetchPlaces(region, category);
    }
  }
});
// ===========================
// 11. 초기 실행
// ===========================

renderHeader();
renderUserTags(userTags);
initResult();