const container = document.getElementById("mainContainer");
const text = document.querySelector(".mainTextWrapper");

/* 마우스 따라 살짝 이동 */
container.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 20;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;

  text.style.transform =
    `translate(-50%, -50%) translate(${x}px, ${y}px)`;
});

/* 마우스 나가면 원위치 */
container.addEventListener("mouseleave", () => {
  text.style.transform = "translate(-50%, -50%)";
});

/* 버튼 이동 */
const moveBtn = document.getElementById("moveBtn");
moveBtn.addEventListener("click", () => {
  location.href = "test.html";
});

