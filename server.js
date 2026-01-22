const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

const SERVICE_KEY ="2fcc44b4d99263a5f44b3e7867fa1eddaec3261ce6f04843d005ee3c7c2d10b7";

// 공통: TourAPI 호출 헬퍼
async function callTourApi(path, params) {
  const base = `https://apis.data.go.kr/B551011/KorService2/${path}`;
  const url = new URL(base);

  // serviceKey는 URLSearchParams가 인코딩 처리하므로 그대로 넣는 게 안전
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelTest");
  url.searchParams.set("_type", "json");

  // 개별 파라미터
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.set(k, String(v));
  });

  // const response = await fetch(url.toString(), { timeout: 15000 });
  // const data = await response.json();
  // return data;
  const finalUrl = url.toString();
  console.log("[TourAPI 요청]", path, params);
  // console.log(finalUrl); // 필요하면 켜

  const res = await fetch(finalUrl);
  const data = await res.json();

  const header = data?.response?.header;
  console.log("[TourAPI 응답]", path, header);

  // ✅ TourAPI 에러코드면 여기서 바로 터뜨려서 원인 보이게
  if (header?.resultCode && header.resultCode !== "0000") {
    throw new Error(`TourAPI Error ${header.resultCode}: ${header.resultMsg}`);
  }

  return data;
}

/**
 * 부산 관광지 목록
 * - areaBasedList2
 */
app.get("/api/busan", async (req, res) => {
  try {
    const data = await callTourApi("areaBasedList2", {
      areaCode: 6,
      contentTypeId: 12,
      numOfRows: 10,
      pageNo: 1,
      arrange : "P"
    });

    res.json(data);
  } catch (err) {
    console.error("Busan API Error:", err);
    res.status(500).json({ error: "Busan API Error" });
  }
});


// 관광지 상세(설명: overview)
app.get("/api/tour/detailCommon2", async (req, res) => {
  try {
    const { contentId } = req.query;
    if (!contentId) {
      return res.status(400).json({ error: "contentId is required" });
    }

    const data = await callTourApi("detailCommon2", {
      contentId,
      overviewYN: "Y",
      addrinfoYN: "Y",
      mapinfoYN: "Y",
      firstimageYN: "Y",  // ⭐ 수정: firstimageYN → firstImageYN (대소문자)
      defaultYN: "Y",
    });

    // ⭐ 수정: 응답 데이터 존재 여부 먼저 확인
    const items = data?.response?.body?.items;
    if (!items || !items.item) {
      return res.status(502).json({ error: "TourAPI returned no items", contentId, raw: data });
    }

    const item = items.item;
    const one = Array.isArray(item) ? item[0] : item;

    console.log("detailCommon contentId:", contentId);
    console.log("detailCommon header:", data?.response?.header);
    console.log("detailCommon item:", one);  // ⭐ 추가: 실제 데이터 확인용

    // 프론트에서 쓰기 쉽게 정리해서 내려줌
    res.json({
      contentId,
      title: one?.title ?? "",
      addr1: one?.addr1 ?? "",
      mapx: one?.mapx ?? "",
      mapy: one?.mapy ?? "",
      firstimage: one?.firstimage ?? "",
      overview: one?.overview ?? "",
      raw: data,
    });

  } catch (err) {
    console.error("DetailCommon API Error:", err);
     res.status(502).json({ error: err.message || "TourAPI call failed" });
  }
});

// 관광지 이미지들
 
 // /api/tour/detailImage?contentId=xxxx

app.get("/api/tour/detailImage", async (req, res) => {
  try {
    const { contentId } = req.query;
    if (!contentId) {
      return res.status(400).json({ error: "contentId is required" });
    }

    const data = await callTourApi("detailImage2", {
      contentId,
      imageYN: "Y",
      subImageYN: "Y",
      numOfRows: 50,
      pageNo: 1,
    });

    const item = data?.response?.body?.items?.item;
    const list = Array.isArray(item) ? item : item ? [item] : [];

    // 프론트에서 바로 쓰기 좋게 배열만 내려줌
    res.json(list);
  } catch (err) {
    console.error("DetailImage API Error:", err);
    res.status(500).json({ error: "DetailImage API Error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행됨 → http://localhost:${PORT}`);
});
