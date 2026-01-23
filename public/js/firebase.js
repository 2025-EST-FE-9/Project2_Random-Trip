// Firebase SDK 불러오기 (CDN 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

//형민 firebase
const firebaseConfig = {
    apiKey: "AIzaSyDMjrnoxiiQlHc2T_8ciDcC9oclxAKHmbE",
    authDomain: "minnn-b3651.firebaseapp.com",
    databaseURL: "https://minnn-b3651-default-rtdb.firebaseio.com/",
    projectId: "minnn-b3651",
    storageBucket: "minnn-b3651.firebasestorage.app",
    messagingSenderId: "298266980930",
    appId: "1:298266980930:web:e5adc738c1e5ba3705f3db",
    measurementId: "G-GRW9ZD4H9K"
  };

// 앱 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 즐겨찾기 컬렉션 이름
const FAV_COLLECTION = "favorites"; 

/**
 * 1. 즐겨찾기 추가 (저장)
 * - id를 문서 이름으로 써서 중복 저장을 방지하고 찾기 쉽게 만듭니다.
 */
export async function addFavorite(place) {
  try {
    const docRef = doc(db, FAV_COLLECTION, String(place.id));
    // Firestore에 저장할 데이터 (필요한 것만 추려서)
    await setDoc(docRef, {
      id: String(place.id),
      title: place.title,
      addr1: place.raw?.addr1 || "", // 주소
      mapx: place.lng,
      mapy: place.lat,
      firstimage: place.image, // 이미지 URL
      source: "FAV", // 소스 표시
      createdAt: new Date().toISOString() // 저장 시간
    });
    console.log("즐겨찾기 저장 성공:", place.title);
    return true;
  } catch (e) {
    console.error("즐겨찾기 저장 실패:", e);
    return false;
  }
}

/**
 * 2. 즐겨찾기 삭제
 */
export async function removeFavorite(placeId) {
  try {
    const docRef = doc(db, FAV_COLLECTION, String(placeId));
    await deleteDoc(docRef);
    console.log("즐겨찾기 삭제 성공:", placeId);
    return true;
  } catch (e) {
    console.error("즐겨찾기 삭제 실패:", e);
    return false;
  }
}

/**
 * 3. 즐겨찾기 목록 전체 가져오기
 */
export async function getFavorites() {
  try {
    const querySnapshot = await getDocs(collection(db, FAV_COLLECTION));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  } catch (e) {
    console.error("목록 가져오기 실패:", e);
    return [];
  }
}

/**
 * 4. 이미 즐겨찾기 된 항목인지 확인 (ID로 체크)
 */
export async function checkIsFavorite(placeId) {
  try {
    const docRef = doc(db, FAV_COLLECTION, String(placeId));
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (e) {
    return false;
  }
}
export const RTDB_BASE = firebaseConfig.databaseURL.replace(/\/$/, "");