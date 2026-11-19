import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../app/useReducedMotion';
import { assetUrl } from '../data/assets';
import './opening-film.css';

const seenKey = 'urameku-intro-seen';
let shownThisVisit = false;

function firstVisit() {
  if (typeof document.createElement('dialog').showModal !== 'function') return false;
  if (shownThisVisit || !document.createElement('video').canPlayType('video/mp4')) return false;
  try {
    return localStorage.getItem(seenKey) !== '1';
  } catch {
    return true;
  }
}

export function OpeningFilm() {
  const [visible, setVisible] = useState(firstVisit);
  const reduced = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const show = visible && !reduced;

  useEffect(() => {
    const modal = dialog.current;
    const film = video.current;
    if (!show || !modal || !film) return;
    let active = true;
    modal.showModal();
    shownThisVisit = true;
    try {
      localStorage.setItem(seenKey, '1');
    } catch {
      // The in-memory flag still covers navigation in this tab.
    }
    const finish = () => {
      if (active) setVisible(false);
    };
    void film.play().catch(finish);
    const timeout = window.setTimeout(finish, 18000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      modal.close();
    };
  }, [show]);

  if (!show) return null;
  return (
    <dialog
      ref={dialog}
      className="opening-film"
      aria-label="ウラメクのオープニング"
      onCancel={() => setVisible(false)}
    >
      <video
        ref={video}
        src={assetUrl('media/urameku-intro.mp4')}
        playsInline
        muted
        aria-label="あなたは調査編集局の記者。この見出しは本当だろうか。資料を読み比べて証拠を探す。つかんだ証拠を記事にしよう。"
        onEnded={() => setVisible(false)}
        onError={() => setVisible(false)}
      />
      <button className="btn ghost" type="button" onClick={() => setVisible(false)}>
        動画をスキップ
      </button>
    </dialog>
  );
}
