const questionEl = document.getElementById("question");
const buttonsEl = document.getElementById("buttons");

const questions = [
  {
    key: "companion",
    question: "누구와 함께 가실 건가요?",
    multi: false,
    answers: [
      { text: "친구", value: "friend" },
      { text: "가족", value: "family" },
      { text: "연인", value: "couple" }
    ]
  },
  {
    key: "theme",
    question: "여행 테마를 선택해주세요 (최대 2개까지 선택 가능)",
    multiple: true,
    maxSelect: 2,
    answers: [
      { text: "관광지", value: "culture" },
      { text: "맛집", value: "food" },
      { text: "카페", value: "cafe" },
      { text: "인생샷", value: "photo" },
      { text: "액티비티", value: "activity" }
    ]
  },
  {
    key: "place",
    question: "선호하는 장소는?",
    multi: false,
    answers: [
      { text: "바다", value: "ocean" },
      { text: "도심", value: "city" },
      { text: "산", value: "mountain" }
    ]
  }
];

let currentIndex = 0;
let selectedAnswers = [];
let answersResult = {};

function renderQuestion() {
  const q = questions[currentIndex];

  questionEl.textContent = q.question;
  buttonsEl.innerHTML = "";
  selectedAnswers = [];

  // 다음 버튼 영역 제거
  const oldNext = document.getElementById("nextArea");
  if (oldNext) oldNext.remove();

  q.answers.forEach(answer => {
    const btn = document.createElement("button");
    btn.textContent = answer.text;
    btn.dataset.value = answer.value;

    btn.addEventListener("click", () => {
      if (q.multi === false) {
        // 단일 선택 → 즉시 다음 질문
        answersResult[q.key] = answer.value;
        goNext();
      } else {
        // 복수 선택
        toggleSelect(btn, answer.value, q.maxSelect);
      }
    });

    buttonsEl.appendChild(btn);
  });

  // 복수 선택일 때만 다음 버튼 생성
  if (q.multiple) {
    renderNextButton(q.key);
  }
}

function toggleSelect(button, value, max) {
  const index = selectedAnswers.indexOf(value);

  if (index > -1) {
    selectedAnswers.splice(index, 1);
    button.classList.remove("selected");
  } else {
    if (selectedAnswers.length >= max) {
      Swal.fire({
        title: "잠시만요!",
        text: `최대 ${max}개까지 선택할 수 있습니다.`,
        icon: "error"
      });
      return;
    }
    selectedAnswers.push(value);
    button.classList.add("selected");
  }
}

function renderNextButton(key) {
  const nextArea = document.createElement("div");
  nextArea.id = "nextArea";
  nextArea.style.marginTop = "30px";
  nextArea.style.textAlign = "center";

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "다음";

  nextBtn.addEventListener("click", () => {
    if (selectedAnswers.length === 0) {
      Swal.fire({
        title: "잠시만요!",
        text: `최소 1개 이상 선택해주세요!.`,
        icon: "error"
      });
      return;
    }
    answersResult[key] = [...selectedAnswers];
    goNext();
  });

  nextArea.appendChild(nextBtn);
  buttonsEl.after(nextArea);
}

function goNext() {
  currentIndex++;

  if (currentIndex >= questions.length) {
    // 결과 저장
    localStorage.setItem(
      "travelResult",
      JSON.stringify(answersResult)
    );

    Swal.fire({
      title: "Good job!",
      text: "질문이 모두 끝났습니다!",
      icon: "success"
    });
    window.location.href = "loading.html";
    return;
  }

  renderQuestion();
}

// 최초 실행
renderQuestion();
