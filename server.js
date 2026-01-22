require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SERVICE_KEY = process.env.TOUR_SERVICE_KEY;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!SERVICE_KEY) {
  throw new Error("TOUR_SERVICE_KEY is missing. Set it in .env");
}
/**
 * 정적파일 서빙(팀원 화면 안 깨지게)
 * - /public 폴더가 있으면 그걸 우선 서빙
 * - 없으면 현재 폴더(__dirname) 서빙 (팀원 기존 방식 호환)
 */
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
} else {
  app.use(express.static(__dirname));
}

/**
 * 공통: TourAPI 호출 헬퍼 (URLSearchParams로 인코딩 안전)
 */
async function callTourApi(pathName, params) {
  const base = `https://apis.data.go.kr/B551011/KorService2/${pathName}`;
  const url = new URL(base);

  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelTest");
  url.searchParams.set("_type", "json");

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  const finalUrl = url.toString();
  console.log("[TourAPI 요청]", pathName, params);

  const res = await fetch(finalUrl);
  const data = await res.json();

  const header = data?.response?.header;
  console.log("[TourAPI 응답]", pathName, header);

  // TourAPI 에러 코드면 명확히 터뜨리기
  if (header?.resultCode && header.resultCode !== "0000") {
    throw new Error(`TourAPI Error ${header.resultCode}: ${header.resultMsg}`);
  }

  return data;
}

/**
 * ==========================================
 * 1) 팀원 UI 호환: /api/busan?pages=N (다중 페이지)
 *    - 응답 형식: TourAPI와 동일한 구조로 합쳐서 반환
 * ==========================================
 */
app.get("/api/busan", async (req, res) => {
  try {
    // 팀원 코드 호환: pages 기본 2
    const totalPages = parseInt(req.query.pages, 10) || 2;

    // 확장(선택): contentTypeId/arrange/areaCode 바꿀 수 있게
    const areaCode = req.query.areaCode || 6;
    const contentTypeId = req.query.contentTypeId; // 없으면 전체
    const arrange = req.query.arrange || "P";

    // pages 모드에서 페이지당 100개
    const numOfRows = parseInt(req.query.numOfRows, 10) || 100;

    const allItems = [];

    console.log(`📡 /api/busan 시작: ${totalPages}페이지 수집 (페이지당 ${numOfRows})`);

    for (let page = 1; page <= totalPages; page++) {
      const data = await callTourApi("areaBasedList2", {
        areaCode,
        contentTypeId, // undefined면 자동 제외
        arrange,
        numOfRows,
        pageNo: page,
      });

      const items = data?.response?.body?.items?.item;

      if (Array.isArray(items)) {
        allItems.push(...items); // ✅ 팀원 코드 버그 수정: allItems.push(.items) → push(...items)
        console.log(`  ✅ page ${page}/${totalPages}: ${items.length}개 (누적 ${allItems.length})`);
      } else if (items) {
        allItems.push(items);
        console.log(`  ✅ page ${page}/${totalPages}: 1개 (누적 ${allItems.length})`);
      } else {
        console.log(`  ⚠️ page ${page}/${totalPages}: 데이터 없음`);
      }

      if (page < totalPages) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // 팀원 UI 호환: 원본 TourAPI 형태로 감싸서 반환
    res.json({
      response: {
        body: {
          items: { item: allItems },
          totalCount: allItems.length,
          pageNo: 1,
          numOfRows: allItems.length,
        },
        header: {
          resultCode: "0000",
          resultMsg: "OK",
        },
      },
    });
  } catch (err) {
    console.error("❌ /api/busan Error:", err);
    res.status(500).json({
      error: "Busan API Error",
      message: err.message,
    });
  }
});

/**
 * ==========================================
 * 2) 팀원 UI 호환: /api/images/:contentId (원본 형태 그대로 반환)
 * ==========================================
 */
app.get("/api/images/:contentId", async (req, res) => {
  try {
    const { contentId } = req.params;

    const data = await callTourApi("detailImage2", {
      contentId,
      imageYN: "Y",
      subImageYN: "Y",
      numOfRows: 50,
      pageNo: 1,
    });

    // 팀원은 원본 형태를 기대할 수 있으니 그대로 반환
    res.json(data);
  } catch (err) {
    console.error("❌ /api/images Error:", err);
    res.status(500).json({
      error: "Image API Error",
      message: err.message,
      items: [],
    });
  }
});

/**
 * ==========================================
 * 3) 너 프론트 호환: /api/tour/detailImage?contentId=xxxx
 *    - 프론트에서 배열(list)만 쓰기 쉽게 반환
 * ==========================================
 */
app.get("/api/tour/detailImage", async (req, res) => {
  try {
    const { contentId } = req.query;
    if (!contentId) return res.status(400).json({ error: "contentId is required" });

    const data = await callTourApi("detailImage2", {
      contentId,
      imageYN: "Y",
      subImageYN: "Y",
      numOfRows: 50,
      pageNo: 1,
    });

    const item = data?.response?.body?.items?.item;
    const list = Array.isArray(item) ? item : item ? [item] : [];
    res.json(list);
  } catch (err) {
    console.error("❌ /api/tour/detailImage Error:", err);
    res.status(500).json({ error: "DetailImage API Error", message: err.message });
  }
});

/**
 * ==========================================
 * 4) 너 프론트 호환: /api/tour/detailCommon2?contentId=xxxx
 *    + alias: /api/tour/detailCommon?contentId=xxxx (프론트 깨짐 방지)
 * ==========================================
 */
async function handleDetailCommon(req, res) {
  try {
    const { contentId } = req.query;
    if (!contentId) return res.status(400).json({ error: "contentId is required" });

    // TourAPI 파라미터는 문서/버전에 따라 케이스 혼란이 있었으니 안전하게 쓰는 조합:
    const data = await callTourApi("detailCommon2", {
      contentId,
      defaultYN: "Y",
      firstImageYN: "Y",
      addrinfoYN: "Y",
      mapinfoYN: "Y",
      overviewYN: "Y",
    });

    const items = data?.response?.body?.items;
    if (!items || !items.item) {
      return res.status(502).json({ error: "TourAPI returned no items", contentId, raw: data });
    }

    const item = items.item;
    const one = Array.isArray(item) ? item[0] : item;

    res.json({
      contentId,
      title: one?.title ?? "",
      addr1: one?.addr1 ?? "",
      mapx: one?.mapx ?? "",
      mapy: one?.mapy ?? "",
      firstimage: one?.firstimage ?? "",
      overview: one?.overview ?? "",
      raw: data, // 필요 없으면 프론트에서 안 쓰게 제거 가능
    });
  } catch (err) {
    console.error("❌ /api/tour/detailCommon Error:", err);
    res.status(502).json({ error: err.message || "TourAPI call failed" });
  }
}

app.get("/api/tour/detailCommon2", handleDetailCommon);
app.get("/api/tour/detailCommon", handleDetailCommon); // ✅ alias (프론트/팀원 코드 깨짐 방지)

/**
 * ==========================================
 * 5) (선택) Kakao Proxy가 필요하면 여기 추가
 *    - results.js에서 /api/kakao/search 호출하는 경우 대비
 * ==========================================
 */
app.get("/api/kakao/search", async (req, res) => {
  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_API_KEY) {
    return res.status(501).json({ error: "KAKAO_REST_API_KEY not set" });
  }

  try {
    const { category, query } = req.query;
    if (!category || !query) {
      return res.status(400).json({ error: "category and query are required" });
    }

    const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
    url.searchParams.set("category_group_code", category);
    url.searchParams.set("query", query);

    // 부산 중심 근처로 제한(원하면 파라미터로 받게 확장 가능)
    url.searchParams.set("y", "35.1795543");
    url.searchParams.set("x", "129.0756416");
    url.searchParams.set("radius", "20000");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Kakao API Error:", err);
    res.status(500).json({ error: "Kakao API Error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 통합 서버 실행됨 → http://localhost:${PORT}`);
  console.log(`📍 부산 API: http://localhost:${PORT}/api/busan?pages=2`);
  console.log(`🖼️ 이미지(팀원): http://localhost:${PORT}/api/images/{contentId}`);
  console.log(`🖼️ 이미지(프론트): http://localhost:${PORT}/api/tourT: http://localhost:${PORT}/api/tour/detailImage?contentId=...`);
});
