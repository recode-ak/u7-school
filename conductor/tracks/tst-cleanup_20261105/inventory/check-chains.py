import re,os,sys
# Проверка цепочек «покрыт удаляемым» между таблицами <m>-{domain,app,bot}-delete.md.
# Запуск: python3 check-chains.py <каталог inventory> <модуль>
os.chdir(sys.argv[1]); M=sys.argv[2]
removed={};rows=[]
def full(f,lvl):
    f=f.strip('`')
    if f.startswith(M+'/'): return 'domain/src/'+f
    if lvl=='domain' and not f.startswith(('domain/','modules/','runners/','node_modules/')): return f'domain/src/{M}/'+f
    return f
for lvl in ['domain','app','bot']:
    cur=None
    for l in open(f'{M}-{lvl}-delete.md'):
        if not l.startswith('|'): continue
        c=[x.strip() for x in l.strip().strip('|').split('|')]
        if len(c)<6 or not c[1].isdigit(): continue
        if c[0]: cur=full(c[0],lvl)
        key=f"{cur}:{c[1]}"; act=c[4]
        rows.append((lvl,key,act,' | '.join(c[5:])))
        if act.startswith(('удалить','слить')): removed[key]=(lvl,act)
print('строк',len(rows),'удаляемых/сливаемых',len(removed))
def refs(ref,lvl):
    out=[];last=None
    for m in re.finditer(r'`([^`\s]*?\.test\.ts):(\d+)`|`:(\d+)`|(?<=[ ,(])\+?`?:(\d+)',ref):
        if m.group(1): last=full(m.group(1),lvl); out.append(f"{last}:{m.group(2)}")
        elif last and (m.group(3) or m.group(4)): out.append(f"{last}:{m.group(3) or m.group(4)}")
    return out
n=0
for lvl,key,act,ref in rows:
    if not act.startswith(('удалить','слить')): continue
    for r in refs(ref,lvl):
        if r in removed and r!=key:
            tgt=removed[r]
            # приёмник слияния — допустим
            if tgt[1].startswith('слить') : flag='(→ сливаемый)'
            else: flag=''
            print(f"{lvl} {key} [{act[:25]}] -> {r} удаляется в {tgt[0]} [{tgt[1][:25]}] {flag}"); n+=1
print('цепочек',n)
