import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
if (params.has('debugview')) {
  import('./debugview').then((m) => m.debugBoot());
} else if (params.has('charlab')) {
  import('./charlab').then((m) => m.charLab());
} else {
  const game = new Game(canvas);
  game.boot().catch((e) => {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff8ec;font-family:sans-serif;padding:20px;text-align:center">Oups, le jeu n'a pas pu démarrer.<br>${String(e)}</div>`);
  });
}
