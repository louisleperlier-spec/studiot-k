import type { Character, Network, PostStatus } from '@/lib/types';
import { NETWORK_LABEL, NETWORK_SHORT, STATUS_LABEL } from '@/lib/types';

export function Who({ c }: { c?: Character }) {
  if (!c) return null;
  return <span className="who" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span>;
}

export function Nets({ list }: { list: Network[] }) {
  return <span className="nets">{list.map(n => <span key={n} className="net" title={NETWORK_LABEL[n]}>{NETWORK_SHORT[n]}</span>)}</span>;
}

export function StatusChip({ s }: { s: PostStatus }) {
  return <span className={`chip is-${s}`}>{STATUS_LABEL[s]}</span>;
}

/** CSS background for a post or character thumbnail: the image, or the character colour as a gradient. */
export function thumb(url: string | undefined, color: string) {
  return url ? `url("${url}")` : `linear-gradient(160deg, #0d0d14, ${color} 70%)`;
}
