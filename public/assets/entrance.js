// "Are you sure?" conversation on the Bayesian detour.
// Without JavaScript (or <dialog> support) "go to Yumi's personal" is an ordinary link to /personal/.
//
// First time: 10 seconds to decide. At zero: "Fine, 5 bonus seconds, as a treat.", and the No reply gets
// its longer wording. At zero again, the silence counts as evidence and the visitor is taken to Research.
// Closing the window or answering stops everything.
// Second time (same tab): "Wow, it's you again." No question this time, just a free pass straight to
// Personal; from then on every Personal link skips the detour (site.js). The state lives in window.name:
// this tab only, never stored on the device or sent anywhere.
(() => {
  const trigger = document.querySelector('[data-open-chat]');
  const chat = document.getElementById('personal-chat');
  if (!trigger || !chat || typeof chat.showModal !== 'function') return;

  const SEEN = 'yumi-personal-seen';
  const FREE = 'yumi-personal-free';
  const OLD_PASS = 'yumi-personal-yes'; // the pass from before the free pass, still honoured
  const ours = [SEEN, FREE, OLD_PASS];
  const visit = () => {
    try {
      if (window.name === FREE || window.name === OLD_PASS) return 'free';
      return window.name === SEEN ? 'seen' : 'new';
    } catch { return 'new'; }
  };
  // Never overwrite a window name that some other page set.
  const remember = value => { try { if (!window.name || ours.includes(window.name)) window.name = value; } catch {} };

  const $ = selector => chat.querySelector(selector);
  const [first, second, bonus, final] = ['1', '2', 'bonus', 'final'].map(name => $(`[data-message="${name}"]`));
  const again = ['again-1', 'again-2', 'again-3'].map(name => $(`[data-message="${name}"]`));
  const messages = [first, second, bonus, final, ...again];
  const typing = $('.typing');
  const status = $('.chat-status');
  const bar = $('.chat-timer span');
  const yes = $('.reply-yes');
  const no = $('.reply-no');
  const noText = {first: no.textContent, bonus: no.dataset.bonusText || no.textContent};
  const counters = {
    first: {count: $('.count'), unit: $('.unit'), duration: 10_000},
    bonus: {count: $('.bonus-count'), unit: $('.bonus-unit'), duration: 5_000}
  };
  const REDIRECT_DELAY = 1600; // also under reduced motion, so the last message can be read
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let round = 'first';   // first → bonus → over, or again
  let remaining = 0;
  let last = 0;
  let frame = 0;
  let steps = [];
  let redirect = 0;
  let redirectWaiting = false;
  let destination = '';
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

  // Out of time once: five more seconds, as a treat, and a longer No.
  const bonusRound = () => {
    setTyping(true);
    later(900, () => {
      setTyping(false);
      round = 'bonus';
      remaining = counters.bonus.duration;
      render();
      bonus.hidden = false;
      no.textContent = noText.bonus;
      chat.classList.add('is-bonus', 'is-late');
      startClock();
    });
  };

  // The hand-off at the end of a conversation; it waits while the tab is in the background.
  const go = url => {
    if (url) destination = url;
    window.clearTimeout(redirect);
    redirect = window.setTimeout(() => {
      redirect = 0;
      if (document.hidden) { redirectWaiting = true; return; }
      window.location.assign(destination);
    }, REDIRECT_DELAY);
  };
  // Out of time twice: off to Research.
  const timeUp = () => {
    round = 'over';
    setTyping(true);
    later(900, () => {
      setTyping(false);
      final.hidden = false;
      status.textContent = 'redirecting…';
      go(no.href);
    });
  };

  const show = () => {
    messages.forEach(message => { message.hidden = true; });
    chat.classList.remove('is-ready', 'is-late', 'is-bonus', 'is-again');
    setTyping(true);
    chat.showModal();
    document.documentElement.classList.add('chat-open');
  };
  // First time through: the question, with the clock.
  const open = () => {
    stopAll();
    round = 'first';
    remaining = counters.first.duration;
    counters.bonus.count.textContent = '5';
    counters.bonus.unit.textContent = 'seconds';
    no.textContent = noText.first;
    render();
    show();
    later(650, () => { first.hidden = false; });
    later(1450, () => {
      setTyping(false);
      second.hidden = false;
      chat.classList.add('is-ready');
      startClock();
    });
  };
  // Second time: no question, no clock, just the free pass.
  const openAgain = () => {
    stopAll();
    round = 'again';
    bar.style.transform = 'scaleX(0)';
    show();
    chat.classList.add('is-again');
    later(650, () => { again[0].hidden = false; });
    later(1650, () => { again[1].hidden = false; });
    later(2750, () => {
      setTyping(false);
      again[2].hidden = false;
      remember(FREE);
      syncTrigger();
      status.textContent = 'redirecting…';
      go(trigger.href);
    });
  };

  const syncTrigger = () => {
    if (visit() === 'free') {
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
    const now = visit();
    // Free pass: no conversation at all.
    if (now === 'free') return;
    event.preventDefault();
    if (now === 'seen') openAgain();
    else {
      remember(SEEN);
      open();
    }
  });
  yes.addEventListener('click', stopAll);
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
    syncTrigger();
  });

  // Pause while the tab is in the background, including the final hand-off.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopClock();
      if (redirect) { window.clearTimeout(redirect); redirect = 0; redirectWaiting = true; }
    } else if (redirectWaiting) {
      redirectWaiting = false;
      go();
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
