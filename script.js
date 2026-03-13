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

// ============= STATE =============
const state = {
  dividend:0, divisor:0,
  stappen:[], userSteps:[], level:"1"
};

// ============= HELPERS ===========
function random(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function toInternal(val){return String(val).replace(',', '.');}
function parseLearnerNumber(s){const n=parseFloat(toInternal(s)); return Number.isFinite(n)?n:null;}

// ============= GENERATIE =========
function genereerOefening(level){
  switch(level){
    case "1": return {dividend: random(10,99), divisor: random(2,9)};
    case "2": return {dividend: random(10,999), divisor: random(2,9)};
    case "3": return {dividend: random(100,9999), divisor: random(2,12)};
    case "4": return {dividend: random(1000,99999), divisor: random(2,20)};
    case "5": const d=random(2,10), q=random(1,200), r=random(0,d-1); return {dividend:q*d+r, divisor:d};
    default: return {dividend: random(10,99), divisor: random(2,9)};
  }
}

// ============= BEREKEN STAPPEN =========
function berekenDelen(dividend,deler){
  const s=[];
  let rest=0;
  const digits=toInternal(dividend).replace(/\D/g,'').split('');
  for(let i=0;i<digits.length;i++){
    rest=rest*10+Number(digits[i]);
    if(rest>=deler){
      const q=Math.floor(rest/deler);
      const product=q*deler;
      const newRest=rest-product;
      s.push({huidig:rest, q, product, rest:newRest});
      rest=newRest;
    } else {
      s.push({huidig:rest, q:0, product:0, rest:rest});
    }
  }
  return s;
}

// ============= INIT USER STEPS =========
function initUserSteps(){state.userSteps=state.stappen.map(()=>({q:"",product:"",rest:""}));}

// ============= RENDER =========
function renderGrid(node,getal){
  node.innerHTML="";
  const chars=toInternal(getal).replace(/\D/g,'').split('');
  node.style.gridTemplateColumns=`repeat(${chars.length},40px)`;
  chars.forEach(c=>{const cel=document.createElement("div"); cel.className="gridcell"; cel.textContent=c; node.appendChild(cel);});
}

function renderQuotient(stappen){
  const node=document.getElementById("quotientRow");
  node.innerHTML="";
  stappen.forEach(s=>{
    const cel=document.createElement("div");
    cel.className="gridcell";
    cel.textContent=s.q;
    node.appendChild(cel);
  });
}

function renderStepInputs(){
  const wrap=document.getElementById("stepInputs");
  wrap.innerHTML=state.stappen.map((s,i)=>{
    return `<div class="stepRow" data-i="${i}">
      <input class="stepInput" id="step-q-${i}" placeholder="q" value="${state.userSteps[i].q}">
      <input class="stepInput" id="step-p-${i}" placeholder="product" value="${state.userSteps[i].product}">
      <input class="stepInput" id="step-r-${i}" placeholder="rest" value="${state.userSteps[i].rest}">
    </div>`;
  }).join("");
  state.stappen.forEach((_,i)=>{
    ["q","p","r"].forEach(k=>{
      const el=document.getElementById(`step-${k}-${i}`);
      if(!el) return;
      el.addEventListener("input",()=>state.userSteps[i][k]=el.value.trim());
    });
  });
}

// ============= START OEFENING =========
function startOefening(level){
  state.level=level;
  const oef=genereerOefening(level);
  state.dividend=oef.dividend; state.divisor=oef.divisor;
  state.stappen=berekenDelen(state.dividend,state.divisor);
  initUserSteps();
  renderGrid(document.getElementById("grid"),state.dividend);
  renderGrid(document.getElementById("divGrid"),state.divisor);
  renderQuotient(state.stappen);
  renderStepInputs();
}

// ============= INIT UI =========
document.getElementById("btnNew").addEventListener("click",()=>startOefening(document.getElementById("levelSelect").value));
startOefening("1"); // start oefening bij laden
</script>

</body>
</html>
