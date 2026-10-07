import { h } from './dom';
import type { UI } from './UI';
import { lookEditor } from './panels';
import { DEFAULT_LOOK } from '../state/newGame';
import type { Appearance } from '../state/types';

/** Title screen: continue / new game. The 3D farm keeps rendering behind it. */
export function titleScreen(ui: UI, hasSave: boolean, onContinue: () => void, onNew: () => void): HTMLElement {
  const el = h('div.title', { onpointerdown: (e: Event) => e.stopPropagation() },
    h('div.logo', null, 'Mossy Meadows', h('small', null, 'COZY FARM ADVENTURE')),
    h('div.col', { style: { alignItems: 'center', marginTop: '18px' } },
      hasSave ? h('button.btn', { style: { minWidth: '240px', fontSize: '20px' }, onclick: () => { ui.g.audio.unlock(); el.remove(); onContinue(); } }, '▶ Continuer') : null,
      h(`button.btn${hasSave ? '.ghost' : ''}`, { style: { minWidth: '240px', fontSize: '20px' }, onclick: () => { ui.g.audio.unlock(); el.remove(); onNew(); } }, '🌱 Nouvelle partie'),
    ),
    h('div.muted', { style: { marginTop: '18px', background: 'rgba(255,255,255,.7)', padding: '4px 12px', borderRadius: '10px' } }, 'Touchez pour commencer · Le son démarre au premier toucher'),
  );
  ui.root.appendChild(el);
  return el;
}

/** Character creator for a new game. */
export function creatorScreen(ui: UI, onDone: (name: string, farm: string, look: Appearance) => void): void {
  const look: Appearance = JSON.parse(JSON.stringify(DEFAULT_LOOK));
  ui.g.previewLook(look);
  const name = h('input.text', { value: 'Sacha', maxLength: 16, placeholder: 'Votre prénom' }) as HTMLInputElement;
  const farm = h('input.text', { value: 'Ferme Moussue', maxLength: 22, placeholder: 'Nom de la ferme' }) as HTMLInputElement;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone(name.value.trim() || 'Sacha', farm.value.trim() || 'Ferme Moussue', look);
  };
  ui.showPanel('creator', '🧸 Votre personnage', [
    h('div.row', null, h('div.grow', null, h('div.muted', null, 'Prénom'), name), h('div.grow', null, h('div.muted', null, 'Ferme'), farm)),
    h('p.muted', null, 'Personnalisez votre style. Vous pourrez le changer à tout moment dans la garde-robe.'),
    lookEditor(ui, look, (l) => ui.g.previewLook(l), false),
    h('div.center', { style: { marginTop: '14px' } }, h('button.btn', { style: { fontSize: '20px' }, onclick: () => {
      ui.closePanel();
    } }, '🌿 Commencer l\'aventure')),
  ], { size: 'wide', onClose: finish });
}
