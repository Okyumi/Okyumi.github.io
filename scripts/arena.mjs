// The Dino arena on the research page: markup only. The game and the learner are in
// public/assets/dino-core.js (rules, DQN) and public/assets/dino.js (drawing, controls, training worker).

const keysHint = '<span class="keys-desktop"><kbd>Space</kbd> or <kbd>↑</kbd> jump <span aria-hidden="true">·</span> <kbd>↓</kbd> duck</span><span class="keys-touch">Tap to jump <span aria-hidden="true">·</span> swipe down to duck</span>';

// Two windows open from the toggles under the buttons: the score box (dino.js fills it in, one line per
// attempt) and "How it learns?", a two-way question. The math is TeX; site.js loads KaTeX (the same version
// as the blog) the first time that window opens and typesets it.
const html = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const m = tex => `<span class="tex">${html(tex)}</span>`;
const M = tex => `<div class="tex is-display">${html(tex)}</div>`;
const primer = [
  `<p>In reinforcement learning, an agent learns by trial and error. At each step ${m('t')} it sees a state ${m('s_t')}, takes an action ${m('a_t')}, and gets back a reward ${m('r_t')} and the next state ${m('s_{t+1}')}. It is looking for a policy ${m('\\pi(a \\mid s)')} that maximizes the expected return, the discounted sum of future rewards:</p>`,
  M('G_t = \\sum_{k=0}^{\\infty} \\gamma^k\\, r_{t+k}, \\qquad 0 \\le \\gamma < 1.'),
  `<p>The action value ${m('Q^\\pi(s, a) = \\mathbb{E}_\\pi[\\, G_t \\mid s_t = s,\\ a_t = a \\,]')} is the return you can expect after taking ${m('a')} in ${m('s')} and following ${m('\\pi')} from then on. The best one, ${m('Q^*')}, satisfies the Bellman optimality equation</p>`,
  M("Q^*(s, a) = \\mathbb{E}\\Big[\\, r + \\gamma \\max_{a'} Q^*(s', a') \\Bigm| s, a \\Big],"),
  `<p>and once you know it, acting well is easy: take ${m('\\arg\\max_a Q^*(s, a)')}.</p>`,
  `<p>DQN approximates ${m('Q^*')} with a neural network ${m('Q_\\theta')}. It keeps its transitions ${m("(s, a, r, s')")} in a replay buffer ${m('\\mathcal{D}')} and trains on random batches from it, pulling ${m('Q_\\theta')} toward a target ${m('y')} computed by an older copy of itself, ${m('Q_{\\theta^-}')}:</p>`,
  M("y = r + \\gamma \\max_{a'} Q_{\\theta^-}(s', a'),"),
  M("\\mathcal{L}(\\theta) = \\mathbb{E}_{(s, a, r, s') \\sim \\mathcal{D}} \\big[ (y - Q_\\theta(s, a))^2 \\big]."),
  `<p>To keep exploring, it acts <span class="no-break">${m('\\varepsilon')}-greedily</span>: a random action with probability ${m('\\varepsilon')}, otherwise the action with the highest ${m('Q_\\theta')}, and ${m('\\varepsilon')} shrinks as it learns.</p>`
].join('\n');
const choice = (answer, label) => `<button type="button" class="learn-choice" data-answer="${answer}" aria-pressed="false" aria-controls="learn-${answer}"><span class="menu-hand" aria-hidden="true"></span>${label}</button>`;
const toggle = (id, label) => `<button type="button" class="game-button is-small game-toggle" data-icon="down" aria-expanded="false" aria-controls="${id}"><span class="icon" aria-hidden="true"></span>${label}</button>`;
const button = (action, icon, label, extra = '') => `<button type="button" class="game-button" data-action="${action}" data-icon="${icon}"${extra}><span class="icon" aria-hidden="true"></span><span class="label">${label}</span></button>`;

// Hidden without JavaScript (the game needs it). The top row is the visitor's game; dino.js adds one row
// per DQN attempt to the list underneath, in order.
export const arenaHTML = `<section class="arena" id="dino-arena" aria-labelledby="arena-heading">
<h2 class="sr-only" id="arena-heading">Dino arena</h2>
<div class="arena-bar">
<div class="arena-buttons">
${button('train', 'play', 'Start training')}
${button('speed', 'fast', 'Fast-forward 3×', ' aria-pressed="true"')}
${button('again', 'play', 'Train again', ' hidden')}
</div>
<p class="arena-status" data-hud aria-hidden="true"></p>
</div>
<div class="arena-more">
<div class="arena-toggles">
${toggle('score-box', 'Score box')}
${toggle('how-it-learns', 'How it learns?')}
</div>
<p class="arena-keys">${keysHint}</p>
</div>
<div class="game-window score-box" id="score-box" hidden>
<ol class="score-list" data-score-list aria-label="DQN attempts"></ol>
</div>
<div class="game-window learn-box" id="how-it-learns" hidden>
<p class="learn-question" data-type>Are you familiar with RL?</p>
<div class="learn-choices" role="group" aria-label="Are you familiar with RL?">
${choice('yes', 'Yes')}
${choice('no', 'No')}
</div>
<div class="learn-answer" id="learn-yes" hidden><p data-type>Well, then you should be very familiar with classic DQN, and I’m pretty sure you don’t need any further explanation.</p></div>
<div class="learn-answer learn-primer" id="learn-no" hidden>
${primer}
</div>
</div>
<div class="arena-board">
<div class="arena-row is-you">
<p class="row-head" aria-hidden="true"><span class="row-name">you</span><span class="row-hi">HI <span data-player-hi>00000</span></span><span class="row-score" data-player-score>00000</span></p>
<canvas class="arena-canvas" tabindex="0" aria-label="Dino game, your row. Press Space or the up arrow to jump and the down arrow to duck." aria-describedby="arena-status"></canvas>
<p class="lane-prompt" data-player-prompt aria-hidden="true"></p>
</div>
<ol class="arena-attempts" data-attempts aria-label="DQN agent attempts"></ol>
</div>
<p class="sr-only" id="arena-status" role="status"></p>
</section>`;
