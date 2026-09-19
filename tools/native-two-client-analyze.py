# Analyser of tools/native-two-client.mjs captures (ported from output/qa/aaa-20260919/fable-native-v3/tools/analyze.py; metrics unchanged).
# usage: python3 tools/native-two-client-analyze.py [<evidence root>]   (default: ./evidence; one sub-folder per capture label)
# Writes <root>/analysis.json and <root>/analysis-summary.json. Captures taken without the window.__fableQA hook have empty frame
# lists: their rows keep the event-level fields (castId, terminal distance/kind, travel events) and bodyFrames/trailSegments are 0.
import json,glob,math,sys,os
root=sys.argv[1] if len(sys.argv)>1 else 'evidence'; out={}
SK={1:('dwarf_frost_shot',1,20),2:('dwarf_gravity_shot',2,18)}
d3=lambda a,b: math.dist(a,b)
def xyz(p): return [p['x'],p.get('y',0),p['z']]
def side(data,slot,who):
    sid,kind,rng=SK[slot]; ev=[e for e in data['events'] if e.get('skillId')==sid]
    casts=[e for e in ev if e.get('phase')=='cast']
    if not casts: return {'error':'no cast event seen'}
    cid=casts[-1]['castId']; ev=[e for e in ev if e.get('castId')==cid]
    rel=next((e for e in ev if e['phase']=='release'),None); imp=next((e for e in ev if e['phase']=='impact'),None)
    trav=[e for e in ev if e['phase']=='travel']; actor=casts[-1].get('actorId'); local=casts[-1].get('local')
    r={'castId':cid,'local':local,'eventRadius':casts[-1].get('radius'),'areaMultiplier':casts[-1].get('areaMultiplier'),'travelEvents':len(trav)}
    if not imp or not rel: r['error']='missing release/impact'; return r
    term=xyz(imp['target']); org=xyz(rel['origin']); dist=math.hypot(term[0]-org[0],term[2]-org[2]); r['terminalDistance']=round(dist,2)
    near=min([math.hypot(t['x']-term[0],t['z']-term[2]) for t in data['targets']] or [99])
    r['terminalKind']='range' if dist>rng-.3 else ('contact?' if near<1.6 else 'solid/early')
    frames=data['frames']; bf=[(f,b) for f in frames for b in f['bodies'] if b['kind']==kind]
    r['bodyFrames']=len(bf)
    if bf:
        f0,b0=bf[0]; mz=f0['muzzles']['local'] if local else (f0['muzzles']['remote'] or {}).get(actor)
        br=next((b for b in f0['bridges'] if b['castId']==cid),None)
        r['bridgeAtFirstBody']=None if not br else {k:br[k] for k in ('enabled','fallback','abandoned','launchBlocked','clipped','errors')}
        if mz: r['firstBodyToMuzzle_m']=round(d3(b0['at'],mz),3)
        if br and mz: r['bridgeSocketToMuzzleNow_m']=round(d3(br['socket'],mz),3)
        r['firstBodyToAuthorityOrigin_m']=round(d3(b0['at'],org),3)
        dx,dz=(term[0]-org[0])/max(dist,1e-6),(term[2]-org[2])/max(dist,1e-6)
        perp=[];over=0;prev=None;jump=0;back=0
        for f,b in bf:
            px,pz=b['at'][0]-org[0],b['at'][2]-org[2]; along=px*dx+pz*dz; per=abs(px*dz-pz*dx); perp.append((along,per,abs(b['at'][1]-org[1])))
            over=max(over,along-dist)
            if prev is not None: jump=max(jump,d3(b['at'],prev[1])); back=min(back,along-prev[0])
            prev=(along,b['at'])
        r['lateralOffsetStart_m']=round(perp[0][1],3); r['heightOffsetStart_m']=round(perp[0][2],3)
        late=[p for p in perp if p[0]>=3.6]; r['maxLateralAfter3_6m']=round(max([p[1] for p in late] or [0]),4); r['maxHeightAfter3_6m']=round(max([p[2] for p in late] or [0]),4)
        r['bodyOvershootPastTerminal_m']=round(max(0,over),3); r['maxBodyJump_m']=round(jump,2); r['bodyWentBackwards_m']=round(-back,3)
        r['lastBodyToTerminal_m']=round(d3(bf[-1][1]['at'],term),3)
        moved=[i for i in range(1,len(bf)) if d3(bf[i][1]['at'],bf[i-1][1]['at'])>1e-4]; r['bodyLingerAtLastPos_ms']=round(bf[-1][0]['t']-bf[moved[-1]][0]['t']) if moved else None
        tl=bf[-1][0]['t']; after=[f for f in frames if f['t']>tl]; r['bodyVisibleAfterLast_ms']=0 if not after else round(after[0]['t']-tl)
    rib={}; stale={(x['i'],round(x['birth'],4)) for x in (frames[0]['ribbons'] if frames else [])}
    dirx,dirz=(term[0]-org[0])/max(dist,1e-6),(term[2]-org[2])/max(dist,1e-6)
    for f in frames:
        for x in f['ribbons']:
            k=(x['i'],round(x['birth'],4))
            if k in stale: continue
            # keep only segments lying on this cast's authoritative line (other casts/clients share the pool)
            qx,qz=(x['from'][0]+x['to'][0])/2-org[0],(x['from'][2]+x['to'][2])/2-org[2]
            if abs(qx*dirz-qz*dirx)<1.3 and -1.5<qx*dirx+qz*dirz<dist+1.5: rib.setdefault(k,x)
    chain=sorted(rib.values(),key=lambda x:x['birth']); r['trailSegments']=len(chain)
    if chain:
        firsts=[c for c in chain if abs(c['birth']-chain[0]['birth'])<1e-6]
        gaps=[]; byb={}
        for c in chain: byb.setdefault(round(c['birth'],4),[]).append(c)
        keys=sorted(byb); 
        for a,b in zip(keys,keys[1:]): gaps.append(min(d3(x['to'],y['from']) for x in byb[a] for y in byb[b]))
        r['trailMaxGap_m']=round(max(gaps or [0]),3); r['trailEndToTerminal_m']=round(min(d3(c['to'],term) for c in byb[keys[-1]]),3)
        if bf and mz: r['trailStartToMuzzle_m']=round(min(d3(c['from'],mz) for c in firsts),3)
    if slot==2:
        rings=[(f['t'],g) for f in frames for g in f['rings']]
        if rings:
            pos=[g['at'] for _,g in rings]; r['ring']={'frames':len(rings),'renderedRadius':round(rings[0][1]['radius'],3),'radiusConstant':len({round(g['radius'],3) for _,g in rings})==1,
              'centreToImpact_m':round(math.hypot(pos[0][0]-term[0],pos[0][2]-term[2]),3),'centreDrift_m':round(max(d3(p,pos[0]) for p in pos),4)}
        neb=[n for f in frames for n in f['nebulae']]
        if neb: r['nebula']={'frames':len(neb),'maxChildScale':max(max(n['scales']) for n in neb),'centreToImpact_m':round(math.hypot(neb[0]['at'][0]-term[0],neb[0]['at'][2]-term[2]),3)}
    else:
        old={(s['i'],round(s['birth'],4)) for s in (frames[0]['surfaces'] if frames else [])}
        nov=[s for f in frames for s in f['surfaces'] if (s['i'],round(s['birth'],4)) not in old and math.hypot(s['at'][0]-term[0],s['at'][2]-term[2])<.5]
        if nov: r['novaSurface']={'renderedRadius':round(max(s['radius'] for s in nov),3),'centreToImpact_m':round(min(math.hypot(s['at'][0]-term[0],s['at'][2]-term[2]) for s in nov),3)}
    return r
for run in sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root,d))):
    rows=[]
    for fp in sorted(glob.glob(f'{root}/{run}/round-*.json')):
        d=json.load(open(fp)); slot=int(fp.split('slot')[1][0])-1; name=os.path.basename(fp)
        rows.append({'file':name,'hud':d['casterBefore']['hud'][slot],'hudAreaMultiplier':d['casterBefore'].get('areaMultiplier'),'caster':side(d['local'],slot,'local'),'observer':side(d['remote'],slot,'remote')})
    out[run]=rows
json.dump(out,open(os.path.join(root,'analysis.json'),'w'),indent=1,ensure_ascii=False)

import statistics as st
def agg(vals): vals=[v for v in vals if v is not None]; return None if not vals else {'n':len(vals),'min':round(min(vals),3),'median':round(st.median(vals),3),'max':round(max(vals),3)}
summary={}
for run,rows in out.items():
    for who in ('caster','observer'):
        for slot in ('slot2','slot3'):
            S=[r[who] for r in rows if slot in r['file'] and 'error' not in r[who]]
            en=[s for s in S if (s.get('bridgeAtFirstBody') or {}).get('enabled')]; fb=[s for s in S if s.get('bridgeAtFirstBody') and not s['bridgeAtFirstBody']['enabled']]
            summary[f'{run}|{who}|{slot}']={'casts':len(S),'bridgeEnabled':len(en),'fallbacks':[s['bridgeAtFirstBody']['fallback'] for s in fb],'terminalKinds':sorted({s['terminalKind'] for s in S}),
              **{k:agg([s.get(k) for s in en]) for k in ('firstBodyToMuzzle_m','lateralOffsetStart_m','maxLateralAfter3_6m','maxHeightAfter3_6m','lastBodyToTerminal_m','bodyOvershootPastTerminal_m','bodyWentBackwards_m','bodyLingerAtLastPos_ms','trailSegments','trailMaxGap_m','trailStartToMuzzle_m','trailEndToTerminal_m')},
              'fallback_firstBodyToAuthorityOrigin_m':agg([s.get('firstBodyToAuthorityOrigin_m') for s in fb])}
json.dump(summary,open(os.path.join(root,'analysis-summary.json'),'w'),indent=1,ensure_ascii=False)
for k,v in summary.items():
    if 'solo' in k and 'observer' in k: continue
    print(k, json.dumps({a:b for a,b in v.items() if b not in (None,[])},ensure_ascii=False))
print('--- area visuals')
for run,rows in out.items():
    for r in rows:
        for who in ('caster','observer'):
            s=r[who]
            if s.get('ring') or s.get('novaSurface'): print(run[:14],r['file'][6:34],who[:3],'eventR',s.get('eventRadius'),'hudR',r['hud'].get('radius'),'ring',s.get('ring'),'neb',s.get('nebula'),'nova',s.get('novaSurface'))
