'use client';
import { useEffect, useRef, useState } from 'react';
import { catalogSchema, detailsSchema, playbackSchema, type MediaItem, type Stream } from '@/lib/contracts';
import { playbackKey, readStored, writeStored, type Progress } from '@/lib/history';
import Player from './player';
async function request(params: Record<string,string>, signal?: AbortSignal) {
  const res = await fetch(`/api/media?${new URLSearchParams(params)}`, { signal });
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(typeof data === 'object' && data && 'error' in data ? String(data.error) : 'Request failed');
  return data;
}
export default function CineBox() {
  const [items,setItems] = useState<MediaItem[]>([]);
  const [query,setQuery] = useState('');
  const [tab,setTab] = useState('Home');
  const [mode,setMode] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState<MediaItem|null>(null);
  const [favorites,setFavorites] = useState<MediaItem[]>([]);
  const [history,setHistory] = useState<Record<string,Progress>>({});
  const [streams,setStreams] = useState<Stream[]>([]);
  const [source,setSource] = useState(0);
  const [season,setSeason] = useState(0);
  const [episode,setEpisode] = useState(0);
  const [warning,setWarning] = useState('');
  const [ready,setReady] = useState(false);
  const generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const stored = readStored<unknown>('cinebox:favorites', []);
    if (Array.isArray(stored)) setFavorites(stored.flatMap(v => { const result = detailsSchema.shape.item.safeParse(v); return result.success ? [result.data] : []; }));
    const progress = readStored<Record<string,Progress>>('cinebox:history', {});
    if (progress && typeof progress === 'object' && !Array.isArray(progress)) setHistory(progress);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);setError('');
      void request({ action:'catalog',q:query },controller.signal).then(data => {
        const result = catalogSchema.parse(data);setItems(result.items);setMode(result.mode);
      }).catch(e => { if(!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Catalog unavailable'); }).finally(() => { if(!controller.signal.aborted)setLoading(false); });
    },250);
    return () => { clearTimeout(timer);controller.abort(); };
  },[query]);
  function close() { generation.current++;dialog.current?.close();setSelected(null);setStreams([]);setReady(false); }
  async function open(item:MediaItem) {
    const token = ++generation.current;
    setSelected(item);setStreams([]);setWarning('Loading details…');setReady(false);dialog.current?.showModal();
    try {
      const result = detailsSchema.parse(await request({action:'details',id:item.id}));
      if(token!==generation.current)return;
      setSelected(result.item);setSeason(result.item.seasons?.[0]?.number??0);setEpisode(result.item.seasons?.[0]?.episodes[0]?.number??0);setWarning('');setReady(true);
    }catch(e){if(token===generation.current)setWarning(e instanceof Error?e.message:'Details unavailable');}
  }
  async function play(s=season,e=episode) {
    if(!selected||!ready)return;
    const token=++generation.current;setSeason(s);setEpisode(e);setStreams([]);setWarning('Resolving stream…');
    try{
      const result=playbackSchema.parse(await request({action:'streams',id:selected.id,season:String(s),episode:String(e)}));
      if(token!==generation.current)return;
      setStreams(result.streams);setSource(0);setWarning(result.warning??(result.streams.length?'':'No compatible sources.'));
    }catch(err){if(token===generation.current)setWarning(err instanceof Error?err.message:'Stream unavailable');}
  }
  function favorite(){if(!selected)return;const next=favorites.some(i=>i.id===selected.id)?favorites.filter(i=>i.id!==selected.id):[...favorites,selected];setFavorites(next);writeStored('cinebox:favorites',next);}
  function save(seconds:number,duration:number){
    if(!selected||!Number.isFinite(seconds)||!Number.isFinite(duration)||duration<=0)return;
    const record:Progress={item:selected,season,episode,seconds,duration,updated:Date.now()};
    setHistory(current=>{const next=Object.fromEntries(Object.entries({...current,[playbackKey(selected.id,season,episode)]:record}).filter(([,v])=>v&&Number.isFinite(v.updated)).sort((a,b)=>b[1].updated-a[1].updated).slice(0,100));writeStored('cinebox:history',next);return next;});
  }
  function nextEpisode(){const all=selected?.seasons?.flatMap(s=>s.episodes.map(e=>({season:s.number,episode:e.number})))??[];const index=all.findIndex(v=>v.season===season&&v.episode===episode);if(index>=0&&all[index+1])void play(all[index+1].season,all[index+1].episode);}
  const visible=(tab==='My List'?favorites:items).filter(i=>(tab!=='Movies'||i.type==='movie')&&(tab!=='Series'||i.type==='series')&&i.title.toLowerCase().includes(query.toLowerCase()));
  const continuing=Object.values(history).filter(v=>v?.item&&v.seconds>5&&v.seconds<v.duration*.9).slice(0,8);
  return <main><header><a className="brand" href="/">cine<span>box</span></a><nav aria-label="Main navigation">{['Home','Movies','Series','My List'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav></header>
    {tab==='Home'&&!query&&<section className="hero"><small>YOUR NEXT WATCH STARTS HERE</small><h1>Stories worth<br/>staying in for.</h1><p>Discover movies and series, explore episodes, and keep your place.</p><a className="primary" href="#catalog">Explore collection ↓</a></section>}
    <section id="catalog" className="collection"><div className="section-head"><h2>{tab==='Home'?'Find your next favorite':tab}</h2><label><span className="sr-only">Search titles</span><input type="search" value={query} placeholder="Search movies and series…" onChange={e=>setQuery(e.target.value)}/></label></div>
    {mode&&<p className="notice"><strong>{mode==='demo'?'Demo mode':'Live provider mode'}</strong> · {mode==='demo'?'Sample movie and synthetic episode lab. Configure the backend for provider results.':'Browser compatibility varies by source.'}</p>}{error&&<p role="alert" className="notice">{error}</p>}
    {tab==='Home'&&continuing.length>0&&<section><h3>Continue watching</h3><div className="continue">{continuing.map(h=><button key={playbackKey(h.item.id,h.season,h.episode)} onClick={()=>void open(h.item)}>{h.item.title}{h.episode?` · S${h.season} E${h.episode}`:''}<progress value={h.seconds} max={h.duration}/><small>Open this episode to resume</small></button>)}</div></section>}
    {loading&&tab!=='My List'?<p role="status">Loading titles…</p>:<div className="grid">{visible.map((item,i)=><button key={item.id} className="card" aria-label={`Open ${item.title}`} onClick={()=>void open(item)}><div className={`poster gradient-${i%3}`}>{item.poster?<img src={item.poster} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<><small>{item.type.toUpperCase()}</small><strong>{item.title}</strong><span>▶</span></>}</div><strong>{item.title}</strong><small>{item.year??'Explore'} · {item.type}</small></button>)}</div>}
    {!loading&&!visible.length&&<p>No titles here yet. Try a search or save a title.</p>}</section>
    <footer>Favorites and history stay on this device. Watch only content you are authorized to access.<br/><small>Demo media: Big Buck Bunny, Blender Foundation. Player Lab episodes reuse that sample.</small></footer>
    <dialog ref={dialog} onCancel={close} className="details"><button className="close" aria-label="Close details" onClick={close}>×</button>{selected&&<><small>{selected.type.toUpperCase()}</small><h2>{selected.title}</h2><p>{selected.description}</p><div className="actions"><button className="primary" disabled={!ready} onClick={()=>void play()}>▶ Watch now</button><button onClick={favorite}>{favorites.some(i=>i.id===selected.id)?'Remove from My List':'Add to My List'}</button></div>
    {!!selected.seasons?.length&&<section><label>Season <select value={season} onChange={e=>{generation.current++;const s=Number(e.target.value);setSeason(s);setEpisode(selected.seasons?.find(v=>v.number===s)?.episodes[0]?.number??0);setStreams([]);}}>{selected.seasons.map(s=><option key={s.number} value={s.number}>{s.number}</option>)}</select></label><div className="episodes">{selected.seasons.find(s=>s.number===season)?.episodes.map(e=><button key={e.number} aria-label={`Episode ${e.number}: ${e.title??`Episode ${e.number}`}`} onClick={()=>void play(season,e.number)}>{e.number}. {e.title??`Episode ${e.number}`}</button>)}</div></section>}
    {warning&&<p className="notice" role="status">{warning}</p>}{streams[source]&&<section><div className="section-head"><strong>{episode?`Season ${season} · Episode ${episode}`:'Now playing'}</strong><label>Source <select value={source} onChange={e=>setSource(Number(e.target.value))}>{streams.map((s,i)=><option key={s.url} value={i}>{s.label}</option>)}</select></label></div><Player key={`${selected.id}:${season}:${episode}:${source}`} stream={streams[source]} start={history[playbackKey(selected.id,season,episode)]?.seconds??0} onProgress={save} onEnded={nextEpisode}/></section>}</>}</dialog>
  </main>;
}
