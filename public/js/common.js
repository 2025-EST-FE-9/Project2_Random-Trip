
// ============= Header 자동 생성 =============
function createHeader() {
    const headerHTML = `
        <header>
            <div id="headerContainer">
                <div id="headerHomeBtn">
                    <a href="main.html">
                        <img src="./IMG/rogo.png" alt="로고">
                    </a>
                </div>

                <div id="headerBtns">
                    <button class="headerBtn1">
                        <img src="./IMG/login.png" class="btnIcon" alt="로그인">
                    </button>
                    <button class="headerBtn2">
                        <img src="./IMG/bookmark.png" class="btnIcon" alt="즐겨찾기">
                    </button>
                </div>
            </div>
        </header>
    `;

    // #header 요소를 찾아서 그 안에 header 삽입
    const headerContainer = document.getElementById('header');
    if (headerContainer) {
        headerContainer.innerHTML = headerHTML;
    }
}

// ============= Header 버튼 이벤트 =============
function initHeaderEvents() {
    // 로그인 버튼
    const loginBtn = document.querySelector('#headerBtns .headerBtn1');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    // 즐겨찾기 버튼
    const bookmarkBtn = document.querySelector('#headerBtns .headerBtn2');
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => {
            console.log('즐겨찾기 클릭');
            // 나중에 즐겨찾기 기능 추가
        });
    }
}

// ============= 초기화 =============
document.addEventListener('DOMContentLoaded', () => {
    // #header 요소가 있으면 header 생성
    if (document.getElementById('header')) {
        createHeader();
    }
    
    // header 버튼 이벤트 등록
    initHeaderEvents();
});