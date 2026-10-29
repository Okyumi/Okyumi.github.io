/* Dino arena (research page). The top row is yours. Underneath, a Deep Q-Network learns the same game:
   every attempt it makes gets its own row, in order, and a row freezes where that attempt crashed.
   Training stops once an attempt reaches 1,000 points.
   The rules and the learner are in dino-core.js. Training runs in a Web Worker made from that same source
   (or in short slices on the page when workers are unavailable), so the game stays smooth.
   Nothing is stored: every visit trains a new agent. */
(() => {
  const root = document.querySelector('.arena');
  if (!root || typeof window.dinoCore !== 'function') return;
  const core = window.dinoCore();
  const {RULES, Runner, Policy, ACTIONS} = core;
  const $ = selector => root.querySelector(selector);
  const board = $('.arena-board');
  const canvas = $('.arena-canvas');
  const yourRow = canvas.parentElement;
  const list = $('[data-attempts]');
  const ui = {
    playerHi: $('[data-player-hi]'), playerScore: $('[data-player-score]'), playerPrompt: $('[data-player-prompt]'),
    hud: $('[data-hud]'), status: $('#arena-status'),
    train: $('[data-action="train"]'), speed: $('[data-action="speed"]'), again: $('[data-action="again"]')
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchFirst = window.matchMedia('(hover: none), (pointer: coarse)');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pad = n => String(Math.min(99999, Math.floor(n))).padStart(5, '0');
  const randomSeed = () => (Math.random() * 4294967296) >>> 0;

  /* Pixel art: x is the body colour, w is white, . is transparent. Two world units per pixel. */
  const ART = {
    run1: ['............xxxxxxxx..', '...........xxwxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxx......', '...........xxxxxxxx...', 'x.........xxxxx.......', 'x........xxxxxx.......', 'xx......xxxxxxxxx.....', 'xxx....xxxxxxxx.x.....', 'xxxx..xxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', '.xxxxxxxxxxxxx........', '..xxxxxxxxxxxx........', '...xxxxxxxxxx.........', '....xxxxxxxx..........', '.....xxx.xxx..........', '.....xx...xxx.........', '.....x................', '.....xx...............'],
    run2: ['............xxxxxxxx..', '...........xxwxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxx......', '...........xxxxxxxx...', 'x.........xxxxx.......', 'x........xxxxxx.......', 'xx......xxxxxxxxx.....', 'xxx....xxxxxxxx.x.....', 'xxxx..xxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', '.xxxxxxxxxxxxx........', '..xxxxxxxxxxxx........', '...xxxxxxxxxx.........', '....xxxxxxxx..........', '.....xxx.xxx..........', '....xxx....x..........', '...........x..........', '...........xx.........'],
    stand: ['............xxxxxxxx..', '...........xxwxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxx......', '...........xxxxxxxx...', 'x.........xxxxx.......', 'x........xxxxxx.......', 'xx......xxxxxxxxx.....', 'xxx....xxxxxxxx.x.....', 'xxxx..xxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', '.xxxxxxxxxxxxx........', '..xxxxxxxxxxxx........', '...xxxxxxxxxx.........', '....xxxxxxxx..........', '.....xxx.xxx..........', '.....xx...xx..........', '.....x.....x..........', '.....xx....xx.........'],
    dead: ['............xxxxxxxx..', '...........xwxwxxxxxxx', '...........xxwxxxxxxxx', '...........xwxwxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxxxxx', '...........xxxxxxxx...', 'x.........xxxxx.......', 'x........xxxxxx.......', 'xx......xxxxxxxxx.....', 'xxx....xxxxxxxx.x.....', 'xxxx..xxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', 'xxxxxxxxxxxxxxx.......', '.xxxxxxxxxxxxx........', '..xxxxxxxxxxxx........', '...xxxxxxxxxx.........', '....xxxxxxxx..........', '.....xxx.xxx..........', '.....xx...xx..........', '.....x.....x..........', '.....xx....xx.........'],
    duck1: ['x..................xxxxxxxx...', 'xx.......xxxxxxxxxxxwxxxxxxx..', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxxxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxxxxxxxxxxxxxxxx.', '...xxxxxxxxxxxxxxxxxxxxx......', '....xxxxxxxxxxxxx.xxxxxxxx....', '.....xxxxxxxxxxx..x...........', '......xxx..xxx................', '......xx.....xx...............', '......x.......................', '......xx......................'],
    duck2: ['x..................xxxxxxxx...', 'xx.......xxxxxxxxxxxwxxxxxxx..', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxxxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxxxxxxxxxxxxxxxx.', '...xxxxxxxxxxxxxxxxxxxxx......', '....xxxxxxxxxxxxx.xxxxxxxx....', '.....xxxxxxxxxxx..x...........', '......xxx..xxx................', '.....xxx.....x................', '.............x................', '.............xx...............'],
    small: ['...xx...', '..xxxx..', '..xxxx..', '..xxxx.x', 'x.xxxx.x', 'x.xxxx.x', 'x.xxxx.x', 'x.xxxxxx', 'x.xxxxx.', 'xxxxxx..', '.xxxxx..', '..xxxx..', '..xxxx..', '..xxxx..', '..xxxx..', '..xxxx..', '..xxxx..'],
    large: ['.....xx.....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx..x.', '....xxxx.xxx', '.x..xxxx.xxx', 'xxx.xxxx.xxx', 'xxx.xxxx.xxx', 'xxx.xxxx.xxx', 'xxx.xxxx.xxx', 'xxx.xxxxxxxx', 'xxx.xxxxxxx.', 'xxxxxxxx....', '.xxxxxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....', '....xxxx....'],
    bird1: ['..........x............', '..........xx...........', '..........xxx..........', '..........xxxx.........', '....x.....xxxxx........', '...xx.....xxxxxx.......', '..xwx.....xxxxxxx......', '.xxxxxxxxxxxxxxxxx.....', 'xxxxxxxxxxxxxxxxxxxxxxx', '......xxxxxxxxxxxxxxx..', '.......xxxxxxxxxxxx....', '.......................', '.......................', '.......................'],
    bird2: ['.......................', '.......................', '.......................', '.......................', '....x..................', '...xx..................', '..xwx..................', '.xxxxxxxxxxxxxxxxx.....', 'xxxxxxxxxxxxxxxxxxxxxxx', '......xxxxxxxxxxxxxxx..', '.......xxxxxxxxxxxx....', '..........xxxxxxx......', '..........xxxxx........', '..........xxx..........']
  };
  const PIXEL = 2;
  const SPRITES = {};
  for (const [name, rows] of Object.entries(ART)) {
    const body = [], white = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let end = x + 1;
        while (end < row.length && row[end] === c) end++;
        if (c === 'x') body.push([x, end, y]);
        else if (c === 'w') white.push([x, end, y]);
        x = end;
      }
    });
    SPRITES[name] = {body, white, h: rows.length};
  }
  const INK = '#20201e', BLUE = '#284ed1', PAPER = '#ffffff', PEBBLE = 'rgba(32, 32, 30, 0.34)', RULE = 'rgba(32, 32, 30, 0.12)';


  /* Layout: the world is measured in units and scaled to the column's width, so the rules never change.
     Every row (yours and each attempt) is one canvas of the same size. */
  const SKY = 136;   // world units above the ground (the highest jump reaches about 131)
  const BELOW = 18;  // world units under the ground line
  let view = {width: 0, scale: 1, dpr: 1, height: 0, units: 600};
  const surface = el => ({el, ctx: el.getContext('2d', {alpha: false})});
  const you = surface(canvas);
  const rows = [];   // one per attempt: {li, world: surface, name, score, scene, status}
  const fit = s => {
    s.el.width = Math.round(view.width * view.dpr);
    s.el.height = Math.round(view.height * view.dpr);
  };
  const layout = () => {
    const width = Math.round(board.clientWidth) || 600;
    const scale = Math.min(1.3, Math.max(0.6, width / 720));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const height = Math.round((SKY + BELOW) * scale);
    if (width === view.width && dpr === view.dpr && height === view.height) return;
    view = {width, scale, dpr, height, units: width / scale};
    board.style.setProperty('--world', height + 'px');
    fit(you);
    for (const row of rows) {
      fit(row.world);
      if (row.scene) drawWorld(row.world, row.scene, INK, row.status);
    }
    paint(true);
  };

  /* Drawing. Pixel edges are rounded to device pixels, so the art stays crisp at any scale. */
  const groundY = () => SKY * view.scale * view.dpr;
  const runs = (ctx, spans, left, top, u) => {
    for (const [x0, x1, row] of spans) {
      const X0 = Math.round(left + x0 * u), X1 = Math.round(left + x1 * u);
      const Y0 = Math.round(top + row * u), Y1 = Math.round(top + (row + 1) * u);
      ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    }
  };
  const sprite = (ctx, name, x, y, color) => {
    const s = SPRITES[name], k = view.scale * view.dpr, u = PIXEL * k;
    const left = x * k, top = groundY() - (y + s.h * PIXEL) * k;
    ctx.fillStyle = color;
    runs(ctx, s.body, left, top, u);
    if (s.white.length) {
      ctx.fillStyle = PAPER;
      runs(ctx, s.white, left, top, u);
    }
  };
  const hash = i => {
    let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    t ^= t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);
    return ((t ^ t >>> 16) >>> 0) / 4294967296;
  };
  const ground = (ctx, width, distance) => {
    const k = view.scale * view.dpr, y = Math.round(groundY());
    ctx.fillStyle = INK;
    ctx.fillRect(0, y, width, Math.max(1, Math.round(k)));
    ctx.fillStyle = PEBBLE;
    const step = 26, first = Math.floor(distance / step) - 1;
    for (let i = first; (i - first - 1) * step < view.units + step; i++) {
      const h = hash(i);
      if (h < 0.42) continue;
      const x = i * step + (h * 977 % 1) * step - distance;
      const length = 2 + Math.floor(h * 31) % 3 * 2;
      const depth = 5 + Math.floor(h * 17) % 3 * 4;
      ctx.fillRect(Math.round(x * k), y + Math.round(depth * k), Math.max(1, Math.round(length * k)), Math.max(1, Math.round(k)));
    }
  };
  const drawObstacles = (ctx, game) => {
    for (const o of game.obstacles) {
      if (o.x > view.units + 8 || o.x + o.w < -8) continue;
      if (o.kind === 'bird') sprite(ctx, Math.floor((game.frames + o.flap) / 12) % 2 ? 'bird2' : 'bird1', o.x, o.bottom, INK);
      else {
        const each = o.kind === 'large' ? 25 : 17;
        for (let i = 0; i < o.count; i++) sprite(ctx, o.kind, o.x + i * each + 0.5, 0, INK);
      }
    }
  };
  const pose = (game, status) => {
    if (status === 'over' || status === 'crashed') return 'dead';
    if (status !== 'playing' && status !== 'running' && status !== 'solved') return 'stand';
    if (!game.grounded) return 'stand';
    const step = Math.floor(game.frames / 6) % 2;
    if (game.ducking) return step ? 'duck2' : 'duck1';
    return step ? 'run2' : 'run1';
  };
  function drawWorld(s, game, color, status) {
    const {ctx, el} = s;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, el.width, el.height);
    ground(ctx, el.width, game.distance);
    drawObstacles(ctx, game);
    sprite(ctx, pose(game, status), RULES.dinoX, game.y, color);
  }

  /* State. Phases: idle → training → solved. */
  let phase = 'idle';
  let userPaused = false;
  let fastForward = true;
  const player = {game: new Runner(randomSeed()), status: 'ready', hi: 0, jump: 0, duck: false, overAt: -999};
  const agent = {game: new Runner(randomSeed()), status: 'waiting', attempt: 0, best: 0, k: 0, action: 0, wait: 0, policy: new Policy(null)};
  const entries = [];
  const training = {trainer: null, running: false, steps: 0, sps: 0, epsilon: 1, checkpoint: 0, weights: null, activeMs: 0, kind: '', solvedText: ''};
  let ticks = 0;

  /* Attempt rows: a new one at the bottom for every attempt; the finished ones keep their last frame. */
  const liveRow = () => rows[rows.length - 1];
  const addRow = attempt => {
    const li = document.createElement('li');
    li.className = 'arena-row is-live';
    li.innerHTML = `<p class="row-head"><span class="row-name">DQN attempt ${attempt}</span><span class="row-score">00000</span></p><canvas aria-hidden="true"></canvas>`;
    list.append(li);
    const row = {li, world: surface(li.querySelector('canvas')), name: li.querySelector('.row-name'), score: li.querySelector('.row-score'), scene: null, status: 'running', shown: ''};
    fit(row.world);
    rows.push(row);
    return row;
  };
  const freezeRow = (status, solved = false) => {
    const row = liveRow();
    if (!row || row.scene) return;
    row.scene = agent.game.copy();
    row.status = status;
    drawWorld(row.world, row.scene, INK, status);
    row.score.textContent = pad(row.scene.score);
    row.li.classList.remove('is-live');
    if (solved) {
      row.li.classList.add('is-solved');
      row.name.textContent = `DQN attempt ${agent.attempt} · solved`;
    }
  };
  const clearRows = () => {
    rows.length = 0;
    list.replaceChildren();
  };
  const announce = message => { ui.status.textContent = message; };

  /* Score box (opens from its toggle): one line per attempt, in order, and the running one at the end.
     The bar has a block for every 100 points, up to the 1,000 that solves the game. */
  const scoreList = root.querySelector('[data-score-list]');
  const scoreBox = scoreList ? scoreList.closest('.score-box') : null;
  const fillOf = score => score > 0 ? Math.min(10, Math.ceil(score / 100)) / 10 : 0;
  const scoreLine = ({attempt, score, live = false, solved = false}) => `<li class="score-entry${live ? ' is-live' : ''}${solved ? ' is-solved' : ''}">`
    + `<span class="score-n" aria-hidden="true">${String(attempt).padStart(2, '0')}</span>`
    + `<span class="score-bar" style="--fill: ${fillOf(score)}" aria-hidden="true"></span>`
    + `<span class="score-value" aria-hidden="true">${pad(score)}</span>`
    + `<span class="sr-only">Attempt ${attempt}: ${live ? 'running' : `${fmt(score)} points${solved ? ', solved' : ''}`}</span></li>`;
  const emptyLine = '<li class="score-entry is-empty" aria-hidden="true"><span class="score-n">--</span><span class="score-bar"></span><span class="score-value">-----</span></li>';
  const scores = {key: '', live: null, shown: -1};
  const syncScores = () => {
    if (!scoreBox || scoreBox.hidden) return;
    const running = phase === 'training' && agent.status === 'running';
    const key = `${phase}|${entries.length}|${running ? agent.attempt : 0}`;
    if (key !== scores.key) {
      scores.key = key;
      const lines = entries.map(scoreLine);
      if (running) lines.push(scoreLine({attempt: agent.attempt, score: agent.game.score, live: true}));
      scoreList.innerHTML = lines.join('') || emptyLine;
      scores.live = running ? scoreList.lastElementChild : null;
      scores.shown = -1;
    }
    if (scores.live && scores.shown !== agent.game.score) {
      scores.shown = agent.game.score;
      scores.live.querySelector('.score-value').textContent = pad(agent.game.score);
      scores.live.querySelector('.score-bar').style.setProperty('--fill', fillOf(agent.game.score));
    }
  };
  scoreBox?.addEventListener('window-open', () => { scores.key = ''; syncScores(); });

  /* Training: the worker posts progress four times a second and a checkpoint whenever its network
     beats the best so far on six fixed practice courses (checked every two seconds). */
  function trainerMain(dinoCore, io) {
    const core = dinoCore();
    const COURSES = [11, 22, 33, 44, 55, 66];
    let trainer = null, running = false, timer = 0, bestMean = -1, lastEval = 0, lastReport = 0, samples = [];
    const loop = () => {
      timer = 0;
      if (!running) return;
      trainer.run(io.slice);
      const now = Date.now();
      samples.push([now, trainer.steps]);
      while (samples.length > 2 && now - samples[0][0] > 1500) samples.shift();
      if (now - lastEval >= 2000) {
        lastEval = now;
        const results = core.evaluate(trainer.weights(), COURSES);
        const mean = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        if (mean > bestMean) {
          bestMean = mean;
          const weights = trainer.weights();
          io.post({type: 'checkpoint', weights, mean, steps: trainer.steps}, [weights.buffer]);
        }
      }
      if (now - lastReport >= 250) {
        lastReport = now;
        const [t0, s0] = samples[0];
        const sps = now > t0 ? (trainer.steps - s0) / (now - t0) * 1000 : 0;
        io.post({type: 'progress', steps: trainer.steps, episodes: trainer.episodes, epsilon: trainer.epsilon, sps});
      }
      timer = setTimeout(loop, io.gap);
    };
    io.listen(message => {
      if (message.type === 'start') {
        trainer = new core.Trainer({seed: message.seed});
        bestMean = -1;
        lastEval = lastReport = Date.now();
        samples = [];
        const weights = trainer.weights();
        io.post({type: 'checkpoint', weights, mean: 0, steps: 0}, [weights.buffer]);
        running = true;
        if (!timer) loop();
      } else if (message.type === 'pause') {
        running = false;
        clearTimeout(timer);
        timer = 0;
      } else if (message.type === 'resume' && trainer && !running) {
        running = true;
        samples = [];
        loop();
      }
    });
  }
  const pageTrainer = () => {
    let handler = () => {};
    trainerMain(window.dinoCore, {post: message => receive(message), listen: f => { handler = f; }, slice: 6, gap: 16});
    return {send: message => handler(message), stop: () => handler({type: 'pause'}), kind: 'page'};
  };
  const createTrainer = () => {
    if (typeof Worker !== 'function' || typeof Blob !== 'function') return pageTrainer();
    try {
      const source = `${window.dinoCore.toString()}\n(${trainerMain.toString()})(dinoCore, {post: (m, t) => postMessage(m, t), listen: f => { onmessage = e => f(e.data); }, slice: 40, gap: 0});`;
      const url = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
      const worker = new Worker(url);
      const handle = {kind: 'worker', queue: [], fallback: null};
      handle.send = message => {
        if (handle.fallback) handle.fallback.send(message);
        else worker.postMessage(message);
        if (handle.queue) handle.queue.push(message);
      };
      handle.stop = () => { worker.terminate(); handle.fallback?.stop(); };
      worker.onmessage = event => {
        handle.queue = null;
        URL.revokeObjectURL(url);
        if (handle === training.trainer) receive(event.data);
      };
      // If the worker cannot start (a strict browser policy, for example), train on the page instead.
      worker.onerror = event => {
        event.preventDefault?.();
        worker.terminate();
        if (handle.queue === null || handle.fallback) return;
        handle.fallback = pageTrainer();
        handle.kind = 'page';
        training.kind = 'page';
        for (const message of handle.queue) handle.fallback.send(message);
      };
      return handle;
    } catch {
      return pageTrainer();
    }
  };
  function receive(message) {
    if (phase !== 'training') return;
    if (message.type === 'checkpoint') {
      training.weights = message.weights;
      training.checkpoint = message.mean;
      if (agent.status === 'waiting') startAttempt();
    } else if (message.type === 'progress') {
      training.steps = message.steps;
      training.sps = message.sps;
      training.epsilon = message.epsilon;
    }
  }
  const stopTrainer = () => {
    training.trainer?.stop();
    training.trainer = null;
    training.running = false;
  };
  const startTraining = () => {
    stopTrainer();
    phase = 'training';
    userPaused = false;
    entries.length = 0;
    clearRows();
    Object.assign(training, {steps: 0, sps: 0, epsilon: 1, checkpoint: 0, weights: null, activeMs: 0, solvedText: ''});
    Object.assign(agent, {game: new Runner(randomSeed()), status: 'waiting', attempt: 0, best: 0, k: 0, action: 0, wait: 0});
    training.trainer = createTrainer();
    training.kind = training.trainer.kind;
    training.trainer.send({type: 'start', seed: randomSeed()});
    training.running = true;
    announce('Training started.');
    sync();
  };

  /* Each attempt plays the best network so far on a new course, at 1× or 3×. */
  const startAttempt = () => {
    agent.attempt++;
    agent.game = new Runner(randomSeed());
    agent.policy.load(training.weights);
    agent.k = 0;
    agent.action = 0;
    agent.status = 'running';
    addRow(agent.attempt);
  };
  const stepAgent = () => {
    if (agent.status === 'running') {
      if (agent.k === 0) agent.action = agent.policy.decide(agent.game).action;
      // Same sequence of frames as core.act(), so the row matches the evaluation in the worker exactly.
      const crashed = agent.game.frame(agent.action === 1 && agent.k === 0, agent.action === 2);
      agent.k = (agent.k + 1) % RULES.repeat;
      if (crashed) {
        agent.status = 'crashed';
        agent.wait = 30;
        agent.best = Math.max(agent.best, agent.game.score);
        entries.push({attempt: agent.attempt, score: agent.game.score, cause: agent.game.cause});
        freezeRow('crashed');
      } else if (agent.game.score >= RULES.target) solve();
    } else if (agent.status === 'crashed' && phase === 'training' && --agent.wait <= 0) startAttempt();
  };
  const solve = () => {
    phase = 'solved';
    agent.status = 'solved';
    agent.best = Math.max(agent.best, agent.game.score);
    entries.push({attempt: agent.attempt, score: agent.game.score, solved: true});
    freezeRow('solved', true);
    stopTrainer();
    const seconds = Math.max(1, Math.round(training.activeMs / 1000));
    const time = seconds < 90 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
    training.solvedText = `solved on attempt ${agent.attempt} · ${fmt(training.steps)} training steps · ${time}`;
    announce(`Solved. The agent reached 1,000 points on attempt ${agent.attempt}.`);
    sync();
  };

  /* Your row. */
  const startPlayer = () => {
    player.game = new Runner(randomSeed());
    player.status = 'playing';
    player.jump = 6; // starting a run is a jump, like the original
    player.duck = false;
  };
  const press = () => {
    if (player.status === 'playing') { player.jump = 6; return; } // remembered for 0.1 s, so an early press still lands
    if (player.status === 'over' && ticks - player.overAt < 24) return;
    startPlayer();
  };
  const stepPlayer = () => {
    if (player.status !== 'playing') return;
    const jump = player.jump > 0 && player.game.grounded;
    player.jump = jump ? 0 : Math.max(0, player.jump - 1);
    if (player.game.frame(jump, player.duck)) {
      player.status = 'over';
      player.overAt = ticks;
      player.duck = false;
      player.hi = Math.max(player.hi, player.game.score);
      announce(`Game over. You scored ${fmt(player.game.score)}.`);
    }
  };

  /* The loop: fixed 60 Hz steps, drawn on animation frames. advanceTime() takes over for tests. */
  const STEP = 1000 / 60;
  let rafId = 0, looping = false, last = 0, carry = 0, manual = false;
  let visible = !document.hidden, onScreen = false;
  const tick = () => {
    ticks++;
    stepPlayer();
    const agentSteps = phase === 'training' ? (userPaused ? 0 : fastForward ? 3 : 1) : 0;
    for (let i = 0; i < agentSteps; i++) stepAgent();
  };
  const loop = now => {
    rafId = window.requestAnimationFrame(loop);
    const dt = last ? Math.min(100, now - last) : STEP;
    last = now;
    if (!manual) {
      carry += dt;
      let n = 0;
      while (carry >= STEP && n < 6) { tick(); carry -= STEP; n++; }
      if (n === 6) carry = 0;
    }
    if (training.running) training.activeMs += dt;
    paint();
  };
  const startLoop = () => {
    if (looping) return;
    looping = true;
    last = 0;
    rafId = window.requestAnimationFrame(loop);
  };
  const stopLoop = () => {
    window.cancelAnimationFrame(rafId);
    looping = false;
  };

  /* Text on and around the rows. Only touched when something changed. */
  const shown = {};
  const setText = (el, key, value) => {
    if (shown[key] === value) return;
    shown[key] = value;
    el.textContent = value;
  };
  const playerPrompt = () => {
    const touch = touchFirst.matches;
    if (player.status === 'ready') return touch ? 'Tap to play' : document.activeElement === canvas ? 'Press Space to play' : 'Click here to play';
    if (player.status === 'over') return `Game over · ${touch ? 'tap' : 'press Space'} to play again`;
    return '';
  };
  const hudText = () => {
    if (phase === 'solved') return training.solvedText;
    if (phase !== 'training') return '';
    return `${fmt(training.steps)} training steps · ε ${training.epsilon.toFixed(2)}${userPaused ? ' · paused' : ''}`;
  };
  let hudShown = 0;
  const paint = (force = false) => {
    drawWorld(you, player.game, BLUE, player.status);
    const row = liveRow();
    if (row && !row.scene) {
      drawWorld(row.world, agent.game, INK, agent.status);
      const score = pad(agent.game.score);
      if (row.shown !== score) { row.shown = score; row.score.textContent = score; }
    }
    setText(ui.playerScore, 'ps', pad(player.game.score));
    setText(ui.playerHi, 'ph', pad(Math.max(player.hi, player.status === 'over' ? player.game.score : 0)));
    setText(ui.playerPrompt, 'pp', playerPrompt());
    yourRow.classList.toggle('is-playing', player.status === 'playing');
    syncScores();
    const now = performance.now();
    if (force || now - hudShown > 250) {
      hudShown = now;
      setText(ui.hud, 'hud', hudText());
    }
  };

  /* Buttons. */
  const syncButtons = () => {
    const done = phase === 'solved';
    ui.train.hidden = done;
    ui.train.textContent = phase === 'idle' ? 'Start training' : userPaused ? 'Resume training' : 'Pause training';
    ui.speed.hidden = done;
    ui.speed.setAttribute('aria-pressed', String(fastForward));
    ui.again.hidden = !done;
  };
  // Run only what can be seen: the loop needs the arena on screen, training also needs it not paused.
  const sync = () => {
    const live = visible && onScreen;
    if (live) startLoop();
    else stopLoop();
    if (phase === 'training' && training.trainer) {
      const run = live && !userPaused;
      if (run && !training.running) training.trainer.send({type: 'resume'});
      else if (!run && training.running) training.trainer.send({type: 'pause'});
      training.running = run;
    }
    syncButtons();
    paint(true);
  };
  ui.train.addEventListener('click', () => {
    if (phase === 'idle') startTraining();
    else if (phase === 'training') {
      userPaused = !userPaused;
      announce(userPaused ? 'Training paused.' : 'Training resumed.');
      sync();
    }
  });
  ui.speed.addEventListener('click', () => {
    fastForward = !fastForward;
    syncButtons();
  });
  ui.again.addEventListener('click', startTraining);

  /* Controls: only while the game itself has focus, so Space still scrolls the page everywhere else. */
  canvas.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || !onScreen) return;
    if (event.key === ' ' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!event.repeat) press();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (player.status === 'playing') player.duck = true;
    }
  });
  canvas.addEventListener('keyup', event => { if (event.key === 'ArrowDown') player.duck = false; });
  canvas.addEventListener('focus', () => paint(true));
  canvas.addEventListener('blur', () => { player.duck = false; paint(true); });
  // Tap or click to jump; on touch screens, swipe down to duck (and drop faster in the air).
  let gesture = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (document.activeElement !== canvas) canvas.focus({preventScroll: true});
    gesture = {id: event.pointerId, y: event.clientY, ducking: false};
    press();
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id || event.pointerType === 'mouse') return;
    if (!gesture.ducking && event.clientY - gesture.y > 22 && player.status === 'playing') {
      gesture.ducking = true;
      player.duck = true;
    }
  });
  const release = event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.ducking) player.duck = false;
    gesture = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  /* Training starts when your row comes into view (not with reduced motion: then it waits for the button),
     and keeps going while any part of the arena, including the rows far below, is on screen. */
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    sync();
  });
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  }, {threshold: 0}).observe(root);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && phase === 'idle' && !reducedMotion.matches) startTraining();
  }, {threshold: 0.2}).observe(yourRow);
  new ResizeObserver(() => layout()).observe(board);
  root.classList.add('is-ready');
  layout();
  syncButtons();

  /* Test hooks: a text view of the game and a deterministic clock. */
  const obstaclesText = game => game.obstacles.filter(o => o.x < view.units && o.x + o.w > 0)
    .map(o => ({kind: o.kind === 'bird' ? ['low', 'middle', 'high'][o.level] + ' bird' : `${o.count} ${o.kind} cact${o.count > 1 ? 'i' : 'us'}`, x: Math.round(o.x), w: o.w, bottom: o.bottom, top: o.top}));
  window.render_game_to_text = () => JSON.stringify({
    coordinates: 'world units; x grows to the right from the row’s left edge, y is height above the ground; the dinosaur’s left edge is at x = 48',
    phase,
    fastForward,
    view: {units: Math.round(view.units), scale: +view.scale.toFixed(3), rowHeight: view.height},
    player: {status: player.status, score: player.game.score, hi: player.hi, y: +player.game.y.toFixed(1), vy: +player.game.vy.toFixed(2), grounded: player.game.grounded, ducking: player.game.ducking, speed: +player.game.speed.toFixed(2), obstacles: obstaclesText(player.game)},
    agent: {status: agent.status, attempt: agent.attempt, score: agent.game.score, best: agent.best, action: ACTIONS[agent.action], obstacles: obstaclesText(agent.game)},
    training: {running: training.running, paused: userPaused, steps: training.steps, stepsPerSecond: Math.round(training.sps), epsilon: +training.epsilon.toFixed(3), checkpoint: Math.round(training.checkpoint), where: training.kind},
    rows: rows.length,
    frozenRows: rows.filter(row => row.scene).length,
    scoreBox: scoreBox && !scoreBox.hidden ? [...scoreList.querySelectorAll('.score-entry:not(.is-empty)')].map(li => li.querySelector('.score-n').textContent + ' ' + li.querySelector('.score-value').textContent + (li.classList.contains('is-live') ? ' live' : li.classList.contains('is-solved') ? ' solved' : '')) : null,
    attempts: entries.length,
    lastAttempt: entries.at(-1) || null,
    solved: phase === 'solved' ? training.solvedText : null
  });
  window.advanceTime = ms => {
    manual = true;
    const n = Math.max(1, Math.round(ms / STEP));
    for (let i = 0; i < n; i++) tick();
    paint(true);
  };
})();
