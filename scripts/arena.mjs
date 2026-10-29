// The Dino arena on the research page: markup only. The game and the learner are in
// public/assets/dino-core.js (rules, DQN) and public/assets/dino.js (drawing, controls, training worker).

const keysHint = '<span class="keys-desktop"><kbd>Space</kbd> or <kbd>↑</kbd> jump <span aria-hidden="true">·</span> <kbd>↓</kbd> duck</span><span class="keys-touch">Tap to jump <span aria-hidden="true">·</span> swipe down to duck</span>';

// Hidden without JavaScript (the game needs it). The top row is the visitor's game; dino.js adds one row
// per DQN attempt to the list underneath, in order.
export const arenaHTML = `<section class="arena" id="dino-arena" aria-labelledby="arena-heading">
<div class="arena-top">
<h2 class="arena-heading" id="arena-heading">Dino arena</h2>
<p class="arena-status" data-hud aria-hidden="true"></p>
</div>
<div class="arena-bar">
<p class="arena-keys">${keysHint}</p>
<div class="arena-buttons">
<button type="button" class="arena-button" data-action="train">Start training</button>
<button type="button" class="arena-button" data-action="speed" aria-pressed="true">Fast-forward 3×</button>
<button type="button" class="arena-button" data-action="again" hidden>Train again</button>
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
