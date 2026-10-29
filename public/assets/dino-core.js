/* Dino arena engine: the runner game and a small Deep Q-Network (DQN). No DOM in this file.
   The research page (dino.js) uses it directly, and the training Web Worker receives the same
   function as source text, so the rules exist only once.
   Coordinates: x grows to the right, y is the height above the ground (up is positive).
   One frame is 1/60 s; the agent picks an action every RULES.repeat frames. */
function dinoCore() {
  'use strict';

  const RULES = {
    fps: 60,
    repeat: 2,             // frames per agent decision (30 decisions a second)
    dinoX: 48,             // left edge of the dinosaur
    gravity: 0.62,
    fastFall: 1.55,        // extra gravity while ducking in the air
    jumpVelocity: 10.4,    // apex about 84 units, about 34 frames in the air
    speed: 6,              // units per frame at the start
    maxSpeed: 13,
    acceleration: 0.0035,  // per frame
    spawnX: 900,
    points: 0.04,          // score per unit travelled
    target: 1000           // score that counts as solved
  };

  // Hitboxes, a little smaller than the art so near misses feel fair.
  const DINO = {standing: {x0: 6, x1: 38, h: 44}, ducking: {x0: 4, x1: 54, h: 24}};
  const KINDS = {
    small: {w: 17, h: 35, label: 'a small cactus'},
    large: {w: 25, h: 50, label: 'a tall cactus'},
    bird: {w: 46, h: 28, label: 'a bird'}
  };
  // Bird heights (bottom edge above the ground): jump over the low one, duck under the middle one,
  // and simply keep running under the high one.
  const BIRD_HEIGHTS = [14, 36, 60];
  const BIRD_NAMES = ['low', 'middle', 'high'];

  // mulberry32: small, fast and seedable, so a seed always gives the same course.
  const mulberry = state => {
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  function makeRandom(seed) {
    let a = seed >>> 0;
    return () => mulberry(a = a + 0x6D2B79F5 | 0);
  }

  class Runner {
    constructor(seed = 1) { this.reset(seed); }

    // speed > RULES.speed starts later in the course (practice runs use this to rehearse the fast part).
    reset(seed = 1, speed = RULES.speed) {
      this.seed = seed >>> 0;
      this.rng = this.seed | 0;
      this.frames = 0;
      this.speed = speed;
      this.distance = (speed * speed - RULES.speed * RULES.speed) / (2 * RULES.acceleration);
      this.score = Math.floor(this.distance * RULES.points);
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      this.ducking = false;
      this.obstacles = [];
      this.birdsInARow = 0;
      this.dead = false;
      this.cause = '';
      this.cleared = 0;
      // The first obstacle starts well inside the course so every run gets going quickly.
      this.place(520 + Math.floor(this.random() * 120));
      return this;
    }

    // The course's own random numbers (kept as plain state, so a game can be copied exactly).
    random() { return mulberry(this.rng = this.rng + 0x6D2B79F5 | 0); }

    // Choose the next obstacle. Harder kinds unlock as the speed rises.
    place(x) {
      const r = () => this.random(), v = this.speed;
      let o;
      if (v >= 7.5 && this.birdsInARow < 2 && r() < 0.26) {
        const level = Math.floor(r() * 3);
        o = {kind: 'bird', level, x, w: KINDS.bird.w, bottom: BIRD_HEIGHTS[level], top: BIRD_HEIGHTS[level] + KINDS.bird.h, count: 1};
        this.birdsInARow++;
      } else {
        const large = r() < 0.45;
        const kind = large ? 'large' : 'small';
        const most = large ? (v < 7 ? 1 : v < 9 ? 2 : 3) : (v < 7 ? 2 : 3);
        const count = 1 + Math.floor(r() * most);
        o = {kind, level: 0, x, w: KINDS[kind].w * count, bottom: 0, top: KINDS[kind].h, count};
        this.birdsInARow = 0;
      }
      o.flap = Math.floor(r() * 20);
      this.obstacles.push(o);
      // The gap always leaves room to land and jump again; the random part keeps the rhythm uneven.
      this.untilNext = o.w + 40 + v * (24 + r() * 20);
    }

    copy() {
      const game = Object.assign(Object.create(Runner.prototype), this);
      game.obstacles = this.obstacles.map(o => ({...o}));
      return game;
    }

    // One frame. jump starts a jump from the ground; duck crouches on the ground and falls faster in the air.
    frame(jump, duck) {
      if (this.dead) return true;
      this.frames++;
      if (this.grounded) {
        if (jump) {
          this.vy = RULES.jumpVelocity;
          this.grounded = false;
          this.ducking = false;
        } else this.ducking = !!duck;
      }
      if (!this.grounded) {
        this.vy -= duck ? RULES.gravity + RULES.fastFall : RULES.gravity;
        this.y += this.vy;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
          this.ducking = !!duck;
        }
      }
      if (this.speed < RULES.maxSpeed) this.speed = Math.min(RULES.maxSpeed, this.speed + RULES.acceleration);
      const v = this.speed;
      this.distance += v;
      this.score = Math.floor(this.distance * RULES.points);

      const list = this.obstacles;
      for (let i = 0; i < list.length; i++) list[i].x -= v;
      while (list.length && list[0].x + list[0].w < -60) list.shift();
      this.untilNext -= v;
      if (this.untilNext <= 0) this.place(RULES.spawnX + this.untilNext);

      // Collisions: shrunken boxes on both sides.
      const box = this.ducking ? DINO.ducking : DINO.standing;
      const left = RULES.dinoX + box.x0, right = RULES.dinoX + box.x1;
      const bottom = this.y, top = this.y + box.h;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const inset = o.kind === 'bird' ? 4 : 2;
        if (o.x + inset < right && o.x + o.w - inset > left && o.bottom + inset < top && o.top - inset > bottom) {
          this.dead = true;
          this.cause = o.kind === 'bird' ? `a ${BIRD_NAMES[o.level]} bird` : KINDS[o.kind].label;
          return true;
        }
        if (!o.passed && o.x + o.w < left) {
          o.passed = true;
          this.cleared++;
        }
      }
      return false;
    }
  }

  /* What the agent sees: 11 numbers about the next two obstacles, the speed and its own jump.
     Distances are given as time to impact, so the right moment to jump barely changes as the game speeds up.
     No pixels: this keeps the network tiny and training fast enough for a browser tab. */
  const FEATURES = 11;
  const ACTIONS = ['run', 'jump', 'duck'];
  function observe(game, out = new Float32Array(FEATURES)) {
    const front = RULES.dinoX + DINO.standing.x1;
    const back = RULES.dinoX + DINO.standing.x0;
    const v = game.speed;
    let first = null, second = null;
    for (const o of game.obstacles) {
      if (o.x + o.w <= back) continue;
      if (!first) first = o;
      else { second = o; break; }
    }
    // Seconds until the obstacle reaches the dinosaur's nose (negative while it is underneath).
    const impact = o => o ? Math.max(-0.5, Math.min(1.5, (o.x - front) / v / RULES.fps)) : 1.5;
    out[0] = impact(first);
    out[1] = first ? (first.w + front - back) / v / 30 : 0;
    out[2] = first ? first.bottom / 60 : 0;
    out[3] = first ? first.top / 60 : 0;
    out[4] = impact(second);
    out[5] = second ? second.bottom / 60 : 0;
    out[6] = second ? second.top / 60 : 0;
    out[7] = (v - RULES.speed) / (RULES.maxSpeed - RULES.speed);
    out[8] = game.y / 90;
    out[9] = game.vy / RULES.jumpVelocity;
    out[10] = game.ducking ? 1 : 0;
    return out;
  }

  // Apply one agent decision for RULES.repeat frames. Returns true if the dinosaur crashed.
  function act(game, action) {
    for (let k = 0; k < RULES.repeat; k++) {
      if (game.frame(action === 1 && k === 0, action === 2)) return true;
    }
    return false;
  }

  /* A small multilayer perceptron: inputs → 64 → 64 → one Q-value per action, ReLU in between.
     All parameters live in one Float32Array so they can be copied to the page in one message. */
  class Network {
    constructor(sizes, random) {
      this.sizes = sizes;
      this.offsets = [];
      let n = 0;
      for (let l = 0; l < sizes.length - 1; l++) {
        const w = n, b = w + sizes[l] * sizes[l + 1];
        this.offsets.push({w, b});
        n = b + sizes[l + 1];
      }
      this.params = new Float32Array(n);
      this.acts = sizes.map(size => new Float32Array(size));
      if (random) {
        // PyTorch's default nn.Linear initialisation: U(-1/sqrt(fan_in), 1/sqrt(fan_in)).
        for (let l = 0; l < sizes.length - 1; l++) {
          const bound = 1 / Math.sqrt(sizes[l]);
          const {w, b} = this.offsets[l];
          for (let i = w; i < b + sizes[l + 1]; i++) this.params[i] = (random() * 2 - 1) * bound;
        }
      }
    }
    copyFrom(other) { this.params.set(other.params); return this; }
    // Forward pass for one input. Keeps every layer's activations in this.acts for backward().
    forward(x, params = this.params) {
      const {sizes, offsets, acts} = this;
      acts[0].set(x);
      const last = sizes.length - 2;
      for (let l = 0; l <= last; l++) {
        const input = acts[l], output = acts[l + 1], fanIn = sizes[l], fanOut = sizes[l + 1];
        const {w, b} = offsets[l];
        for (let j = 0; j < fanOut; j++) {
          let sum = params[b + j];
          const row = w + j * fanIn;
          for (let i = 0; i < fanIn; i++) sum += params[row + i] * input[i];
          output[j] = l < last && sum < 0 ? 0 : sum;
        }
      }
      return acts[sizes.length - 1];
    }
    // Backward pass for the last forward(): adds d(loss)/d(params) into grad, given d(loss)/d(output).
    backward(dOut, grad) {
      const {sizes, offsets, acts, params} = this;
      let delta = dOut;
      for (let l = sizes.length - 2; l >= 0; l--) {
        const input = acts[l], fanIn = sizes[l], fanOut = sizes[l + 1];
        const {w, b} = offsets[l];
        const next = l > 0 ? (this.scratch?.[l] || ((this.scratch ||= [])[l] = new Float32Array(fanIn))) : null;
        if (next) next.fill(0);
        for (let j = 0; j < fanOut; j++) {
          const d = delta[j];
          if (d === 0) continue;
          grad[b + j] += d;
          const row = w + j * fanIn;
          for (let i = 0; i < fanIn; i++) {
            grad[row + i] += d * input[i];
            if (next) next[i] += d * params[row + i];
          }
        }
        if (next) for (let i = 0; i < fanIn; i++) if (input[i] <= 0) next[i] = 0;
        delta = next;
      }
    }
  }

  const argmax = q => {
    let best = 0;
    for (let i = 1; i < q.length; i++) if (q[i] > q[best]) best = i;
    return best;
  };

  /* Double DQN with experience replay, a slowly-following target network, Huber loss and Adam.
     Each call to run(ms) plays and learns for about ms milliseconds, then returns. */
  const DEFAULTS = {
    seed: 1,
    hidden: [64, 64],
    gamma: 0.99,
    learningRate: 5e-4,
    batch: 64,
    buffer: 50000,
    warmup: 1000,
    trainEvery: 4,          // one gradient step every four decisions
    tau: 0.005,
    epsilonStart: 1,
    epsilonEnd: 0.02,
    epsilonSteps: 12000,
    clip: 10,
    practice: 0.5,          // share of practice runs that start at a random speed
    aliveReward: 0.1,
    crashReward: -1
  };

  class Trainer {
    constructor(options = {}) {
      const o = this.options = {...DEFAULTS, ...options};
      this.random = makeRandom(o.seed * 7919 + 17);
      const sizes = [FEATURES, ...o.hidden, ACTIONS.length];
      this.online = new Network(sizes, this.random);
      this.target = new Network(sizes).copyFrom(this.online);
      this.grad = new Float32Array(this.online.params.length);
      this.m = new Float32Array(this.grad.length);
      this.v = new Float32Array(this.grad.length);
      this.adamStep = 0;
      const cap = o.buffer;
      this.states = new Float32Array(cap * FEATURES);
      this.nextStates = new Float32Array(cap * FEATURES);
      this.actions = new Uint8Array(cap);
      this.rewards = new Float32Array(cap);
      this.dones = new Uint8Array(cap);
      this.size = 0;
      this.cursor = 0;
      this.steps = 0;
      this.updates = 0;
      this.episodes = 0;
      this.lastLoss = 0;
      this.scores = [];
      this.best = 0;
      this.courseSeed = o.seed * 104729;
      this.game = new Runner(this.nextCourse());
      this.state = observe(this.game);
      this.nextState = new Float32Array(FEATURES);
      this.dq = new Float32Array(ACTIONS.length);
      this.row = new Float32Array(FEATURES);
    }
    nextCourse() { return (this.courseSeed = (this.courseSeed + 0x9E3779B9) >>> 0); }
    get epsilon() {
      const o = this.options;
      const t = Math.min(1, this.steps / o.epsilonSteps);
      return o.epsilonStart + (o.epsilonEnd - o.epsilonStart) * t;
    }
    choose(state) {
      if (this.random() < this.epsilon) return Math.floor(this.random() * ACTIONS.length);
      return argmax(this.online.forward(state));
    }
    // One decision: act, store the transition, maybe learn, and start a new course after a crash.
    step() {
      const o = this.options, game = this.game;
      const action = this.choose(this.state);
      const crashed = act(game, action);
      const reward = crashed ? o.crashReward : o.aliveReward;
      observe(game, this.nextState);
      const i = this.cursor;
      this.states.set(this.state, i * FEATURES);
      this.nextStates.set(this.nextState, i * FEATURES);
      this.actions[i] = action;
      this.rewards[i] = reward;
      this.dones[i] = crashed ? 1 : 0;
      this.cursor = (i + 1) % o.buffer;
      this.size = Math.min(this.size + 1, o.buffer);
      this.steps++;
      if (this.steps >= o.warmup && this.steps % o.trainEvery === 0) this.learn();
      // Reaching the target ends a practice run without counting as a crash (no terminal flag).
      if (crashed || game.score >= RULES.target) {
        this.episodes++;
        this.scores.push(game.score);
        if (this.scores.length > 100) this.scores.shift();
        this.best = Math.max(this.best, game.score);
        const practice = this.random() < o.practice;
        game.reset(this.nextCourse(), practice ? RULES.speed + this.random() * (RULES.maxSpeed - RULES.speed) : RULES.speed);
        observe(game, this.state);
      } else {
        const swap = this.state;
        this.state = this.nextState;
        this.nextState = swap;
      }
    }
    learn() {
      const o = this.options, online = this.online, target = this.target, grad = this.grad, dq = this.dq, row = this.row;
      grad.fill(0);
      let loss = 0;
      for (let n = 0; n < o.batch; n++) {
        const i = Math.floor(this.random() * this.size);
        let y = this.rewards[i];
        if (!this.dones[i]) {
          // Double DQN: the online network picks the next action, the target network scores it.
          row.set(this.nextStates.subarray(i * FEATURES, (i + 1) * FEATURES));
          const next = argmax(online.forward(row));
          y += o.gamma * target.forward(row)[next];
        }
        row.set(this.states.subarray(i * FEATURES, (i + 1) * FEATURES));
        const q = online.forward(row);
        const a = this.actions[i];
        const error = q[a] - y;
        const abs = Math.abs(error);
        loss += abs <= 1 ? 0.5 * error * error : abs - 0.5;
        dq.fill(0);
        dq[a] = Math.max(-1, Math.min(1, error)) / o.batch; // Huber loss gradient
        online.backward(dq, grad);
      }
      this.lastLoss = loss / o.batch;
      // Clip the global gradient norm, then Adam.
      let norm = 0;
      for (let i = 0; i < grad.length; i++) norm += grad[i] * grad[i];
      norm = Math.sqrt(norm);
      const scale = norm > o.clip ? o.clip / norm : 1;
      const p = online.params, m = this.m, v = this.v;
      const t = ++this.adamStep, b1 = 0.9, b2 = 0.999;
      const lr = o.learningRate * Math.sqrt(1 - b2 ** t) / (1 - b1 ** t);
      for (let i = 0; i < p.length; i++) {
        const g = grad[i] * scale;
        m[i] = b1 * m[i] + (1 - b1) * g;
        v[i] = b2 * v[i] + (1 - b2) * g * g;
        p[i] -= lr * m[i] / (Math.sqrt(v[i]) + 1e-8);
      }
      // The target network follows slowly (Polyak averaging).
      const tp = target.params, tau = o.tau;
      for (let i = 0; i < tp.length; i++) tp[i] += tau * (p[i] - tp[i]);
      this.updates++;
    }
    run(ms) {
      const end = Date.now() + ms;
      do {
        for (let k = 0; k < 32; k++) this.step();
      } while (Date.now() < end);
    }
    weights() { return this.online.params.slice(); }
  }

  // A greedy player for the page and for evaluation: no exploration, no learning.
  class Policy {
    constructor(params, hidden = DEFAULTS.hidden) {
      this.net = new Network([FEATURES, ...hidden, ACTIONS.length]);
      if (params) this.net.params.set(params);
      this.state = new Float32Array(FEATURES);
    }
    load(params) { this.net.params.set(params); }
    decide(game) {
      const q = this.net.forward(observe(game, this.state));
      return {action: argmax(q), q: Array.from(q)};
    }
  }

  function evaluate(params, seeds, cap = RULES.target, hidden = DEFAULTS.hidden) {
    const policy = new Policy(params, hidden);
    return seeds.map(seed => {
      const game = new Runner(seed);
      while (!game.dead && game.score < cap) act(game, policy.decide(game).action);
      return {score: game.score, cause: game.dead ? game.cause : ''};
    });
  }

  return {RULES, DINO, KINDS, BIRD_HEIGHTS, FEATURES, ACTIONS, makeRandom, Runner, observe, act, Network, Trainer, Policy, evaluate, DEFAULTS};
}

if (typeof window !== 'undefined') window.dinoCore = dinoCore;
else if (typeof module !== 'undefined') module.exports = dinoCore;
