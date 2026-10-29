/* Dino arena (research page). You play the top lane; underneath, a Deep Q-Network learns the same game.
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
  const ctx = canvas.getContext('2d', {alpha: false});
  const lanes = [$('.lane-player'), $('.lane-agent')];
  const ui = {
    playerHi: $('[data-player-hi]'), playerScore: $('[data-player-score]'), playerPrompt: $('[data-player-prompt]'),
    agentAttempt: $('[data-agent-attempt]'), agentBest: $('[data-agent-best]'), agentScore: $('[data-agent-score]'), agentPrompt: $('[data-agent-prompt]'),
    hud: $('[data-hud]'), status: $('#arena-status'), list: $('[data-attempts]'), empty: $('[data-empty]'), solved: $('[data-solved]'),
    train: $('[data-action="train"]'), speed: $('[data-action="speed"]'), race: $('[data-action="race"]'), again: $('[data-action="again"]')
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

  /* Layout: the world is measured in units and scaled to the board's width, so the rules never change. */
  const HEAD = 34;   // CSS pixels above each lane for its labels
  const SKY = 136;   // world units above the ground (the highest jump reaches about 131)
  const BELOW = 18;  // world units under the ground line
  let view = {width: 600, scale: 1, dpr: 1, lane: 200, units: 600};
  const layout = () => {
    const width = board.clientWidth || 600;
    const scale = Math.min(1.3, Math.max(0.6, width / 720));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lane = Math.round(HEAD + (SKY + BELOW) * scale);
    view = {width, scale, dpr, lane, units: width / scale};
    board.style.setProperty('--lane', lane + 'px');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(lane * 2 * dpr);
    paint(true);
  };

  /* Drawing. Pixel edges are rounded to device pixels, so the art stays crisp at any scale. */
  const groundY = lane => (lane * view.lane + HEAD + SKY * view.scale) * view.dpr;
  const runs = (list, left, top, u) => {
    for (const [x0, x1, row] of list) {
      const X0 = Math.round(left + x0 * u), X1 = Math.round(left + x1 * u);
      const Y0 = Math.round(top + row * u), Y1 = Math.round(top + (row + 1) * u);
      ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    }
  };
  const sprite = (name, x, y, lane, color) => {
    const s = SPRITES[name], k = view.scale * view.dpr, u = PIXEL * k;
    const left = x * k, top = groundY(lane) - (y + s.h * PIXEL) * k;
    ctx.fillStyle = color;
    runs(s.body, left, top, u);
    if (s.white.length) {
      ctx.fillStyle = PAPER;
      runs(s.white, left, top, u);
    }
  };
  const hash = i => {
    let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    t ^= t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);
    return ((t ^ t >>> 16) >>> 0) / 4294967296;
  };
  const ground = (lane, distance) => {
    const k = view.scale * view.dpr, y = Math.round(groundY(lane));
    ctx.fillStyle = INK;
    ctx.fillRect(0, y, canvas.width, Math.max(1, Math.round(k)));
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
  const drawObstacles = (game, lane) => {
    for (const o of game.obstacles) {
      if (o.x > view.units + 8 || o.x + o.w < -8) continue;
      if (o.kind === 'bird') sprite(Math.floor((game.frames + o.flap) / 12) % 2 ? 'bird2' : 'bird1', o.x, o.bottom, lane, INK);
      else {
        const each = o.kind === 'large' ? 25 : 17;
        for (let i = 0; i < o.count; i++) sprite(o.kind, o.x + i * each + 0.5, 0, lane, INK);
      }
    }
  };
  const pose = (game, status) => {
    if (status === 'over' || status === 'crashed') return 'dead';
    if (status !== 'playing' && status !== 'running') return 'stand';
    if (!game.grounded) return 'stand';
    const step = Math.floor(game.frames / 6) % 2;
    if (game.ducking) return step ? 'duck2' : 'duck1';
    return step ? 'run2' : 'run1';
  };
  const drawLane = (game, lane, color, status) => {
    ground(lane, game.distance);
    drawObstacles(game, lane);
    sprite(pose(game, status), RULES.dinoX, game.y, lane, color);
  };

  /* State. Phases: idle → training → solved, with racing as a detour from solved. */
  let phase = 'idle';
  let userPaused = false;
  let fastForward = true;
  let raced = false;
  let resultText = '';
  const player = {game: new Runner(randomSeed()), status: 'ready', hi: 0, jump: 0, duck: false, overAt: -999};
  const agent = {game: new Runner(randomSeed()), status: 'waiting', attempt: 0, best: 0, k: 0, action: 0, wait: 0, policy: new Policy(null)};
  const race = {count: 0};
  const entries = [];
  const training = {trainer: null, running: false, steps: 0, sps: 0, epsilon: 1, checkpoint: 0, weights: null, activeMs: 0, kind: ''};
  let ticks = 0;

  /* Attempts list: the newest at the bottom, older ones folded into one line. */
  const SHOWN = 8;
  const renderEntries = () => {
    ui.empty.hidden = entries.length > 0;
    ui.empty.textContent = phase === 'idle'
      ? (reducedMotion.matches ? 'No attempts yet. Press “Start training” to begin.' : 'No attempts yet. Training starts when the arena is on screen.')
      : 'No crashes yet. The first attempt is running.';
    const folded = Math.max(0, entries.length - SHOWN);
    const best = entries.slice(0, folded).reduce((most, e) => Math.max(most, e.score), 0);
    const rows = entries.slice(folded).map((e, i, shown) => `<li class="attempt${e.solved ? ' is-solved' : ''}${i === shown.length - 1 ? ' is-new' : ''}">`
      + `<span class="attempt-number">#${e.attempt}</span>`
      + `<span class="attempt-bar" style="--score: ${Math.min(1, e.score / RULES.target).toFixed(3)}"></span>`
      + `<span class="attempt-score">${fmt(e.score)}</span>`
      + `<span class="attempt-cause">${e.solved ? 'reached 1,000 · solved' : 'hit ' + e.cause}</span></li>`);
    if (folded) rows.unshift(`<li class="attempt attempt-earlier">${folded} earlier attempt${folded === 1 ? '' : 's'} · best ${fmt(best)}</li>`);
    ui.list.innerHTML = rows.join('');
  };
  const announce = message => { ui.status.textContent = message; };

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
    Object.assign(training, {steps: 0, sps: 0, epsilon: 1, checkpoint: 0, weights: null, activeMs: 0});
    Object.assign(agent, {game: new Runner(randomSeed()), status: 'waiting', attempt: 0, best: 0, k: 0, action: 0, wait: 0});
    ui.solved.hidden = true;
    training.trainer = createTrainer();
    training.kind = training.trainer.kind;
    training.trainer.send({type: 'start', seed: randomSeed()});
    training.running = true;
    renderEntries();
    announce('Training started.');
    sync();
  };

  /* The agent's lane: each attempt plays the best network so far on a new course, at 1× or 3×. */
  const startAttempt = () => {
    agent.attempt++;
    agent.game = new Runner(randomSeed());
    agent.policy.load(training.weights);
    agent.k = 0;
    agent.action = 0;
    agent.status = 'running';
  };
  const stepAgent = () => {
    if (agent.status === 'running') {
      if (agent.k === 0) agent.action = agent.policy.decide(agent.game).action;
      // Same sequence of frames as core.act(), so the lane matches the evaluation in the worker exactly.
      const crashed = agent.game.frame(agent.action === 1 && agent.k === 0, agent.action === 2);
      agent.k = (agent.k + 1) % RULES.repeat;
      if (crashed) {
        agent.status = 'crashed';
        agent.wait = 40;
        if (phase === 'training') {
          agent.best = Math.max(agent.best, agent.game.score);
          entries.push({attempt: agent.attempt, score: agent.game.score, cause: agent.game.cause});
          renderEntries();
        }
      } else if (phase === 'training' && agent.game.score >= RULES.target) solve();
    } else if (agent.status === 'crashed' && phase === 'training' && --agent.wait <= 0) startAttempt();
  };
  const solve = () => {
    phase = 'solved';
    agent.status = 'done';
    agent.best = Math.max(agent.best, agent.game.score);
    entries.push({attempt: agent.attempt, score: agent.game.score, solved: true});
    renderEntries();
    stopTrainer();
    const seconds = Math.max(1, Math.round(training.activeMs / 1000));
    const time = seconds < 90 ? `${seconds} seconds` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
    ui.solved.textContent = `Solved on attempt ${agent.attempt}, after ${fmt(training.steps)} training steps and ${time}.`;
    ui.solved.hidden = false;
    announce(`Solved. The agent reached 1,000 points on attempt ${agent.attempt}. You can race it now.`);
    sync();
  };

  /* Your lane. */
  const startPlayer = () => {
    player.game = new Runner(randomSeed());
    player.status = 'playing';
    player.jump = 6; // starting a run is a jump, like the original
    player.duck = false;
    resultText = '';
  };
  const press = () => {
    if (player.status === 'playing') { player.jump = 6; return; } // remembered for 0.1 s, so an early press still lands
    if (player.status === 'countdown' || phase === 'racing') return;
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
      if (phase !== 'racing') announce(`Game over. You scored ${fmt(player.game.score)}.`);
    }
  };

  /* Race: same course, same start, the trained network at normal speed. Same clock, so the score is
     the same on both lanes until someone crashes. */
  const startRace = () => {
    if (!training.weights || phase !== 'solved') return;
    phase = 'racing';
    raced = true;
    resultText = '';
    const seed = randomSeed();
    Object.assign(player, {game: new Runner(seed), status: 'countdown', jump: 0, duck: false});
    Object.assign(agent, {game: new Runner(seed), status: 'countdown', k: 0, action: 0});
    agent.policy.load(training.weights);
    race.count = 180;
    canvas.focus({preventScroll: true});
    announce('Race starting in three seconds. Space or the up arrow to jump, the down arrow to duck.');
    sync();
  };
  // Called after both lanes have moved, so a crash on the same frame is a draw.
  const raceCheck = () => {
    const agentOut = agent.status === 'crashed';
    if (player.status !== 'over') return; // you're still running; the race goes on until you crash
    const you = player.game.score, them = agent.game.score;
    if (agentOut && you > them) resultText = `You win, ${fmt(you)} to ${fmt(them)}.`;
    else if (agentOut && you === them) resultText = `A draw at ${fmt(you)}.`;
    else resultText = `The agent wins. You crashed at ${fmt(you)}; it was still running.`;
    if (!agentOut) agent.status = 'done';
    phase = 'solved';
    announce(resultText);
    sync();
  };

  /* The loop: fixed 60 Hz steps, drawn on animation frames. advanceTime() takes over for tests. */
  const STEP = 1000 / 60;
  let rafId = 0, looping = false, last = 0, carry = 0, manual = false;
  let visible = !document.hidden, onScreen = false;
  const meter = {frames: 0, since: 0, fps: 0, shown: 0};
  const tick = () => {
    ticks++;
    if (phase === 'racing' && race.count > 0 && --race.count === 0) {
      player.status = 'playing';
      agent.status = 'running';
    }
    stepPlayer();
    const agentSteps = phase === 'training' ? (userPaused ? 0 : fastForward ? 3 : 1) : 1;
    for (let i = 0; i < agentSteps; i++) stepAgent();
    if (phase === 'racing') raceCheck();
  };
  const loop = now => {
    rafId = window.requestAnimationFrame(loop);
    const dt = last ? Math.min(100, now - last) : STEP;
    last = now;
    meter.frames++;
    if (now - meter.since >= 1000) {
      meter.fps = Math.round(meter.frames * 1000 / (now - meter.since || 1000));
      meter.frames = 0;
      meter.since = now;
    }
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
    meter.since = performance.now();
    meter.frames = 0;
    rafId = window.requestAnimationFrame(loop);
  };
  const stopLoop = () => {
    window.cancelAnimationFrame(rafId);
    looping = false;
  };

  /* Text on and around the board. Only touched when something changed. */
  const shown = {};
  const setText = (el, key, value) => {
    if (shown[key] === value) return;
    shown[key] = value;
    el.textContent = value;
  };
  const playerPrompt = () => {
    const touch = touchFirst.matches;
    if (player.status === 'countdown') return String(Math.ceil(race.count / 60));
    if (player.status === 'ready') return touch ? 'Tap to play' : document.activeElement === canvas ? 'Press Space to play' : 'Click here to play';
    if (player.status === 'over') {
      const again = touch ? 'tap to play again' : 'press Space to play again';
      return resultText ? `${resultText} ${again[0].toUpperCase()}${again.slice(1)}.` : `Game over · ${again}`;
    }
    return '';
  };
  const agentPrompt = () => {
    if (phase === 'idle') return reducedMotion.matches || !onScreen ? 'Press “Start training” to begin' : 'Starting…';
    if (phase === 'training' && userPaused) return 'Training paused';
    if (phase === 'training' && agent.status === 'waiting') return 'Warming up…';
    if (agent.status === 'countdown') return 'Racing you';
    if (phase === 'solved' && agent.status === 'done' && !raced) return 'Solved';
    return '';
  };
  const paint = (force = false) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = RULE;
    ctx.fillRect(0, Math.round(view.lane * view.dpr), canvas.width, Math.max(1, Math.round(view.dpr)));
    drawLane(player.game, 0, BLUE, player.status);
    drawLane(agent.game, 1, INK, agent.status);
    setText(ui.playerScore, 'ps', pad(player.game.score));
    setText(ui.playerHi, 'ph', pad(Math.max(player.hi, player.status === 'over' ? player.game.score : 0)));
    setText(ui.agentScore, 'as', pad(agent.game.score));
    setText(ui.agentBest, 'ab', pad(agent.best));
    setText(ui.agentAttempt, 'aa', phase === 'racing' || (raced && phase === 'solved') ? ' · race' : agent.attempt ? ` · attempt ${agent.attempt}` : '');
    setText(ui.playerPrompt, 'pp', playerPrompt());
    setText(ui.agentPrompt, 'ap', agentPrompt());
    board.classList.toggle('is-playing', player.status === 'playing' || player.status === 'countdown');
    const now = performance.now();
    if (force || now - meter.shown > 500) {
      meter.shown = now;
      const fps = looping ? `${meter.fps || '…'} fps` : 'paused';
      const state = phase === 'training'
        ? (training.running ? `${fmt(training.sps)} steps/s · ε ${training.epsilon.toFixed(2)}` : 'training paused')
        : phase === 'idle' ? 'not training yet' : 'training finished';
      setText(ui.hud, 'hud', `${fps} · ${state}`);
    }
  };

  /* Buttons. */
  const syncButtons = () => {
    const done = phase === 'solved' || phase === 'racing';
    ui.train.hidden = done;
    ui.train.textContent = phase === 'idle' ? 'Start training' : userPaused ? 'Resume training' : 'Pause training';
    ui.speed.hidden = done;
    ui.speed.setAttribute('aria-pressed', String(fastForward));
    ui.race.hidden = !done;
    ui.race.disabled = phase === 'racing';
    ui.race.textContent = raced ? 'Race again' : 'Race it';
    ui.again.hidden = !done;
    ui.again.disabled = phase === 'racing';
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
  ui.race.addEventListener('click', startRace);
  ui.again.addEventListener('click', () => {
    raced = false;
    resultText = '';
    if (player.status === 'countdown') player.status = 'ready';
    startTraining();
  });

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

  /* Start when the arena comes into view (not with reduced motion: then it waits for the button). */
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    sync();
  });
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen && phase === 'idle' && !reducedMotion.matches) startTraining();
    else sync();
  }, {threshold: 0.2}).observe(board);
  new ResizeObserver(() => layout()).observe(board);
  root.classList.add('is-ready');
  layout();
  renderEntries();
  syncButtons();

  /* Test hooks: a text view of the game and a deterministic clock. */
  const obstaclesText = game => game.obstacles.filter(o => o.x < view.units && o.x + o.w > 0)
    .map(o => ({kind: o.kind === 'bird' ? ['low', 'middle', 'high'][o.level] + ' bird' : `${o.count} ${o.kind} cact${o.count > 1 ? 'i' : 'us'}`, x: Math.round(o.x), w: o.w, bottom: o.bottom, top: o.top}));
  window.render_game_to_text = () => JSON.stringify({
    coordinates: 'world units; x grows to the right from the lane’s left edge, y is height above the ground; the dinosaur’s left edge is at x = 48',
    phase,
    fastForward,
    view: {units: Math.round(view.units), scale: +view.scale.toFixed(3)},
    player: {status: player.status, score: player.game.score, hi: player.hi, y: +player.game.y.toFixed(1), vy: +player.game.vy.toFixed(2), grounded: player.game.grounded, ducking: player.game.ducking, speed: +player.game.speed.toFixed(2), obstacles: obstaclesText(player.game)},
    agent: {status: agent.status, attempt: agent.attempt, score: agent.game.score, best: agent.best, action: ACTIONS[agent.action], obstacles: obstaclesText(agent.game)},
    training: {running: training.running, paused: userPaused, steps: training.steps, stepsPerSecond: Math.round(training.sps), epsilon: +training.epsilon.toFixed(3), checkpoint: Math.round(training.checkpoint), where: training.kind},
    attempts: entries.length,
    lastAttempt: entries.at(-1) || null,
    solved: phase === 'solved' || phase === 'racing' ? ui.solved.textContent : null,
    race: phase === 'racing' ? {countdown: Math.ceil(race.count / 60)} : resultText ? {result: resultText} : null,
    fps: meter.fps
  });
  window.advanceTime = ms => {
    manual = true;
    const n = Math.max(1, Math.round(ms / STEP));
    for (let i = 0; i < n; i++) tick();
    paint(true);
  };
})();
