# 🕯️ WAX-PPU (왁뿌!) ASMR Simulator

> 스트레스 해소를 위한 바삭바삭 왁스 뿌시기 & 쫀득쫀득 모찌 말랑이 ASMR 피젯 토이 시뮬레이터입니다.

---

## ✨ 주요 기능 (Key Features)

### 1. 🕯️ 왁스 뿌시기 모드 (Wax Shattering)
- 중심 왁스를 클릭하면 8단계 깨진 텍스처로 랜덤 변경되며 균열 연출
- 클릭 지점에서 폭발하듯 튀어나가는 2D 물리 삼각형 파편(Shard) 애니메이션
- 실시간 디코딩 기반 9가지 크랙 ASMR 사운드 무작위 재생

### 2. 🐾 모찌 말랑이 모드 (Mochi Squishy Toy)
- **고양이 젤리 발바닥** 및 **모찌 찹쌀떡 토끼** 2가지 캐릭터 선택
- **부피 보존 젤리 탄성 (Squash & Stretch):** 누른 축은 푹 꺼지고 반대편은 볼록해지는 리얼 실리콘 물리
- **드래그 주무르기:** 손가락을 따라 슬라임처럼 쫀득하게 늘어나는 텐션
- **손 뗄 때 탄성 복원:** 감쇠 조화 진동으로 "탕-! 파르르~" 떨리며 제자리 복원
- 누를 때마다 즉각 반응하는 7종의 찰진 ASMR 사운드 및 하트/별빛 파티클

### 3. 📖 실시간 방명록 (Guestbook)
- Google Firebase Cloud Firestore 연동 익명 방명록
- 페이징 더보기(5개씩) 및 XSS 방어 인젝션 차단
- 오프라인 환경에서도 작동하는 LocalStorage 자동 폴백

### 4. 📱 모바일 터치 최적화
- 왁스/말랑이 영역 내 터치와 바깥 흰색 여백 터치를 분리하여, 오브젝트 조작과 모바일 페이지 스크롤이 자연스럽게 공존

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend:** HTML5 Canvas 2D, Vanilla JavaScript (ES6+), CSS3 (Glassmorphism & Flex/Grid)
- **Audio Engine:** Web Audio API (Zero-latency AudioBuffer decoding & dynamic pitch modulation)
- **Backend/DB:** Google Firebase Firestore
- **Hosting:** Serverless Static Hosting (Netlify)

---

## 👤 Creator
- **Made By:** 조연우
- **Contact:** 010-4535-5501
- **Donation:** 농협 3021300241541
