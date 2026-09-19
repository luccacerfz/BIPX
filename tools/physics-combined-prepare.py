from pathlib import Path
import hashlib,json,shutil,subprocess,datetime
root=Path.cwd();out=root/'output/physics/combined-native-20260919';snap=out/'game'
assert not snap.exists(),'Never overwrite existing snapshot'
files=[root/x for x in ['index.html','styles.css','server.mjs','package.json','package-lock.json']]
for folder in ['src','assets','vendor']:files += [p for p in (root/folder).rglob('*') if p.is_file() and 'source-history' not in p.parts]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p.relative_to(root)):sha(p) for p in sorted(files)}
assert before['src/main.js']=='afc7d5acd1a5fbe33b03367acf93aec5e404d7aa720e7869bf9c9c6a0f76d7b1'
assert before['assets/models/aldric-hero.glb']=='5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996'
env=root/'output/environment/crypt-maintenance-combined-v1';em=json.loads((env/'manifest.json').read_text())
assert len(em['files'])==7
for e in em['files']:
 assert sha(env/'payload'/e['path'])==e['after'];assert before.get(e['path'])==e['before'],e['path']
for p in files:
 dest=snap/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
for p in ['src/main.js','src/physics/navigation.mjs']:
 dest=out/'baseline'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(snap/p,dest)
for e in em['files']:
 dest=snap/e['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(env/'payload'/e['path'],dest)
selected=root/'output/physics/pursuit-terminal-20260919'
shutil.copyfile(selected/'candidate/src/physics/navigation.mjs',snap/'src/physics/navigation.mjs')
subprocess.run(['patch','--batch','-p1','-i',str(selected/'main-bloodcow-adapter.patch')],cwd=snap,check=True)
assert sha(snap/'src/main.js')=='c0fbc03bd99ba66deacac8122c75d625038ce950c8c5c00745d7c7662e6b2493'
after={p:sha(root/p) for p in before};assert before==after
candidate={p:sha(snap/p) for p in sorted(set(before)|{e['path'] for e in em['files']})}
deltas=[{'path':p,'before':before.get(p),'after':h} for p,h in candidate.items() if before.get(p)!=h]
assert len(deltas)==9
(out/'manifest.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':before,'candidate':candidate,'deltas':deltas,'environmentPayloadManifestSha256':sha(env/'manifest.json'),'environmentPayload':em['files'],'liveUnchanged':True,'scope':'New snapshot only; current Aldric5c, no Lich, no env/ledger copied, old snapshots untouched.'},indent=2)+'\n')
print(json.dumps({'baselineFiles':len(before),'candidateFiles':len(candidate),'deltas':len(deltas),'snapshot':str(snap)}))
