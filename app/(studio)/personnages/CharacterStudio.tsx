'use client';
import { useActionState, useMemo, useState, useTransition } from 'react';
import { FolderFan, type FanItem } from '@/components/process/web-folder-fan/FolderFan';
import { GlassPanel } from '@/components/process/web-liquid-glass/LiquidGlass';
import { removeAsset, saveCharacter, uploadAssets } from '@/app/actions';
import type { Character } from '@/lib/types';

export function CharacterStudio({ characters, postCounts }: { characters: Character[]; postCounts: Record<string, number> }) {
  const [selectedId, setSelectedId] = useState(characters[0]?.id);
  const items: FanItem[] = useMemo(() => characters.map(c => {
    const images = c.assets.filter(a => a.kind === 'image').map(a => a.url);
    return {
      id: c.id,
      title: c.name,
      subtitle: `${c.assets.length} visuel${c.assets.length > 1 ? 's' : ''} · ${postCounts[c.id] ?? 0} post${(postCounts[c.id] ?? 0) > 1 ? 's' : ''}`,
      covers: images.length ? images.slice(0, 3) : [`linear-gradient(160deg, #1a1a22, ${c.color})`],
      avatar: images[0] ?? `radial-gradient(circle at 35% 30%, #fff, ${c.color} 45%, #111 90%)`,
      live: (postCounts[c.id] ?? 0) > 0,
    };
  }), [characters, postCounts]);
  const selected = characters.find(c => c.id === selectedId) ?? characters[0];

  return (
    <>
      <div className="fan-wrap">
        <FolderFan items={items} accent="violet" height={340} ariaLabel="Tes personnages"
          onSelect={item => item && setSelectedId(item.id)} />
      </div>
      {selected && <Editor key={selected.id} c={selected} />}
    </>
  );
}

function Editor({ c }: { c: Character }) {
  const [saved, save, saving] = useActionState(saveCharacter, null);
  const [up, upload, uploading] = useActionState(uploadAssets, null);
  const [removing, startRemove] = useTransition();

  return (
    <div className="char-grid">
      <GlassPanel tone="dark" className="panel" radius={20}>
        <div className="panel-h"><h2>Fiche de {c.name}</h2><span className="color-dot" style={{ '--c': c.color } as React.CSSProperties} /></div>
        <form action={save} className="form">
          <input type="hidden" name="id" value={c.id} />
          <div className="row-2">
            <label className="field"><span>Nom</span><input className="input" id={`name-${c.id}`} name="name" defaultValue={c.name} required /></label>
            <label className="field"><span>Couleur</span><input className="input" id={`color-${c.id}`} name="color" type="color" defaultValue={c.color} style={{ padding: 4 }} /></label>
          </div>
          <label className="field"><span>Univers</span>
            <textarea className="input" id={`universe-${c.id}`} name="universe" defaultValue={c.universe} placeholder="D'où il vient, ce qu'il fait, son monde…" /></label>
          <label className="field"><span>Ton</span>
            <textarea className="input" id={`tone-${c.id}`} name="tone" defaultValue={c.tone} placeholder="Comment il parle, son humour, ce qu'il ne dit jamais…" /></label>
          <label className="field"><span>Répliques types</span>
            <textarea className="input" id={`catch-${c.id}`} name="catchphrases" defaultValue={c.catchphrases} placeholder="Une réplique par ligne" /></label>
          <div className="row-2">
            <label className="field"><span>Voix ElevenLabs (ID)</span><input className="input mono" id={`voice-${c.id}`} name="voiceId" defaultValue={c.voiceId} placeholder="ex. 21m00Tcm4TlvDq8ikWAM" /></label>
            <label className="field"><span>Réglages de voix</span><input className="input" id={`vnotes-${c.id}`} name="voiceNotes" defaultValue={c.voiceNotes} placeholder="Stabilité, style, modèle…" /></label>
          </div>
          {saved && <p className={`notice ${saved.ok ? 'ok' : 'err'}`} role="status">{saved.message}</p>}
          <div className="row"><button className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</button></div>
        </form>
      </GlassPanel>

      <GlassPanel tone="dark" className="panel" radius={20}>
        <div className="panel-h"><h2>Visuels, vidéos et voix</h2><span className="muted">{c.assets.length}</span></div>
        <form action={upload} className="form">
          <input type="hidden" name="id" value={c.id} />
          <label className="drop" htmlFor={`files-${c.id}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <span>Choisis des images, vidéos ou fichiers audio</span>
            <input id={`files-${c.id}`} name="files" type="file" multiple accept="image/*,video/*,audio/*" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
          </label>
          {up && <p className={`notice ${up.ok ? 'ok' : 'err'}`} role="status">{up.message}</p>}
          <div className="row"><button className="btn btn-ghost" disabled={uploading}>{uploading ? 'Envoi…' : 'Ajouter à la bibliothèque'}</button></div>
        </form>
        <div className="assets" style={{ marginTop: 14 }}>
          {c.assets.map(a => (
            <figure key={a.id} className="asset" style={{ margin: 0 }} title={a.name}>
              {a.kind === 'image' && <img src={a.url} alt={a.name} loading="lazy" />}
              {a.kind === 'video' && <video src={a.url} muted playsInline preload="metadata" />}
              {a.kind === 'audio' && <><span className="asset-kind">audio</span><audio src={a.url} controls preload="none" /></>}
              <button className="rm" aria-label={`Retirer ${a.name}`} disabled={removing} onClick={() => startRemove(() => removeAsset(c.id, a.id))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </figure>
          ))}
        </div>
        {!c.assets.length && <p className="muted" style={{ marginTop: 6 }}>Rien pour l&apos;instant. Ajoute tes visuels et tes extraits de voix ElevenLabs.</p>}
      </GlassPanel>
    </div>
  );
}
