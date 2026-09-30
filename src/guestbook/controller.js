import { CONFIG } from '../config.js';
import { safeRead, safeWrite } from '../core/settings.js';
import { validateEntry, normalizeEntry, mergeEntries } from './data.js';

const LOCAL_KEY = 'wax_guestbook_messages'; // preserve existing local guestbook
const CACHE_KEY = 'waxppu:guestbook:cache:v2';
const COOLDOWN_KEY = 'waxppu:guestbook:cooldown';
export class Guestbook {
  constructor(section) {
    this.section = section;
    this.form = section.querySelector('form');
    this.nickname = section.querySelector('#gb-nickname');
    this.message = section.querySelector('#gb-message');
    this.list = section.querySelector('#guestbook-list');
    this.status = section.querySelector('#gb-status');
    this.submit = section.querySelector('#btn-submit-gb');
    this.more = section.querySelector('#btn-more-gb');
    this.counter = section.querySelector('#gb-count');
    this.localButton = section.querySelector('#gb-save-local');
    this.store = null;
    this.unsubscribe = null;
    this.busy = false;
    this.paging = false;
    this.recent = [];
    this.history = [];
    this.cursor = null;
    this.hasMore = false;
    this.started = false;
    this.startPromise = null;
    this.hiddenTimer = null;
    this.abort = new AbortController();
    const deadline = safeRead(COOLDOWN_KEY, 0);
    this.nextAt = Number.isFinite(deadline)
      ? Math.min(deadline, Date.now() + CONFIG.guestbook.cooldownMs)
      : 0;
    this.local = this.readLocal();
    const cache = safeRead(CACHE_KEY, []);
    if (Array.isArray(cache))
      this.recent = cache.flatMap((item, i) => {
        const e = normalizeEntry(item, item?.id ?? `cache-${i}`);
        return e ? [e] : [];
      });
  }
  readLocal() {
    const items = safeRead(LOCAL_KEY, []);
    if (!Array.isArray(items)) return [];
    return items.slice(-CONFIG.guestbook.maxLocal).flatMap((item, i) => {
      const e = normalizeEntry(
        { ...item, local: true },
        item?.id ?? `legacy-${i}`,
      );
      return e ? [e] : [];
    });
  }
  init() {
    const signal = this.abort.signal;
    window.addEventListener(
      'storage',
      (event) => {
        if (event.key === COOLDOWN_KEY) {
          const deadline = safeRead(COOLDOWN_KEY, 0);
          this.nextAt = Number.isFinite(deadline)
            ? Math.min(deadline, Date.now() + CONFIG.guestbook.cooldownMs)
            : 0;
          this.updateControls();
        }
        if (event.key === LOCAL_KEY) {
          this.local = this.readLocal();
          this.render();
        }
      },
      { signal },
    );
    this.form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void this.send();
      },
      { signal },
    );
    this.message.addEventListener('input', () => this.updateControls(), {
      signal,
    });
    this.more.addEventListener('click', () => void this.loadMore(), { signal });
    this.localButton.addEventListener('click', () => this.saveLocal(), {
      signal,
    });
    this.nickname.value = safeRead('waxppu:nickname', '');
    this.render();
    this.updateControls();
    this.setStatus(
      this.recent.length
        ? '마지막으로 읽은 기록이에요. 연결을 확인하고 있어요.'
        : '방명록에 가까이 오면 최근 기록을 불러와요.',
    );
    if (import.meta.env.VITE_GUESTBOOK_MODE === 'local')
      this.setStatus(
        '이 화면은 기기에 기록해요. 다른 사람에게 공유되지 않아요.',
      );
    if (!navigator.onLine)
      this.setStatus(
        '오프라인이에요. 사용한 에셋으로 즐기고, 마음은 내 기기에 저장할 수 있어요.',
      );
    this.timer = setInterval(() => this.updateControls(), 500);
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.observer.disconnect();
          this.started = true;
          void this.connect();
        }
      },
      { rootMargin: '240px' },
    );
    this.observer.observe(this.section);
    window.addEventListener(
      'online',
      () => {
        if (this.started) void this.connect();
      },
      { signal },
    );
    window.addEventListener(
      'offline',
      () =>
        this.setStatus(
          '연결이 끊겼어요. 작성한 내용은 내 기기에 저장할 수 있어요.',
        ),
      { signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        clearTimeout(this.hiddenTimer);
        if (document.hidden)
          this.hiddenTimer = setTimeout(() => this.disconnect(), 60000);
        else if (this.started) void this.connect();
      },
      { signal },
    );
  }
  async connect() {
    if (
      this.unsubscribe ||
      this.startPromise ||
      document.hidden ||
      !navigator.onLine ||
      import.meta.env.VITE_GUESTBOOK_MODE === 'local'
    )
      return;
    this.startPromise = (async () => {
      try {
        if (!this.store) {
          const { createFirebaseStore } = await import('./firebase.ts');
          this.store = await createFirebaseStore();
        }
        if (this.abort.signal.aborted || document.hidden) return;
        this.unsubscribe = this.store.listen(
          (docs, fromCache) => {
            const rows = docs.flatMap((doc) => {
              const entry = normalizeEntry(
                {
                  ...doc.data({ serverTimestamps: 'estimate' }),
                  pending: doc.metadata.hasPendingWrites,
                },
                doc.id,
              );
              return entry ? [entry] : [];
            });
            // Keep records pushed out of the bounded live window, so paging has no gap.
            const oldest = rows.at(-1)?.timestamp;
            if (oldest != null) {
              const ids = new Set(rows.map((row) => row.id));
              const evicted = this.recent.filter(
                (row) =>
                  !ids.has(row.id) && !row.pending && row.timestamp <= oldest,
              );
              this.history = mergeEntries(this.history, evicted).slice(0, 200);
            }
            this.recent = rows;
            if (
              !this.cursor &&
              !fromCache &&
              docs.every((doc) => !doc.metadata.hasPendingWrites)
            ) {
              this.cursor = docs.at(-1) ?? null;
              this.hasMore = docs.length === CONFIG.guestbook.recentLimit;
            }
            const cache = mergeEntries(this.history, rows)
              .filter((row) => !row.pending && row.timestamp !== null)
              .slice(0, 100);
            safeWrite(
              CACHE_KEY,
              cache.map((row) => ({
                ...row,
                timestamp: new Date(row.timestamp).toISOString(),
              })),
            );
            this.setStatus(
              fromCache
                ? '저장된 기록을 표시하고 있어요. 연결되면 갱신돼요.'
                : '최근 방명록이 실시간으로 연결되어 있어요.',
            );
            this.render();
          },
          () => {
            this.unsubscribe = null;
            this.setStatus(
              '공유 방명록을 연결하지 못했어요. 기록은 유지되고, 내 기기에 저장할 수 있어요.',
            );
          },
        );
      } catch {
        this.setStatus(
          '공유 방명록을 연결하지 못했어요. 내 기기에 저장할 수 있어요.',
        );
      }
    })().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }
  disconnect() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  setStatus(text) {
    this.status.textContent = text;
  }
  updateControls() {
    const left = Math.max(0, Math.ceil((this.nextAt - Date.now()) / 1000));
    this.counter.textContent = `${this.message.value.length} / ${CONFIG.guestbook.messageMax}`;
    this.submit.disabled = this.busy || left > 0;
    this.localButton.disabled = this.busy || left > 0;
    this.submit.textContent = this.busy
      ? '전송 확인 중…'
      : left
        ? `${left}초 후 작성`
        : '마음 남기기 ↗';
  }
  draft() {
    return validateEntry(this.nickname.value, this.message.value);
  }
  finish() {
    this.message.value = '';
    this.nextAt = Date.now() + CONFIG.guestbook.cooldownMs;
    safeWrite(COOLDOWN_KEY, this.nextAt);
    safeWrite('waxppu:nickname', this.nickname.value.trim());
    this.updateControls();
  }
  saveLocal() {
    if (this.busy || Date.now() < this.nextAt) return;
    const draft = this.draft();
    if (!draft) {
      this.setStatus('닉네임 1~10자, 메시지 1~100자를 입력해 주세요.');
      return;
    }
    const item = {
      ...draft,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      local: true,
      pending: false,
    };
    const rows = [...this.readLocal(), item].slice(-CONFIG.guestbook.maxLocal);
    const saved = safeWrite(
      LOCAL_KEY,
      rows.map((row) => ({
        ...row,
        timestamp:
          row.timestamp == null ? null : new Date(row.timestamp).toISOString(),
      })),
    );
    if (!saved) {
      this.setStatus(
        '기기 저장 공간을 사용할 수 없어요. 입력 내용은 그대로 남아 있어요.',
      );
      return;
    }
    this.local = rows;
    this.finish();
    this.render();
    this.setStatus('내 기기에 저장했어요. 다른 사람에게 공유되지는 않아요.');
  }
  async send() {
    if (this.busy || Date.now() < this.nextAt) return;
    const draft = this.draft();
    if (!draft) {
      this.setStatus('닉네임 1~10자, 메시지 1~100자를 입력해 주세요.');
      return;
    }
    if (!navigator.onLine || import.meta.env.VITE_GUESTBOOK_MODE === 'local') {
      this.saveLocal();
      return;
    }
    this.busy = true;
    this.updateControls();
    let pendingTimer;
    try {
      await this.connect();
      if (!this.store || !this.unsubscribe) throw new Error('연결할 수 없음');
      const id = this.store.createId();
      pendingTimer = setTimeout(
        () =>
          this.setStatus(
            '서버 확인을 기다리고 있어요. 중복 전송 없이 기다리는 중이에요.',
          ),
        8000,
      );
      await this.store.save(id, draft);
      // Preserve edits made during a slow request.
      if (
        this.nickname.value.trim() === draft.nickname &&
        this.message.value.trim() === draft.message
      )
        this.finish();
      else {
        this.nextAt = Date.now() + CONFIG.guestbook.cooldownMs;
        safeWrite(COOLDOWN_KEY, this.nextAt);
      }
      this.setStatus('마음을 남겼어요. 고마워요!');
    } catch {
      this.setStatus(
        '등록하지 못했어요. 내용을 보관하고 있으니 다시 시도하거나 내 기기에 저장해 주세요.',
      );
    } finally {
      clearTimeout(pendingTimer);
      this.busy = false;
      this.updateControls();
    }
  }
  async loadMore() {
    if (!this.store || !this.cursor || this.paging || !this.hasMore) return;
    this.paging = true;
    this.more.disabled = true;
    try {
      const docs = await this.store.page(this.cursor);
      const rows = docs.flatMap((doc) => {
        const e = normalizeEntry(doc.data(), doc.id);
        return e ? [e] : [];
      });
      this.history = mergeEntries(this.history, rows);
      this.cursor = docs.at(-1) ?? this.cursor;
      this.hasMore = docs.length === CONFIG.guestbook.pageSize;
      this.render();
    } catch {
      this.setStatus('이전 기록을 읽지 못했어요. 연결 후 다시 시도해 주세요.');
    } finally {
      this.paging = false;
      this.more.disabled = false;
    }
  }
  render() {
    const fragment = document.createDocumentFragment();
    const rows = mergeEntries(this.history, this.recent, this.local);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'gb-empty';
      empty.textContent = '오늘의 기분을 짧게 남겨보세요. 첫 마음도 환영해요.';
      fragment.append(empty);
    }
    for (const row of rows) {
      const item = document.createElement('article');
      item.className = 'gb-item';
      const meta = document.createElement('div');
      meta.className = 'gb-meta';
      const name = document.createElement('strong');
      name.textContent = row.nickname;
      const time = document.createElement('span');
      time.textContent = row.local
        ? '내 기기'
        : row.pending
          ? '전송 확인 중'
          : row.timestamp === null
            ? '시간 확인 중'
            : new Intl.DateTimeFormat('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).format(row.timestamp);
      const text = document.createElement('p');
      text.textContent = row.message;
      meta.append(name, time);
      item.append(meta, text);
      fragment.append(item);
    }
    this.list.replaceChildren(fragment);
    this.more.hidden = !this.hasMore;
  }
  dispose() {
    this.disconnect();
    this.abort.abort();
    this.observer.disconnect();
    clearInterval(this.timer);
    clearTimeout(this.hiddenTimer);
  }
}
