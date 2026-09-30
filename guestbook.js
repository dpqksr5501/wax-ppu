/**
 * Wax-ppu ASMR Simulator - Guestbook (방명록) Logic
 * Integrates Google Firebase Firestore with LocalStorage offline fallback.
 * Includes paginated loading and input character sanitization.
 */

class WaxGuestbook {
    constructor() {
        this.db = null;
        this.dbMode = 'local'; // 'firebase' | 'local'
        
        // 구글 Firebase Firestore 연동을 위한 설정 키
        // Firebase 콘솔에서 발급받아 아래 값들을 대체해 주시면 클라우드 DB 동기화가 활성화됩니다.
        this.firebaseConfig = {
            apiKey: "AIzaSyBb1lVkn_Ol4amr4bGzhmlYvn_rZ5qE5gE",
            authDomain: "waxppu-cac47.firebaseapp.com",
            projectId: "waxppu-cac47",
            storageBucket: "waxppu-cac47.firebasestorage.app",
            messagingSenderId: "854443872433",
            appId: "1:854443872433:web:5c4fd6ed1efdd9081ed290"
        };
        
        this.allMessages = []; // 캐싱된 방명록 리스트
        this.displayLimit = 5; // 처음에 몇 개를 보여줄지 설정
        this.displayIncrement = 5; // '더보기' 누를 때 늘어날 개수

        // UI 요소 캐싱
        this.form = document.getElementById('guestbook-form');
        this.nicknameInput = document.getElementById('gb-nickname');
        this.messageInput = document.getElementById('gb-message');
        this.listContainer = document.getElementById('guestbook-list');
        this.btnMore = document.getElementById('btn-more-gb');
    }

    /**
     * DB 연동 및 이벤트 핸들링 시작
     */
    init() {
        this._setupDatabase();
        this._bindEvents();
        this.loadAndRender();
    }

    /**
     * 구글 파이어베이스 DB 인스턴스 확인 또는 로컬 저장소 연결
     */
    _setupDatabase() {
        const config = this.firebaseConfig;
        
        // 사용자가 기본값(YOUR_...)을 수정하지 않은 경우 로컬 저장소로 구동
        const isDefaultConfig = !config.apiKey || 
                                config.apiKey.includes("YOUR_") || 
                                config.projectId.includes("YOUR_");

        if (!isDefaultConfig && typeof firebase !== 'undefined') {
            try {
                firebase.initializeApp(config);
                this.db = firebase.firestore();
                this.dbMode = 'firebase';
                console.log("WaxGuestbook: 구글 Firebase Firestore 클라우드 연결 완료.");
            } catch (err) {
                console.warn("WaxGuestbook: Firebase 초기화 실패. 로컬 저장소 모드로 작동합니다.", err);
                this.dbMode = 'local';
            }
        } else {
            console.log("WaxGuestbook: 파이어베이스 설정값 없음. 임시 로컬 저장소(LocalStorage) 모드로 실행.");
            this.dbMode = 'local';
            
            // 사용자에게 로컬 모드임을 안내하는 알림 문구 표시
            this._showLocalNotice();
        }
    }

    /**
     * 로컬 저장소 모드 알림 문구 삽입
     */
    _showLocalNotice() {
        const noticeDiv = document.createElement('div');
        noticeDiv.className = 'local-notice';
        noticeDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <strong>안내:</strong> 구글 DB 설정이 입력되지 않아 브라우저 단독 모드로 기록됩니다. (친구 공유 불가)';
        this.form.appendChild(noticeDiv);
    }

    /**
     * 이벤트 바인딩
     */
    _bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        this.btnMore.addEventListener('click', () => {
            this.handleLoadMore();
        });
    }

    /**
     * 데이터베이스로부터 글 목록을 로드하고 출력
     */
    async loadAndRender() {
        try {
            if (this.dbMode === 'firebase' && this.db) {
                // 파이어베이스에서 읽기 (최근 글 최대 100개 로딩)
                const snapshot = await this.db.collection('guestbook')
                                              .orderBy('timestamp', 'desc')
                                              .limit(100)
                                              .get();
                
                this.allMessages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.allMessages.push({
                        nickname: data.nickname || '익명',
                        message: data.message || '',
                        timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                    });
                });
            } else {
                // 브라우저 로컬 저장소에서 읽기
                const localData = localStorage.getItem('wax_guestbook_messages');
                if (localData) {
                    this.allMessages = JSON.parse(localData).map(m => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                    // 최신순 정렬
                    this.allMessages.sort((a, b) => b.timestamp - a.timestamp);
                } else {
                    this.allMessages = [];
                }
            }

            this.renderList();
        } catch (error) {
            console.error("방명록 데이터를 가져오는 도중 에러 발생:", error);
            this.listContainer.innerHTML = '<div class="gb-empty"><i class="fa-solid fa-circle-xmark"></i> 방명록을 가져오지 못했습니다. 연결을 확인해 주세요.</div>';
        }
    }

    /**
     * 캐시된 목록을 5개 단위 페이징 제한에 맞춰 렌더링
     */
    renderList() {
        this.listContainer.innerHTML = '';

        if (this.allMessages.length === 0) {
            this.listContainer.innerHTML = '<div class="gb-empty"><i class="fa-solid fa-message"></i> 아직 작성된 방명록이 없습니다. 첫 메시지를 남겨보세요!</div>';
            this.btnMore.style.display = 'none';
            return;
        }

        // 현재 표시 제한 한도만큼 오려내서 렌더링
        const messagesToDraw = this.allMessages.slice(0, this.displayLimit);

        messagesToDraw.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'gb-item';
            
            const timeString = this._formatDate(msg.timestamp);

            item.innerHTML = `
                <div class="gb-meta">
                    <span class="gb-author"><i class="fa-solid fa-user"></i> ${this._escapeHtml(msg.nickname)}</span>
                    <span class="gb-time">${timeString}</span>
                </div>
                <div class="gb-text">${this._escapeHtml(msg.message)}</div>
            `;
            this.listContainer.appendChild(item);
        });

        // 더 가져올 메시지가 있다면 '더보기' 버튼 활성화
        if (this.allMessages.length > this.displayLimit) {
            this.btnMore.style.display = 'block';
        } else {
            this.btnMore.style.display = 'none';
        }
    }

    /**
     * 방명록 작성 제출 처리
     */
    async handleSubmit() {
        const nickname = this.nicknameInput.value.trim();
        const message = this.messageInput.value.trim();

        if (!nickname || !message) return;

        const submitBtn = document.getElementById('btn-submit-gb');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 작성 중';

        const timestamp = new Date();

        try {
            if (this.dbMode === 'firebase' && this.db) {
                // Firebase DB 기록
                await this.db.collection('guestbook').add({
                    nickname: nickname,
                    message: message,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // LocalStorage 기록
                const newMessage = { nickname, message, timestamp };
                const localData = localStorage.getItem('wax_guestbook_messages');
                let messages = [];
                if (localData) {
                    messages = JSON.parse(localData);
                }
                messages.push(newMessage);
                localStorage.setItem('wax_guestbook_messages', JSON.stringify(messages));
            }

            // 양식 비우기
            this.messageInput.value = '';
            
            // 성공 리로딩 (화면 표시 한도는 다시 5개로 리셋)
            this.displayLimit = 5;
            await this.loadAndRender();
        } catch (error) {
            console.error("방명록 작성 저장 실패:", error);
            alert("방명록을 등록하는 과정에서 오류가 발생했습니다.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-pen"></i> 작성하기';
        }
    }

    /**
     * 더보기 버튼 클릭 시 5개 추가 갱신
     */
    handleLoadMore() {
        this.displayLimit += this.displayIncrement;
        this.renderList();
    }

    /**
     * 시간 날짜 포맷 변환 (YYYY-MM-DD HH:MM)
     */
    _formatDate(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    /**
     * HTML 인젝션 방어 (XSS 방어 함수)
     */
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// DOM 준비 시 작동 시작
document.addEventListener('DOMContentLoaded', () => {
    const gb = new WaxGuestbook();
    gb.init();
});
