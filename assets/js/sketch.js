/**
 * @fileoverview Summary of the script's purpose and functionality.
 * @project      Collector Challenge T2, 2026
 * @author       VORN, Sona <10034343>
 * @Grab & Dash is an underwater collecting game where the player controls a diver to collect pearls while avoiding jellyfish and starfish. The player wins by collecting all the pearls before losing all HP.
 */

/* =========================================================================
   1. CONFIG
   The game always runs at GAME_W x GAME_H. CSS scales the canvas to fit any
   screen, so positions, speeds and collisions are identical on every device.
   ========================================================================= */
const GAME_W = 800;
const GAME_H = 500;

const ASSET_PATH = {
  images: 'assets/images/',
  audio: 'assets/audio/',
  fonts: 'assets/fonts/',
};

// Game stages
const STAGE = { MENU: 0, PLAY: 1, GAME_OVER: 2, WIN: 3 };

// Diver
const DIVER_SIZE = 120;
const DIVER_SPEED = 3;       // pixels per frame at 60fps
const DIVER_START_X = 400;
const DIVER_START_Y = -10;
const START_HP = 3;

// Collectables and enemies
const NUM_PEARLS = 20;
const NUM_JELLY = 3;
const NUM_SEASTARS = 9;

const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/* =========================================================================
   2. STATE
   ========================================================================= */
let stage = STAGE.MENU;
let stageStartedAt = 0;      // ms timestamp of the last stage change
let fade = 255;              // dark overlay used to fade between screens
let nextStage = null;        // set while fading out towards another screen
let dt = 1;                  // frame-time multiplier (1 = one frame at 60fps)

// Player
let p1X = DIVER_START_X;
let p1Y = DIVER_START_Y;
let hp = START_HP;
let facing = -1;             // -1 = facing left, 1 = facing right
let pearlCount = 0;

// Run results (shown on the win / game over screens)
let runStartedAt = 0;        // ms timestamp when the dive began
let runSeconds = 0;          // how long the dive lasted
let lastHitBy = 'jellyfish'; // what took the last HP
let bestTime = null;         // fastest win in seconds (saved in the browser)
let isNewBest = false;
let hoverButton = null;      // end-screen button under the mouse

// Entities
let pearls = [];
let jellyfish = [];
let seaStars = [];

// Assets
let menuBg, gameBg;
let diverLeft, diverRight, pearlImg, jellyImg, seaStarImg;
let myFont;
let diverSound, splashSound, gameSound, pearlSound, goSound, winSound;

/* =========================================================================
   3. LOADING AND SETUP
   ========================================================================= */
function preload() {
  // images
  diverLeft = loadImage(ASSET_PATH.images + 'IMG_3882.gif');
  diverRight = loadImage(ASSET_PATH.images + 'diverright.gif');
  gameBg = loadImage(ASSET_PATH.images + 'Beaches.gif');
  menuBg = loadImage(ASSET_PATH.images + 'lobbu.gif');
  pearlImg = loadImage(ASSET_PATH.images + 'clam-pearl.gif');
  jellyImg = loadImage(ASSET_PATH.images + 'jellyfish.gif');
  seaStarImg = loadImage(ASSET_PATH.images + 'seastar.gif');

  // font
  myFont = loadFont(ASSET_PATH.fonts + 'Amarante-Regular.ttf');

  // sounds
  diverSound = loadSound(ASSET_PATH.audio + 'ow.mp3');
  splashSound = loadSound(ASSET_PATH.audio + 'splash.mp3');
  pearlSound = loadSound(ASSET_PATH.audio + 'collect.mp3');
  gameSound = loadSound(ASSET_PATH.audio + 'game.mp3');
  goSound = loadSound(ASSET_PATH.audio + 'gameover.mp3');
  winSound = loadSound(ASSET_PATH.audio + 'win.mp3');
}

function setup() {
  createCanvas(GAME_W, GAME_H).parent('game-container');
  updateCanvasSharpness();
  textAlign(CENTER);

  const loading = select('#loading');
  if (loading) loading.remove();

  bestTime = loadBestTime();
  populateWorld();
  applyStage(STAGE.MENU);   // starts faded out, then fades in
}

// Keep the canvas crisp when CSS scales it up on big or high-DPI screens
function updateCanvasSharpness() {
  const cssWidth = Math.min(windowWidth, windowHeight * (GAME_W / GAME_H));
  const dpr = window.devicePixelRatio || 1;
  const wanted = constrain(Math.ceil((cssWidth * dpr) / GAME_W), 1, 3);
  if (wanted !== pixelDensity()) pixelDensity(wanted);
}

function windowResized() {
  updateCanvasSharpness();
}

/* =========================================================================
   4. WORLD CREATION
   ========================================================================= */
function makePearl() {
  return { x: random(30, width - 60), y: random(200, height - 30), collected: false };
}

function makeJelly() {
  return { x: random(30, width - 60), y: random(350, height - 100), speed: random(0.001, 0.01), hit: false };
}

function makeSeaStar() {
  return { x: random(30, width - 60), y: random(250, height - 60), speed: random(1, 3), movingRight: true, hit: false };
}

function populateWorld() {
  pearls = Array.from({ length: NUM_PEARLS }, makePearl);
  jellyfish = Array.from({ length: NUM_JELLY }, makeJelly);
  seaStars = Array.from({ length: NUM_SEASTARS }, makeSeaStar);
}

function resetGame() {
  p1X = DIVER_START_X;
  p1Y = DIVER_START_Y;
  hp = START_HP;
  pearlCount = 0;
  facing = -1;
  populateWorld();
}

/* =========================================================================
   5. MAIN LOOP
   ========================================================================= */
function draw() {
  // Normalise movement so the game feels the same on 60Hz, 120Hz and 144Hz screens
  dt = constrain(deltaTime / (1000 / 60), 0.1, 3);

  switch (stage) {
    case STAGE.MENU:      drawMenu();     break;
    case STAGE.PLAY:      drawGame();     break;
    case STAGE.GAME_OVER: drawGameOver(); break;
    case STAGE.WIN:       drawWin();      break;
  }

  updateMusic();
  drawFade();
}

/* =========================================================================
   6. STAGES AND AUDIO
   ========================================================================= */
// Ask for a new screen. The current one fades out first, then the new one fades in.
function setStage(next) {
  if (nextStage !== null || next === stage) return;

  // a dive just ended: record the result
  if (stage === STAGE.PLAY && (next === STAGE.WIN || next === STAGE.GAME_OVER)) {
    runSeconds = (millis() - runStartedAt) / 1000;
    isNewBest = false;
    if (next === STAGE.WIN && (bestTime === null || runSeconds < bestTime)) {
      bestTime = runSeconds;
      isNewBest = true;
      saveBestTime(bestTime);
    }
  }
  nextStage = next;
}

function applyStage(next) {
  stage = next;
  stageStartedAt = millis();
  fade = 255;

  if (next === STAGE.PLAY || next === STAGE.MENU) resetGame();
  if (next === STAGE.PLAY) runStartedAt = millis();
  hoverButton = null;
  cursor(ARROW);

  goSound.stop();
  winSound.stop();
  if (next === STAGE.GAME_OVER) goSound.play();
  if (next === STAGE.WIN) winSound.play();
}

// Looping music: play only on its own screen
function updateMusic() {
  setLooping(splashSound, stage === STAGE.MENU);
  setLooping(gameSound, stage === STAGE.PLAY);
}

function setLooping(sound, shouldPlay) {
  if (shouldPlay && !sound.isPlaying()) sound.loop();
  if (!shouldPlay && sound.isPlaying()) sound.stop();
}

// Smooth fade between screens
function drawFade() {
  if (nextStage !== null) {
    fade += 14 * dt;                       // fading out
    if (fade >= 255) {
      const target = nextStage;
      nextStage = null;
      applyStage(target);
    }
  } else if (fade > 0) {
    fade -= 9 * dt;                        // fading in
  }

  if (fade <= 0) return;
  push();
  noStroke();
  fill(2, 27, 43, constrain(fade, 0, 255));
  rect(0, 0, width, height);
  pop();
}

/* =========================================================================
   7. TEXT HELPERS
   ========================================================================= */
// Glow behind text. Scaled by pixel density so it looks the same on every screen.
function glow(amount) {
  drawingContext.shadowBlur = amount * pixelDensity();
  drawingContext.shadowColor = color(255);
}

function waveOffsets() {
  const t = millis() / 1000;
  return { x: cos(t * 6) * 2, y: sin(t * 6) * 2 };
}

function breathing(base, range) {
  return base + sin((millis() / 1000) * 2.4) * range;
}

/* =========================================================================
   8. MENU
   ========================================================================= */
function drawMenu() {
  push();
  image(menuBg, 0, 0, width, height);

  const wave = waveOffsets();
  textFont(myFont);
  textAlign(CENTER);
  fill(255);
  glow(breathing(20, 10));

  textSize(60);
  text('Grab & Dash', width / 2, 100 + wave.y);
  textSize(20);
  text('By SONA, Collector Challenge T2, 2026', width / 2, 140 + wave.y);
  textSize(30);
  text('How to Play', width / 2, 220 + wave.y);
  textSize(18);
  text(IS_TOUCH ? 'Touch and drag to swim the diver around the ocean'
                : 'Use the Arrow Keys to move the diver around the ocean', width / 2, 260 + wave.y);
  text('Obtain all pearls before time runs out', width / 2, 290 + wave.y);
  text('Avoid hitting the jellyfish', width / 2, 320 + wave.y);
  textSize(26);
  text(IS_TOUCH ? 'TAP TO PLAY' : 'PRESS ANY KEY TO PLAY', width / 2 + wave.x, 400 + wave.y);
  pop();
}

/* =========================================================================
   9. GAME
   ========================================================================= */
function drawGame() {
  image(gameBg, 0, 0, width, height);

  updateDiver();
  drawDiver();
  updatePearls();
  updateJellyfish();
  updateSeaStars();
  drawHud();

  if (hp <= 0) setStage(STAGE.GAME_OVER);
  else if (pearlCount === NUM_PEARLS) setStage(STAGE.WIN);
}

// ---- diver -------------------------------------------------------------
function updateDiver() {
  const step = DIVER_SPEED * dt;

  // keyboard (arrows or WASD)
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { p1X += step; facing = 1; }
  if (keyIsDown(LEFT_ARROW)  || keyIsDown(65)) { p1X -= step; facing = -1; }
  if (keyIsDown(DOWN_ARROW)  || keyIsDown(83)) { p1Y += step; }
  if (keyIsDown(UP_ARROW)    || keyIsDown(87)) { p1Y -= step; }

  // touch / mouse drag: swim towards the finger
  const pointer = getPointer();
  if (pointer) {
    const dx = pointer.x - (p1X + DIVER_SIZE / 2);
    const dy = pointer.y - (p1Y + DIVER_SIZE / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > 4) {
      const move = Math.min(step, distance);
      p1X += (dx / distance) * move;
      p1Y += (dy / distance) * move;
      if (Math.abs(dx) > 4) facing = dx > 0 ? 1 : -1;
    }
  }

  // keep diver inside the canvas
  p1X = constrain(p1X, -10, width - 110);
  p1Y = constrain(p1Y, -25, height - 95);
}

function getPointer() {
  if (touches.length > 0) return { x: touches[0].x, y: touches[0].y };
  if (mouseIsPressed) return { x: mouseX, y: mouseY };
  return null;
}

function drawDiver() {
  image(facing === 1 ? diverRight : diverLeft, p1X, p1Y, DIVER_SIZE, DIVER_SIZE);
}

function diverCentre() {
  return { x: p1X + DIVER_SIZE / 2, y: p1Y + DIVER_SIZE / 2 };
}

function sendDiverToStart() {
  p1X = DIVER_START_X;
  p1Y = DIVER_START_Y;
}

// ---- pearls ------------------------------------------------------------
function updatePearls() {
  const d = diverCentre();
  for (const pearl of pearls) {
    if (pearl.collected) continue;

    image(pearlImg, pearl.x, pearl.y, 30, 30);

    if (dist(d.x, d.y, pearl.x + 15, pearl.y + 15) < 56) {
      pearl.collected = true;
      pearlCount++;
      pearlSound.play();
    }
  }
}

// ---- jellyfish ---------------------------------------------------------
function updateJellyfish() {
  const d = diverCentre();
  for (const j of jellyfish) {
    image(jellyImg, j.x, j.y, 100, 100);

    // chase the diver once he leaves the surface (frame-rate independent)
    if (p1Y > 0) {
      const ease = 1 - Math.pow(1 - j.speed, dt);
      j.x = lerp(j.x, p1X, ease);
      j.y = lerp(j.y, p1Y, ease);
    }

    const distance = dist(d.x, d.y, j.x + 50, j.y + 50);
    if (!j.hit && distance < 60) {
      j.hit = true;
      lastHitBy = 'jellyfish';
      loseHp();
    }
    if (j.hit && distance > 100) j.hit = false;
  }
}

// ---- sea stars ---------------------------------------------------------
function updateSeaStars() {
  const d = diverCentre();
  for (const s of seaStars) {
    // turn around at the walls
    if (s.x > width - 40) s.movingRight = false;
    if (s.x < 0) s.movingRight = true;

    s.x += (s.movingRight ? s.speed : -s.speed) * dt;
    image(seaStarImg, s.x, s.y, 40, 40);

    const distance = dist(d.x, d.y, s.x + 20, s.y + 20);
    if (!s.hit && distance < 60) {
      s.hit = true;
      lastHitBy = 'sea star';
      loseHp();
    }
    if (s.hit && distance > 100) s.hit = false;
  }
}

function loseHp() {
  hp--;
  diverSound.play();
  sendDiverToStart(); // put diver back at the start position when hitting an enemy
}

// ---- HUD ---------------------------------------------------------------
function drawHud() {
  push();
  textFont(myFont);
  textAlign(LEFT);
  textSize(20);
  stroke(245);
  strokeWeight(1);
  fill(255);
  text('Pearls: ' + pearlCount + ' / ' + NUM_PEARLS, 20, 50);
  text('HP: ' + max(hp, 0), 20, 80);
  pop();
}

/* =========================================================================
   10. GAME OVER AND WIN
   Both screens share one layout, so they always look balanced:
   title, message, three stats, two buttons.
   On PC use the buttons or the keyboard; on mobile just tap the buttons.
   ========================================================================= */
const PANEL = { x: 100, y: 40, w: 600, h: 420 };

function drawGameOver() {
  drawEndScreen({
    title: 'GAME OVER',
    message: 'The ' + lastHitBy + ' got you!',
    againLabel: 'Try Again',
  });
}

function drawWin() {
  const messages = {
    4: 'Flawless dive!',
    3: 'Great dive!',
    2: 'Nice work!',
    1: 'Phew, that was close!',
  };
  drawEndScreen({
    title: 'YOU DID IT!',
    message: messages[constrain(hp, 1, 4)],
    againLabel: 'Play Again',
    win: true,
  });
}

function drawEndScreen(cfg) {
  push();
  image(gameBg, 0, 0, width, height);

  // dim the scene so the panel stands out
  noStroke();
  fill(0, 0, 0, 90);
  rect(0, 0, width, height);

  // panel
  fill(2, 27, 43, 205);
  stroke(255, 120);
  strokeWeight(2);
  rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 24);

  textFont(myFont);
  textAlign(CENTER, BASELINE);
  noStroke();
  fill(255);

  // title with a soft glow
  push();
  glow(breathing(18, 8));
  textSize(60);
  text(cfg.title, width / 2, 115 + waveOffsets().y);
  pop();

  // message
  textSize(26);
  text(cfg.message, width / 2, 160);

  // stats: the same three columns on both screens
  const cols = [width / 2 - 190, width / 2, width / 2 + 190];
  drawStat(cols[0], 'Pearls', pearlCount + ' / ' + NUM_PEARLS);
  drawStat(cols[1], 'Time', formatTime(runSeconds));
  drawStat(cols[2], 'HP left', max(hp, 0) + ' / ' + START_HP);

  // best time note (win only)
  if (cfg.win && bestTime !== null) {
    textSize(17);
    fill(255, 215, 120);
    text(isNewBest ? 'NEW BEST TIME!' : 'Best: ' + formatTime(bestTime), cols[1], 308);
  }

  // buttons
  const buttons = endButtons(cfg.againLabel);
  hoverButton = IS_TOUCH ? null : buttonAt(mouseX, mouseY, buttons);
  for (const b of buttons) drawButton(b, hoverButton === b.id);
  cursor(hoverButton ? HAND : ARROW);

  // keyboard hint (PC only)
  if (!IS_TOUCH) {
    textSize(18);
    fill(255, 200);
    text('ENTER  play again     ESC  menu', width / 2, 440);
  }
  pop();
}

function drawStat(cx, label, value) {
  textAlign(CENTER, BASELINE);
  fill(255, 190);
  textSize(20);
  text(label, cx, 235);
  fill(255);
  textSize(40);
  text(value, cx, 282);
}

// ---- buttons -----------------------------------------------------------
function endButtons(againLabel) {
  const w = 230, h = 64, gap = 24, y = 340;
  return [
    { id: 'again', label: againLabel, x: width / 2 - w - gap / 2, y, w, h },
    { id: 'menu',  label: 'Menu',     x: width / 2 + gap / 2,     y, w, h },
  ];
}

function drawButton(b, hovered) {
  const primary = b.id === 'again';
  const lift = hovered ? -2 : 0;

  if (primary) {
    fill(255, hovered ? 255 : 235);
    stroke(255);
  } else {
    fill(255, hovered ? 55 : 22);
    stroke(255, 200);
  }
  strokeWeight(2);
  rect(b.x, b.y + lift, b.w, b.h, 16);

  noStroke();
  fill(primary ? color(2, 27, 43) : color(255));
  textSize(26);
  textAlign(CENTER, CENTER);
  text(b.label, b.x + b.w / 2, b.y + b.h / 2 + lift);
  textAlign(CENTER, BASELINE);
}

// Hit area is a little bigger than the drawn button, so fingers don't miss
function buttonAt(px, py, buttons) {
  const pad = 12;
  for (const b of buttons) {
    if (px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad) {
      return b.id;
    }
  }
  return null;
}

// ---- helpers -----------------------------------------------------------
function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Best time is saved in the browser (wrapped in try/catch in case storage is blocked)
function loadBestTime() {
  try {
    const v = parseFloat(localStorage.getItem('grabdash-best-time'));
    return isNaN(v) ? null : v;
  } catch (e) {
    return null;
  }
}

function saveBestTime(seconds) {
  try {
    localStorage.setItem('grabdash-best-time', String(seconds));
  } catch (e) { /* storage blocked: ignore */ }
}

/* =========================================================================
   11. INPUT
   ========================================================================= */
function keyPressed() {
  userStartAudio(); // browsers only allow sound after the first interaction

  if (stage === STAGE.MENU) {
    startGame();
  } else if (stage === STAGE.GAME_OVER || stage === STAGE.WIN) {
    if (keyCode === ENTER) startGame();      // same keys on both end screens
    if (keyCode === ESCAPE) returnToMenu();
  }
}

// Touch and mouse
function touchStarted() {
  const t = touches.length ? touches[touches.length - 1] : { x: mouseX, y: mouseY };
  pointerAction(t.x, t.y);
  return false; // stops the browser from also firing a fake mouse click
}

function mousePressed() {
  pointerAction(mouseX, mouseY);
}

function pointerAction(px, py) {
  userStartAudio();
  if (millis() - stageStartedAt < 700) return; // ignore accidental taps right after a screen change

  if (stage === STAGE.MENU) {
    startGame();
  } else if (stage === STAGE.GAME_OVER || stage === STAGE.WIN) {
    const pressed = buttonAt(px, py, endButtons(''));
    if (pressed === 'again') startGame();
    if (pressed === 'menu') returnToMenu();
  }
}

function startGame() {
  setStage(STAGE.PLAY);
}

function returnToMenu() {
  setStage(STAGE.MENU);
}