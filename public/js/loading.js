   setTimeout(() => {
      location.href = "result.html";
    }, 2500);
    const dice = document.getElementById("dice");
const diceFace = document.getElementById("diceFace");

const icons = ["✈️", "🗺️", "📸"];

let speed = 80;
let count = 0;
let interval;

function rollIcon() {
  interval = setInterval(() => {
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];
    diceFace.textContent = randomIcon;
    count++;

    // 감속 시작
    if (count > 12) {
      clearInterval(interval);
      speed += 40;
      count = 0;

      if (speed < 300) {
        rollIcon();
      } else {
        stopRoll();
      }
    }
  }, speed);
}

function stopRoll() {
  clearInterval(interval);

  const finalIcon = icons[Math.floor(Math.random() * icons.length)];
  diceFace.textContent = finalIcon;

  // 흔들림 정지
  dice.style.animation = "none";

  // 결과 페이지 이동
  setTimeout(() => {
    location.href = "result.html";
  }, 1300);
}

rollIcon();
