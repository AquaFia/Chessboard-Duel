
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const glyph={w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
const value={p:100,n:320,b:330,r:500,q:900,k:0};
let catalog=[], chars={}, game=new Chess(), config={}, selected=null, running=false, timer=null, seedRng=Math.random;

async function loadCharacters(){
 const response=await fetch("characters/characters.json",{cache:"no-store"});
 if(!response.ok)throw new Error(`Could not load character roster (${response.status})`);

 const roster=await response.json();
 const files=Array.isArray(roster.characters)?roster.characters:[];

 const loaded=await Promise.all(files.map(async file=>{
  const characterResponse=await fetch(`characters/${file}`,{cache:"no-store"});
  if(!characterResponse.ok)throw new Error(`Could not load character file: ${file}`);
  return characterResponse.json();
 }));

 catalog=loaded;
 chars=Object.fromEntries(loaded.map(character=>[character.id,character]));

 for(const sel of ["#whiteCharacter","#blackCharacter"]){
  const el=$(sel);
  el.innerHTML=loaded.map(character=>
   `<option value="${character.id}">${character.name}</option>`
  ).join("");
 }

 if(!loaded.length)throw new Error("The character roster is empty.");

 $("#whiteCharacter").value=chars.jace?"jace":loaded[0].id;
 $("#blackCharacter").value=chars.juno?"juno":loaded[Math.min(1,loaded.length-1)].id;
}

function seeded(seed){
 let h=2166136261;
 for(const ch of seed)h=Math.imul(h^ch.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
}
function fallbackSvg(c,expression){
 const p=c.fallbackPortrait||{};
 const happy=["happy","excited","satisfied","knowing"].includes(expression);
 const worried=["worried","annoyed"].includes(expression);
 const smug=["smug","knowing","satisfied"].includes(expression);
 const surprised=expression==="surprised";
 const mouth=happy?"M82 116 Q100 130 118 116":worried?"M84 124 Q100 111 116 124":smug?"M88 119 Q103 125 117 115":"M91 119 Q100 123 109 119";
 const eye=surprised?9:6;
 return `<svg viewBox="0 0 200 260" role="img" aria-label="${c.name}">
 <defs><linearGradient id="h" x2="0" y2="1"><stop stop-color="${p.hairTop||c.theme.primary}"/><stop offset="1" stop-color="${p.hairBottom||c.theme.secondary}"/></linearGradient></defs>
 <ellipse cx="100" cy="117" rx="74" ry="91" fill="url(#h)"/><path d="M38 246 Q44 166 100 160 Q157 166 164 246" fill="${p.shirt||c.theme.panel}"/>
 <ellipse cx="100" cy="102" rx="51" ry="62" fill="${p.skin||'#efd2d4'}"/><path d="M48 84 Q57 25 104 28 Q150 29 153 90 Q126 66 112 41 Q91 70 48 84" fill="url(#h)"/>
 <ellipse cx="78" cy="101" rx="${eye}" ry="${eye+3}" fill="${p.eyes||'#623aaa'}"/><ellipse cx="122" cy="101" rx="${eye}" ry="${eye+3}" fill="${p.eyes||'#623aaa'}"/>
 <circle cx="76" cy="98" r="2" fill="white"/><circle cx="120" cy="98" r="2" fill="white"/><path d="${mouth}" fill="none" stroke="#783849" stroke-width="3" stroke-linecap="round"/>
 ${p.accessory==="constellation"?'<path d="M145 60 L165 48 L171 72 L151 83 Z" fill="none" stroke="#ddd" stroke-width="2"/><circle cx="145" cy="60" r="3" fill="#eee"/><circle cx="165" cy="48" r="3" fill="#eee"/><circle cx="171" cy="72" r="3" fill="#eee"/><circle cx="151" cy="83" r="3" fill="#eee"/>':''}
 ${p.accessory==="sparkle"?'<path d="M157 55 l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#ffd477"/>':''}
 </svg>`;
}
function setCharacter(side,c,expression="neutral"){
 const box=$(`#${side}Card`);box.style.setProperty("--accent",c.theme.primary);box.style.setProperty("--accent2",c.theme.secondary);
 $(`#${side}Name`).textContent=c.name;$(`#${side}Talent`).textContent=c.talent;$(`#${side}Expression`).textContent=expression;
 const area=$(`#${side}Portrait`), path=c.portraits?.[expression];
 area.innerHTML=path?`<img src="${path}" alt="${c.name} — ${expression}">`:fallbackSvg(c,expression);
}
function createBoard(){
 const b=$("#board");b.innerHTML="";
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const sq=document.createElement("div"),alg=String.fromCharCode(97+c)+(8-r);
  sq.className="sq "+((r+c)%2?"dark":"light");sq.dataset.square=alg;
  if(c===0)sq.insertAdjacentHTML("beforeend",`<span class="coord rank">${8-r}</span>`);
  if(r===7)sq.insertAdjacentHTML("beforeend",`<span class="coord file">${String.fromCharCode(97+c)}</span>`);
  sq.onclick=()=>humanClick(alg);b.appendChild(sq);
 }
 renderBoard();
}
function renderBoard(last=[]){
 $$(".sq").forEach(x=>{x.classList.remove("selected","legal","last");[...x.querySelectorAll(".piece")].forEach(p=>p.remove())});
 for(const row of game.board())for(const p of row)if(p){
  const alg=String.fromCharCode(97+p.square.charCodeAt(0)-97)+p.square[1];
  const el=document.createElement("span");el.className=`piece ${p.color}`;el.textContent=glyph[p.color][p.type];
  document.querySelector(`[data-square="${alg}"]`).appendChild(el);
 }
 last.forEach(x=>document.querySelector(`[data-square="${x}"]`)?.classList.add("last"));
 if(selected){document.querySelector(`[data-square="${selected}"]`)?.classList.add("selected");game.moves({square:selected,verbose:true}).forEach(m=>document.querySelector(`[data-square="${m.to}"]`)?.classList.add("legal"))}
 updateStatus();
}
function sideMode(color){return color==="w"?config.whiteMode:config.blackMode}
function humanClick(sq){
 if(running||game.isGameOver()||sideMode(game.turn())!=="human")return;
 if(selected){
  const move=game.move({from:selected,to:sq,promotion:"q"});selected=null;
  if(move){afterMove(move);return}
 }
 const p=game.get(sq);selected=p&&p.color===game.turn()?sq:null;renderBoard();
}
function evaluate(){
 let s=0;
 for(const row of game.board())for(const p of row)if(p)s+=(p.color==="w"?1:-1)*value[p.type];
 return s;
}
function moveScore(move,c){
 const before=evaluate();game.move(move);const after=evaluate();
 let score=(game.turn()==="b"?after-before:before-after);
 const ps=c.playstyle;
 if(move.captured)score+=value[move.captured]*(.35+.8*ps.materialism);
 if(game.inCheck())score+=80*(.35+ps.aggression+ps.tactics);
 if(move.san.includes("O-O"))score+=90*ps.kingSafety;
 if(move.piece==="p"&&(move.to[1]==="4"||move.to[1]==="5"))score+=18*ps.positional;
 const center=["d4","d5","e4","e5","c4","c5","f4","f5"].includes(move.to)?25:0;
 score+=center*ps.positional;
 score+=(seedRng()-.5)*180*ps.randomness;
 if(seedRng()<ps.blunderChance)score-=160+seedRng()*250;
 game.undo();return score;
}
function chooseMove(c){
 const moves=game.moves({verbose:true});if(!moves.length)return null;
 const ranked=moves.map(m=>({m,s:moveScore(m,c)})).sort((a,b)=>b.s-a.s);
 const breadth=Math.max(1,Math.min(ranked.length,Math.round(1+(1-c.playstyle.strength/10)*8+c.playstyle.randomness*5)));
 const pool=ranked.slice(0,breadth);return pool[Math.floor(seedRng()*pool.length)].m;
}
function expressionFor(character,event){
 return character.expressionMap?.[event] || character.defaultExpression || "neutral";
}
function dialogueFor(c,move){
 let key="move";
 if(game.isCheckmate())key="mate";else if(game.isDraw())key="draw";else if(game.inCheck())key="check";else if(move?.captured)key="capture";else if(game.history().length<=2)key="opening";else{
  const ev=evaluate()*(game.turn()==="w"?-1:1);if(ev>250)key="winning";if(ev<-250)key="losing";
 }
 const lines=c.dialogue[key]||c.dialogue.move;return {text:lines[Math.floor(seedRng()*lines.length)],key};
}
function afterMove(move){
 renderBoard([move.from,move.to]);appendMove(move);
 const actor=move.color==="w"?config.white:config.black, side=move.color==="w"?"left":"right";
 const d=dialogueFor(actor,move),exp=expressionFor(actor,d.key);
 setCharacter(side,actor,exp);speak(actor,d.text,side);
 if(game.isGameOver()){finish();return}
 scheduleAi();
}
function speak(c,text,side){
 $("#leftCard").classList.toggle("active",side==="left");
 $("#rightCard").classList.toggle("active",side==="right");
 $(`#${side}Speech`).textContent=text;
}
function appendMove(m){
 const el=document.createElement("div");el.className="move";el.textContent=`${Math.ceil(game.history().length/2)}${m.color==="w"?"." : "..."} ${m.san}`;$("#moves").appendChild(el);$("#moves").scrollLeft=99999;
}
function updateStatus(){
 $("#turnText").textContent=game.isGameOver()?"Game complete":`${game.turn()==="w"?config.white?.shortName||"White":config.black?.shortName||"Black"} to move`;
 $("#fenText").textContent=`Move ${Math.ceil((game.history().length+1)/2)}`;
 const ev=Math.max(-900,Math.min(900,evaluate())),left=50+ev/36;
 $("#momentumLeft").style.width=`${left}%`;$("#momentumRight").style.width=`${100-left}%`;
 $("#leftMeter").style.width=`${left}%`;$("#rightMeter").style.width=`${100-left}%`;
}
function scheduleAi(){
 clearTimeout(timer);
 const mode=sideMode(game.turn());
 if(mode!=="ai"||game.isGameOver()){running=false;$("#play").textContent="▶ Run";return}
 running=true;$("#play").textContent="❚❚ Pause";
 timer=setTimeout(()=>{
  if(!running)return;
  const c=game.turn()==="w"?config.white:config.black,m=chooseMove(c);
  if(m){const made=game.move(m);afterMove(made)}
 },Number($("#delay").value));
}
function finish(){
 running=false;$("#play").textContent="▶ Run";
 let text=game.isCheckmate()?`${game.turn()==="w"?config.black.shortName:config.white.shortName} wins by checkmate.`:"The game ends in a draw.";
 $("#statusDetail").textContent=text;
}
function startGame(){
 config={
  white:chars[$("#whiteCharacter").value],black:chars[$("#blackCharacter").value],
  whiteMode:$("#mode").value==="hvh"?"human":$("#mode").value==="hva"?"human":"ai",
  blackMode:$("#mode").value==="hvh"?"human":"ai"
 };
 document.documentElement.style.setProperty("--left",config.white.theme.primary);document.documentElement.style.setProperty("--left2",config.white.theme.secondary);
 document.documentElement.style.setProperty("--right",config.black.theme.primary);document.documentElement.style.setProperty("--right2",config.black.theme.secondary);
 seedRng=$("#seed").value.trim()?seeded($("#seed").value.trim()):Math.random;
 game=new Chess();selected=null;$("#moves").innerHTML="";$("#statusDetail").textContent="Match initialized";
 setCharacter("left",config.white,config.white.defaultExpression||"neutral");
 setCharacter("right",config.black,config.black.defaultExpression||"neutral");
 speak(config.white,config.white.dialogue.opening[0],"left");
 $("#setupModal").hidden=true;createBoard();
 if(config.whiteMode==="ai")scheduleAi();
}
$("#setupBtn").onclick=()=>{$("#setupModal").hidden=false};
$("#cancelSetup").onclick=()=>{$("#setupModal").hidden=true};
$("#startMatch").onclick=startGame;
$("#swap").onclick=()=>{const a=$("#whiteCharacter").value;$("#whiteCharacter").value=$("#blackCharacter").value;$("#blackCharacter").value=a};
$("#play").onclick=()=>{running=!running;running?scheduleAi():(clearTimeout(timer),$("#play").textContent="▶ Run")};
$("#step").onclick=()=>{if(game.isGameOver())return;const mode=sideMode(game.turn());if(mode==="ai"){const c=game.turn()==="w"?config.white:config.black,m=chooseMove(c);if(m)afterMove(game.move(m))}};
$("#newGame").onclick=()=>{$("#setupModal").hidden=false;running=false;clearTimeout(timer)};
try{
 await loadCharacters();
 $("#setupModal").hidden=false;
}catch(error){
 console.error(error);
 $("#setupModal").hidden=false;
 $("#statusDetail").textContent=error.message;
 $("#leftSpeech").textContent="Load error.";$("#rightSpeech").textContent=error.message;
}
