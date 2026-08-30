
const NOTE_NAMES_SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const ROOTS = [
  {name:'C', pc:0},{name:'D♭',pc:1},{name:'D',pc:2},{name:'E♭',pc:3},
  {name:'E',pc:4},{name:'F',pc:5},{name:'F♯',pc:6},{name:'G',pc:7},
  {name:'A♭',pc:8},{name:'A',pc:9},{name:'B♭',pc:10},{name:'B',pc:11}
];
const EASY_ROOTS = ROOTS.filter(r => ['C','F','G','D','B♭','A','E♭'].includes(r.name));

const CHORDS = {
  maj7: {label:'maj7', intervals:[0,4,7,11], degrees:{third:4,fifth:7,seventh:11}, scale:'Ionian'},
  m7:   {label:'m7', intervals:[0,3,7,10], degrees:{third:3,fifth:7,seventh:10}, scale:'Dorian'},
  dom7: {label:'7', intervals:[0,4,7,10], degrees:{third:4,fifth:7,seventh:10}, scale:'Mixolydian'},
  halfdim:{label:'m7♭5', intervals:[0,3,6,10], degrees:{third:3,fifth:6,seventh:10}, scale:'Locrian'},
  aeolian:{label:'m7', intervals:[0,3,7,10], degrees:{third:3,fifth:7,seventh:10}, scale:'Aeolian'}
};

// Avoid-note conventions used in the app.
// practical: common improvisation-oriented treatment (Dorian = no strict avoid).
// strict: Nettles/Graf-style summary, including Dorian 13 as avoid.
const AVOID = {
  practical: {
    maj7:{scale:'Ionian', intervals:[5], degree:'11'},
    m7:{scale:'Dorian', intervals:[], degree:'なし'},
    dom7:{scale:'Mixolydian', intervals:[5], degree:'11'},
    halfdim:{scale:'Locrian', intervals:[1], degree:'♭9'},
    aeolian:{scale:'Aeolian', intervals:[8], degree:'♭13'}
  },
  strict: {
    maj7:{scale:'Ionian', intervals:[5], degree:'11'},
    m7:{scale:'Dorian', intervals:[9], degree:'13'},
    dom7:{scale:'Mixolydian', intervals:[5], degree:'11'},
    halfdim:{scale:'Locrian', intervals:[1], degree:'♭9'},
    aeolian:{scale:'Aeolian', intervals:[8], degree:'♭13'}
  }
};

const els = Object.fromEntries([...document.querySelectorAll('[id]')].map(x=>[x.id,x]));
let state = JSON.parse(localStorage.getItem('jazzQuizState')||'{"answered":0,"correct":0,"weak":{}}');
let settings = JSON.parse(localStorage.getItem('jazzQuizSettings')||'{"keyRange":"all","chordRange":"basic","avoidRule":"practical"}');
let currentMode='third', currentQ=null, session={correct:0,total:0};

function save(){
  localStorage.setItem('jazzQuizState',JSON.stringify(state));
  localStorage.setItem('jazzQuizSettings',JSON.stringify(settings));
}
function pcName(pc, rootName=''){
  const flats = {1:'D♭',3:'E♭',6:'G♭',8:'A♭',10:'B♭'};
  const preferFlat = /♭/.test(rootName) || ['F','B♭','E♭','A♭','D♭'].includes(rootName);
  return preferFlat && flats[(pc+12)%12] ? flats[(pc+12)%12] : NOTE_NAMES_SHARP[(pc+12)%12];
}
function sample(a){return a[Math.floor(Math.random()*a.length)]}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chordKeys(){
  return settings.chordRange==='diatonic' ? ['maj7','m7','dom7','halfdim','aeolian'] : ['maj7','m7','dom7','halfdim'];
}
function roots(){ return settings.keyRange==='easy' ? EASY_ROOTS : ROOTS; }
function qid(mode,root,key,extra=''){return `${mode}:${root.name}:${key}:${extra}`}
function makeOptions(correct, root, forbidden=[]){
  const pool = ROOTS.map(n=>pcName(n.pc,root.name)).filter((v,i,a)=>a.indexOf(v)===i && v!==correct && !forbidden.includes(v));
  return shuffle([correct,...shuffle(pool).slice(0,3)]);
}
function generateQuestion(mode){
  if(mode==='weak'){
    const ids = Object.entries(state.weak).filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(!ids.length) return generateQuestion('third');
    const [m,r,k,extra] = sample(ids.slice(0,Math.min(12,ids.length)))[0].split(':');
    const root = ROOTS.find(x=>x.name===r) || sample(roots());
    return buildQuestion(m,root,k,extra);
  }
  return buildQuestion(mode,sample(roots()),sample(chordKeys()));
}
function buildQuestion(mode,root,key){
  const c=CHORDS[key]||CHORDS.maj7;
  const chord=`${root.name}${c.label}`;
  if(['third','fifth','seventh'].includes(mode)){
    const degreeLabel={third:'3度',fifth:'5度',seventh:'7度'}[mode];
    const pc=(root.pc+c.degrees[mode])%12, correct=pcName(pc,root.name);
    return {id:qid(mode,root,key), mode, chord, prompt:`${chord} の${degreeLabel}は？`, kicker:'コード構成音', correct,
      options:makeOptions(correct,root), explanation:`${chord} の${degreeLabel}は ${correct}。構成音は ${c.intervals.map(i=>pcName(root.pc+i,root.name)).join('・')}。`};
  }
  if(mode==='tones'){
    const tones=c.intervals.map(i=>pcName(root.pc+i,root.name));
    const missingIndex=Math.floor(Math.random()*tones.length);
    const correct=tones[missingIndex];
    const shown=tones.map((n,i)=>i===missingIndex?'□':n).join('・');
    return {id:qid(mode,root,key,String(missingIndex)), mode, chord, prompt:`${chord}：${shown}`, kicker:'□ に入る構成音は？', correct,
      options:makeOptions(correct,root,tones.filter(x=>x!==correct)), explanation:`${chord} の構成音は ${tones.join('・')}。`};
  }
  if(mode==='avoid'){
    const rule=AVOID[settings.avoidRule][key] || AVOID[settings.avoidRule].maj7;
    if(rule.intervals.length===0){
      const correct='なし';
      const scalePcs = scaleIntervals(rule.scale).map(i=>pcName(root.pc+i,root.name));
      return {id:qid(mode,root,key,settings.avoidRule), mode, chord,
        prompt:`${chord}（${rule.scale}）のアボイドノートは？`, kicker:'アボイドノート', scale:`使用スケール：${root.name} ${rule.scale}`,
        correct, options:shuffle(['なし',...shuffle(scalePcs.filter(n=>!c.intervals.map(i=>pcName(root.pc+i,root.name)).includes(n))).slice(0,3)]),
        explanation:`この設定では ${root.name} ${rule.scale} に「厳密なアボイドなし」として出題しています。経過音・ターゲット音の扱いは文脈で変わります。`};
    }
    const correct=pcName(root.pc+rule.intervals[0],root.name);
    const scalePcs=scaleIntervals(rule.scale).map(i=>pcName(root.pc+i,root.name));
    const choices=shuffle([correct,...shuffle(scalePcs.filter(n=>n!==correct)).slice(0,3)]);
    return {id:qid(mode,root,key,settings.avoidRule), mode, chord,
      prompt:`${chord}（${rule.scale}）のアボイドノートは？`, kicker:'アボイドノート', scale:`使用スケール：${root.name} ${rule.scale}`,
      correct, options:choices,
      explanation:`このルールでは ${correct}（${rule.degree}）をアボイドとして扱います。「弾いてはいけない音」ではなく、長く着地すると響きを濁しやすい音という意味です。`};
  }
}
function scaleIntervals(name){
  return {
    Ionian:[0,2,4,5,7,9,11],
    Dorian:[0,2,3,5,7,9,10],
    Mixolydian:[0,2,4,5,7,9,10],
    Locrian:[0,1,3,5,6,8,10],
    Aeolian:[0,2,3,5,7,8,10]
  }[name] || [0,2,4,5,7,9,11];
}
function renderStats(){
  els.totalAnswered.textContent=state.answered;
  els.accuracy.textContent=state.answered?`${Math.round(state.correct/state.answered*100)}%`:'—';
  els.weakCount.textContent=Object.values(state.weak).filter(v=>v>0).length;
}
function openMode(mode){
  currentMode=mode; session={correct:0,total:0};
  els.homeView.classList.remove('active'); els.quizView.classList.add('active');
  els.modeLabel.textContent={third:'3度',fifth:'5度',seventh:'7度',tones:'構成音',avoid:'アボイド',weak:'苦手復習'}[mode];
  nextQuestion();
}
function nextQuestion(){
  currentQ=generateQuestion(currentMode);
  els.questionKicker.textContent=currentQ.kicker;
  els.questionText.textContent=currentQ.prompt;
  els.scaleNote.textContent=currentQ.scale||'';
  els.feedback.classList.add('hidden');
  els.answers.innerHTML='';
  currentQ.options.forEach(opt=>{
    const b=document.createElement('button'); b.className='answer'; b.textContent=opt;
    b.onclick=()=>answer(opt,b); els.answers.appendChild(b);
  });
  els.sessionCorrect.textContent=session.correct; els.sessionTotal.textContent=session.total;
  els.progressBar.style.width=`${(session.total%10)*10}%`;
}
function answer(value,button){
  const ok=value===currentQ.correct;
  [...els.answers.children].forEach(b=>{
    b.disabled=true;
    if(b.textContent===currentQ.correct)b.classList.add('correct');
  });
  if(!ok)button.classList.add('wrong');
  state.answered++; session.total++;
  if(ok){state.correct++;session.correct++;state.weak[currentQ.id]=Math.max(0,(state.weak[currentQ.id]||0)-1)}
  else state.weak[currentQ.id]=(state.weak[currentQ.id]||0)+1;
  save(); renderStats();
  els.sessionCorrect.textContent=session.correct; els.sessionTotal.textContent=session.total;
  els.feedbackTitle.textContent=ok?'正解！':'惜しい！';
  els.feedbackText.textContent=currentQ.explanation;
  els.feedback.classList.remove('hidden');
}
document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>openMode(b.dataset.mode));
els.nextBtn.onclick=nextQuestion;
els.backBtn.onclick=()=>{els.quizView.classList.remove('active');els.homeView.classList.add('active');renderStats()};
els.settingsBtn.onclick=()=>els.settingsDialog.showModal();
els.keyRange.value=settings.keyRange; els.chordRange.value=settings.chordRange; els.avoidRule.value=settings.avoidRule;
['keyRange','chordRange','avoidRule'].forEach(id=>els[id].onchange=e=>{settings[id]=e.target.value;save()});
els.resetBtn.onclick=()=>{if(confirm('学習記録をリセットしますか？')){state={answered:0,correct:0,weak:{}};save();renderStats()}};
renderStats();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'))}
