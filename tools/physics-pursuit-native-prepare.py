from pathlib import Path
import hashlib,json,shutil,subprocess
root=Path.cwd(); out=root/'output/physics/pursuit-native-20260919'; snap=out/'game'
assert not snap.exists(), 'Snapshot already exists; preserve previous evidence'
files=[root/x for x in ['index.html','styles.css','server.mjs','package.json','package-lock.json']]
for folder in ['src','assets','vendor']:
    files += [p for p in (root/folder).rglob('*') if p.is_file() and 'source-history' not in p.parts]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p.relative_to(root)):sha(p) for p in sorted(files)}
assert before['src/main.js']=='afc7d5acd1a5fbe33b03367acf93aec5e404d7aa720e7869bf9c9c6a0f76d7b1'
assert before['src/physics/contacts.mjs']=='912c00fe18457ac0951812d31a6215bbff1cb01b05e9fae619e8aa2cbe4db6d4'
for p in files:
    dest=snap/p.relative_to(root); dest.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(p,dest)
for p in ['src/main.js','src/physics/navigation.mjs','src/render/environment-layout.js']:
    dest=out/'baseline'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(snap/p,dest)
selected=root/'output/physics/pursuit-terminal-20260919'
shutil.copyfile(selected/'candidate/src/physics/navigation.mjs',snap/'src/physics/navigation.mjs')
shutil.copyfile(selected/'layout-a5f4.js',snap/'src/render/environment-layout.js')
subprocess.run(['patch','--batch','-p1','-i',str(selected/'main-bloodcow-adapter.patch')],cwd=snap,check=True)
assert sha(snap/'src/main.js')=='c0fbc03bd99ba66deacac8122c75d625038ce950c8c5c00745d7c7662e6b2493'
after={p:sha(root/p) for p in before};assert before==after
candidate={p:sha(snap/p) for p in before}
changed=[p for p in before if before[p]!=candidate[p]]
assert changed==['src/main.js','src/physics/navigation.mjs','src/render/environment-layout.js'],changed
(out/'manifest.json').write_text(json.dumps({'baseline':before,'candidate':candidate,'changed':changed,'liveUnchanged':before==after,'excluded':'No Lich or other staging patches. Current full live assets copied; no env/ledger copied.'},indent=2)+'\n')
print(json.dumps({'files':len(before),'snapshot':str(snap),'changed':changed}))
