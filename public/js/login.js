// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDMjrnoxiiQlHc2T_8ciDcC9oclxAKHmbE",
    authDomain: "minnn-b3651.firebaseapp.com",
    databaseURL: "https://minnn-b3651-default-rtdb.firebaseio.com",
    projectId: "minnn-b3651",
    storageBucket: "minnn-b3651.firebasestorage.app",
    messagingSenderId: "298266980930",
    appId: "1:298266980930:web:e5adc738c1e5ba3705f3db",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM 요소
const body = document.getElementById("body");
const popupArea = document.getElementById("popupArea");

// 로그인 input
const userV = document.getElementById("user");
const passV = document.getElementById("pass");
const loginBtn = document.getElementById("loginBtn");
const signUpBtnL = document.getElementById("signUpBtnL");

// 회원가입 input
const signUpUser = document.getElementById("signUpUser");
const signUpName = document.getElementById("signUpName");
const signUpPass = document.getElementById("signUpPass");
const signUpPassV = document.getElementById("signUpPassV");
const signUpBtnS = document.getElementById("signUpBtnS");

const messageV = document.getElementById("message");

// 페이지 로드 시 자동으로 팝업 열기 (login.html 페이지일 때만)
window.addEventListener('DOMContentLoaded', () => {
    // header가 없으면 login.html 페이지로 판단
    if (!document.querySelector('header')) {
        openPopup();
    }
});

// 팝업 열기
const openPopup = (target) => {
    popupArea.style.display = "block";
    popupArea.offsetHeight;
    popupArea.classList.add("show");

    if (target === "signup") {
        popupArea.classList.add("signup");
    } else {
        popupArea.classList.remove("signup");
    }

    resetForm();
};

// 팝업 닫기
const closePopup = () => {
    popupArea.classList.remove("show");

    setTimeout(() => {
        popupArea.style.display = "none";
    }, 400);
};

// 로그인 내부 회원가입 버튼 → 회원가입 탭
signUpBtnL.addEventListener("click", () => {
    popupArea.classList.add("signup");
    resetForm();
});

// 배경 클릭 시 닫기 (다른 페이지에서 팝업으로 사용할 때만)
body.addEventListener("click", (e) => {
    if (e.target === body && document.querySelector('header')) {
        closePopup();
    }
});

// 폼 초기화
const resetForm = () => {
    userV.value = "";
    passV.value = "";
    signUpUser.value = "";
    signUpName.value = "";
    signUpPass.value = "";
    signUpPassV.value = "";
    clearMessage();
};

// 회원가입
const signUp = () => {
    const email = signUpUser.value.trim();
    const name = signUpName.value.trim();
    const password = signUpPass.value.trim();
    const passwordVerify = signUpPassV.value.trim();

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

    // 입력값 검증
    if (!email && !name && !password && !passwordVerify) {
        showMessage("회원가입 정보를 입력해주세요.", "error", 1500);
        return;
    }
    if (!email) {
        showMessage("이메일을 입력해주세요.", "error", 1500);
        return;
    }
    if (!name) {
        showMessage("닉네임을 입력해주세요.", "error", 1500);
        return;
    }
    if (!password) {
        showMessage("비밀번호를 입력해주세요.", "error", 1500);
        return;
    }
    if (!passwordVerify) {
        showMessage("비밀번호 확인을 입력해주세요.", "error", 1500);
        return;
    }
    if (!passwordRegex.test(password)) {
        showMessage("비밀번호는 영문+숫자 조합 6자 이상이어야 합니다.", "error", 1500);
        return;
    }
    if (password !== passwordVerify) {
        showMessage("비밀번호가 일치하지 않습니다.", "error", 1500);
        signUpPassV.focus();
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return user.updateProfile({
                displayName: name
            });
        })
        .then(() => {
            showMessage("회원이 되신걸 축하합니다. 로그인 해주세요.", "success", 1500);
            setTimeout(() => {
                popupArea.classList.remove("signup");
            }, 1500);
        })
        .catch((error) => {
            let errorCode = error.code;
            if (errorCode === "auth/email-already-in-use") {
                showMessage("이미 있는 계정입니다.", "error", 1500);
            } else if (error.code === "auth/invalid-email") {
                showMessage("이메일을 제대로 입력해주세요.", "error", 1500);
            }
        });
};

// 로그인
const login = () => {
    let loginEmail = userV.value.trim();
    let loginPassword = passV.value.trim();

    if (!loginEmail && !loginPassword) {
        showMessage("이메일과 비밀번호를 입력해주세요.", "error");
        return;
    }

    if (!loginEmail) {
        showMessage("이메일을 입력해주세요.", "error", 1500);
        userV.focus();
        return;
    }

    if (!loginPassword) {
        showMessage("비밀번호를 입력해주세요.", "error", 1500);
        passV.focus();
        return;
    }

    auth.signInWithEmailAndPassword(loginEmail, loginPassword)
        .then((userCredential) => {
            const user = userCredential.user;
            const name = user.displayName || "회원";

            showMessage(`환영합니다, ${name}님!`, "success", 1500);
            
            setTimeout(() => {
                // 다른 페이지에서 왔으면 팝업만 닫기, login.html이면 main.html로 이동
                if (document.querySelector('header')) {
                    closePopup();
                    resetForm();
                } else {
                    window.location.href = 'main.html';
                }
            }, 1500);
        })
        .catch((error) => {
            console.log(error.code);
            if (error.code === "auth/invalid-login-credentials" ||
                error.code === "auth/invalid-credential") {
                showMessage("이메일 또는 비밀번호가 올바르지 않습니다.", "error", 1500);
            } else if (error.code === "auth/invalid-email") {
                showMessage("이메일 형식이 올바르지 않습니다.", "error", 1500);
            }
        });
};

// 메시지 표시
const showMessage = (msg, type, duration = 1000) => {
    clearMessage();

    messageV.innerText = msg;
    messageV.classList.add("show", type);

    setTimeout(hideMessage, duration);
};

const hideMessage = () => {
    messageV.classList.remove("show");

    setTimeout(() => {
        messageV.innerText = "";
        messageV.classList.remove("success", "error");
    }, 250);
};

const clearMessage = () => {
    messageV.classList.remove("show", "success", "error");
    messageV.innerText = "";
};

// 이벤트 리스너
signUpBtnS.addEventListener("click", signUp);
loginBtn.addEventListener("click", login);