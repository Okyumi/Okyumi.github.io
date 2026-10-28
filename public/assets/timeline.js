// Side track for the blog (save points) and the travel guide (waypoints):
// marks the section you are reading, and pops the marker when you reach a new one.
const links = [...document.querySelectorAll('.timeline-link')];
const groups = [...document.querySelectorAll('.month-group, .travel-section')];
const panel = document.querySelector('.timeline');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let lockedUntil = 0;
let pending = false;
let current = null;

function activate(id) {
  let selected;
  for (const link of links) {
    if (link.hash.slice(1) === id) {
      link.setAttribute('aria-current', 'true');
      selected = link;
    } else link.removeAttribute('aria-current');
  }
  for (const group of groups) group.classList.toggle('is-current', group.id === id);
  if (!selected || selected === current) return;
  if (current) {
    selected.classList.remove('is-saved');
    void selected.offsetWidth;
    selected.classList.add('is-saved');
  }
  current = selected;
  // Keep the marker in view when the track scrolls (sideways on phones, up/down on short screens).
  const behavior = reducedMotion.matches ? 'instant' : 'smooth';
  if (panel.scrollWidth > panel.clientWidth + 1) {
    panel.scrollTo({left: selected.offsetLeft - panel.clientWidth / 2 + selected.offsetWidth / 2, behavior});
  } else if (panel.scrollHeight > panel.clientHeight + 1) {
    panel.scrollTo({top: selected.offsetTop - panel.clientHeight / 2 + selected.offsetHeight / 2, behavior});
  }
}
for (const link of links) {
  link.addEventListener('click', () => {
    activate(link.hash.slice(1));
    lockedUntil = performance.now() + 1100;
  });
  link.addEventListener('animationend', () => link.classList.remove('is-saved'));
}
function update() {
  pending = false;
  if (performance.now() < lockedUntil) return;
  const target = innerHeight * .28;
  let closest = groups[0];
  for (const group of groups) {
    if (group.getBoundingClientRect().top <= target) closest = group;
    else break;
  }
  if (closest) activate(closest.id);
}
addEventListener('scroll', () => {
  if (!pending) {
    pending = true;
    requestAnimationFrame(update);
  }
}, {passive: true});
addEventListener('resize', update);
addEventListener('hashchange', () => { if (location.hash) activate(location.hash.slice(1)); });
if (location.hash) activate(location.hash.slice(1));
else update();
setTimeout(update, 1200);
