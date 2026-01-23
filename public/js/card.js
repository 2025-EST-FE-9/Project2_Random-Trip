const KEY="1fb55d90094ac835cb99d10619aadd6cd8ef915ae09349382fc18fcde7f8bdd6";
const list=document.getElementById("list");
const modal=document.getElementById("modal");
const sliderTrack=document.getElementById("sliderTrack");
const prevBtn=document.getElementById("prevBtn");
const nextBtn=document.getElementById("nextBtn");
const mTitle=document.getElementById("mTitle");
const mTags=document.getElementById("mTags");
const mAddress=document.getElementById("mAddress");
const mDistance=document.getElementById("mDistance");
const modalMapBtn=document.getElementById("modalMapBtn");

let userLat=null,userLng=null;
navigator.geolocation.getCurrentPosition(pos=>{userLat=pos.coords.latitude; userLng=pos.coords.longitude;});

let currentIndex=0, images=[], startX=0, endX=0;

function calcDistance(lat1,lon1,lat2,lon2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2);
}
function openMap(lat,lng,title){ window.open(`https://map.kakao.com/link/map/${title},${lat},${lng}`); }

async function getRandomBusanImage(){
  const res=await fetch(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${KEY}&areaCode=6&contentTypeId=12&numOfRows=20&pageNo=1&MobileOS=ETC&MobileApp=App&_type=json`);
  const data=await res.json();
  const items=data.response.body.items.item||[];
  const imgItems=items.filter(i=>i.firstimage).map(i=>i.firstimage);
  return imgItems.length===0?"https://via.placeholder.com/400x300?text=부산관광지":imgItems[Math.floor(Math.random()*imgItems.length)];
}

fetch(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${KEY}&areaCode=6&contentTypeId=12&numOfRows=8&pageNo=1&MobileOS=ETC&MobileApp=App&_type=json`)
.then(res=>res.json())
.then(async data=>{
  const items=data.response.body.items.item||[];
  for(const item of items){
    const guMatch=item.addr1?item.addr1.match(/부산광역시\s(\S+)구/):null;
    const guTag=guMatch?`#${guMatch[1]}`:"#부산구";
    const nameTag=`#${item.title.replace(/\s/g,"")}`;
    const staticTags=["#관광지","#사진"];
    const tags=["#부산", guTag, nameTag, ...staticTags];
    const imgUrl=item.firstimage||await getRandomBusanImage();
    
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <img src="${imgUrl}" class="card-bg">
      <div class="overlay">
        <div class="icon-box"><img src="./img/wishlist.png" class="icon" alt="위시리스트"></div>
        <h3>${item.title}</h3>
        <p class="address">${item.addr1||"주소 없음"}</p>
        <p class="distance">${userLat?`거리 약 ${calcDistance(userLat,userLng,item.mapy,item.mapx)} km`:"거리 불가"}</p>
        <div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="card-btns">
          <button class="card-btn" onclick="event.stopPropagation();openMap(${item.mapy},${item.mapx},'${item.title}')">카카오맵</button>
        </div>
      </div>
    `;
    card.onclick=()=>openModal(item.contentid,item.title,item.addr1,item.mapy,item.mapx);
    list.appendChild(card);
  }
});

function openModal(contentid,title,address,mapy,mapx){
  modal.style.display="flex";
  sliderTrack.innerHTML="";
  mTitle.innerText=title;
  mAddress.innerText=address||"주소 없음";
  mTags.innerHTML="";
  mDistance.innerText=userLat?`거리 약 ${calcDistance(userLat,userLng,mapy,mapx)} km`:"거리 불가";
  currentIndex=0; images=[];

  modalMapBtn.onclick=()=>openMap(mapy,mapx,title);

  const guMatch=address?address.match(/부산광역시\s(\S+)구/):null;
  const guTag=guMatch?`#${guMatch[1]}`:"#부산구";
  const nameTag=`#${title.replace(/\s/g,"")}`;
  const staticTags=["#관광지","#사진"];
  const modalTags=["#부산", guTag, nameTag, ...staticTags];
  mTags.innerHTML=modalTags.map(t=>`<span class="tag">${t}</span>`).join("");

  // 모달 슬라이더 이미지
  fetch(`https://apis.data.go.kr/B551011/KorService2/detailImage2?serviceKey=${KEY}&contentId=${contentid}&imageYN=Y&MobileOS=ETC&MobileApp=App&_type=json`)
  .then(r=>r.json())
  .then(async d=>{
    const imgItems=d.response?.body?.items?.item;
    if(!imgItems || (Array.isArray(imgItems) && imgItems.length === 0)){
      images=[await getRandomBusanImage()];
    } else if(Array.isArray(imgItems)){
      images=imgItems.slice(0,4).map(i=>i.originimgurl);
    } else {
      images=[imgItems.originimgurl];
    }
    sliderTrack.innerHTML=images.map(img=>`<img src="${img}">`).join("");
    updateSlider();
  });
}

function updateSlider(){ sliderTrack.style.transform=`translateX(-${currentIndex*100}%)`; }
prevBtn.onclick=()=>{ if(images.length===0) return; currentIndex=(currentIndex-1+images.length)%images.length; updateSlider(); }
nextBtn.onclick=()=>{ if(images.length===0) return; currentIndex=(currentIndex+1)%images.length; updateSlider(); }

document.getElementById("closeBtn").onclick=()=>{ modal.style.display="none"; };
modal.onclick=e=>{ if(e.target===modal) modal.style.display="none"; };