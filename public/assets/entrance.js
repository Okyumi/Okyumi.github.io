// "Are you sure?" conversation on the Bayesian detour.
// Without JavaScript (or <dialog> support) "go to Yumi's personal" is an ordinary link to /personal/.
(() => {
  const trigger = document.querySelector('[data-open-chat]');
  const chat = document.getElementById('personal-chat');
  if (!trigger || !chat || typeof chat.showModal !== 'function') return;

  const $ = selector => chat.querySelector(selector);
  const [first, second, late] = [1, 2, 3].map(n => $(`[data-message="${n}"]`));
  const typing = $('.typing');
  const status = $('.chat-status');
  const count = $('.count');
  const unit = $('.unit');
  const bar = $('.chat-timer span');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 10_000;

  let remaining = DURATION;
  let last = 0;
  let frame = 0;
  let steps = [];
  let pressedOutside = false;

  const later = (ms, fn) => steps.push(window.setTimeout(fn, reducedMotion.matches ? 0 : ms));
  const clearSteps = () => { steps.forEach(window.clearTimeout); steps = []; };
  const setTyping = on => {
    typing.hidden = !on;
    status.textContent = on ? 'typing…' : 'updated just now';
  };

  const render = () => {
    const seconds = Math.ceil(remaining / 1000);
    count.textContent = String(seconds);
    unit.textContent = seconds === 1 ? 'second' : 'seconds';
    bar.style.transform = `scaleX(${remaining / DURATION})`;
  };
  const stopClock = () => { window.cancelAnimationFrame(frame); frame = 0; };
  const tick = now => {
    remaining = Math.max(0, remaining - (now - last));
    last = now;
    render();
    if (remaining > 0) {
      frame = window.requestAnimationFrame(tick);
      return;
    }
    frame = 0;
    timeUp();
  };
  const startClock = () => {
    if (!chat.open || document.hidden || remaining <= 0 || frame) return;
    last = performance.now();
    frame = window.requestAnimationFrame(tick);
  };
  // The deadline is a joke: nothing is disabled and nobody is redirected when it runs out.
  const timeUp = () => {
    setTyping(true);
    later(900, () => {
      setTyping(false);
      late.hidden = false;
      chat.classList.add('is-late');
    });
  };

  const open = () => {
    clearSteps();
    stopClock();
    remaining = DURATION;
    render();
    first.hidden = true;
    second.hidden = true;
    late.hidden = true;
    chat.classList.remove('is-ready', 'is-late');
    setTyping(true);
    chat.showModal();
    document.documentElement.classList.add('chat-open');
    later(650, () => { first.hidden = false; });
    later(1450, () => {
      setTyping(false);
      second.hidden = false;
      chat.classList.add('is-ready');
      startClock();
    });
  };

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', chat.id);
  trigger.addEventListener('click', event => {
    // Keep new-tab / new-window clicks going straight to the personal page.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open();
  });

  $('.chat-close').addEventListener('click', () => chat.close());
  const isOutside = event => {
    if (event.target !== chat) return false;
    const box = chat.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  chat.addEventListener('pointerdown', event => { pressedOutside = isOutside(event); });
  chat.addEventListener('click', event => {
    if (pressedOutside && isOutside(event)) chat.close();
    pressedOutside = false;
  });
  chat.addEventListener('close', () => {
    clearSteps();
    stopClock();
    document.documentElement.classList.remove('chat-open');
  });

  // Pause the countdown while the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopClock();
    else if (chat.classList.contains('is-ready')) startClock();
  });
  // Never come back (via the back button) to a half-finished conversation.
  window.addEventListener('pagehide', () => { if (chat.open) chat.close(); });
  window.addEventListener('pageshow', event => { if (event.persisted && chat.open) chat.close(); });
})();
