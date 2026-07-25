
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
  const character=await characterResponse.json();
  validateCharacter(character,file);
  return character;
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

function validateCharacter(character,file){
 const required=["corePersonality","chessAptitude","currentChessSkill","playstyle","signatureBehaviors"];
 if(!character.id)throw new Error(`${file} is missing id.`);
 if(!character.personalityProfile)throw new Error(`${character.id} is missing personalityProfile.`);
 for(const section of required){
  if(character.personalityProfile[section]==null){
   throw new Error(`${character.id} personalityProfile is missing ${section}.`);
  }
 }
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

 const piece=game.get(sq);
 const turn=game.turn();

 // Select one of the current player's pieces.
 if(!selected){
  selected=piece&&piece.color===turn?sq:null;
  renderBoard();
  return;
 }

 // Clicking the selected piece again cancels the selection.
 if(sq===selected){
  selected=null;
  renderBoard();
  return;
 }

 // Clicking another friendly piece switches selection immediately.
 if(piece&&piece.color===turn){
  selected=sq;
  renderBoard();
  return;
 }

 // Otherwise, attempt the move. Illegal destinations keep the current
 // piece selected so the player can try another square or switch pieces.
 const move=game.move({from:selected,to:sq,promotion:"q"});
 if(move){
  selected=null;
  afterMove(move);
 }else{
  renderBoard();
 }
}
function evaluate(){
 let s=0;
 for(const row of game.board())for(const p of row)if(p)s+=(p.color==="w"?1:-1)*value[p.type];
 return s;
}
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const pct=n=>clamp01((Number(n)||0)/100);
function eloMidpoint(value){
 const nums=String(value||"").match(/\d+/g)?.map(Number)||[];
 if(nums.length>=2)return (nums[0]+nums[1])/2;
 return nums[0]||1200;
}
function includesText(items,text){
 return (items||[]).some(item=>String(item).toLowerCase().includes(text));
}
function generateBrain(c){
 const p=c.personalityProfile;
 const core=p.corePersonality;
 const apt=p.chessAptitude;
 const skill=p.currentChessSkill;
 const styles=p.playstyle;
 const signatures=p.signatureBehaviors;
 const elo=eloMidpoint(skill.estimatedElo);
 const tacticalStyle=includesText(styles,"tactical")||includesText(styles,"trickster");
 const strategicStyle=includesText(styles,"strategic")||includesText(styles,"positional");
 const chaoticStyle=includesText(styles,"chaotic")||includesText(styles,"creative");
 const defensiveStyle=includesText(styles,"defensive")||includesText(styles,"solid");
 const queenPreference=includesText(signatures,"queen")?0.95:0.5;
 const dislikesDraws=includesText(signatures,"draw")?0.9:0.35;

 return {
  elo,
  aggression:clamp01(pct(core.aggression)*.55+pct(core.competitiveness)*.2+(includesText(styles,"aggressive")?.25:0)),
  tactics:clamp01(pct(apt.tacticalVision)*.55+pct(apt.patternRecognition)*.2+(tacticalStyle?.25:0)),
  positional:clamp01(pct(apt.strategicPlanning)*.45+pct(apt.longTermPlanning)*.3+(strategicStyle?.25:0)),
  material:clamp01(.72-pct(core.riskTolerance)*.35-pct(core.curiosity)*.12),
  kingSafety:clamp01(.78+pct(core.caution)*.2-pct(core.riskTolerance)*.35+(defensiveStyle?.15:0)),
  risk:pct(core.riskTolerance),
  novelty:clamp01(pct(core.creativity)*.45+pct(core.curiosity)*.4+(chaoticStyle?.15:0)),
  randomness:clamp01(.08+(1-pct(skill.practicalAccuracy))*.38+pct(core.impulsiveness)*.18),
  blunderChance:clamp01(.008+(1-pct(skill.practicalAccuracy))*.055+(1-pct(core.discipline))*.02),
  complexity:clamp01(pct(core.creativity)*.25+pct(core.riskTolerance)*.25+pct(core.curiosity)*.2+(chaoticStyle?.3:0)),
  queenPreference,
  simplification:clamp01(pct(core.caution)*.35+pct(apt.longTermPlanning)*.25+(defensiveStyle?.25:0)-dislikesDraws*.2),
  pressure:clamp01(pct(core.bluffing)*.4+pct(core.confidence)*.25+pct(core.aggression)*.2+(includesText(styles,"psychological")?.15:0))
 };
}
function brainFor(c){
 return c._brain||(c._brain=generateBrain(c));
}
function chessScore(move){
 const before=evaluate(),actor=move.color;
 game.move(move);
 const after=evaluate();
 const replies=game.moves({verbose:true});
 const result={
  material:actor==="w"?after-before:before-after,
  check:game.inCheck(),
  mate:game.isCheckmate(),
  replyCount:replies.length,
  forcingReplies:replies.filter(r=>r.captured||String(r.san).includes("+")).length
 };
 game.undo();
 return result;
}
function personalityScore(move,c,position){
 const brain=brainFor(c);
 const movingValue=value[move.piece]||0;
 let score=position.material*(.75+brain.material*.8);

 if(position.mate)score+=100000;
 else if(position.check)score+=75+135*brain.tactics+90*brain.pressure;

 if(move.captured){
  score+=(value[move.captured]||0)*(.15+.55*brain.material);
  score+=35*brain.aggression;
  if(move.captured==="q")score+=110*brain.pressure;
 }

 if(move.san.includes("O-O"))score+=45+100*brain.kingSafety;
 if(move.piece==="q")score+=18*brain.pressure-38*brain.kingSafety;
 if(move.piece==="q"&&brain.queenPreference>.8&&move.captured)score+=45;

 const center=["c4","c5","d4","d5","e4","e5","f4","f5"].includes(move.to);
 score+=(center?1:0)*(18+34*brain.positional);
 if(move.piece!=="p"&&game.history().length<16)score+=16*brain.positional;

 const complexity=Math.min(1,(position.replyCount+position.forcingReplies*2)/38);
 score+=(complexity-.45)*115*brain.complexity;
 score+=(18-position.replyCount)*4*brain.simplification;
 if(move.captured)score-=movingValue*.025*brain.risk;

 const skillControl=clamp01((brain.elo-600)/1800);
 score+=(seedRng()-.5)*(45+150*brain.randomness)*(1-.55*skillControl);
 score+=(seedRng()-.5)*80*brain.novelty;

 if(seedRng()<brain.blunderChance*(1-.45*skillControl)){
  score-=120+seedRng()*260;
 }
 return score;
}
function moveScore(move,c){
 return personalityScore(move,c,chessScore(move));
}
function chooseMove(c){
 const moves=game.moves({verbose:true});
 if(!moves.length)return null;
 const brain=brainFor(c);
 const ranked=moves.map(m=>({m,s:moveScore(m,c)})).sort((a,b)=>b.s-a.s);
 const skillControl=clamp01((brain.elo-600)/1800);
 const breadth=Math.max(1,Math.min(ranked.length,Math.round(7-5*skillControl+brain.randomness*4)));
 const pool=ranked.slice(0,breadth);
 const temperature=.45+brain.randomness*1.8;
 const weights=pool.map((item,i)=>Math.exp(-i/temperature));
 let roll=seedRng()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<pool.length;i++){
  roll-=weights[i];
  if(roll<=0)return pool[i].m;
 }
 return pool[0].m;
}
function moveEvent(move){
 if(game.isCheckmate())return "mate";
 if(game.isDraw())return "draw";
 if(game.inCheck())return "check";
 if(move?.captured)return "capture";
 if(game.history().length<=2)return "opening";
 const actorAdvantage=evaluate()*(move.color==="w"?1:-1);
 if(actorAdvantage>250)return "winning";
 if(actorAdvantage<-250)return "losing";
 return "move";
}
function moodFor(c,event){
 const brain=brainFor(c);
 if(event==="mate")return "triumphant";
 if(event==="draw")return brain.aggression>.65?"frustrated":"calm";
 if(event==="losing")return "frustrated";
 if(event==="winning")return "confident";
 if(event==="check")return brain.pressure>.65?"confident":"excited";
 if(event==="capture")return brain.novelty>.7?"excited":"confident";
 if(event==="opening")return brain.novelty>.65?"curious":"focused";
 if(brain.novelty>.8)return "curious";
 if(brain.pressure>.78)return "confident";
 return "focused";
}
function reactionMood(move,opponent){
 if(game.isCheckmate())return "frustrated";
 if(game.inCheck())return "pressured";
 if(move?.captured)return brainFor(opponent).risk>.65?"focused":"pressured";
 return opponent._mood||"focused";
}
function expressionForMood(character,mood,event){
 const map={
  calm:"draw",
  focused:"move",
  curious:"opening",
  confident:"winning",
  excited:"capture",
  pressured:"checked",
  frustrated:"losing",
  triumphant:"mate"
 };
 const expressionEvent=map[mood]||event;
 return character.expressionMap?.[expressionEvent]
  ||character.expressionMap?.[event]
  ||character.defaultExpression
  ||"neutral";
}
function dialogueFor(c,event,mood){
 const lines=c.dialogue[mood]||c.dialogue[event]||c.dialogue.move;
 return lines[Math.floor(seedRng()*lines.length)];
}
function afterMove(move,autoContinue=true){
 renderBoard([move.from,move.to]);appendMove(move);
 const actor=move.color==="w"?config.white:config.black;
 const opponent=move.color==="w"?config.black:config.white;
 const side=move.color==="w"?"left":"right";
 const opponentSide=side==="left"?"right":"left";
 const event=moveEvent(move);
 const mood=moodFor(actor,event);
 const opponentMood=reactionMood(move,opponent);

 actor._mood=mood;
 opponent._mood=opponentMood;

 setCharacter(side,actor,expressionForMood(actor,mood,event));
 setCharacter(opponentSide,opponent,expressionForMood(opponent,opponentMood,"move"));
 speak(actor,dialogueFor(actor,event,mood),side);
 $("#statusDetail").textContent=`${actor.shortName||actor.name} is ${mood}.`;

 if(game.isGameOver()){finish();updateMoveControls();return}
 updateMoveControls();
 if(autoContinue)scheduleAi();
}
function speak(c,text,side){
 $("#leftCard").classList.toggle("active",side==="left");
 $("#rightCard").classList.toggle("active",side==="right");
 $(`#${side}Speech`).textContent=text;
}
function appendMove(m){
 const el=document.createElement("div");el.className="move";el.textContent=`${Math.ceil(game.history().length/2)}${m.color==="w"?"." : "..."} ${m.san}`;$("#moves").appendChild(el);
}
function updateStatus(){
 $("#turnText").textContent=game.isGameOver()?"Game complete":`${game.turn()==="w"?config.white?.shortName||"White":config.black?.shortName||"Black"} to move`;
 $("#fenText").textContent=`Move ${Math.ceil((game.history().length+1)/2)}`;
 const ev=Math.max(-900,Math.min(900,evaluate())),left=50+ev/36;
 $("#momentumLeft").style.width=`${left}%`;$("#momentumRight").style.width=`${100-left}%`;
 $("#leftMeter").style.width=`${left}%`;$("#rightMeter").style.width=`${100-left}%`;
 if(config.white&&config.black)updateMoveControls();
}

function delayLabel(ms){
 return ms<1000?`${ms} ms`:`${(ms/1000).toFixed(1)} s`;
}
function updateDelayLabel(){
 $("#delayValue").textContent=delayLabel(Number($("#delay").value));
}
function updateMoveControls(){
 const hasHistory=game.history().length>0;
 $("#lastMove").disabled=!hasHistory;
 $("#nextMove").disabled=game.isGameOver()||sideMode(game.turn())!=="ai";
}
function pauseMatch(){
 running=false;
 clearTimeout(timer);
 $("#play").textContent="▶ Run";
}
function playNextAiMove(){
 if(game.isGameOver()||sideMode(game.turn())!=="ai")return;
 pauseMatch();
 const c=game.turn()==="w"?config.white:config.black;
 const move=chooseMove(c);
 if(move)afterMove(game.move(move),false);
}
function rewindOneMove(){
 if(!game.history().length)return;
 pauseMatch();
 hideResult();
 game.undo();
 selected=null;
 $("#moves").lastElementChild?.remove();
 $("#leftCard").classList.remove("active");
 $("#rightCard").classList.remove("active");
 $("#leftSpeech").textContent="Waiting...";
 $("#rightSpeech").textContent="Waiting...";
 renderBoard();
 $("#statusDetail").textContent="Rewound one move";
 updateMoveControls();
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
function drawReason(){
 if(game.isStalemate?.())return "Stalemate";
 if(game.isThreefoldRepetition?.())return "Threefold repetition";
 if(game.isInsufficientMaterial?.())return "Insufficient material";
 return "Draw";
}
function hideResult(){
 $("#resultBanner").hidden=true;
}
function showResult(){
 const banner=$("#resultBanner");
 const moveCount=game.history().length;
 const fullMoves=Math.ceil(moveCount/2);

 if(game.isCheckmate()){
  const winner=game.turn()==="w"?config.black:config.white;
  const side=game.turn()==="w"?"Black":"White";
  banner.style.setProperty("--winner1",winner.theme.primary);
  banner.style.setProperty("--winner2",winner.theme.secondary);
  $("#resultMark").textContent="♔";
  $("#resultLabel").textContent="Checkmate";
  $("#resultTitle").textContent=`${winner.shortName||winner.name} wins`;
  $("#resultSummary").textContent=`${side} wins by checkmate • ${fullMoves} ${fullMoves===1?"move":"moves"}`;
 }else{
  banner.style.setProperty("--winner1","#7d748d");
  banner.style.setProperty("--winner2","#b8afc8");
  $("#resultMark").textContent="½";
  $("#resultLabel").textContent="Match drawn";
  $("#resultTitle").textContent="Draw";
  $("#resultSummary").textContent=`${drawReason()} • ${fullMoves} ${fullMoves===1?"move":"moves"}`;
 }

 banner.hidden=false;
}

function finish(){
 running=false;$("#play").textContent="▶ Run";
 let text=game.isCheckmate()?`${game.turn()==="w"?config.black.shortName:config.white.shortName} wins by checkmate.`:`The game ends in a ${drawReason().toLowerCase()}.`;
 $("#statusDetail").textContent=text;
 showResult();
}
function startGame(){
 hideResult();
 catalog.forEach(character=>{delete character._brain;delete character._mood});
 config={
  white:chars[$("#whiteCharacter").value],black:chars[$("#blackCharacter").value],
  whiteMode:$("#mode").value==="hvh"?"human":$("#mode").value==="hva"?"human":"ai",
  blackMode:$("#mode").value==="hvh"?"human":"ai"
 };
 document.documentElement.style.setProperty("--left",config.white.theme.primary);document.documentElement.style.setProperty("--left2",config.white.theme.secondary);
 document.documentElement.style.setProperty("--right",config.black.theme.primary);document.documentElement.style.setProperty("--right2",config.black.theme.secondary);
 seedRng=$("#seed").value.trim()?seeded($("#seed").value.trim()):Math.random;
 game=new Chess();selected=null;$("#moves").innerHTML="";$("#statusDetail").textContent="Match initialized";
 config.white._mood=moodFor(config.white,"opening");
 config.black._mood=moodFor(config.black,"opening");
 setCharacter("left",config.white,expressionForMood(config.white,config.white._mood,"opening"));
 setCharacter("right",config.black,expressionForMood(config.black,config.black._mood,"opening"));
 speak(config.white,config.white.dialogue.opening[0],"left");
 $("#setupModal").hidden=true;createBoard();
 updateMoveControls();
 if(config.whiteMode==="ai")scheduleAi();
}
$("#setupBtn").onclick=()=>{$("#setupModal").hidden=false};
$("#reviewGame").onclick=hideResult;
$("#resultNewMatch").onclick=()=>{$("#setupModal").hidden=false};
$("#cancelSetup").onclick=()=>{$("#setupModal").hidden=true};
$("#startMatch").onclick=startGame;
$("#swap").onclick=()=>{const a=$("#whiteCharacter").value;$("#whiteCharacter").value=$("#blackCharacter").value;$("#blackCharacter").value=a};
$("#play").onclick=()=>{running=!running;running?scheduleAi():pauseMatch()};
$("#lastMove").onclick=rewindOneMove;
$("#nextMove").onclick=playNextAiMove;
$("#delay").oninput=updateDelayLabel;
$("#newGame").onclick=()=>{
 pauseMatch();
 startGame();
};
try{
 await loadCharacters();
 updateDelayLabel();
 updateMoveControls();
 $("#setupModal").hidden=false;
}catch(error){
 console.error(error);
 $("#setupModal").hidden=false;
 $("#statusDetail").textContent=error.message;
 $("#leftSpeech").textContent="Load error.";$("#rightSpeech").textContent=error.message;
}
