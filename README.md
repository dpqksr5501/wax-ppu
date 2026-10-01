# WAX-PPU (왁뿌!) ASMR Simulator

HTML5 Canvas와 Web Audio API를 사용하는 웹 ASMR 시뮬레이터입니다. 왁스 파쇄와 모찌 변형을 조작할 수 있으며, Firestore 기반 방명록을 제공합니다. 제작: 조연우.

## 실행

Node.js 24와 pnpm 11.25.0을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

VS Code에서 폴더를 열고 추천 확장(Prettier, Playwright)을 사용합니다. F5 디버깅은 먼저 `pnpm dev`를 실행합니다. 개발 주소는 `http://localhost:5173`입니다. `file://` 실행은 지원하지 않습니다.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm preview
```

Windows의 설치된 Edge로 검사하려면 PowerShell에서 `$env:PLAYWRIGHT_CHANNEL='msedge'`를 설정합니다. 브라우저 검사는 최신 `pnpm build` 후 실행합니다. 검사 전용 5174/4174는 운영 DB에 글을 쓰지 않습니다.

## 구조

```text
src/main.ts               화면 연결·초기화·설정
src/config.js             공통 설정·촉감 프리셋
src/core/                 입력, 논리 좌표/DPR, 루프, 에셋, 저장
src/simulations/physics.js 왁스 파편·모찌 변형 물리
src/rendering/renderer.js  본체·텍스처 파편·그림자 렌더링
src/audio/engine.js        버퍼 캐시·합성 폴백·보이스 수명
src/guestbook/             데이터 검증, UI, 지연 로딩 Firebase adapter
public/assets/            기존 PNG/M4A + 무손실 WebP
build/offline.ts           운영 service worker 생성
tests/                    단위·브라우저 검사
```

앱 연결과 Firebase adapter는 TypeScript, 기존 엔진과 작은 모듈은 ES Modules JavaScript입니다. 기존 물리 동작을 유지하면서 단계적으로 타입을 도입했습니다. Node 내장 테스트 러너를 사용합니다. GitHub Actions는 타입·단위·빌드·브라우저 검사를 수행합니다. 브라우저 실행에 불필요한 Firebase util/protobufjs 설치 스크립트는 pnpm 정책에서 실행하지 않습니다.

## 주요 기능과 성능

- 왁스: 클릭과 드래그로 균열 텍스처를 변경하고 삼각형 파편을 생성합니다. 파편에는 중력과 바닥 충돌을 적용하며, 텍스처는 생성 시점에 고정합니다.
- 왁스 모드의 ‘새 왁스로 바꾸기’ 버튼으로 파편을 정리하고 초기 상태로 복원합니다.
- 모찌: 고양이 발바닥과 찹쌀떡 토끼를 선택할 수 있습니다. 누르는 방향에 따라 형태가 변하고, 드래그하면 이동 방향으로 늘어납니다. 손을 떼면 감쇠 진동으로 원래 형태로 복원됩니다.
- 기본·부드러운 변형·높은 탄성의 세 가지 촉감 프리셋을 제공합니다. 기본 프리셋은 기존 물리 계수를 사용합니다.
- 집중 모드(Escape로 해제), 캔버스 키보드 조작(Enter/Space), 음소거.
- 볼륨·모드·캐릭터·촉감·소리·진동·모션 설정을 기기에 저장합니다. 시스템 모션 감소 설정은 첫 방문에 반영합니다.
- DPR 상한 2, 논리 520×520 좌표, 60Hz 고정 물리 스텝. 정지 상태에서 RAF 휴식.
- 모바일 중앙 조작/바깥 여백 스크롤. 활성 터치 ID 추적, blur/cancel/모드 변경 복구.
- WebP 우선, PNG/한국어 파일명 폴백. 이미지 하나 실패해도 정상 이미지 사용. 이미지 동시 로딩 제한, 모찌 모드 지연 로딩.
- 사운드는 사용 모드만 3개 병렬 로딩. 합성 폴백, 최대 보이스 12, 종료 시 노드 해제, compressor와 볼륨 ramp.
- 최신 방명록 10개 실시간 구독, 과거 10개씩 커서 조회. 탭 숨김 60초 후 구독 해제.
- 글자 수(UTF-16 maxlength 기준), 제출 가드, 10초 클라이언트 쿨다운, 타입 검증과 textContent 출력.
- 명시적 기기 전용 저장. 기존 `wax_guestbook_messages` 기록을 읽고 자동 업로드하지 않습니다.
- 운영 PWA: 오프라인 shell과 사용한 동일 출처 에셋 캐시. 미사용 에셋은 벡터/합성 폴백. Firebase·외부 요청은 캐시하지 않습니다.
- 1200×630 공유 이미지, favicon, 터치 아이콘, OG/Twitter 메타데이터.

모찌는 시각적인 squash/stretch 근사이며 정확한 3D 부피 보존 모델은 아닙니다. DPR 3까지 무조건 그리기보다 픽셀 비용을 제한했습니다. WebP 11개는 약 16.23MB에서 12.39MB로 줄었고 alpha와 표시되는 RGB의 원본 일치도 검사했습니다. 원본 PNG/M4A는 보관합니다.

## 진동

왁스 조작은 50ms, 모찌 조작은 40ms의 진동을 요청합니다. 빠른 연속 조작에서는 요청 간격을 제한해 진행 중인 진동이 계속 취소되지 않도록 합니다. 설정을 끄거나 페이지를 숨기면 진행 중인 진동을 중단합니다.

설정의 ‘진동 테스트’ 버튼은 150ms 진동을 요청합니다. 테스트는 조작 진동 설정을 변경하지 않습니다. 브라우저가 API를 제공하지 않으면 진동 설정과 테스트 버튼을 비활성화합니다. 요청 거부나 예외가 발생해도 시뮬레이터 조작은 계속됩니다.

브라우저가 요청을 수락하더라도 실제 진동 모터의 동작 여부는 웹에서 확인할 수 없습니다. 테스트가 느껴지지 않으면 휴대폰의 진동 설정, 무음·방해 금지 모드와 브라우저 설정을 확인합니다. 관련 동작은 [Vibration API 안내](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate)를 참고하세요.

## 환경 설정과 방명록

`.env.example`을 참고해 `.env.local`을 만듭니다. VITE 환경 변수와 Firebase client config는 공개 설정이며 비밀키를 넣지 않습니다.

- `VITE_SITE_URL`: 실제 HTTPS 사이트 주소. 빌드에서 canonical, og:url, 공유 이미지 절대 URL에 반영. 주소가 없으면 임의 도메인을 넣지 않습니다.
- `VITE_GUESTBOOK_MODE=firebase`: 기존 방명록 연결(기본값). `local`은 기기 전용.
- `VITE_FIREBASE_ANONYMOUS_AUTH=false`: 기존 무인증 규칙과 호환되는 기본값. provider 활성화와 규칙 검토 후 `true`로 전환.

서버 확인 전에는 완료로 표시하지 않습니다. 진행 중 중복 전송을 막고 연결이 느리면 대기 문구를 표시합니다. 작성 중 편집한 내용은 보존합니다. 로컬 저장이 막히면 입력을 지우지 않습니다.

클라이언트 쿨다운은 우회 가능합니다. `firestore.rules.example`은 익명 UID별 쿨다운을 방명록 생성과 같은 batch에서 검증하는 별도 도입 템플릿입니다. Auth 사용 시 adapter는 uid와 `guestbookCooldowns/{uid}`의 lastPostedAt/entryId를 함께 씁니다. 같은 entryId를 양쪽 규칙에서 검사해 한 batch 복수 작성 우회를 제한합니다.

**규칙은 배포하거나 Emulator에서 검증하지 않았습니다.** 기존 규칙 보관, Anonymous Auth 활성화, Emulator 검증, 앱/규칙 호환 배포가 필요합니다. 미인증 쓰기, 타입/길이 조작, 시각 조작, 10초 내 재작성, cooldown 단독 쓰기, batch 복수 작성, 수정/삭제를 검사합니다. UID 재발급 우회는 가능하고 get/getAfter 규칙 읽기도 할당량에 포함됩니다.

과거 페이지는 항상 실시간 갱신되지 않습니다. 운영자가 삭제한 과거 글은 현재 세션에서 다음 새 조회까지 남을 수 있습니다. 운영 요금제/규칙은 이 작업에서 변경하지 않았습니다.

## 배포

`dist/`만 정적으로 제공합니다. 개발 의존성/Node 서버를 운영에 배포하지 않습니다. 사이트 루트(`/`) 제공을 기준으로 구성했습니다.

Vercel:

운영 주소: https://wax-ppu.vercel.app

GitHub의 `dpqksr5501/wax-ppu` 저장소와 연결되어 있습니다. `main`에 push하면 운영 배포가 실행됩니다. 배포 상태는 Vercel의 Deployments에서 확인합니다.

- Framework Preset: Vite
- Node.js: 24.x
- Build Command: `pnpm build`
- Output Directory: `dist`
- Install Command: `pnpm install --frozen-lockfile`
- Environment Variables (Production / Preview): `ENABLE_EXPERIMENTAL_COREPACK=1`, `VITE_SITE_URL=https://wax-ppu.vercel.app`

`vercel.json`에서 빌드와 응답 헤더를 관리합니다. `.vercel/`과 인증 값이 포함될 수 있는 `.env.local`은 Git과 CLI 소스 업로드에서 제외합니다. 환경 변수나 사이트 주소를 변경한 뒤에는 다시 배포합니다.

다른 호스팅을 사용할 경우:

Cloudflare Workers Static Assets:

1. Git 연동에서 저장소를 선택하고 빌드 `pnpm build`, 배포 `pnpm dlx wrangler deploy`를 설정합니다. 로컬에서도 Wrangler 로그인 후 같은 명령을 사용합니다.
2. `wrangler.jsonc`의 사이트 이름을 확인합니다. 정적 Assets로 직접 제공하고 모든 요청 앞에 Worker를 실행하도록 설정하지 않습니다.
3. 실제 URL을 `VITE_SITE_URL`에 지정해 다시 빌드합니다. Auth를 사용하면 Firebase 허용 도메인도 확인합니다.
4. 배포 미리보기에서 공유 카드·모바일·service worker 업데이트를 검증한 뒤 운영 주소를 연결합니다.

Netlify 유지 시 `netlify.toml`은 `pnpm build` / `dist`를 설정합니다. 기존 루트 게시 설정은 publish directory를 dist로 변경해야 합니다. 수동 정적 배포도 dist를 사용합니다.

Vercel 운영 배포와 GitHub 연결을 구성했습니다. Firebase 요금제·인증·보안 규칙은 변경하지 않았습니다. 호스팅과 DB의 무료 할당량은 각각 관리해야 합니다.
