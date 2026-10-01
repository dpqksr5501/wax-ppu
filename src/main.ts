import './styles.css';
import { CONFIG } from './config.js';
import { loadSettings, saveSettings, safeRead } from './core/settings.js';
import { setupCanvas } from './core/canvas.js';
import { SimulationLoop } from './core/loop.js';
import { bindInput } from './core/input.js';
import { createHaptics } from './core/haptics.js';
import { WaxPhysicsEngine } from './simulations/physics.js';
import { WaxAudioEngine } from './audio/engine.js';
import { Guestbook } from './guestbook/controller.js';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`필수 화면 요소가 없어요: ${id}`);
  return value as T;
}
const settings = loadSettings();
if (!safeRead('waxppu:settings:v2', null))
  settings.reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
const canvas = element<HTMLCanvasElement>('simulator-canvas');
const startButton = element<HTMLButtonElement>('btn-start');
const overlay = element('start-overlay');
const waxTab = element<HTMLButtonElement>('tab-wax'),
  mochiTab = element<HTMLButtonElement>('tab-squishy');
const volume = element<HTMLInputElement>('volume-slider');
const mute = element<HTMLButtonElement>('btn-mute');
const sound = element<HTMLSelectElement>('sound-select'),
  feel = element<HTMLSelectElement>('feel-select');
const haptics = element<HTMLInputElement>('haptics-toggle'),
  motion = element<HTMLInputElement>('motion-toggle');
const hint = element('hint-text'),
  audioStatus = element('audio-status');
let started = false,
  lastDrag = -Infinity,
  keyboardRelease: ReturnType<typeof setTimeout> | undefined;
let previousVolume = settings.volume || 80;
const audio = new WaxAudioEngine((state: string) => {
  audioStatus.textContent =
    state === 'muted'
      ? '소리를 켜지 못했어요. 소리 설정을 누르면 다시 시도해요.'
      : '';
});
const physics = new WaxPhysicsEngine(canvas, () => loop?.wake());
const viewport = setupCanvas(canvas, (ctx: CanvasRenderingContext2D) =>
  physics.draw(ctx),
);
const loop = new SimulationLoop(
  (dt: number) => physics.update(dt),
  () => physics.draw(viewport.ctx),
  () => physics.isActive(),
);
const persist = () => {
  if (!saveSettings(settings))
    element('audio-status').textContent =
      '기기에서 설정 저장을 허용하지 않아요. 이번 방문 동안 적용해요.';
};
const vibration = createHaptics();
const hapticStatus = element('haptic-status');
const hapticTest = element<HTMLButtonElement>('btn-haptic-test');
const haptic = () => {
  if (!settings.haptics) return;
  const result = vibration.pulse(
    physics.mode === 'wax' ? CONFIG.haptics.waxMs : CONFIG.haptics.mochiMs,
  );
  if (result === 'blocked')
    hapticStatus.textContent =
      '브라우저가 진동 요청을 허용하지 않았어요. Chrome이나 삼성 인터넷에서 직접 열어 확인해 보세요.';
};
const refreshVolume = () => {
  volume.value = String(settings.volume);
  volume.style.setProperty('--volume', `${settings.volume}%`);
  element('volume-val').textContent = `${settings.volume}%`;
  mute.textContent = settings.volume === 0 ? '소리 켜기' : '소리 끄기';
  mute.setAttribute('aria-pressed', String(settings.volume === 0));
  audio.setVolume(settings.volume / 100);
};
function unlockAudio() {
  void audio.unlock().then((ready: boolean) => {
    if (ready) {
      audioStatus.textContent = '';
      void audio.warm(physics.mode);
    }
  });
}
function begin(x: number, y: number) {
  if (!started) return false;
  clearTimeout(keyboardRelease);
  physics.handleSquishyUp();
  unlockAudio();
  const action =
    physics.mode === 'wax'
      ? physics.handleClick(x, y)
      : physics.handleSquishyDown(x, y);
  if (action === 'none') return false;
  hint.classList.add('used');
  lastDrag = performance.now();
  audio.play(physics.mode, physics.mode === 'wax' ? 1 : 1.05);
  haptic();
  loop.wake();
  return true;
}
function release() {
  clearTimeout(keyboardRelease);
  physics.handleSquishyUp();
  loop.wake();
}
const input = bindInput(canvas, {
  hitTest: (x: number, y: number) => started && physics.hitTest(x, y),
  start: begin,
  move: (x: number, y: number) => {
    if (physics.mode === 'squishy') physics.handleSquishyMove(x, y);
    else if (performance.now() - lastDrag >= CONFIG.timing.dragMs) {
      lastDrag = performance.now();
      if (physics.handleClick(x, y) === 'shatter') {
        audio.play('wax');
        haptic();
      }
    }
    loop.wake();
  },
  end: release,
});
function updateMode(mode: string, playSound = false) {
  input.cancel();
  settings.mode = mode;
  physics.setMode(mode);
  waxTab.classList.toggle('active', mode === 'wax');
  mochiTab.classList.toggle('active', mode === 'squishy');
  waxTab.setAttribute('aria-pressed', String(mode === 'wax'));
  mochiTab.setAttribute('aria-pressed', String(mode === 'squishy'));
  element('squishy-char-group').hidden = mode !== 'squishy';
  element('feel-group').hidden = mode !== 'squishy';
  element('btn-reset').hidden = mode !== 'wax';
  element('mode-description').textContent =
    mode === 'wax'
      ? '바삭한 소리로 가볍게 털어내요'
      : '말랑한 촉감으로 천천히 쉬어가요';
  hint.textContent =
    mode === 'wax'
      ? '중앙을 클릭하거나 드래그해 보세요'
      : '꾹 누르고, 천천히 당겨보세요';
  hint.classList.remove('used');
  if (started) {
    unlockAudio();
    if (playSound && mode === 'squishy') audio.play(mode, 0.8);
  }
  loop.wake();
  persist();
}
startButton.addEventListener('click', () => {
  if (started) return;
  started = true;
  startButton.disabled = true;
  unlockAudio();
  overlay.hidden = true;
  loop.wake();
  canvas.focus({ preventScroll: true });
});
waxTab.addEventListener('click', () => updateMode('wax'));
mochiTab.addEventListener('click', () => updateMode('squishy', true));
for (const chip of document.querySelectorAll<HTMLButtonElement>('.char-chip')) {
  const image = chip.querySelector('img');
  image?.addEventListener('error', () => {
    if (image.src.endsWith('.webp'))
      image.src = image.src.replace(/\.webp$/, '.png');
    else image.hidden = true;
  });
  chip.addEventListener('click', () => {
    input.cancel();
    settings.character = chip.dataset.char!;
    physics.setSquishyCharacter(settings.character);
    for (const other of document.querySelectorAll('.char-chip'))
      other.setAttribute('aria-pressed', String(other === chip));
    if (started) {
      unlockAudio();
      audio.play('squishy', 0.8);
      haptic();
    }
    loop.wake();
    persist();
  });
  chip.setAttribute(
    'aria-pressed',
    String(chip.dataset.char === settings.character),
  );
}
sound.value = settings.sound;
audio.setPreset(settings.sound);
sound.addEventListener('change', () => {
  settings.sound = sound.value;
  audio.setPreset(sound.value);
  if (started) unlockAudio();
  persist();
});
feel.value = settings.feel;
physics.setFeel(settings.feel);
feel.addEventListener('change', () => {
  input.cancel();
  settings.feel = feel.value;
  physics.setFeel(feel.value);
  loop.wake();
  persist();
});
volume.addEventListener('input', () => {
  settings.volume = Number(volume.value);
  if (settings.volume > 0) previousVolume = settings.volume;
  refreshVolume();
  if (started) unlockAudio();
  persist();
});
mute.addEventListener('click', () => {
  if (settings.volume > 0) previousVolume = settings.volume;
  settings.volume = settings.volume > 0 ? 0 : previousVolume;
  refreshVolume();
  if (started) unlockAudio();
  persist();
});
haptics.checked = settings.haptics;
haptics.addEventListener('change', () => {
  settings.haptics = haptics.checked;
  persist();
  hapticStatus.textContent = '';
  if (settings.haptics) {
    if (vibration.pulse(CONFIG.haptics.confirmMs, true) === 'blocked')
      hapticStatus.textContent =
        '브라우저가 진동 요청을 허용하지 않았어요. 진동 테스트로 확인해 보세요.';
  } else vibration.stop();
});
if (!vibration.available) {
  haptics.disabled = true;
  haptics.checked = false;
  hapticTest.disabled = true;
  element('haptic-support').textContent =
    '이 브라우저는 진동을 지원하지 않아요';
}
hapticTest.addEventListener('click', () => {
  const result = vibration.pulse(CONFIG.haptics.testMs, true);
  hapticStatus.textContent =
    result === 'requested'
      ? '진동을 요청했어요.'
      : result === 'activation'
        ? '화면을 한 번 터치한 뒤 다시 테스트해 주세요.'
        : '브라우저가 진동 요청을 허용하지 않았어요. Chrome이나 삼성 인터넷에서 직접 열어 확인해 보세요.';
});
function updateMotion() {
  motion.checked = settings.reducedMotion;
  physics.reducedMotion = settings.reducedMotion;
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
}
motion.addEventListener('change', () => {
  input.cancel();
  settings.reducedMotion = motion.checked;
  updateMotion();
  loop.wake();
  persist();
});
element('btn-reset').addEventListener('click', () => {
  input.cancel();
  if (physics.mode !== 'wax') return;
  physics.reset();
  hint.classList.remove('used');
  haptic();
  loop.wake();
});
canvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (event.repeat) return;
  if (!started) {
    startButton.focus();
    return;
  }
  input.cancel();
  const obj = physics.mode === 'wax' ? physics.squishy : physics.squishyObj;
  if (
    begin(
      obj.x + ('offsetX' in obj ? obj.offsetX : 0),
      obj.y + ('offsetY' in obj ? obj.offsetY : 0),
    )
  )
    keyboardRelease = setTimeout(release, 160);
});
const focusButton = element('btn-focus');
focusButton.addEventListener('click', () => {
  input.cancel();
  const active = document.body.classList.toggle('focus-mode');
  focusButton.setAttribute('aria-pressed', String(active));
  focusButton.textContent = active ? '집중 모드 나가기 ⛶' : '집중 모드 ⛶';
  viewport.resize();
  loop.wake();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('focus-mode'))
    focusButton.click();
});
document.addEventListener('visibilitychange', () => {
  loop.setEnabled(!document.hidden);
  if (document.hidden) {
    audio.suspend();
    vibration.stop();
  }
});
window.addEventListener('pageshow', () => loop.setEnabled(!document.hidden));
const guestbook = new Guestbook(element('guestbook'));
guestbook.init();
physics.setSquishyCharacter(settings.character);
updateMotion();
refreshVolume();
updateMode(settings.mode);
if (import.meta.env.DEV)
  Object.assign(window, {
    __waxDebug: { physics, loop, audio, input, guestbook },
  });
const dispose = () => {
  clearTimeout(keyboardRelease);
  vibration.stop();
  input.dispose();
  loop.dispose();
  viewport.dispose();
  guestbook.dispose();
  void audio.dispose();
};
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) dispose();
  else {
    loop.stop();
    audio.suspend();
    vibration.stop();
  }
});
import.meta.hot?.dispose(dispose);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
