// "Are you sure?" conversation on the Bayesian detour.
// Without JavaScript (or <dialog> support) "go to Yumi's personal" is an ordinary link to /personal/.
//
// First time: 10 seconds to decide. At zero: "Fine, 5 bonus seconds, as a treat.", and the No reply gets
// its longer wording. At zero again, the silence counts as evidence and the visitor is taken to Research.
// Closing the window or answering stops everything.
// It plays like a game dialogue: each line types out with a caret, the clock is a row of ten cells, and the two
// answers are a menu with the pointing hand (↑ / ↓ move it, Enter picks; in the bonus round it slides to No).
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
  const log = $('.chat-log');
  const status = $('.chat-status');
  const cells = [...chat.querySelectorAll('.chat-timer i')];
  const replies = $('.chat-replies');
  const yes = $('.reply-yes');
  const no = $('.reply-no');
  const options = [yes, no];
  const noLabel = no.querySelector('.reply-text');
  const noText = {first: noLabel.textContent, bonus: no.dataset.bonusText || noLabel.textContent};
  const caret = document.createElement('span');
  caret.className = 'chat-caret';
  caret.setAttribute('aria-hidden', 'true');
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

  let job = null;         // the line being typed
  let selected = 0;       // the answer the hand points at

  const later = (ms, fn) => steps.push(window.setTimeout(fn, reducedMotion.matches ? 0 : ms));
  const stopClock = () => { window.cancelAnimationFrame(frame); frame = 0; };

  // A line types out two letters at a time. All of it is laid out from the start (the rest is transparent),
  // so nothing reflows; the log is marked busy meanwhile, so screen readers read each line once, whole.
  const settle = () => {
    if (!job) return;
    for (const part of job) { part.node.data = part.full; part.rest.remove(); }
    job = null;
    log.removeAttribute('aria-busy');
  };
  const typeOut = (line, done) => {
    settle();
    line.hidden = false;
    if (reducedMotion.matches) { caret.remove(); done(); return; }
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    const parts = nodes.map(node => {
      const rest = document.createElement('span');
      rest.className = 'type-rest';
      node.after(rest);
      return {node, rest, full: node.data};
    });
    job = parts;
    log.setAttribute('aria-busy', 'true');
    const total = parts.reduce((n, part) => n + part.full.length, 0);
    let shown = 0;
    const step = () => {
      let left = shown;
      let placed = false;
      for (const part of parts) {
        const k = Math.max(0, Math.min(part.full.length, left));
        left -= part.full.length;
        part.node.data = part.full.slice(0, k);
        part.rest.textContent = part.full.slice(k);
        if (!placed && k < part.full.length) { part.rest.before(caret); placed = true; }
      }
      if (shown >= total) {
        settle();
        line.append(caret);
        done();
        return;
      }
      shown += 2;
      steps.push(window.setTimeout(step, 24));
    };
    step();
  };
  // Lines one after another, with a short pause between them.
  const sayInTurn = (lines, done) => {
    const [line, ...rest] = lines;
    typeOut(line, () => (rest.length ? later(340, () => sayInTurn(rest, done)) : done()));
  };

  const stopAll = () => {
    steps.forEach(window.clearTimeout);
    steps = [];
    settle();
    window.clearTimeout(redirect);
    redirect = 0;
    redirectWaiting = false;
    stopClock();
  };
  const setTyping = on => {
    if (!on) caret.remove();
    status.textContent = on ? 'typing…' : 'updated just now';
  };

  // The menu of answers.
  const select = (index, focus = false) => {
    selected = (index + options.length) % options.length;
    options.forEach((option, i) => option.classList.toggle('is-current', i === selected));
    if (focus) options[selected].focus();
  };
  options.forEach((option, i) => {
    option.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') select(i); });
    option.addEventListener('focus', () => select(i));
  });
  chat.addEventListener('keydown', event => {
    if (!chat.classList.contains('is-ready') || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(selected + (event.key === 'ArrowDown' ? 1 : -1), true);
    } else if (event.key === 'Enter' && event.target === chat) {
      event.preventDefault();
      options[selected].click();
    }
  });

  // Only what changed is written, so the count is announced once a second at most.
  const render = () => {
    const {count, unit} = counters[round];
    const seconds = Math.ceil(remaining / 1000);
    if (count.textContent !== String(seconds)) count.textContent = String(seconds);
    const word = seconds === 1 ? 'second' : 'seconds';
    if (unit.textContent !== word) unit.textContent = word;
    cells.forEach((cell, i) => cell.classList.toggle('is-on', i < seconds));
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

  // Out of time once: five more seconds, as a treat, and a longer No, which the hand slides to (unless you are
  // already pointing at or focused on an answer).
  const bonusRound = () => {
    setTyping(true);
    later(600, () => {
      round = 'bonus';
      remaining = counters.bonus.duration;
      render();
      noLabel.textContent = noText.bonus;
      chat.classList.add('is-bonus', 'is-late');
      if (!replies.matches(':hover') && !options.includes(document.activeElement)) select(1);
      typeOut(bonus, () => {
        setTyping(false);
        startClock();
      });
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
    later(600, () => typeOut(final, () => {
      status.textContent = 'redirecting…';
      go(no.href);
    }));
  };

  const show = () => {
    messages.forEach(message => { message.hidden = true; });
    chat.classList.remove('is-ready', 'is-late', 'is-bonus', 'is-again');
    select(0);
    setTyping(true);
    chat.showModal();
    // The window itself takes the focus (not the close button), so Enter picks the answer the hand points at.
    chat.focus({preventScroll: true});
    document.documentElement.classList.add('chat-open');
  };
  // First time through: the question, with the clock.
  const open = () => {
    stopAll();
    round = 'first';
    remaining = counters.first.duration;
    counters.bonus.count.textContent = '5';
    counters.bonus.unit.textContent = 'seconds';
    noLabel.textContent = noText.first;
    render();
    show();
    later(420, () => sayInTurn([first, second], () => {
      setTyping(false);
      chat.classList.add('is-ready');
      startClock();
    }));
  };
  // Second time: no question, no clock, just the free pass.
  const openAgain = () => {
    stopAll();
    round = 'again';
    show();
    chat.classList.add('is-again');
    later(420, () => sayInTurn(again, () => {
      remember(FREE);
      syncTrigger();
      status.textContent = 'redirecting…';
      go(trigger.href);
    }));
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
