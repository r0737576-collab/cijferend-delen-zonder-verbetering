<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Staartdeling Oefening</title>
<style>
  body{font-family:sans-serif;}
  .grid{display:grid; gap:2px; margin-bottom:10px;}
  .gridcell{border:1px solid #ccc; width:40px; height:40px; text-align:center; line-height:40px;}
  .stepRow{margin-bottom:5px;}
  .stepInput{width:50px; margin-right:5px;}
  .mini{font-size:12px; color:#666;}
</style>
</head>
<body>

<h2>Staartdeling Oefening</h2>
<label>Niveau:
  <select id="levelSelect">
    <option value="1">1 (eenvoudig)</option>
    <option value="2">2 (gemiddeld)</option>
    <option value="3">3 (iets moeilijker)</option>
    <option value="4">4 (moeilijk)</option>
    <option value="5">5 (zeer moeilijk)</option>
  </select>
</label>
<button id="btnNew">Nieuwe Oefening</button>

<h3>Dividend:</h3>
<div id="grid" class="grid"></div>

<h3>Divisor:</h3>
<div id="divGrid" class="grid"></div>

<h3>Quotient:</h3>
<div id="quotientRow" class="grid"></div>

<h3>Stappen invullen:</h3>
<div id="stepInputs"></div>

<script>
"use strict";

// --- HULP ---
const SEP_UI = ',';
const toInternal = v => String(v).replace(',', '.');
const parseNum = s => { const n=parseFloat(toInternal(s)); return Number.isFinite(n)?n:null; };
const random = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

// --- STATE ---
const state = {
  dividend:0, divisor:0, stappen:[], stepMode:false, userSteps:[], 
  decimalPos:null, showComma:false, selectedStep:null
};

// --- GENEREER OPGAVE ---
function genereerOpdracht(){
  const d=random(2,9); const q=random(2,99); const D=d*q;
  state.dividend=D; state.divisor=d; berekenStappen(D,d);
}

// --- BEREKEN STAPPEN ---
function berekenStappen(D,d){
  const s=[], chars=toInternal(D).split(''), isDigit=c=>c>='0'&&c<='9';
  let rest=0, started=false, decimalQuotPos=null;
  chars.forEach((c,i)=>{
    if(c==='.'){ if(decimalQuotPos===null) decimalQuotPos=s.length; return; }
    if(!isDigit(c)) return;
    rest=rest*10+Number(c);
    if(rest>=d){ started=true; const q=Math.floor(rest/d); const product=q*d; rest=rest-product;
      s.push({huidig:rest+product, product, rest, q}); 
    } else if(started){ s.push({huidig:rest,product:0,rest,q:0}); }
  });
  if(decimalQuotPos===null) decimalQuotPos=s.length;
  state.stappen=s; state.decimalPos=decimalQuotPos;
}

// --- ROOSTER FUNCTIES ---
function maakRooster(){ 
  const s=state.stappen; const r=s.length*2; const cols=Math.max(...s.map(st=>String(st.huidig).length))+2;
  const grid=Array.from({length:r},()=>Array.from({length:cols},()=>({waarde:"",type:""})));
  s.forEach((st,i)=>{
    const p=i*2,a=p+1,b=String(st.huidig).padStart(cols,'0'),prod=String(st.product).padStart(cols,'0'),rest=String(st.rest).padStart(cols,'0');
    for(let j=0;j<cols;j++){ grid[p][j]={waarde:prod[j],type:"product"}; grid[a][j]={waarde:rest[j],type:"rest"}; }
  });
  return grid;
}

// --- UI ---
const UI = {
  cacheDOM(){ this.workArea=document.getElementById("workArea"); this.quotientRow=document.getElementById("quotientRow"); },
  tekenQuotient(){ 
    const node=this.quotientRow; node.innerHTML=""; state.stappen.forEach(s=>{ const c=document.createElement("div"); c.className="gridcell"; c.textContent=s.q; node.appendChild(c); });
  },
  tekenWorkArea(){ 
    const node=this.workArea; node.innerHTML=""; const grid=maakRooster();
    grid.forEach(row=>{ row.forEach(cel=>{ const c=document.createElement("div"); c.className="gridcell"; c.textContent=cel.waarde; node.appendChild(c); }); });
  },
  init(){ 
    this.cacheDOM();
    document.getElementById("btnNew")?.addEventListener("click", startNieuweOefening); 
  }
};

// --- START OEFENING ---
function startNieuweOefening(){ 
  genereerOpdracht(); 
  UI.tekenQuotient(); UI.tekenWorkArea();
}

// --- LOAD ---
document.addEventListener("DOMContentLoaded",()=>{
  UI.init();
  startNieuweOefening();
});
</script>

</body>
</html>
