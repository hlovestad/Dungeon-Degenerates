// THE IDIOT'S TRIAL: 3 quick trivia questions hosted by a skull with a bow tie.
// Works inside a run (mode 'crawl': gold for right answers, zaps for wrong ones)
// and on its own (mode 'arcade': just a score). Arcade mode is what the future
// standalone minigame menu will use.
import { T, C, SPRITE_HEIGHT } from '../config.js';
import { TRIVIA } from '../data/trivia.js';
import { text, panel, button, bubble, floater, fadeTo, fadeIn } from '../ui/ui.js';
import { background, actor, spawnParty } from '../ui/stage.js';
import { run, rng, addGold } from '../systems/state.js';
import { SCENE_SLOTS } from '../scenes/Event.js';
import { sfx } from '../audio/sfx.js';

const ROUNDS = 3;
const SECONDS = 12;
const RIGHT = ['Correct! Somehow.', 'Ding ding ding!', 'Even a broken clock...', 'The crowd is stunned.'];
const WRONG = ['WRONG. Zap them.', 'Oh no. Oh no no no.', 'The audience boos.', 'Incorrect, idiot.'];

export class TriviaScene extends Phaser.Scene {
  constructor() { super('Trivia'); }

  create(data = {}) {
    fadeIn(this);
    this.mode = data.mode || 'crawl';
    this.returnTo = data.returnTo || (this.mode === 'crawl' ? 'Map' : 'Title');
    background(this, 'bg_trivia_stage');
    this.crawl = this.mode === 'crawl' && run;
    if (this.crawl) this.party = spawnParty(this, { slots: SCENE_SLOTS });
    this.host = actor(this, 'npc_trivia_skull', 540, 200, SPRITE_HEIGHT.npc, { float: 18, flip: true });
    this.josh = this.crawl && run.party.find((h) => h.race === 'josh' && h.hp > 0);
    this.eyeUsed = false;
    this.round = 0;
    this.score = 0;
    this.goldWon = 0;
    this.deck = rng.shuffle(TRIVIA).slice(0, ROUNDS);
    this.ui = this.add.container(0, 0).setDepth(500);
    text(this, 320, 8, "THE IDIOT'S TRIAL", { size: 12, ox: 0.5, color: T.gold, depth: 501 });
    this.time.delayedCall(500, () => {
      bubble(this, 540, 150, 'Welcome, contestants! Three questions. Try not to embarrass your families.', 2200);
    });
    this.time.delayedCall(1700, () => this.ask());
  }

  ask() {
    this.ui.removeAll(true);
    const item = this.deck[this.round];
    const correct = item.a[0];
    const answers = rng.shuffle(item.a);
    this.answered = false;

    this.ui.add(panel(this, 60, 28, 520, 64));
    this.ui.add(text(this, 76, 36, `QUESTION ${this.round + 1} OF ${ROUNDS}`, { size: 8, color: T.grey }));
    this.ui.add(text(this, 76, 52, item.q, { size: 8, wrap: 490, lineSpacing: 5 }));
    // timer bar
    const tg = this.add.graphics();
    this.ui.add(tg);
    let left = SECONDS * 1000;
    const drawTimer = () => {
      tg.clear();
      tg.fillStyle(C.ink, 1); tg.fillRect(60, 96, 520, 6);
      tg.fillStyle(left < 4000 ? C.red : C.gold, 1); tg.fillRect(60, 96, Math.max(0, 520 * left / (SECONDS * 1000)), 6);
    };
    drawTimer();
    this.timerEv = this.time.addEvent({
      delay: 100, loop: true, callback: () => {
        left -= 100;
        drawTimer();
        if (left <= 0) this.pick(null, correct);
      },
    });

    this.btns = answers.map((a, i) => {
      const b = button(this, 140 + (i % 2) * 220, 254 + Math.floor(i / 2) * 50, 212, 44, a, () => this.pick(a, correct), { size: 8 });
      b.answer = a;
      this.ui.add(b);
      return b;
    });
    if (this.josh && !this.eyeUsed) {
      const eye = button(this, 14, 300, 116, 52, 'THIRD EYE', () => {
        this.eyeUsed = true;
        eye.setEnabled(false);
        sfx('magic');
        this.btns.filter((b) => b.answer !== correct).slice(0, 2).forEach((b) => b.setEnabled(false));
        const j = run.party.findIndex((h) => h.race === 'josh');
        bubble(this, this.party.heroes[j].x, 150, 'My third eye says... not those two.', 1600);
      }, { size: 8, fill: 0x2a3a6a, sub: 'Josh kills 2 wrong answers' });
      this.ui.add(eye);
    }
  }

  pick(answer, correct) {
    if (this.answered) return;
    this.answered = true;
    this.timerEv.remove();
    this.btns.forEach((b) => {
      b.setEnabled(false);
      if (b.answer === correct) b.setSelected(true);
    });
    const right = answer === correct;
    if (right) {
      this.score++;
      sfx('jackpot');
      if (this.crawl) { addGold(15); this.goldWon += 15; floater(this, 320, 230, '+15g', T.gold, 12); }
      bubble(this, 540, 150, rng.pick(RIGHT), 1300);
      this.tweens.add({ targets: this.host.sprite, angle: 10, duration: 80, yoyo: true, repeat: 3 });
    } else {
      sfx('hit');
      this.cameras.main.shake(200, 0.006);
      bubble(this, 540, 150, answer === null ? "Time's up! ZAP!" : rng.pick(WRONG), 1300);
      if (this.crawl) {
        run.party.forEach((h) => { if (h.hp > 0) h.hp = Math.max(1, h.hp - 3); });
        this.party.heroes.forEach((a) => {
          a.sprite.setTintFill(0x9af0ff);
          this.time.delayedCall(120, () => a.sprite.clearTint());
        });
        floater(this, 160, 150, 'ZAP! -3 HP each', T.blue, 10);
      }
    }
    this.time.delayedCall(1500, () => {
      this.round++;
      if (this.round < ROUNDS) this.ask();
      else this.results();
    });
  }

  results() {
    this.ui.removeAll(true);
    this.ui.add(panel(this, 140, 110, 360, 130));
    const verdict = this.score === 3 ? 'GENIUSES. Suspicious.' : this.score === 0 ? 'Zero. A new record.' : this.score === 1 ? 'One. Better than nothing.' : 'Two. Not bad, idiots.';
    this.ui.add(text(this, 320, 124, `${this.score} / ${ROUNDS} CORRECT`, { size: 16, ox: 0.5, color: T.gold }));
    this.ui.add(text(this, 320, 152, verdict, { size: 8, ox: 0.5 }));
    if (this.crawl) this.ui.add(text(this, 320, 170, `Gold won: ${this.goldWon}`, { size: 8, ox: 0.5, color: T.gold }));
    if (this.mode === 'arcade') {
      this.ui.add(button(this, 160, 196, 150, 36, 'PLAY AGAIN', () => this.scene.restart({ mode: 'arcade', returnTo: this.returnTo }), { size: 8, fill: 0x2a5a3a }));
      this.ui.add(button(this, 330, 196, 150, 36, 'BACK', () => fadeTo(this, this.returnTo), { size: 8 }));
    } else {
      this.ui.add(button(this, 230, 196, 180, 36, 'CONTINUE', () => fadeTo(this, this.returnTo), { size: 10, fill: 0x2a5a3a }));
    }
  }
}
