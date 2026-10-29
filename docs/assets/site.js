// Shared behaviour for every page: the Personal visit pass, keyboard controls and a few game touches.
// All of it is optional. Every page and link works without JavaScript.
(() => {
  const body = document.body;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const moving = () => !reducedMotion.matches;
  const isEntrance = body.classList.contains('cover-page') || body.classList.contains('detour-page');

  /* Visit pass. Research-side Personal links (the cover, the research page) go through the Bayesian detour.
     After "Yes, I AM SURE" they go straight to /personal/ for the rest of the visit. The pass lives in
     window.name: this tab only, never stored on the device or sent anywhere. */
  const PASS = 'yumi-personal-yes';
  const hasPass = () => { try { return window.name === PASS; } catch { return false; } };
  const applyPass = () => {
    if (!hasPass()) return;
    for (const link of $$('a[data-personal-gate]')) link.setAttribute('href', link.dataset.personalDirect);
  };
  applyPass();
  window.addEventListener('pageshow', applyPass);

  /* Keyboard. Each page registers its keys; the Controls window (press ?) lists them. */
  const bindings = [];
  const rows = [];
  const bind = (keys, run) => bindings.push({keys, run});
  const describe = (keys, label) => rows.push({keys, label});
  const isTyping = el => el instanceof HTMLElement && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName)
    || (el.tagName === 'INPUT' && !/^(radio|checkbox|button|submit|reset|range|color|file|image)$/.test(el.type)));
  const scrollsSideways = el => el instanceof HTMLElement && el !== document.body && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible';

  /* Cover: a title-screen menu. The pixel hand jumps to the word you hover; ↑ / ↓ (or j / k) and Enter work too. */
  const menu = $('.cover-choices');
  if (menu) {
    const items = $$('.cover-link', menu);
    const hand = $('.menu-hand', menu);
    let current = -1;
    const place = () => {
      if (current < 0) return;
      const item = items[current];
      menu.style.setProperty('--hand-y', `${item.offsetTop + item.offsetHeight / 2}px`);
    };
    const select = (index, focus = false) => {
      const firstTime = current < 0;
      current = (index + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle('is-current', i === current));
      if (firstTime) menu.classList.add('no-glide');
      place();
      if (firstTime) {
        void hand.offsetWidth;
        menu.classList.remove('no-glide');
      }
      menu.classList.add('has-pointer');
      if (focus) items[current].focus();
    };
    items.forEach((item, i) => {
      item.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || current === i) return;
        // Keys and mouse share one pointer: if a word has keyboard focus, focus follows the mouse too.
        const keyboardFocus = items.includes(document.activeElement);
        select(i);
        if (keyboardFocus) items[i].focus({preventScroll: true});
      });
      item.addEventListener('focus', () => select(i));
    });
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place);
    bind(['ArrowDown', 'j'], event => { event.preventDefault(); select(current < 0 ? 0 : current + 1, true); });
    bind(['ArrowUp', 'k'], event => { event.preventDefault(); select(current < 0 ? items.length - 1 : current - 1, true); });
    bind(['Enter', ' '], event => {
      if (current < 0 || (event.key === 'Enter' && items.includes(document.activeElement))) return;
      event.preventDefault();
      items[current].click();
    });
    describe(['↑', '↓', 'j', 'k'], 'move the pointer');
    describe(['Enter'], 'select');
  }

  /* Personal: the opening sentence is the menu. Pointing at a verb (or focusing it) lifts it, and the line
     underneath says what's behind it. With a verb focused, ← / → move to the next one. */
  const sentence = $('.doors-sentence');
  if (sentence) {
    const doors = $$('.door', sentence);
    const hint = $('.door-hint');
    const note = $('.door-note');
    const resting = note.innerHTML;
    let active = null;
    let timer = 0;
    const show = door => {
      window.clearTimeout(timer);
      if (door === active) return;
      active = door;
      doors.forEach(item => item.classList.toggle('is-active', item === door));
      hint.classList.toggle('is-peeking', Boolean(door));
      if (door) note.textContent = door.dataset.note;
      else note.innerHTML = resting;
      note.classList.remove('is-new');
      void note.offsetWidth;
      note.classList.add('is-new');
    };
    // A short grace period, so the line doesn't flicker back while the mouse crosses the commas.
    const rest = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!doors.includes(document.activeElement)) show(null);
      }, 450);
    };
    doors.forEach((door, i) => {
      door.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(door); });
      door.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') rest(); });
      door.addEventListener('focus', () => show(door));
      door.addEventListener('blur', rest);
      door.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        doors[(i + (event.key === 'ArrowRight' ? 1 : -1) + doors.length) % doors.length].focus();
      });
    });
  }

  /* Personal: step through the entries with j / k; the hand points at the selected one. */
  const cards = $$('.post-card');
  if (cards.length) {
    const step = direction => {
      const active = document.activeElement instanceof Element ? document.activeElement.closest('.post-card') : null;
      let index;
      if (active) index = cards.indexOf(active) + direction;
      else {
        index = cards.findIndex(card => card.getBoundingClientRect().bottom > 96);
        if (index < 0) index = cards.length - 1;
      }
      const card = cards[Math.max(0, Math.min(cards.length - 1, index))];
      $('.card-link', card).focus({preventScroll: true});
      card.scrollIntoView({block: 'center', behavior: moving() ? 'smooth' : 'auto'});
    };
    bind(['j'], () => step(1));
    bind(['k'], () => step(-1));
    describe(['j', 'k'], 'next / previous entry');
    describe(['Enter'], 'open the selected entry');
  }

  /* Articles: ← / → for the previous and next post, b to go back, and a reading-progress bar. */
  const previous = $('.post-navigation .previous');
  const next = $('.post-navigation .next');
  if (previous || next) {
    bind(['ArrowLeft'], event => { if (previous && !scrollsSideways(event.target)) previous.click(); });
    bind(['ArrowRight'], event => { if (next && !scrollsSideways(event.target)) next.click(); });
    describe(['←', '→'], 'previous / next post');
  }
  const back = $('.back-to-blog, .travel-back, .books-back');
  if (back) {
    bind(['b'], () => back.click());
    describe(['b'], back.classList.contains('back-to-blog') ? 'back to the blog' : 'back to writing');
  }
  // "Level complete": the marker pops once when you reach the end of a post.
  const level = $('.level-complete');
  if (level && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      level.classList.add('is-reached');
      seen.disconnect();
    }, {threshold: .6});
    seen.observe(level);
  }
  const progress = $('.reading-progress');
  const article = $('.article-body');
  if (progress && article) {
    let queued = false;
    const update = () => {
      queued = false;
      const box = article.getBoundingClientRect();
      const distance = box.height - window.innerHeight;
      const value = distance > 0 ? -box.top / distance : (box.bottom <= window.innerHeight ? 1 : 0);
      progress.style.setProperty('--progress', Math.min(1, Math.max(0, value)).toFixed(4));
    };
    const queue = () => { if (!queued) { queued = true; window.requestAnimationFrame(update); } };
    progress.hidden = false;
    window.addEventListener('scroll', queue, {passive: true});
    window.addEventListener('resize', queue);
    update();
  }

  /* Travel and reading: j / k jump between the markers on the side track. */
  const track = $('.travel-contents, .book-years');
  if (track) {
    const go = direction => {
      const links = $$('.timeline-link', track).filter(link => !link.hidden);
      if (!links.length) return;
      let index = links.findIndex(link => link.getAttribute('aria-current') === 'true');
      const section = index < 0 ? null : document.getElementById(decodeURIComponent(links[index].hash.slice(1)));
      // Still above the marked section (reading the intro): the first j goes to that section itself.
      const line = track.classList.contains('book-years') ? 140 : window.innerHeight * .28; // same lines as books.js / timeline.js
      const reached = section && section.getBoundingClientRect().top <= line + 2;
      index = index < 0 ? 0 : (direction > 0 && !reached ? index : index + direction);
      if (index >= 0 && index < links.length) links[index].click();
    };
    bind(['j'], () => go(1));
    bind(['k'], () => go(-1));
    describe(['j', 'k'], track.classList.contains('book-years') ? 'next / previous year' : 'next / previous waypoint');
  }
  // Travel: the score counts up on arrival.
  const counts = $$('[data-count]');
  if (counts.length && moving()) {
    const start = performance.now();
    const duration = 1300;
    // Hold each number's final width while it counts, so the labels beside it stay still.
    counts.forEach(el => { el.style.minWidth = `${el.getBoundingClientRect().width}px`; });
    const tickCounts = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 4;
      counts.forEach(el => { el.textContent = String(Math.round(Number(el.dataset.count) * eased)); });
      if (t < 1) window.requestAnimationFrame(tickCounts);
      else counts.forEach(el => { el.style.minWidth = ''; });
    };
    window.requestAnimationFrame(tickCounts);
  }

  // Research: the Dino arena's keys work while the game has focus (dino.js handles them).
  if ($('.arena-canvas')) {
    describe(['Space', '↑'], 'jump (click the game first)');
    describe(['↓'], 'duck');
  }

  const search = $('#book-search');
  if (search) {
    bind(['/'], event => {
      if (search.closest('[hidden]')) return;
      event.preventDefault();
      search.focus();
      search.select();
    });
    describe(['/'], 'find a title or author');
    describe(['Esc'], 'clear the search');
  }

  /* Game over: infinite continues. */
  const continues = $('.continue-count');
  if (continues) {
    continues.closest('.continue').hidden = false;
    let left = Number(continues.textContent) || 9;
    const timer = window.setInterval(() => {
      left -= 1;
      if (left >= 0) {
        continues.textContent = String(left);
        return;
      }
      window.clearInterval(timer);
      continues.textContent = '∞';
      continues.classList.add('is-infinite');
    }, 1000);
    const respawn = $('.respawn');
    bind(['Enter', 'r'], event => {
      if (document.activeElement && document.activeElement !== body && event.key === 'Enter') return;
      respawn.click();
    });
    describe(['Enter', 'r'], 'respawn');
  }

  /* Controls window. */
  const pageKeys = rows.length;
  describe(['?'], 'show or hide controls');
  let controls = null;
  const buildControls = () => {
    controls = document.createElement('dialog');
    controls.className = 'window-dialog controls-window';
    controls.setAttribute('aria-labelledby', 'controls-title');
    controls.innerHTML = `<header class="window-header"><h2 class="window-title" id="controls-title">Controls</h2>`
      + `<button class="window-close" type="button" aria-label="Close"><span aria-hidden="true">×</span></button></header>`
      + `<dl class="controls-list">${rows.map(row => `<div class="controls-row"><dt>${row.keys.map(key => `<kbd>${key}</kbd>`).join('')}</dt><dd>${row.label}</dd></div>`).join('')}</dl>`
      + `<p class="window-note">Every key is optional. Mouse, touch and Tab work everywhere.</p>`;
    body.append(controls);
    $('.window-close', controls).addEventListener('click', () => controls.close());
    let pressedOutside = false;
    const outside = event => {
      if (event.target !== controls) return false;
      const box = controls.getBoundingClientRect();
      return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    };
    controls.addEventListener('pointerdown', event => { pressedOutside = outside(event); });
    controls.addEventListener('click', event => {
      if (pressedOutside && outside(event)) controls.close();
      pressedOutside = false;
    });
  };
  const toggleControls = () => {
    if (!controls) buildControls();
    if (controls.open) controls.close();
    else controls.showModal();
  };
  if (!isEntrance && pageKeys) {
    const hud = document.createElement('button');
    hud.type = 'button';
    hud.className = 'controls-hud';
    hud.innerHTML = 'controls <kbd aria-hidden="true">?</kbd>';
    hud.setAttribute('aria-label', 'Keyboard controls');
    hud.addEventListener('click', toggleControls);
    body.append(hud);
  }
  window.addEventListener('pagehide', () => { if (controls?.open) controls.close(); });

  /* One hidden cheat code. */
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let entered = 0;
  // Returns true when the key belongs to a code in progress, so ← / → and b don't also navigate.
  const trackCode = key => {
    const before = entered;
    if (key === CODE[before]) {
      entered = before + 1;
      if (entered === CODE.length) {
        entered = 0;
        cheat();
        return true;
      }
      return before >= 4;
    }
    entered = key === 'ArrowUp' ? (before === 2 ? 2 : 1) : 0;
    return false;
  };
  const bell = (() => {
    const points = Array.from({length: 41}, (_, i) => {
      const t = i / 40 * 6 - 3;
      return `${(6 + i / 40 * 24).toFixed(2)} ${(25 - 15 * Math.exp(-t * t / 2)).toFixed(2)}`;
    });
    const line = `M${points.join(' L')}`;
    return `<svg viewBox="0 0 36 36" width="36" height="36" focusable="false"><path d="${line} L30 25 L6 25 Z" fill="currentColor" opacity=".14"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  })();
  const confetti = origin => {
    const box = origin.getBoundingClientRect();
    const colors = ['#284ed1', '#20201e', '#7d8fd4', '#19399f'];
    for (let i = 0; i < 30; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti';
      bit.style.background = colors[i % colors.length];
      body.append(bit);
      const x = box.left + 24 + Math.random() * Math.max(40, box.width - 48);
      const y = box.top + 8;
      const drift = (Math.random() - .5) * 280;
      const rise = 110 + Math.random() * 170;
      const turn = Math.round(Math.random() * 4) * 90;
      bit.animate([
        {transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1},
        {transform: `translate(${x + drift * .6}px, ${y - rise}px) rotate(${turn}deg)`, opacity: 1, offset: .45},
        {transform: `translate(${x + drift}px, ${y - rise + 240}px) rotate(${turn * 2}deg)`, opacity: 0}
      ], {duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(.2, .7, .4, 1)'}).onfinish = () => bit.remove();
    }
  };
  let toastTimer = 0;
  const cheat = () => {
    $('.toast')?.remove();
    window.clearTimeout(toastTimer);
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    body.append(toast);
    toast.innerHTML = `<span class="toast-avatar" aria-hidden="true">${bell}</span><div><p class="toast-title">cheat code accepted</p><p>Posterior on ‘you play games’ → <b>0.50</b></p></div>`;
    const value = $('b', toast);
    const start = performance.now();
    const duration = moving() ? 1200 : 0;
    const count = now => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      value.textContent = (0.5 + 0.49 * (1 - (1 - t) ** 3)).toFixed(2);
      if (t < 1) window.requestAnimationFrame(count);
    };
    window.requestAnimationFrame(count);
    if (moving()) confetti(toast);
    toastTimer = window.setTimeout(() => {
      if (!moving()) { toast.remove(); return; }
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), {once: true});
    }, 5200);
  };

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    if (isTyping(event.target)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (trackCode(key)) return;
    const openDialog = $('dialog[open]');
    if (key === '?') {
      if (openDialog && openDialog !== controls) return;
      event.preventDefault();
      toggleControls();
      return;
    }
    if (openDialog) return;
    const binding = bindings.find(({keys}) => keys.includes(key));
    if (binding) binding.run(event);
  });
})();
