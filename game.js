document.addEventListener("DOMContentLoaded", () => {
  const game    = document.getElementById("game");
  const player  = document.getElementById("player");
  const scoreEl = document.getElementById("score");
  const boardEl = document.getElementById("leaderboard");
  const intro   = document.getElementById("intro");
  const startBtn= document.getElementById("startBtn");
  const sky     = document.getElementById("sky");

  // ---------- Tunables ----------
  const GROUND_PX        = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ground-height')) || 20;
  const JUMP_VELOCITY    = 10.5;
  const GRAVITY          = 0.55;
  const HOLD_THRUST      = 0.35;
  const MAX_HOLD_MS      = 180;

  const START_SPEED      = 2.6;
  const SPEED_PER_POINT  = 0.10;
  const MAX_SPEED        = 7.0;

  const BASE_MIN_H       = 20;
  const BASE_MAX_H       = 48;
  const MIN_W            = 16;
  const MAX_W            = 34;

  const SPAWN_MIN_MS     = 900;
  const SPAWN_MAX_MS     = 1600;
  const EXTRA_DIFFICULTY = 0.6;

  // Day/Night cycle (ms)
  const CYCLE_MS         = 30000; // 30s full cycle day->night->day

  // ---------- State ----------
  let vy = 0;
  let playerBottom = GROUND_PX;
  let inAir = false;
  let running = false;
  let speed = START_SPEED;
  let score = 0;
  let nextSpawnAt = 0;
  let loopId = null;
  let startTime = 0; // for survival time
  const obstacles = new Set();

  // variable jump
  let spaceDown = false;
  let holdMs = 0;

  // ---------- Utils ----------
  const rand = (a,b)=> Math.random()*(b-a)+a;
  const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
  function setPlayerBottom(px){
    playerBottom = Math.max(GROUND_PX, px);
    player.style.bottom = `${playerBottom}px`;
  }

  // Leaderboard
  function loadScores(){
    try { return JSON.parse(localStorage.getItem("jumpTop5")) || []; }
    catch { return []; }
  }
  function saveScoreEntry(entry){
    const arr = loadScores();
    arr.push(entry);
    arr.sort((a,b)=> b.score - a.score || a.time - b.time);
    localStorage.setItem("jumpTop5", JSON.stringify(arr.slice(0,5)));
  }
  function renderBoard(){
    const arr = loadScores();
    if (!arr.length){ boardEl.innerHTML = "<strong>Leaderboard</strong>No scores yet"; return; }
    boardEl.innerHTML = "<strong>Leaderboard</strong>" + arr.map((e,i)=> {
      const secs = (e.time/1000).toFixed(1);
      return `${i+1}. ${e.score} pts — ${secs}s`;
    }).join("<br>");
  }

  // Day/Night color interpolation (HSL lerp)
  function lerp(a,b,t){ return a + (b - a) * t; }
  function hsl(h,s,l){ return `hsl(${h}, ${s}%, ${l}%)`; }
  function updateSky(now){
    // t goes 0..1..0 over the cycle (day -> night -> day)
    const phase = (now % CYCLE_MS) / CYCLE_MS;        // 0..1
    const t = phase < 0.5 ? (phase/0.5) : (1 - (phase-0.5)/0.5); // up then down

    // Day colors
    const dayTop = {h:200,s:100,l:85}, dayBot = {h:190,s:100,l:92};
    // Night colors
    const nightTop = {h:230,s:60,l:12}, nightBot = {h:230,s:50,l:20};

    const top = {
      h: lerp(dayTop.h, nightTop.h, t),
      s: lerp(dayTop.s, nightTop.s, t),
      l: lerp(dayTop.l, nightTop.l, t)
    };
    const bot = {
      h: lerp(dayBot.h, nightBot.h, t),
      s: lerp(dayBot.s, nightBot.s, t),
      l: lerp(dayBot.l, nightBot.l, t)
    };

    game.style.background = `linear-gradient(${hsl(top.h,top.s,top.l)}, ${hsl(bot.h,bot.s,bot.l)})`;

    // Make stars visible more at night (t close to 1)
    sky.style.opacity = String(clamp(t, 0, 1));
  }

  // Obstacles (some can bob vertically a little)
  function spawnObstacle(now){
    const el = document.createElement('div');
    el.className = 'obstacle';

    const maxH = BASE_MAX_H + Math.min(score * 2, 20);
    const h = Math.round(rand(BASE_MIN_H, maxH));
    const w = Math.round(rand(MIN_W, MAX_W));
    el.style.height = `${h}px`;
    el.style.width  = `${w}px`;

    el.style.left   = `${game.clientWidth + 20}px`;
    el.dataset.t0     = now.toString();
    el.dataset.amp    = (Math.random() < 0.5) ? rand(4, 12) : 0;
    el.dataset.phase  = rand(0, Math.PI*2);
    el.dataset.vspeed = rand(0.08, 0.16);
    el.dataset.base   = GROUND_PX.toString();

    game.appendChild(el);
    obstacles.add(el);
  }

  function updateObstacles(dt, now){
    const remove = [];
    obstacles.forEach(el=>{
      const left = parseFloat(el.style.left) || game.clientWidth + 20;
      el.style.left = `${left - speed * dt}px`;

      const amp = parseFloat(el.dataset.amp || "0");
      if (amp > 0){
        const t0 = parseFloat(el.dataset.t0 || "0");
        const phase = parseFloat(el.dataset.phase || "0");
        const vs = parseFloat(el.dataset.vspeed || "0.1");
        const base = parseFloat(el.dataset.base || GROUND_PX.toString());
        const dy = Math.sin((now - t0) * vs * 0.01 + phase) * amp;
        el.style.bottom = `${base + dy}px`;
      } else {
        el.style.bottom = `${GROUND_PX}px`;
      }

      if (left + el.offsetWidth < 0){
        remove.push(el);
        score++;
        scoreEl.textContent = `Score: ${score}`;
        scoreEl.classList.add('pop');
        setTimeout(()=> scoreEl.classList.remove('pop'), 140);
        speed = Math.min(START_SPEED + score * SPEED_PER_POINT, MAX_SPEED);
      }

      const p = player.getBoundingClientRect();
      const o = el.getBoundingClientRect();
      const hit = !(p.right < o.left || p.left > o.right || p.bottom < o.top || p.top > o.bottom);
      if (hit) gameOver();
    });

    remove.forEach(el=>{ obstacles.delete(el); el.remove(); });
  }

  function loop(now){
    if (!running) return;

    // Day/Night
    updateSky(now);

    // dynamic spawn interval (harder over time)
    const shrink = Math.min(score * EXTRA_DIFFICULTY * 10, 400);
    const minGap = Math.max(SPAWN_MIN_MS - shrink, 500);
    const maxGap = Math.max(SPAWN_MAX_MS - shrink, 800);

    if (now >= nextSpawnAt){
      spawnObstacle(now);
      nextSpawnAt = now + rand(minGap, maxGap);
    }

    // physics with variable jump
    if (inAir){
      vy -= GRAVITY;
      if (spaceDown && holdMs < MAX_HOLD_MS && vy > 0){
        vy += HOLD_THRUST;
        holdMs += 16;
      }
      setPlayerBottom(playerBottom + vy);
      if (playerBottom <= GROUND_PX){
        setPlayerBottom(GROUND_PX);
        vy = 0;
        inAir = false;
        holdMs = 0;
      }
    }

    updateObstacles(1, now);
    loopId = requestAnimationFrame(loop);
  }

  function gameOver(){
    if (!running) return;
    running = false;
    if (loopId !== null){ cancelAnimationFrame(loopId); loopId = null; }

    const timeSurvived = performance.now() - startTime;
    const secs = (timeSurvived/1000).toFixed(1);

    saveScoreEntry({ score, time: timeSurvived, ts: Date.now() });
    renderBoard();

    // Show intro overlay as a "play again" screen
    intro.querySelector('h1').textContent = "Game Over";
    intro.querySelector('p').innerHTML =
      `Score: <strong>${score}</strong> — Time: <strong>${secs}s</strong><br>` +
      `Press <strong>Enter</strong> or click <strong>Start Game</strong> to try again.`;
    startBtn.textContent = "Play Again";
    intro.classList.remove('hidden');
  }

  function resetState(){
    obstacles.forEach(el=> el.remove());
    obstacles.clear();
    score = 0;
    speed = START_SPEED;
    inAir = false;
    vy = 0;
    holdMs = 0;
    spaceDown = false;
    setPlayerBottom(GROUND_PX);
    scoreEl.textContent = 'Score: 0';
  }

  function startGame(){
    if (running) return;
    resetState();
    intro.classList.add('hidden');
    running = true;
    startTime = performance.now();
    nextSpawnAt = startTime + 700;
    loopId = requestAnimationFrame(loop);
  }

  // Controls
  document.addEventListener('keydown', (e)=>{
    if (e.code === 'Space'){
      spaceDown = true;
      if (!running) return;
      if (!inAir){
        inAir = true;
        vy = JUMP_VELOCITY;
        holdMs = 0;
      }
    } else if (e.code === 'Enter'){
      if (!running) startGame();
    }
  });
  document.addEventListener('keyup', (e)=>{
    if (e.code === 'Space') spaceDown = false;
  });

  // Start button & overlay
  startBtn.addEventListener('click', startGame);

  // Init
  setPlayerBottom(GROUND_PX);
  renderBoard();
  // show intro overlay on first load (game not running)
});
