// "Are you sure?" conversation on the Bayesian detour.
// Without JavaScript (or <dialog> support) "go to Yumi's personal" is an ordinary link to /personal/.
//
// 10 seconds to decide. At zero: "Fine, 5 bonus seconds, as a treat." At zero again, the silence
// counts as evidence and the visitor is taken to Research. Closing the window or answering stops everything.
// "Yes, I AM SURE" gives a visit pass (window.name, this tab only), so the question is not asked twice.
(() => {
  const trigger = document.querySelector('[data-open-chat]');
  const chat = document.getElementById('personal-chat');
  if (!trigger || !chat || typeof chat.showModal !== 'function') return;

  const PASS = 'yumi-personal-yes';
  const hasPass = () => { try { return window.name === PASS; } catch { return false; } };
  const grantPass = () => { try { if (!window.name || window.name === PASS) window.name = PASS; } catch {} };

  const $ = selector => chat.querySelector(selector);
  const [first, second, bonus, final] = ['1', '2', 'bonus', 'final'].map(name => $(`[data-message="${name}"]`));
  const typing = $('.typing');
  const status = $('.chat-status');
  const bar = $('.chat-timer span');
  const yes = $('.reply-yes');
  const no = $('.reply-no');
  const counters = {
    first: {count: $('.count'), unit: $('.unit'), duration: 10_000},
    bonus: {count: $('.bonus-count'), unit: $('.bonus-unit'), duration: 5_000}
  };
  const REDIRECT_DELAY = 1600; // also under reduced motion, so the last message can be read
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let round = 'first';   // first → bonus → over
  let remaining = 0;
  let last = 0;
  let frame = 0;
  let steps = [];
  let redirect = 0;
  let redirectWaiting = false;
  let pressedOutside = false;

  const later = (ms, fn) => steps.push(window.setTimeout(fn, reducedMotion.matches ? 0 : ms));
  const stopClock = () => { window.cancelAnimationFrame(frame); frame = 0; };
  const stopAll = () => {
    steps.forEach(window.clearTimeout);
    steps = [];
    window.clearTimeout(redirect);
    redirect = 0;
    redirectWaiting = false;
    stopClock();
  };
  const setTyping = on => {
    typing.hidden = !on;
    status.textContent = on ? 'typing…' : 'updated just now';
  };

  const render = () => {
    const {count, unit, duration} = counters[round];
    const seconds = Math.ceil(remaining / 1000);
    count.textContent = String(seconds);
    unit.textContent = seconds === 1 ? 'second' : 'seconds';
    bar.style.transform = `scaleX(${remaining / duration})`;
  };
  const tick = now => {
    remaining = Math.max(0, remaining - (now - last));
    last = now;
    render();
    if (remaining > 0) {
      frame = window.requestAnimationFrame(tick);
      return;
    }
    frame = 0;
    if (round === 'first') bonusRound();
    else timeUp();
  };
  const startClock = () => {
    if (!chat.open || document.hidden || remaining <= 0 || frame || !chat.classList.contains('is-ready')) return;
    last = performance.now();
    frame = window.requestAnimationFrame(tick);
  };

  // Out of time once: five more seconds, as a treat.
  const bonusRound = () => {
    setTyping(true);
    later(900, () => {
      setTyping(false);
      round = 'bonus';
      remaining = counters.bonus.duration;
      render();
      bonus.hidden = false;
      chat.classList.add('is-bonus', 'is-late');
      startClock();
    });
  };

  // Out of time twice: off to Research.
  const goToResearch = () => {
    window.clearTimeout(redirect);
    redirect = window.setTimeout(() => {
      redirect = 0;
      if (document.hidden) { redirectWaiting = true; return; }
      window.location.assign(no.href);
    }, REDIRECT_DELAY);
  };
  const timeUp = () => {
    round = 'over';
    setTyping(true);
    later(900, () => {
      setTyping(false);
      final.hidden = false;
      status.textContent = 'redirecting…';
      goToResearch();
    });
  };

  const open = () => {
    stopAll();
    round = 'first';
    remaining = counters.first.duration;
    counters.bonus.count.textContent = '5';
    counters.bonus.unit.textContent = 'seconds';
    render();
    [first, second, bonus, final].forEach(message => { message.hidden = true; });
    chat.classList.remove('is-ready', 'is-late', 'is-bonus');
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

  const syncTrigger = () => {
    if (hasPass()) {
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-controls');
    } else {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', chat.id);
    }
  };
  syncTrigger();
  trigger.addEventListener('click', event => {
    // Keep new-tab / new-window clicks going straight to the personal page.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Already said yes during this visit: no second interrogation.
    if (hasPass()) return;
    event.preventDefault();
    open();
  });
  yes.addEventListener('click', () => { grantPass(); stopAll(); });
  no.addEventListener('click', stopAll);

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
    stopAll();
    document.documentElement.classList.remove('chat-open');
  });

  // Pause while the tab is in the background, including the final hand-off to Research.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopClock();
      if (redirect) { window.clearTimeout(redirect); redirect = 0; redirectWaiting = true; }
    } else if (redirectWaiting) {
      redirectWaiting = false;
      goToResearch();
    } else {
      startClock();
    }
  });
  // Never come back (via the back button) to a half-finished conversation.
  window.addEventListener('pagehide', () => { if (chat.open) chat.close(); });
  window.addEventListener('pageshow', event => {
    if (event.persisted && chat.open) chat.close();
    syncTrigger();
  });
})();
