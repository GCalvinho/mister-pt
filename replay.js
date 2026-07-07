/* ============ REPETIÇÃO 2.5D (golos) ============ */
const RP={q:[],on:false,raf:0,t0:0,segs:[],dots:[],defs:[],gk:null,d:null,cam:null,trail:[],dur:0,phase:"play",phT:0,W:0,H:0,ctx:null};
function canReplay(){try{return !matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return true}}
function queueReplay(d){RP.q.push(d);if(!RP.on)rpNext();}
function rpNext(){const d=RP.q.shift();if(!d){rpClose();return}rpStart(d);}
function rpClose(){
  RP.on=false;cancelAnimationFrame(RP.raf);
  const el=$("replay");el.classList.remove("on");el.style.transition="";el.style.opacity="";
  $("rp-cap").classList.remove("gol");
  if(M)M.replaying=false;
  if(M&&!M.done&&!M.paused)tick();
}
function rpSkip(){if(!RP.on)return;RP.q.length=0;rpClose();}
function rpStart(d){
  RP.on=true;
  const el=$("replay");el.style.transition="";el.style.opacity="1";el.classList.add("on");
  const cv=$("rp-cv"),dpr=Math.min(window.devicePixelRatio||1,2);
  RP.W=el.clientWidth||window.innerWidth;RP.H=el.clientHeight||window.innerHeight;
  cv.width=Math.round(RP.W*dpr);cv.height=Math.round(RP.H*dpr);
  RP.ctx=cv.getContext("2d");RP.ctx.setTransform(dpr,0,0,dpr,0,0);
  RP.d=d;RP.trail=[];RP.phase="play";RP.phT=0;
  /* segmentos da jogada */
  let legs=d.legs&&d.legs.length?d.legs.slice():[{x:0.5,y:0.5,id:0,n:d.scorer}];
  /* prolongar com construção: passes de colegas recuados até ao 1.º toque registado */
  if(d.A&&d.A.length){
    const named=new Set(legs.map(l=>l.id));
    const uniq=named.size;
    const want=Math.min(4,Math.max(0,7-uniq));
    if(want>0){
      const first=legs[0];
      const cands=d.A.filter(o=>!named.has(o.id)&&o.y>first.y+0.05).sort((a,b)=>b.y-a.y);
      const bl=[];let ref=null;
      for(const c of cands){
        if(bl.length>=want)break;
        if(!ref||(c.y<ref.y-0.04&&Math.abs(c.x-ref.x)<0.7)){bl.push({x:c.x,y:c.y,id:c.id,n:c.n});ref=c;}
      }
      if(bl.length)legs=bl.concat(legs);
    }
  }
  /* rotação de bola: passes longos passam por um colega perto da trajetória */
  {
    const line0=(d.D&&d.D.length)?Math.min.apply(null,d.D.map(o=>o.y)):0.25;
    const pool=(d.A||[]).filter(o=>!o.gk&&o.y>line0+0.02);
    const relTh=(d.atk&&d.atk.contra)?0.40:(d.atk&&d.atk.posse)?0.24:0.30;
    let changed=true,guard=0;
    while(changed&&guard++<12&&legs.length<10){
      changed=false;
      for(let i=1;i<legs.length;i++){
        const a=legs[i-1],b=legs[i];
        if(a.id===b.id)continue;
        const dist=Math.hypot(b.x-a.x,b.y-a.y);
        if(dist<relTh)continue;
        /* distância do colega ao corredor do passe (segmento a→b) */
        const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
        let best=null,bd=1e9;
        for(const c of pool){
          if(c.id===a.id||c.id===b.id)continue; /* pode repetir toques, menos os extremos do passe */
          let tt=((c.x-a.x)*dx+(c.y-a.y)*dy)/len2;
          if(tt<0.18||tt>0.82)continue; /* tem de estar a meio do corredor */
          const px=a.x+tt*dx,py=a.y+tt*dy;
          const dd=Math.hypot(c.x-px,c.y-py);
          if(dd<bd){bd=dd;best=c;}
        }
        if(best&&bd<0.24){legs.splice(i,0,{x:best.x,y:best.y,id:best.id,n:best.n});changed=true;break;}
      }
    }
  }
  RP.segs=[];let t=520;
  for(let i=1;i<legs.length;i++){
    const a=legs[i-1],b=legs[i],dist=Math.hypot(b.x-a.x,b.y-a.y);
    const carry=a.id===b.id;
    const spd=(d.atk&&d.atk.contra)?0.88:1.12; /* contra-ataque menos lento; jogadas normais mais pausadas */
    const dur=(carry?Math.max(470,dist*1680):Math.max(430,dist*1400))*spd;
    RP.segs.push({t0:t,t1:t+dur,a,b,carry,i:RP.segs.length});t+=dur+(carry?0:140);
  }
  const last=legs[legs.length-1];
  const out=d.outcome||"goal";RP.out=out;
  var gx=0.5,gy=-0.022;
  if(out==="tackle"){
    /* a jogada morre num corte: a bola vai até um ponto onde o defensor intercepta */
    const tx=last.x+(0.5-last.x)*0.3,ty=Math.max(0.12,last.y-0.06);
    RP.segs.push({t0:t,t1:t+360,a:last,b:{x:tx,y:ty,id:-8,n:""},tackle:true,i:RP.segs.length});
    RP.tackleAt={x:tx,y:ty};t+=360;RP.dur=t;gx=tx;
  }else{
  if(out==="post"){gx=last.x<0.5?0.585:0.415;gy=-0.004;}
  else if(out==="save"){gx=0.5+(last.x<0.5?1:-1)*0.052;gy=0.018;}
  else if(out==="miss"){gx=0.5+(last.x<0.5?1:-1)*(0.125+Math.random()*0.05);gy=-0.03;}
  else{gx=0.5+(last.x<0.5?1:-1)*(0.02+Math.random()*0.032);gy=-0.022;}
  RP.segs.push({t0:t,t1:t+380,a:last,b:{x:gx,y:gy,id:last.id,n:last.n},shot:true,i:RP.segs.length});
  t+=380;
  }
  if(out==="post"){ /* ressalto no ferro */
    const rx=gx+(gx<0.5?0.13:-0.13);
    RP.segs.push({t0:t,t1:t+330,a:{x:gx,y:0.0,id:-9,n:""},b:{x:rx,y:0.12,id:-9,n:""},shot:true,ric:true,i:RP.segs.length});
    t+=330;
  }
  RP.dur=t;
  /* receções: em cada passe, quem recebe corre para o ponto de receção */
  RP.firstId=legs[0].id;
  RP.tacY=d.atk?(d.atk.ment===2?-0.035:d.atk.ment===0?0.04:0):0;
  RP.recv={};
  RP.segs.forEach(sg=>{
    if(!sg.carry&&!sg.shot){(RP.recv[sg.b.id]=RP.recv[sg.b.id]||[]).push({si:sg.i,x:sg.b.x,y:sg.b.y});}
  });
  /* onze atacante completo; participantes na jogada ficam na posição do 1.º toque */
  RP.dots=(d.A||[]).map(o=>({id:o.id,n:o.n,x:o.x,y:o.y,gk:!!o.gk,role:o.role,band:o.band}));
  const seen={};
  for(let li=0;li<legs.length;li++){const l=legs[li];
    if(seen[l.id])continue;seen[l.id]=1;
    const dt=RP.dots.find(x=>x.id===l.id);
    if(dt){if(li===0){dt.x=l.x;dt.y=l.y}} /* só o portador inicial começa colado à bola */
    else RP.dots.push({id:l.id,n:l.n,x:l.x,y:l.y});
  }
  /* forma de bloco: posição-base de cada jogador + origem da bola (translação parcial) */
  RP.b0={x:legs[0].x,y:legs[0].y};
  RP._b0y=null; /* baricentro vertical calculado após o re-espaçamento */
  for(const dt of RP.dots){dt.x0=dt.x;dt.y0=dt.y;}
  /* profundidade por ROLE: cada jogador vai à sua faixa natural do campo (y=0 ataque, 1 defesa própria) */
  {
    /* profundidade-alvo por role (fração do meio-campo próprio até à baliza adversária) */
    const DEPTH={GR:0.97,CEN:0.82,DL:0.64,ALA:0.50,MDF:0.60,B2B:0.48,MCR:0.38,F9:0.20,AVI:0.18,EXT:0.18,PL:0.08};
    const nn=RP.dots.filter(o=>!o.gk);
    if(nn.length){
      /* âncora: manter o baricentro vertical original da equipa (respeita bloco alto/baixo) */
      const meanNow=nn.reduce((s,o)=>s+o.y0,0)/nn.length;
      const tgt=o=>DEPTH[o.role]!=null?DEPTH[o.role]:o.y0;
      const meanTgt=nn.reduce((s,o)=>s+tgt(o),0)/nn.length;
      /* âncora suave: só metade do desvio do baricentro (bloco alto/baixo nota-se, mas não domina) */
      const shift=(meanNow-meanTgt)*0.5;
      for(const o of nn){
        /* escala de role manda (92%), posição real dá variação lateral/individual (8%) */
        const ry=tgt(o)+shift;
        o.y0=Math.max(0.08,Math.min(0.94,ry*0.92+o.y0*0.08));
        o.y=o.y0;
      }
    }
    /* ajustar receções/remates à profundidade de role: um PL recebe e remata na SUA zona avançada */
    const byId={};for(const o of nn)byId[o.id]=o;
    for(const sg of RP.segs){
      const rc=byId[sg.b.id];
      if(rc&&rc.y0!=null&&!sg.carry&&sg.b.y>rc.y0+0.02)sg.b.y=rc.y0;
    }
    /* origem do remate = onde o rematador de facto está */
    const shotSeg=RP.segs.find(s=>s.shot&&!s.ric);
    if(shotSeg){const sh=byId[shotSeg.a.id];if(sh&&sh.y0!=null&&shotSeg.a.y>sh.y0+0.02)shotSeg.a.y=sh.y0;}
    /* recalcular RP.recv com os pontos corrigidos */
    RP.recv={};
    RP.segs.forEach(sg=>{if(!sg.carry&&!sg.shot){(RP.recv[sg.b.id]=RP.recv[sg.b.id]||[]).push({si:sg.i,x:sg.b.x,y:sg.b.y});}});
    /* âncora da basculação = baricentro vertical da equipa (não o GR) */
    RP.b0.y=nn.reduce((s,o)=>s+o.y0,0)/nn.length;
  }
  RP.defs=(d.D||[]).map(o=>({x:o.x,y:o.y,n:o.n,role:o.role,band:o.band}));
  /* profundidade por role para a defesa (mesmas faixas, lado da baliza de ataque): corrige defensor perdido no ataque */
  {
    const DEF_DEPTH={GR:0.03,CEN:0.15,DL:0.20,ALA:0.32,MDF:0.28,B2B:0.40,MCR:0.50,F9:0.60,AVI:0.64,EXT:0.64,PL:0.72};
    const dd=RP.defs.filter(o=>o.role&&o.role!=="GR");
    if(dd.length){
      const meanNow=dd.reduce((s,o)=>s+o.y,0)/dd.length;
      const tgt=o=>DEF_DEPTH[o.role]!=null?DEF_DEPTH[o.role]:o.y;
      const meanTgt=dd.reduce((s,o)=>s+tgt(o),0)/dd.length;
      const shift=meanNow-meanTgt;
      for(const o of dd){
        const ry=tgt(o)+shift;
        o.y=Math.max(0.06,Math.min(0.62,ry*0.8+o.y*0.2)); /* nenhum defensor passa do meio-campo adversário */
      }
    }
  }
  /* marcações: cada defesa fica atribuído ao adversário mais próximo (atribuição única gulosa) */
  {
    /* teto de profundidade por role: a defesa não passa o seu meio-campo */
    const CAP={GR:0.02,CEN:0.30,DL:0.34,ALA:0.44,MDF:0.42,B2B:0.50,MCR:0.56,F9:0.60,AVI:0.60,EXT:0.60,PL:0.62};
    for(const df of RP.defs)df.yCap=CAP[df.role]!=null?CAP[df.role]:0.40;
    /* marcação: cada defesa marca o atacante mais próximo, mas só os que entram no seu meio-campo */
    const cand=[];
    for(const df of RP.defs)for(const dt of RP.dots){if(dt.gk)continue;cand.push({df,id:dt.id,dd:Math.hypot(df.x-dt.x,df.y-dt.y)});}
    cand.sort((a,b)=>a.dd-b.dd);
    const tD=new Set(),tA=new Set();
    for(const c of cand){if(tD.has(c.df)||tA.has(c.id))continue;c.df.mk=c.id;tD.add(c.df);tA.add(c.id);}
  }
  RP.gk={x:Math.max(0.41,Math.min(0.59,(d.GK&&d.GK.x!=null)?d.GK.x:0.5)),y:(d.GK&&d.GK.y!=null)?Math.min(d.GK.y,0.05):0.035,n:(d.GK&&d.GK.n)||"",dive:0,side:gx<0.5?-1:1};
  RP.cam={x:RP.W/2,y:RP.H*0.62,z:1.02};
  const CAP={
    goal:["GOLO · "+(d.team&&d.team.s?d.team.s:""),"⚽ "+d.scorer+" "+d.min+"'"+(d.assist?" · assistência de "+d.assist:"")],
    save:["QUE DEFESA!","🧤 "+(d.gkN||"O guarda-redes")+" nega o golo a "+d.scorer+" · "+d.min+"'"],
    post:["AO POSTE!","😱 "+d.scorer+" acerta no ferro · "+d.min+"'"],
    miss:["POR POUCO!","💨 "+d.scorer+" atira ao lado · "+d.min+"'"],
    tackle:["DESARME!","🛡 "+(d.tackler||"A defesa")+" corta o ataque · "+d.min+"'"]};
  $("rp-c1").textContent=CAP[out][0];
  $("rp-c2").textContent=CAP[out][1];
  RP.t0=performance.now();
  RP.raf=requestAnimationFrame(rpFrame);
}
/* projeção 2.5D: linhas de u ou v constantes ficam retas no ecrã */
function rpP(u,v,h){
  const P=1.5,W=RP.W,H=RP.H;
  const yTop=H*0.18,yBot=H*1.04,m=(yBot-yTop)/P,Hz=yTop-m,K=m*(1+P);
  const z=1+(1-v)*P,s=1/z;
  return{x:W/2+(u-0.5)*W*1.32*s,y:Hz+K*s-(h||0)*H*0.6*s,s};
}
function rpQuad(C,u0,v0,u1,v1,fill){
  const a=rpP(u0,v0),b=rpP(u1,v0),c=rpP(u1,v1),d=rpP(u0,v1);
  C.fillStyle=fill;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.lineTo(c.x,c.y);C.lineTo(d.x,d.y);C.closePath();C.fill();
}
function rpLine(C,u0,v0,u1,v1,w,col){
  const a=rpP(u0,v0),b=rpP(u1,v1);
  C.strokeStyle=col||"rgba(255,255,255,.65)";C.lineWidth=w||1.5;
  C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();
}
function rpPitchDraw(C){
  const W=RP.W,H=RP.H;
  /* céu / estádio */
  const sky=C.createLinearGradient(0,0,0,H*0.34);
  sky.addColorStop(0,"#03100A");sky.addColorStop(1,"#0A2417");
  C.fillStyle=sky;C.fillRect(0,0,W,H*0.34);
  /* brilho dos holofotes atrás da baliza */
  const g0=rpP(0.5,0,0.1);
  const glow=C.createRadialGradient(g0.x,g0.y,4,g0.x,g0.y,W*0.42);
  glow.addColorStop(0,"rgba(255,232,170,.20)");glow.addColorStop(1,"rgba(255,232,170,0)");
  C.fillStyle=glow;C.fillRect(0,0,W,H*0.5);
  /* relvado fora das linhas */
  rpQuad(C,-0.35,-0.06,1.35,1.06,"#0B4A28");
  /* faixas de corte da relva */
  const N=8;
  for(let i=0;i<N;i++){
    const v0=i/N,v1=(i+1)/N;
    rpQuad(C,0.02,v0,0.98,v1,i%2?"#0E5C33":"#107040");
  }
  /* linhas */
  const wl="rgba(255,255,255,.72)",wl2="rgba(255,255,255,.55)";
  rpLine(C,0.02,0,0.98,0,2,wl);       /* linha de baliza (ataque) */
  rpLine(C,0.02,0,0.02,1,2,wl);       /* lateral esq */
  rpLine(C,0.98,0,0.98,1,2,wl);       /* lateral dir */
  rpLine(C,0.02,1,0.98,1,2,wl);       /* linha de baliza (defesa) */
  /* grande e pequena área — ataque */
  rpLine(C,0.21,0,0.21,0.16,1.5,wl);rpLine(C,0.79,0,0.79,0.16,1.5,wl);rpLine(C,0.21,0.16,0.79,0.16,1.5,wl);
  rpLine(C,0.365,0,0.365,0.055,1.2,wl);rpLine(C,0.635,0,0.635,0.055,1.2,wl);rpLine(C,0.365,0.055,0.635,0.055,1.2,wl);
  const pn=rpP(0.5,0.105,0);C.fillStyle=wl;C.beginPath();C.arc(pn.x,pn.y,2,0,7);C.fill();
  rpArc(C,0.5,0.105,0.135,0.085,(v,u)=>v>=0.162,wl2);   /* meia-lua ataque */
  /* grande e pequena área — defesa (lado de cá) */
  rpLine(C,0.21,1,0.21,0.84,1.5,wl);rpLine(C,0.79,1,0.79,0.84,1.5,wl);rpLine(C,0.21,0.84,0.79,0.84,1.5,wl);
  rpLine(C,0.365,1,0.365,0.945,1.2,wl);rpLine(C,0.635,1,0.635,0.945,1.2,wl);rpLine(C,0.365,0.945,0.635,0.945,1.2,wl);
  const pn2=rpP(0.5,0.895,0);C.fillStyle=wl;C.beginPath();C.arc(pn2.x,pn2.y,2.4,0,7);C.fill();
  rpArc(C,0.5,0.895,0.135,0.085,(v,u)=>v<=0.838,wl2);   /* meia-lua defesa */
  /* meio-campo + círculo central + marca central */
  rpLine(C,0.02,0.5,0.98,0.5,1.5,wl2);
  rpArc(C,0.5,0.5,0.135,0.085,null,wl2);
  const cs=rpP(0.5,0.5,0);C.fillStyle=wl2;C.beginPath();C.arc(cs.x,cs.y,2,0,7);C.fill();
  /* arcos de canto */
  rpArc(C,0.02,0,0.024,0.015,null,wl2);rpArc(C,0.98,0,0.024,0.015,null,wl2);
  rpArc(C,0.02,1,0.024,0.015,null,wl2);rpArc(C,0.98,1,0.024,0.015,null,wl2);
}
function rpArc(C,cu,cv,ru,rv,keep,col){
  C.strokeStyle=col;C.lineWidth=1.3;C.beginPath();let started=false;
  for(let a=0;a<=48;a++){const th=a/48*Math.PI*2;
    const u=cu+Math.cos(th)*ru,v=cv+Math.sin(th)*rv;
    const ok=u>=0.021&&u<=0.979&&v>=0.001&&v<=0.999&&(!keep||keep(v,u));
    if(ok){const q=rpP(u,v,0);if(started)C.lineTo(q.x,q.y);else{C.moveTo(q.x,q.y);started=true}}
    else started=false;
  }
  C.stroke();
}
function rpGoalDraw(C,front){
  const GL=0.415,GR=0.585,GH=0.055,BK=-0.045;
  const pl=rpP(GL,0,0),pr=rpP(GR,0,0),tl=rpP(GL,0,GH),tr=rpP(GR,0,GH);
  const bl=rpP(GL,BK,0),br=rpP(GR,BK,0),btl=rpP(GL,BK,GH*0.72),btr=rpP(GR,BK,GH*0.72);
  if(!front){
    /* rede: verticais e horizontais */
    C.strokeStyle="rgba(255,255,255,.28)";C.lineWidth=0.7;
    for(let i=0;i<=8;i++){const u=GL+(GR-GL)*i/8;
      const t=rpP(u,0,GH),b2=rpP(u,BK,0.001),m2=rpP(u,BK,GH*0.72);
      C.beginPath();C.moveTo(t.x,t.y);C.lineTo(m2.x,m2.y);C.lineTo(b2.x,b2.y);C.stroke();}
    for(let j=0;j<=4;j++){const h=GH*0.72*j/4;
      const l2=rpP(GL,BK,h),r2=rpP(GR,BK,h);
      C.beginPath();C.moveTo(l2.x,l2.y);C.lineTo(r2.x,r2.y);C.stroke();}
    /* laterais da rede */
    C.beginPath();C.moveTo(tl.x,tl.y);C.lineTo(btl.x,btl.y);C.lineTo(bl.x,bl.y);C.lineTo(pl.x,pl.y);C.stroke();
    C.beginPath();C.moveTo(tr.x,tr.y);C.lineTo(btr.x,btr.y);C.lineTo(br.x,br.y);C.lineTo(pr.x,pr.y);C.stroke();
  }else{
    /* postes + trave */
    C.strokeStyle="rgba(255,255,255,.95)";C.lineWidth=3;C.lineCap="round";
    C.beginPath();C.moveTo(pl.x,pl.y);C.lineTo(tl.x,tl.y);C.lineTo(tr.x,tr.y);C.lineTo(pr.x,pr.y);C.stroke();C.lineCap="butt";
  }
}
function rpGoalBack(C,front){
  const GL=0.415,GR=0.585,GH=0.052,BK=1.045; /* atrás da linha de fundo (v=1) */
  const pl=rpP(GL,1,0),pr=rpP(GR,1,0),tl=rpP(GL,1,GH),tr=rpP(GR,1,GH);
  const bl=rpP(GL,BK,0),br=rpP(GR,BK,0),btl=rpP(GL,BK,GH*0.72),btr=rpP(GR,BK,GH*0.72);
  if(!front){
    C.strokeStyle="rgba(255,255,255,.24)";C.lineWidth=0.7;
    for(let i=0;i<=8;i++){const u=GL+(GR-GL)*i/8;
      const t=rpP(u,1,GH),b2=rpP(u,BK,0.001),m2=rpP(u,BK,GH*0.72);
      C.beginPath();C.moveTo(t.x,t.y);C.lineTo(m2.x,m2.y);C.lineTo(b2.x,b2.y);C.stroke();}
    for(let j=0;j<=4;j++){const h=GH*0.72*j/4;const l2=rpP(GL,BK,h),r2=rpP(GR,BK,h);
      C.beginPath();C.moveTo(l2.x,l2.y);C.lineTo(r2.x,r2.y);C.stroke();}
    C.beginPath();C.moveTo(tl.x,tl.y);C.lineTo(btl.x,btl.y);C.lineTo(bl.x,bl.y);C.lineTo(pl.x,pl.y);C.stroke();
    C.beginPath();C.moveTo(tr.x,tr.y);C.lineTo(btr.x,btr.y);C.lineTo(br.x,br.y);C.lineTo(pr.x,pr.y);C.stroke();
  }else{
    C.strokeStyle="rgba(255,255,255,.9)";C.lineWidth=2.5;C.lineCap="round";
    C.beginPath();C.moveTo(pl.x,pl.y);C.lineTo(tl.x,tl.y);C.lineTo(tr.x,tr.y);C.lineTo(pr.x,pr.y);C.stroke();C.lineCap="butt";
  }
}
function rpGoalBack(C,front){
  const GL=0.415,GR=0.585,GH=0.052,BK=1.045; /* atrás da linha de fundo (v=1) */
  const pl=rpP(GL,1,0),pr=rpP(GR,1,0),tl=rpP(GL,1,GH),tr=rpP(GR,1,GH);
  const bl=rpP(GL,BK,0),br=rpP(GR,BK,0),btl=rpP(GL,BK,GH*0.72),btr=rpP(GR,BK,GH*0.72);
  if(!front){
    C.strokeStyle="rgba(255,255,255,.24)";C.lineWidth=0.7;
    for(let i=0;i<=8;i++){const u=GL+(GR-GL)*i/8;
      const t=rpP(u,1,GH),b2=rpP(u,BK,0.001),m2=rpP(u,BK,GH*0.72);
      C.beginPath();C.moveTo(t.x,t.y);C.lineTo(m2.x,m2.y);C.lineTo(b2.x,b2.y);C.stroke();}
    for(let j=0;j<=4;j++){const h=GH*0.72*j/4;const l2=rpP(GL,BK,h),r2=rpP(GR,BK,h);
      C.beginPath();C.moveTo(l2.x,l2.y);C.lineTo(r2.x,r2.y);C.stroke();}
    C.beginPath();C.moveTo(tl.x,tl.y);C.lineTo(btl.x,btl.y);C.lineTo(bl.x,bl.y);C.lineTo(pl.x,pl.y);C.stroke();
    C.beginPath();C.moveTo(tr.x,tr.y);C.lineTo(btr.x,btr.y);C.lineTo(br.x,br.y);C.lineTo(pr.x,pr.y);C.stroke();
  }else{
    C.strokeStyle="rgba(255,255,255,.9)";C.lineWidth=2.5;C.lineCap="round";
    C.beginPath();C.moveTo(pl.x,pl.y);C.lineTo(tl.x,tl.y);C.lineTo(tr.x,tr.y);C.lineTo(pr.x,pr.y);C.stroke();C.lineCap="butt";
  }
}
function rpDot(C,u,v,r,fill,ring,label,fallen,nm){
  const p=rpP(u,v,0),rad=Math.max(3.5,r*p.s*2.4);
  if(nm){
    const sn=nm.split(" ").pop();
    C.font="600 "+Math.max(7.5,8.5*p.s*1.5)+"px -apple-system,Arial";C.textAlign="center";
    C.fillStyle="rgba(0,0,0,.65)";C.fillText(sn,p.x+0.7,p.y+rad+8.7);
    C.fillStyle="rgba(255,255,255,.88)";C.fillText(sn,p.x,p.y+rad+8);
  }
  /* sombra */
  C.fillStyle="rgba(0,0,0,.30)";C.beginPath();C.ellipse(p.x,p.y+rad*0.35,rad*1.05,rad*0.42,0,0,7);C.fill();
  C.save();
  if(fallen){C.translate(p.x,p.y-rad*0.4);C.rotate(1.25);C.translate(-p.x,-(p.y-rad*0.4));}
  C.fillStyle=fill;C.beginPath();C.arc(p.x,p.y-rad*0.75,rad,0,7);C.fill();
  if(ring){C.strokeStyle=ring;C.lineWidth=1.6;C.stroke();}
  C.restore();
  if(label){
    C.font="700 "+Math.max(9,11*p.s*1.6)+"px -apple-system,Arial";C.textAlign="center";
    C.fillStyle="rgba(0,0,0,.55)";
    const tw=C.measureText(label).width;
    C.fillRect(p.x-tw/2-4,p.y-rad*2.6-11,tw+8,14);
    C.fillStyle="#fff";C.fillText(label,p.x,p.y-rad*2.6);
  }
}
function rpFrame(now){
  if(!RP.on)return;
  const t=now-RP.t0,C=RP.ctx,W=RP.W,H=RP.H,d=RP.d;
  /* bola */
  let bx,bv,bh=0,seg=null,shotK=0;
  for(const s of RP.segs){if(t>=s.t0&&t<s.t1){seg=s;break}}
  if(t<RP.segs[0].t0){const a=RP.segs[0].a;bx=a.x;bv=a.y;}
  else if(seg){
    const k=(t-seg.t0)/(seg.t1-seg.t0);
    const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    bx=seg.a.x+(seg.b.x-seg.a.x)*e;bv=seg.a.y+(seg.b.y-seg.a.y)*e;
    const dist=Math.hypot(seg.b.x-seg.a.x,seg.b.y-seg.a.y);
    if(!seg.carry&&!seg.shot)bh=Math.sin(Math.PI*k)*Math.min(0.5,dist)*0.42;
    if(seg.shot){bh=Math.sin(Math.PI*Math.min(k*1.15,1))*0.028;shotK=k;}
    if(seg.carry){const d0=RP.dots.find(x=>x.id===seg.a.id);if(d0){d0.x=bx;d0.y=bv;}}
  }else if(t>=RP.dur){
    const lb=RP.segs[RP.segs.length-1].b;bx=lb.x;bv=lb.y;
    if(RP.phase==="play"){RP.phase="gol";RP.phT=t;$("rp-cap").classList.add("gol");
      if(RP.out==="goal"&&navigator.vibrate){try{navigator.vibrate(70)}catch(e){}}}
  }else{
    /* pausa entre segmentos: bola parada no fim do último concluído */
    let ls=RP.segs[0];for(const s of RP.segs){if(t>=s.t1)ls=s}
    bx=(t>=ls.t1?ls.b:ls.a).x;bv=(t>=ls.t1?ls.b:ls.a).y;
  }
  /* guarda-redes: mergulho durante o remate */
  if(seg&&seg.shot){RP.gk.dive=Math.min(1,shotK*1.5);}
  const gkU=RP.gk.x+RP.gk.side*RP.gk.dive*(RP.out==="save"?0.095:0.055);
  /* defesa viva: o mais próximo pressiona a bola; os restantes marcam o seu homem pelo lado da baliza */
  const dp=(RP.d.dfT&&RP.d.dfT.press!=null)?RP.d.dfT.press:1; /* pressão tática da defesa */
  const pLerp=dp===2?0.038:dp===0?0.022:0.030;
  const mGap=dp===2?0.035:dp===0?0.075:0.05;
  const mLerp=dp===2?0.028:dp===0?0.020:0.024;
  const recvId=(seg&&!seg.carry&&!seg.shot)?seg.b.id:null;
  let presser=null,pdist=1e9;
  for(const df of RP.defs){const d2=Math.hypot(df.x-bx,df.y-bv);if(d2<pdist){pdist=d2;presser=df;}}
  for(const df of RP.defs){
    if(df===presser){
      /* pressiona a bola, mas não persegue além do seu teto de campo */
      df.x+=(bx-df.x)*pLerp;df.y+=(Math.max(bv,0.04)-df.y)*pLerp;
    }else{
      const mk=df.mk!=null?RP.dots.find(x=>x.id===df.mk):null;
      if(mk){
        if(recvId!=null&&mk.id===recvId){ /* o seu homem desmarcou-se: sprint atrás dele */
          df.x+=(mk.x-df.x)*0.045;df.y+=(Math.max(mk.y-0.01,0.10)-df.y)*0.045;
        }else{
          const lf=Math.max(0.10,bv-0.30); /* a linha defensiva não afunda com a bola longe */
          const tx=mk.x*0.75+0.125,ty=Math.max(lf,mk.y-mGap); /* entre o homem e a baliza */
          df.x+=(tx-df.x)*mLerp;df.y+=(ty-df.y)*mLerp;
        }
      }else{df.y+=(Math.max(bv,0.03)-df.y)*0.005;}
      df.x+=(bx-df.x)*0.004; /* deslize coletivo para o lado da bola */
    }
    /* TETO (todos, incl. o presser): um defensor nunca se perde no ataque */
    if(df.y<df.yCap)df.y=df.yCap;
  }
  const cid=seg?(seg.carry?seg.a.id:null):null;
  let si=-1;for(const s2 of RP.segs){if(t>=s2.t0)si=s2.i;else break;}
  /* recetor do passe atual: corre e chega ao ponto de receção com a bola */
  if(seg&&!seg.carry&&!seg.shot){
    const rd=RP.dots.find(x=>x.id===seg.b.id);
    if(rd){
      if(!seg._r0){
        /* recetor avançado (ex.: PL) recebe na sua profundidade de role, não recua para a bola */
        if(rd.y0!=null&&rd.y0<seg.b.y-0.02){seg.b.y=rd.y0;}
        seg._r0={x:rd.x,y:rd.y};
        /* corrida longa → passe flutuado: ninguém corre a 1000 à hora */
        const run=Math.hypot(seg.b.x-rd.x,seg.b.y-rd.y);
        const need=run/0.00022; /* velocidade máx. de sprint (contando com o pico do easing) */
        if(need>seg.t1-seg.t0){
          const add=need-(seg.t1-seg.t0);
          for(const s2 of RP.segs){if(s2.i===seg.i)s2.t1+=add;else if(s2.i>seg.i){s2.t0+=add;s2.t1+=add;}}
          RP.dur+=add;
        }
      }
      const k=(t-seg.t0)/(seg.t1-seg.t0),e2=Math.min(1,k*1.12);
      const ee=e2<0.5?2*e2*e2:1-Math.pow(-2*e2+2,2)/2;
      rd.x=seg._r0.x+(seg.b.x-seg._r0.x)*ee;
      rd.y=seg._r0.y+(seg.b.y-seg._r0.y)*ee;
    }
  }
  for(const dt of RP.dots){
    if(dt.id===cid||dt.gk)continue;
    if(seg&&!seg.carry&&!seg.shot&&dt.id===seg.b.id)continue; /* já tratado acima */
    /* antecipação: quem vai receber mais à frente desloca-se para lá */
    const fut=(RP.recv[dt.id]||[]).find(r=>r.si>si);
    if(fut){const fy=(dt.y0!=null&&fut.y>dt.y0+0.02)?dt.y0:fut.y; /* não recuar atrás do role */
      dt.x+=(fut.x-dt.x)*0.030;dt.y+=(fy-dt.y)*0.030;}
    else{ /* bloco: a equipa desliza para a zona da bola preservando as posições relativas */
      const tx=Math.max(0.05,Math.min(0.95,dt.x0+(bx-RP.b0.x)*0.40));
      const ty=Math.max(0.06,Math.min(0.985,dt.y0+(bv-RP.b0.y)*0.18+RP.tacY));
      dt.x+=(tx-dt.x)*0.012;dt.y+=(ty-dt.y)*0.012;
    }
  }
  /* separação: jogadores não se sobrepõem (portador e recetor têm prioridade) */
  {
    const lockA=cid!=null?cid:-1,lockB=recvId!=null?recvId:-1;
    const all=[];
    for(const dt of RP.dots)if(!dt.gk)all.push({o:dt,lock:dt.id===lockA||dt.id===lockB,px:0,py:0});
    for(const df of RP.defs)all.push({o:df,lock:df===presser,px:0,py:0});
    for(let i2=0;i2<all.length;i2++)for(let j2=i2+1;j2<all.length;j2++){
      const a2=all[i2],b2=all[j2];
      const ddx=b2.o.x-a2.o.x,ddy=b2.o.y-a2.o.y,dd=Math.hypot(ddx,ddy);
      if(dd<0.042&&dd>1e-4){
        const push=(0.042-dd)*0.35,nx=ddx/dd,ny=ddy/dd;
        a2.px-=nx*push;a2.py-=ny*push;
        b2.px+=nx*push;b2.py+=ny*push;
      }
    }
    /* aplicar com limite total por frame: multidão não catapulta ninguém */
    for(const e2 of all){
      if(e2.lock)continue;
      const m=Math.hypot(e2.px,e2.py);
      if(m>1e-6){const c=Math.min(m,0.0035)/m;e2.o.x+=e2.px*c;e2.o.y+=e2.py*c;}
    }
  }
  /* fora-de-jogo: quem ainda não recebeu segura a linha do último defesa até a bola ser jogada */
  /* piso mínimo: um jogador nunca entra fisicamente na baliza adversária antes de receber a bola.
     A profundidade de role já dá posições realistas — não recuamos ninguém para trás da sua base. */
  const carrierNow=seg?(seg.carry?seg.a.id:seg.b.id):null;
  for(const dt of RP.dots){
    if(dt.gk||dt.id===carrierNow)continue;
    if(dt.y<0.075)dt.y=0.075;
  }
  /* câmara segue a jogada */
  const foc=rpP(bx,Math.max(bv,-0.02),0);
  const tz=1.02+(1-clamp(bv,0,1))*0.72;
  RP.cam.z+=(tz-RP.cam.z)*0.055;
  RP.cam.x+=(foc.x-RP.cam.x)*0.075;RP.cam.y+=(foc.y-RP.cam.y)*0.075;
  const camx=clamp(RP.cam.x,W*0.30,W*0.70),camy=clamp(RP.cam.y,H*0.24,H*0.80);
  C.clearRect(0,0,W,H);
  C.fillStyle="#04120B";C.fillRect(0,0,W,H);
  C.save();
  C.translate(W/2,H*0.46);C.scale(RP.cam.z,RP.cam.z);C.translate(-camx,-camy);
  rpPitchDraw(C);
  rpGoalDraw(C,false);
  /* trilho da bola */
  /* limite de velocidade humano: nenhum jogador se desloca mais que vMax por frame */
  {
    const vMax=0.0068; /* ~sprint (repetições um pouco mais lentas) */
    const clampMove=(o)=>{
      if(o._px==null){o._px=o.x;o._py=o.y;return;}
      let dxv=o.x-o._px,dyv=o.y-o._py,mv=Math.hypot(dxv,dyv);
      if(mv>vMax){const c=vMax/mv;o.x=o._px+dxv*c;o.y=o._py+dyv*c;}
      o._px=o.x;o._py=o.y;
    };
    for(const dt of RP.dots){if(dt.gk){dt._px=dt.x;dt._py=dt.y;continue;}if(dt.id===cid){dt._px=dt.x;dt._py=dt.y;continue;}clampMove(dt);}
    for(const df of RP.defs)clampMove(df);
  }
  RP.trail.push({x:bx,v:bv,h:bh});if(RP.trail.length>12)RP.trail.shift();
  for(let i=0;i<RP.trail.length;i++){const tr=RP.trail[i],q=rpP(tr.x,tr.v,tr.h);
    C.fillStyle="rgba(255,255,255,"+(i/RP.trail.length*0.22)+")";
    C.beginPath();C.arc(q.x,q.y,2.2*q.s*2,0,7);C.fill();}
  /* dorsais: defesas primeiro (mais longe), depois atacantes, ordenados por profundidade */
  const ac=(d.team&&d.team.c)?d.team.c:["#1B5E20","#fff"];
  const dc=(d.def&&d.def.c)?d.def.c:["#555","#ddd"];
  const ents=[];
  for(const df of RP.defs)ents.push({v:df.y,fn:()=>rpDot(C,df.x,df.y,4.6,dc[0],"rgba(255,255,255,.35)",null,false,df.n)});
  const carrier=seg?(seg.shot?seg.a.id:(t>=seg.t0?seg.b.id:seg.a.id)):null;
  const GK_ATK="#E6C34A",GK_DEF="#9AA0A6"; /* GR atacante amarelo, GR defensor cinza */
  for(const dt of RP.dots)ents.push({v:dt.y,fn:()=>dt.gk
    ?rpDot(C,dt.x,dt.y,4.8,GK_ATK,"rgba(0,0,0,.35)",null,false,dt.n)
    :rpDot(C,dt.x,dt.y,5,ac[0],ac[1],dt.id===carrier?dt.n.split(" ").pop():null,false,dt.id===carrier?null:dt.n)});
  ents.push({v:RP.gk.y,fn:()=>rpDot(C,gkU,RP.gk.y,4.8,GK_DEF,"rgba(0,0,0,.35)",null,RP.gk.dive>0.55,RP.gk.n)});
  ents.sort((a,b)=>a.v-b.v);
  for(const e2 of ents)e2.fn();
  /* bola */
  const bp=rpP(bx,bv,bh);
  C.fillStyle="rgba(0,0,0,.30)";const gr=rpP(bx,bv,0);
  C.beginPath();C.ellipse(gr.x,gr.y,4.2*bp.s*2,1.7*bp.s*2,0,0,7);C.fill();
  C.fillStyle="#fff";C.beginPath();C.arc(bp.x,bp.y-3,Math.max(3.3,4.1*bp.s*2),0,7);C.fill();
  C.strokeStyle="rgba(0,0,0,.35)";C.lineWidth=0.8;C.stroke();
  /* bola dentro da baliza: rede por cima, suave */
  if(bv<0){C.globalAlpha=0.55;rpGoalDraw(C,false);C.globalAlpha=1;}
  rpGoalDraw(C,true);
  /* efeito de golo */
  if(RP.phase!=="play"&&RP.out==="goal"){
    const gt=t-RP.phT,gp=rpP(bx,0,0.03);
    if(gt<620){const rr=gt/620;
      C.strokeStyle="rgba(255,214,90,"+(1-rr)*0.9+")";C.lineWidth=3;
      C.beginPath();C.arc(gp.x,gp.y,10+rr*90,0,7);C.stroke();
      C.fillStyle="rgba(255,255,255,"+(1-rr)*0.28+")";C.fillRect(camx-W,camy-H,W*2,H*2);}
  }
  C.restore();
  /* fim */
  if(RP.phase==="gol"&&t>RP.phT+(RP.out==="goal"?2050:1600)){
    RP.phase="fade";
    const el=$("replay");el.style.transition="opacity .35s ease";el.style.opacity="0";
    setTimeout(()=>{$("rp-cap").classList.remove("gol");rpNext()},380);
    return;
  }
  RP.raf=requestAnimationFrame(rpFrame);
}
