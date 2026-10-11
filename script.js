(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const fmtTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};
const STORAGE_KEY = 'project-orbit-2-progress-v2';

const MISSIONS = [
 {id:1,code:'MISSION 01',name:'ORBIT INSERTION',desc:'Stabilize the vehicle and establish a safe orbit.',objective:'Orbit insertion',limit:180,goal:100,initial:{power:92,temp:38,comm:82,fuel:88,progress:0},solar:1.0,scanRate:1.15,thrustRate:5,events:['orbitDrift','propulsionFault','sensorCalibration','solarFlare','scienceFind'],success:s=>s.progress>=100&&s.power>=5&&s.temp<90,failComm:false},
 {id:2,code:'MISSION 02',name:'HELIOS OBSERVATION',desc:'Collect solar data while controlling thermal load.',objective:'Observation data',limit:210,goal:100,initial:{power:96,temp:48,comm:85,fuel:95,progress:0},solar:.72,scanRate:1.25,events:['solarFlare','thermalSpike','scienceFind','commNoise','sensorCalibration'],success:s=>s.progress>=100&&s.comm>=15&&s.temp<90,failComm:false},
 {id:3,code:'MISSION 03',name:'MARS EXPLORER',desc:'Survey the surface and preserve rover resources.',objective:'Surface survey',limit:240,goal:100,initial:{power:86,temp:34,comm:72,fuel:76,progress:0},solar:.82,scanRate:1.0,thrustRate:6,events:['surfaceObstacle','scienceFind','routeShift','sensorCalibration','debris'],success:s=>s.progress>=100&&s.fuel>=10&&s.power>=5,failComm:false},
 {id:4,code:'MISSION 04',name:'DEEP SPACE RELAY',desc:'Transmit the data package through a fragile link.',objective:'Data transmission',limit:190,goal:100,initial:{power:91,temp:37,comm:58,fuel:90,progress:0},solar:.75,scanRate:.95,events:['commNoise','signalFade','commWindow','solarFlare','powerSurge'],success:s=>s.progress>=100&&s.comm>=25,failComm:true},
 {id:5,code:'MISSION 05',name:'RENDEZVOUS',desc:'Approach the target and complete a safe docking.',objective:'Docking sequence',limit:220,goal:100,initial:{power:90,temp:36,comm:76,fuel:70,progress:0},solar:.9,scanRate:.85,thrustRate:8,events:['relativeVelocity','attitudeTrim','dockingWindow','propulsionFault','debris'],success:s=>s.progress>=100&&s.fuel>=10&&s.power>=5,failComm:false},
 {id:6,code:'MISSION 06',name:'LUNAR RECON',desc:'Map multiple lunar sites and maintain the survey bus.',objective:'Lunar reconnaissance',limit:210,goal:100,initial:{power:83,temp:40,comm:69,fuel:86,progress:0},solar:1.12,scanRate:1.05,events:['terrainAnomaly','sensorOverload','solarEfficiency','scienceFind','solarFlare'],success:s=>s.progress>=100&&s.power>=10,failComm:false},
 {id:7,code:'MISSION 07',name:'ASTEROID SURVEY',desc:'Analyze a rotating asteroid with limited reserves.',objective:'Asteroid analysis',limit:200,goal:100,initial:{power:80,temp:39,comm:74,fuel:62,progress:0},solar:.7,scanRate:.95,thrustRate:7,events:['rotationShift','debris','rareMineral','propulsionFault','sensorCalibration'],success:s=>s.progress>=100&&s.fuel>=15,failComm:false},
 {id:8,code:'MISSION 08',name:'DEEP SPACE RECOVERY',desc:'Stabilize a distressed probe and recover its data.',objective:'Probe recovery',limit:240,goal:100,initial:{power:46,temp:66,comm:13,fuel:58,progress:0},solar:.8,scanRate:.9,events:['commOutage','powerFault','coolingFault','solarFlare','commWindow'],success:s=>s.progress>=100&&s.power>=10&&s.comm>=20&&s.temp<90,failComm:true}
];

const EVENT_DEFS = {
 orbitDrift:{type:'WARNING',title:'ORBITAL DRIFT',desc:'Insertion angle is off nominal. Course correction recommended.',duration:18,effect(s){s.drift=true;},clear(s){s.drift=false;},resolve:'thrust',resolveText:'Correct course'},
 propulsionFault:{type:'MALFUNCTION',title:'PROPULSION FAULT',desc:'Thruster efficiency reduced. Maneuvers cost extra propellant.',duration:24,effect(s){s.effects.thrustCost=1.7;},clear(s){s.effects.thrustCost=1;},resolve:'diagnostics',resolveText:'Run diagnostics'},
 sensorCalibration:{type:'WARNING',title:'SENSOR CALIBRATION',desc:'Scan efficiency reduced until the sensor array is calibrated.',duration:22,effect(s){s.effects.scan=.55;},clear(s){s.effects.scan=1;},resolve:'diagnostics',resolveText:'Calibrate sensors'},
 solarFlare:{type:'CRITICAL',title:'SOLAR ACTIVITY SPIKE',desc:'Incoming radiation is increasing thermal load.',duration:17,effect(s){s.effects.heat=2.1;},clear(s){s.effects.heat=1;},resolve:'cool',resolveText:'Run cooling'},
 thermalSpike:{type:'WARNING',title:'THERMAL SPIKE',desc:'Observation equipment is running hotter than expected.',duration:16,effect(s){s.effects.heat=1.8;},clear(s){s.effects.heat=1;},resolve:'cool',resolveText:'Cool system'},
 scienceFind:{type:'OPPORTUNITY',title:'ANOMALOUS SCIENCE DATA',desc:'A promising signature could improve the survey record.',duration:16,effect(s){s.effects.discovery=true;},clear(s){s.effects.discovery=false;},resolve:'scan',resolveText:'Analyze signature'},
 commNoise:{type:'WARNING',title:'COMMUNICATION NOISE',desc:'Signal-to-noise ratio has dropped. Link quality is degrading.',duration:20,effect(s){s.effects.comm=-1.3;},clear(s){s.effects.comm=0;},resolve:'diagnostics',resolveText:'Tune receiver'},
 surfaceObstacle:{type:'WARNING',title:'SURFACE OBSTACLE',desc:'Rover route is obstructed. A maneuver will clear the path.',duration:20,effect(s){s.effects.scan=.65;},clear(s){s.effects.scan=1;},resolve:'thrust',resolveText:'Reroute rover'},
 routeShift:{type:'WARNING',title:'ROUTE UPDATE',desc:'Surface route changed. Maneuvering can recover survey efficiency.',duration:18,effect(s){s.effects.scan=.8;},clear(s){s.effects.scan=1;},resolve:'thrust',resolveText:'Adjust route'},
 signalFade:{type:'MALFUNCTION',title:'SIGNAL STRENGTH DROP',desc:'Deep-space link is fading. Antenna diagnostics are advised.',duration:22,effect(s){s.effects.comm=-1.8;},clear(s){s.effects.comm=0;},resolve:'diagnostics',resolveText:'Retune antenna'},
 commWindow:{type:'OPPORTUNITY',title:'COMMUNICATION WINDOW',desc:'A clean relay window improves signal recovery and transfer.',duration:20,effect(s){s.effects.commBoost=2.2;},clear(s){s.effects.commBoost=0;},resolve:'comm',resolveText:'Use comm link'},
 powerSurge:{type:'OPPORTUNITY',title:'POWER BUS SURGE',desc:'A temporary solar alignment offers a small power gain.',duration:12,effect(s){s.effects.powerBoost=1.8;},clear(s){s.effects.powerBoost=0;}},
 relativeVelocity:{type:'CRITICAL',title:'RELATIVE VELOCITY RISE',desc:'Closing velocity is outside the preferred docking envelope.',duration:17,effect(s){s.effects.scan=.5;},clear(s){s.effects.scan=1;},resolve:'thrust',resolveText:'Correct velocity'},
 attitudeTrim:{type:'WARNING',title:'ATTITUDE TRIM REQUIRED',desc:'Vehicle attitude is drifting. A small maneuver can stabilize approach.',duration:19,effect(s){s.effects.thrustCost=1.25;},clear(s){s.effects.thrustCost=1;},resolve:'thrust',resolveText:'Trim attitude'},
 dockingWindow:{type:'OPPORTUNITY',title:'DOCKING WINDOW',desc:'Target alignment is favorable. Scan operations gain a brief bonus.',duration:16,effect(s){s.effects.scan=1.35;},clear(s){s.effects.scan=1;}},
 terrainAnomaly:{type:'WARNING',title:'TERRAIN DATA ANOMALY',desc:'Unexpected elevation data. Diagnostics can recalibrate the model.',duration:20,effect(s){s.effects.scan=.7;},clear(s){s.effects.scan=1;},resolve:'diagnostics',resolveText:'Recalibrate map'},
 sensorOverload:{type:'MALFUNCTION',title:'SENSOR OVERLOAD',desc:'Survey array is throttled until the overload clears.',duration:22,effect(s){s.effects.scan=.5;},clear(s){s.effects.scan=1;},resolve:'cool',resolveText:'Cool sensor bay'},
 solarEfficiency:{type:'OPPORTUNITY',title:'SOLAR ALIGNMENT',desc:'Array angle is favorable. Power generation is temporarily boosted.',duration:20,effect(s){s.effects.solarBoost=1.8;},clear(s){s.effects.solarBoost=0;}},
 rotationShift:{type:'WARNING',title:'ASTEROID ROTATION SHIFT',desc:'Target rotation complicates the scan angle. Course adjustment advised.',duration:18,effect(s){s.effects.scan=.65;},clear(s){s.effects.scan=1;},resolve:'thrust',resolveText:'Adjust scan angle'},
 rareMineral:{type:'OPPORTUNITY',title:'RARE MINERAL SIGNATURE',desc:'A high-value deposit has been detected. Analyze it for a score bonus.',duration:16,effect(s){s.effects.discovery=true;},clear(s){s.effects.discovery=false;},resolve:'scan',resolveText:'Analyze deposit'},
 debris:{type:'CRITICAL',title:'MICRO-DEBRIS ALERT',desc:'Debris is near the flight path. Diagnostics can calculate a safe avoidance vector.',duration:16,effect(s){s.effects.scan=.7;},clear(s){s.effects.scan=1;},resolve:'diagnostics',resolveText:'Calculate avoidance'},
 commOutage:{type:'CRITICAL',title:'COMMUNICATION OUTAGE',desc:'Probe transmitter has failed. Restore the link with diagnostics.',duration:30,effect(s){s.commDown=true;s.comm= Math.min(s.comm,8);},clear(s){s.commDown=false;},resolve:'diagnostics',resolveText:'Restore transmitter'},
 powerFault:{type:'CRITICAL',title:'POWER DISTRIBUTION FAULT',desc:'A bus fault is draining power. Diagnostics can isolate the fault.',duration:26,effect(s){s.effects.drain=1.1;},clear(s){s.effects.drain=0;},resolve:'diagnostics',resolveText:'Isolate power fault'},
 coolingFault:{type:'MALFUNCTION',title:'COOLING LOOP FAILURE',desc:'Cooling output is reduced until the loop is reset.',duration:24,effect(s){s.effects.cooling=.4;},clear(s){s.effects.cooling=1;},resolve:'diagnostics',resolveText:'Reset cooling loop'}
};

const state = {
 view:'select', mission:null, mode:'mission', running:false, paused:false, ended:false,
 elapsed:0, remaining:0, power:100,temp:35,comm:80,fuel:100,progress:0,
 commOn:true,powerSave:false,solarOn:true,cooling:false,thermalLocked:false,commLost:0,
 eventCooldown:12,active:{},recentEvents:[],logs:[],eventCount:0,warningCount:0,actions:0,
 maxTemp:35,startResources:null,diagTimer:0,diagHint:'',lastTick:0,score:0,
 effects:{scan:1,heat:1,comm:0,commBoost:0,solarBoost:0,powerBoost:0,thrustCost:1,drain:0,cooling:1,discovery:false},
 stats:{powerUsed:0,fuelUsed:0},lastWarnings:{},longScore:0
};
let intervalId = null, toastTimer = null, pendingConfirm = null;
let saved = loadSaved();

function loadSaved(){
 try{
  const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return {cleared:[],bestScores:{},longBest:0};
  const parsed=JSON.parse(raw);
  return {cleared:Array.isArray(parsed.cleared)?parsed.cleared.filter(n=>Number.isInteger(n)&&n>=1&&n<=8):[],bestScores:parsed.bestScores&&typeof parsed.bestScores==='object'?parsed.bestScores:{},longBest:Number.isFinite(parsed.longBest)?parsed.longBest:0};
 }catch(_){return {cleared:[],bestScores:{},longBest:0};}
}
function saveProgress(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch(_){/* Storage may be disabled; game remains playable. */}}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function log(category,message){
 const entry={time:fmtTime(state.elapsed),category,message};
 state.logs.push(entry);if(state.logs.length>200)state.logs.shift();
 renderLogs();
}
function renderLogs(){
 const root=$('eventLog');if(!root)return;
 root.innerHTML=state.logs.slice().reverse().map(e=>`<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-category ${escapeHtml(e.category)}">${escapeHtml(e.category)}</span><span class="log-message">${escapeHtml(e.message)}</span></div>`).join('');
 $('logCount').textContent=`${state.logs.length} ENTRIES`;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showView(view){state.view=view;['missionSelect','controlRoom','resultView'].forEach(id=>$(id).classList.toggle('hidden',id!==view));}
function renderMissionCards(){
 $('missionGrid').innerHTML=MISSIONS.map(m=>{
  const clear=saved.cleared.includes(m.id);
  return `<button class="mission-card ${clear?'cleared':''}" data-mission="${m.id}">
   <div class="mission-number"><span>${m.code}</span>${clear?'<span class="clear-pill">✓ CLEAR</span>':''}</div>
   <h3>${m.name}</h3><p>${m.desc}</p>
   <div class="mission-meta"><span>◷ ${Math.floor(m.limit/60)} MIN</span><span>◎ ${saved.bestScores[m.id]!==undefined?'BEST '+saved.bestScores[m.id]:'UNRANKED'}</span></div>
  </button>`;
 }).join('');
 // Use one delegated click handler on the grid so dynamically-rendered cards
 // reliably start on touch devices as well as desktop browsers.
 const grid = $('missionGrid');
 if (!grid.dataset.missionHandlerBound) {
  grid.dataset.missionHandlerBound = 'true';
  grid.addEventListener('click', (event) => {
   const btn = event.target.closest('[data-mission]');
   if (!btn || !grid.contains(btn)) return;
   const id = Number(btn.dataset.mission);
   if (!Number.isInteger(id)) return;
   try {
    startMission(id);
   } catch (error) {
    console.error('PROJECT ORBIT mission start failed:', error);
    toast('Mission failed to start. Please reload the page.');
   }
  });
 }
}
function resetEffects(){state.effects={scan:1,heat:1,comm:0,commBoost:0,solarBoost:0,powerBoost:0,thrustCost:1,drain:0,cooling:1,discovery:false};}
function startMission(id){
 stopTimer();
 const m=MISSIONS.find(x=>x.id===id);if(!m)return;
 resetState(m,'mission');showView('controlRoom');startTimer();renderAll();
 log('SYSTEM',`${m.code} ${m.name} initialized.`);log('SYSTEM',`Mission timer set to ${fmtTime(m.limit)}.`);
}
function startLongTerm(){
 stopTimer();resetState(null,'long');showView('controlRoom');startTimer();renderAll();
 log('SYSTEM','LONG-TERM OPERATIONS initialized. No mission countdown active.');
}
function resetState(m,mode){
 state.mission=m;state.mode=mode;state.running=true;state.paused=false;state.ended=false;state.elapsed=0;state.remaining=m?m.limit:0;
 const init=m?m.initial:{power:100,temp:35,comm:80,fuel:100,progress:0};
 Object.assign(state,{power:init.power,temp:init.temp,comm:init.comm,fuel:init.fuel,progress:init.progress,commOn:true,powerSave:false,solarOn:true,cooling:false,thermalLocked:false,commLost:0,eventCooldown:10,active:{},recentEvents:[],logs:[],eventCount:0,warningCount:0,actions:0,maxTemp:init.temp,startResources:{power:init.power,fuel:init.fuel},diagTimer:0,diagHint:'',score:0,lastTick:0,lastWarnings:{},longScore:0,stats:{powerUsed:0,fuelUsed:0}});
 resetEffects();$('pauseOverlay').classList.add('hidden');$('pauseBtn').textContent='Ⅱ PAUSE';$('liveDot').classList.remove('paused');
 $('modeLabel').textContent=m?`${m.code} / STANDARD`:'LONG-TERM OPERATIONS';
 $('headerState').textContent='RUNNING';$('endButtonLabel').textContent=mode==='long'?'END OPERATION':'ABORT MISSION';
 $('missionCode').textContent=m?`${m.code} / STANDARD MISSIONS`:'OPEN-ENDED FLIGHT MODE';
 $('missionTitle').textContent=m?m.name:'LONG-TERM OPERATIONS';
 $('missionObjective').textContent=m?m.desc:'Maintain stable spacecraft systems for as long as possible.';
 $('clockLabel').textContent=m?'TIME REMAINING':'ELAPSED TIME';
 $('objectiveName').textContent=m?m.objective:'Operational stability score';
 $('taskTitle').textContent=m?m.objective:'Long-term system maintenance';
 $('missionClock').textContent=m?fmtTime(m.limit):'00:00';
 $('objectiveHint').textContent=m?'MISSION ACTIVE':'OPEN ENDED';
 $('pauseOverlay').classList.add('hidden');
 updateActiveEvents();updateControls();
}
function startTimer(){
 if(intervalId!==null)clearInterval(intervalId);
 state.lastTick=performance.now();
 intervalId=setInterval(()=>{
  if(!state.running||state.paused||state.ended)return;
  const now=performance.now();
  const delta=Math.min(1.25,Math.max(0,(now-state.lastTick)/1000));
  state.lastTick=now;
  if(delta>0)tick(delta);
 },250);
}
function stopTimer(){if(intervalId!==null){clearInterval(intervalId);intervalId=null;}}
function tick(dt){
 if(!state.running||state.paused||state.ended)return;
 state.elapsed+=dt;if(state.mode==='mission')state.remaining=Math.max(0,state.mission.limit-state.elapsed);
 state.eventCooldown-=dt;
 applyNaturalChanges(dt);
 applySystemEffects(dt);
 updateEvents(dt);
 if(state.diagTimer>0){state.diagTimer-=dt;if(state.diagTimer<=0){state.diagHint='Diagnostic complete: '+diagnosticSummary();log('DIAGNOSTIC',state.diagHint);toast(state.diagHint);}}
 state.maxTemp=Math.max(state.maxTemp,state.temp);
 evaluateWarnings();
 // Failure has priority over success in a shared update cycle.
 const failure=checkFailure();
 if(failure){finish('failure',failure);return;}
 if(state.mode==='mission'&&state.mission.success(state)){finish('success','All primary mission criteria satisfied.');return;}
 if(state.mode==='mission'&&state.remaining<=0){finish('failure','Mission timer expired before all success criteria were met.');return;}
 renderAll();
}
function applyNaturalChanges(dt){
 // Baseline system drift, before active subsystem effects.
 state.power-=.10*dt;
 state.temp+=(state.temp>72?.16:.035)*dt;
 if(state.commOn&&!state.active.commOutage)state.comm+=.08*dt;
 else state.comm-=.11*dt;
 state.fuel-=.006*dt;
 if(state.mode==='long')state.longScore+=.1*dt;
}
function applySystemEffects(dt){
 const m=state.mission;
 const solarEfficiency=m?m.solar:1;
 if(state.solarOn&&!state.active.powerFault)state.power+=(1.15*solarEfficiency+state.effects.solarBoost+state.effects.powerBoost)*dt;
 if(state.powerSave){state.power+=.35*dt;state.temp-=.12*dt;}
 if(state.commOn&&!state.active.commOutage)state.comm+=(.12+state.effects.commBoost+state.effects.comm)*dt;
 if(state.cooling&&state.power>=.12){const used=.12*dt;state.power-=used;state.stats.powerUsed+=used;state.temp-=1.15*state.effects.cooling*dt;}
 if(state.temp>=90){state.thermalLocked=true;state.cooling=false;}
 if(state.temp<=82&&state.thermalLocked){state.thermalLocked=false;log('SYSTEM','Thermal lock cleared. Scan controls require manual activation.');}
 state.temp+=state.effects.heat*.08*dt;
 state.power-=state.effects.drain*dt;
 state.comm=clamp(state.comm,0,100);state.power=clamp(state.power,0,100);state.fuel=clamp(state.fuel,0,100);state.temp=clamp(state.temp,-50,150);state.progress=clamp(state.progress,0,100);
}
function updateEvents(dt){
 for(const [id,event] of Object.entries(state.active)){
  event.remaining-=dt;
  if(event.remaining<=0)clearEvent(id,'incident timer expired');
 }
 if(state.eventCooldown<=0&&Object.keys(state.active).length<2){
  const chance=state.mode==='long'?.27:.32;
  if(Math.random()<chance*dt){triggerRandomEvent();state.eventCooldown=18+Math.random()*13;}
 }
}
function triggerRandomEvent(){
 const pool=state.mission?state.mission.events:Object.keys(EVENT_DEFS);
 const candidates=pool.filter(id=>!state.active[id]&&!state.recentEvents.includes(id));
 if(!candidates.length)return;
 // Favor a useful mix and avoid simultaneous critical pileups.
 const available=candidates.filter(id=>!(EVENT_DEFS[id].type==='CRITICAL'&&Object.values(state.active).some(e=>e.type==='CRITICAL')));
 if(!available.length)return;
 const id=available[Math.floor(Math.random()*available.length)];
 const def=EVENT_DEFS[id];if(!def)return;
 const event={id,type:def.type,title:def.title,desc:def.desc,remaining:def.duration,started:state.elapsed};
 state.active[id]=event;state.recentEvents.push(id);if(state.recentEvents.length>4)state.recentEvents.shift();
 state.eventCount++;if(def.type==='CRITICAL')state.warningCount++;
 if(def.effect)def.effect(state);
 log('EVENT',`${def.title}: ${def.desc}`);toast(`EVENT DETECTED: ${def.title}`);
 updateActiveEvents();renderControls();
}
function clearEvent(id,reason){
 const event=state.active[id];if(!event)return;
 const def=EVENT_DEFS[id];if(def&&def.clear)def.clear(state);
 delete state.active[id];log('EVENT',`${event.title} cleared (${reason}).`);updateActiveEvents();renderControls();
}
function resolveEvent(id){
 const event=state.active[id],def=EVENT_DEFS[id];if(!event||!def)return;
 if(def.resolve==='thrust'){performThrust(true);}
 else if(def.resolve==='diagnostics'){runDiagnostics(true);}
 else if(def.resolve==='cool'){if(state.power<2){toast('Insufficient power for cooling response.');return;}state.temp=clamp(state.temp-8,-50,150);state.power-=2;state.stats.powerUsed+=2;log('ACTION','Emergency cooling response executed.');}
 else if(def.resolve==='scan'){if(state.thermalLocked||state.power<3){toast('Analysis unavailable: thermal lock or low power.');return;}state.progress=clamp(state.progress+7,0,100);state.power-=3;state.temp+=3;state.actions++;log('ACTION','Opportunity analyzed. Survey progress +7%.');}
 else if(def.resolve==='comm'){state.commOn=true;state.comm=clamp(state.comm+8,0,100);log('ACTION','Communication window utilized.');}
 clearEvent(id,'player response');renderAll();
}
function evaluateWarnings(){
 const checks=[
  ['powerCritical',state.power<=15,'CRITICAL','Power reserve critical (≤15%).'],
  ['powerLow',state.power<=30,'WARNING','Power reserve low (≤30%).'],
  ['tempCritical',state.temp>=90,'CRITICAL','Thermal limit exceeded (≥90°C). Scan operations locked.'],
  ['tempHigh',state.temp>=70,'WARNING','Thermal load high (≥70°C). Cooling recommended.'],
  ['commLost',state.comm<=15,'CRITICAL','Communication quality critically low (≤15%).'],
  ['commLow',state.comm<=40,'WARNING','Communication quality degraded (≤40%).'],
  ['fuelLow',state.fuel<=20,'WARNING','Propellant reserve low (≤20%).']
 ];
 const next={};
 for(const [key,condition,cat,msg] of checks){
  next[key]=condition;
  if(condition&&!state.lastWarnings[key]){log(cat,msg);if(cat==='CRITICAL')state.warningCount++;}
  if(!condition&&state.lastWarnings[key])log('SYSTEM',`${key.replace(/([A-Z])/g,' $1')} warning cleared.`);
 }
 state.lastWarnings=next;
}
function checkFailure(){
 if(state.power<=0)return 'Power bus depleted. Spacecraft systems can no longer operate.';
 if(state.temp>=120)return 'Thermal runaway reached the critical limit of 120°C.';
 if(state.mission&&state.mission.failComm&&state.comm<=0){state.commLost+=.25; if(state.commLost>=10)return 'Required communication link remained unavailable for 10 seconds.';}else state.commLost=0;
 return null;
}
function finish(result,reason){
 if(state.ended)return;
 state.ended=true;state.running=false;state.paused=false;stopTimer();$('pauseOverlay').classList.add('hidden');
 const score=calculateScore(result);state.score=score;
 log(result==='success'?'SUCCESS':result==='failure'?'ERROR':'SYSTEM',`${result.toUpperCase()}: ${reason}`);
 if(result==='success'&&state.mission){if(!saved.cleared.includes(state.mission.id))saved.cleared.push(state.mission.id);saved.bestScores[state.mission.id]=Math.max(saved.bestScores[state.mission.id]||0,score);saveProgress();}
 if(state.mode==='long'){saved.longBest=Math.max(saved.longBest,score);saveProgress();}
 renderMissionCards();showResult(result,reason,score);$('headerState').textContent=result==='success'?'MISSION CLEAR':result==='failure'?'MISSION FAILED':'OPERATION ENDED';$('liveDot').classList.remove('paused');
}
function calculateScore(result){
 const survival=Math.round(state.power*1.5+clamp(100-Math.max(0,state.temp-25)*.8,0,100)*.5+state.comm*.55+state.fuel*.65);
 const progress=Math.round(state.progress*2.1);
 const penalty=state.warningCount*35+Math.max(0,state.elapsed-(state.mission?state.mission.limit*.65:600))*.15;
 const longBonus=state.mode==='long'?Math.min(1000,Math.floor(state.elapsed*1.5)):0;
 return Math.max(0,Math.round((result==='success'?250:result==='failure'?0:100)+survival+progress+longBonus-penalty));
}
function rankFor(score,result){if(result==='failure')return'D';if(score>=500)return'S';if(score>=390)return'A';if(score>=290)return'B';if(score>=190)return'C';return'D';}
function showResult(result,reason,score){
 const shell=document.querySelector('.result-shell');shell.classList.remove('failure','aborted');if(result!=='success')shell.classList.add(result==='failure'?'failure':'aborted');
 $('resultSymbol').textContent=result==='success'?'✓':result==='failure'?'!':'Ⅱ';
 $('resultEyebrow').textContent=state.mode==='long'?'LONG-TERM OPERATIONS REPORT':'MISSION REPORT';
 $('resultTitle').textContent=result==='success'?'MISSION SUCCESS':result==='failure'?'MISSION FAILURE':'OPERATION ENDED';
 $('resultSummary').textContent=reason;
 const stats=[
  ['DURATION',fmtTime(state.elapsed),''],
  ['PROGRESS',`${Math.round(state.progress)}%`,state.mission?state.mission.objective:'Operations stability'],
  ['POWER',`${Math.round(state.power)}%`,'Remaining'],
  ['FINAL TEMP',`${Math.round(state.temp)}°C`,'Peak '+Math.round(state.maxTemp)+'°C'],
  ['COMM LINK',`${Math.round(state.comm)}%`,'Signal quality'],
  ['PROPELLANT',`${Math.round(state.fuel)}%`,'Remaining'],
  ['EVENTS',String(state.eventCount),'Incidents recorded'],
  ['OPERATIONS',String(state.actions),'Actions executed'],
  ['SCORE',String(score),'Total points'],
  ['RANK',rankFor(score,result),result==='failure'?'Mission failed':'Performance rating']
 ];
 $('resultStats').innerHTML=stats.map(([label,value,sub])=>`<div class="result-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong>${sub?`<small>${escapeHtml(sub)}</small>`:''}</div>`).join('');
 $('retryBtn').textContent=state.mode==='long'?'↻ NEW LONG-TERM RUN':'↻ RETRY OPERATION';
 showView('resultView');
}
function pauseToggle(force){
 if(state.ended||!state.running)return;
 const next=typeof force==='boolean'?force:!state.paused;
 if(next===state.paused)return;
 state.paused=next;state.lastTick=performance.now();
 $('pauseOverlay').classList.toggle('hidden',!next);$('pauseBtn').textContent=next?'▶ RESUME':'Ⅱ PAUSE';$('liveDot').classList.toggle('paused',next);$('headerState').textContent=next?'PAUSED':'RUNNING';
 log('SYSTEM',next?'Simulation paused by operator.':'Simulation resumed by operator.');renderControls();
}
function payPower(amount,label){
 if(state.power<amount){toast(`Insufficient power for ${label}.`);log('WARNING',`${label} rejected: insufficient power.`);return false;}
 state.power=clamp(state.power-amount,0,100);state.stats.powerUsed+=amount;return true;
}
function doScan(high){
 if(state.thermalLocked||state.temp>=90){toast('Thermal lock active. Cool to 82°C or below first.');return;}
 const cost=high?7:3.2;if(!payPower(cost,high?'high-power scan':'scan'))return;
 const rate=(state.mission?state.mission.scanRate:1)*(high?2.5:1)*state.effects.scan*(state.powerSave?.6:1);
 state.progress=clamp(state.progress+rate*(high?5:3),0,100);
 state.temp=clamp(state.temp+(high?9:3.5)*state.effects.heat,-50,150);
 if(state.commOn)state.comm=clamp(state.comm-.35,0,100);
 state.actions++;log('ACTION',`${high?'HIGH-POWER SCAN':'STANDARD SCAN'} executed. Progress ${Math.round(state.progress)}%.`);renderAll();
}
function performThrust(isResponse=false){
 const cost=(state.mission?state.mission.thrustRate||5:5)*state.effects.thrustCost;
 if(state.fuel<cost){toast('Insufficient propellant. Maneuver rejected.');log('WARNING','Maneuver rejected: insufficient propellant.');return false;}
 if(!payPower(1.5,'maneuver'))return false;
 state.fuel=clamp(state.fuel-cost,0,100);state.stats.fuelUsed+=cost;
 const gain=state.mission?state.mission.id===5?8:state.mission.id===3?5:4:3;
 if(state.mission&&(state.mission.id===1||state.mission.id===3||state.mission.id===5||state.mission.id===7))state.progress=clamp(state.progress+gain,0,100);
 if(state.active.orbitDrift){state.progress=clamp(state.progress+3,0,100);}
 state.temp=clamp(state.temp+1.5,-50,150);state.actions++;
 log('ACTION',`${isResponse?'Corrective':'Manual'} maneuver completed. Propellant −${cost.toFixed(1)}%.`);renderAll();return true;
}
function runDiagnostics(isResponse=false){
 if(!payPower(1.2,'diagnostics'))return;
 state.diagTimer=2.5;state.actions++;log('ACTION',`${isResponse?'Incident response':'System diagnostics'} started. Results pending.`);renderControls();
}
function diagnosticSummary(){
 const keys=Object.keys(state.active);
 if(!keys.length)return 'No persistent fault found. Telemetry nominal.';
 return keys.map(id=>EVENT_DEFS[id]?.title||id).join(', ')+' detected. Response options available in Event Monitor.';
}
function handleAction(action){
 if(!state.running||state.paused||state.ended)return;
 switch(action){
  case 'scan':doScan(false);break;
  case 'highScan':doScan(true);break;
  case 'cool':
   if(state.temp<=35){toast('Cooling not required at current temperature.');return;}
   if(!payPower(1.5,'cooling'))return;
   state.temp=clamp(state.temp-10*state.effects.cooling,-50,150);state.cooling=true;state.actions++;log('ACTION','Cooling cycle engaged. Temperature reduced.');setTimeout(()=>{state.cooling=false;renderControls();},2200);renderAll();break;
  case 'comm':
   state.commOn=!state.commOn;state.actions++;log('ACTION',`Communication link ${state.commOn?'enabled':'disabled'}.`);renderAll();break;
  case 'powerSave':
   state.powerSave=!state.powerSave;state.actions++;log('ACTION',`Power management ${state.powerSave?'enabled':'disabled'}.`);renderAll();break;
  case 'solar':
   state.solarOn=!state.solarOn;state.actions++;log('ACTION',`Solar array ${state.solarOn?'enabled':'disabled'}.`);renderAll();break;
  case 'thrust':performThrust();break;
  case 'diagnostics':runDiagnostics();break;
 }
}
function updateActiveEvents(){
 const root=$('activeEvents'),events=Object.values(state.active);
 $('eventCount').textContent=String(state.eventCount).padStart(3,'0');
 if(!events.length){root.innerHTML='<div class="empty-state"><span>◎</span><p>No active incidents detected.</p></div>';$('eventBadge').textContent='NO ACTIVE ALERT';$('eventBadge').className='event-badge';return;}
 const hasCritical=events.some(e=>e.type==='CRITICAL');
 $('eventBadge').textContent=hasCritical?'CRITICAL ALERT':`${events.length} ACTIVE EVENT${events.length>1?'S':''}`;$('eventBadge').className='event-badge '+(hasCritical?'critical':'alert');
 root.innerHTML=events.map(e=>{const d=EVENT_DEFS[e.id];return `<article class="incident ${e.type==='CRITICAL'?'critical':e.type==='OPPORTUNITY'?'opportunity':''}"><div class="incident-head"><b>${escapeHtml(e.title)}</b><span>${escapeHtml(e.type)} · ${Math.ceil(e.remaining)}s</span></div><p>${escapeHtml(e.desc)}</p>${d&&d.resolve?`<div class="incident-actions"><button class="mini-btn" data-resolve="${e.id}">${escapeHtml(d.resolveText)}</button></div>`:''}</article>`;}).join('');
 root.querySelectorAll('[data-resolve]').forEach(btn=>btn.addEventListener('click',()=>resolveEvent(btn.dataset.resolve)));
}
function renderControls(){
 const locked=state.thermalLocked||state.temp>=90;
 document.querySelectorAll('.control-btn').forEach(btn=>{
  const a=btn.dataset.action;let disabled=!state.running||state.paused||state.ended;
  if(['scan','highScan'].includes(a)&&locked)disabled=true;
  if(a==='cool'&&(state.temp<=35||state.power<1.5))disabled=true;
  if(a==='thrust'&&(state.fuel<(state.mission?state.mission.thrustRate||5:5)*state.effects.thrustCost||state.power<1.5))disabled=true;
  if(a==='diagnostics'&&state.power<1.2)disabled=true;
  btn.disabled=disabled;btn.classList.toggle('active',(a==='comm'&&state.commOn)||(a==='powerSave'&&state.powerSave)||(a==='solar'&&state.solarOn)||(a==='cool'&&state.cooling));
 });
 $('commTag').textContent=state.commOn?'ON':'OFF';$('commButtonSub').textContent=state.commOn?'Link enabled':'Link disabled';
 $('powerSaveTag').textContent=state.powerSave?'ON':'OFF';$('powerSaveSub').textContent=state.powerSave?'Reduced system load':'Standard load';
 $('solarTag').textContent=state.solarOn?'ON':'OFF';$('solarSub').textContent=state.solarOn?'Charging enabled':'Charging disabled';
 $('coolingTag').textContent=state.cooling?'ACTIVE':locked?'THERMAL LOCK':'READY';
 $('pauseBtn').disabled=state.ended;
}
function renderAll(){
 $('missionClock').textContent=state.mode==='mission'?fmtTime(state.remaining):fmtTime(state.elapsed);
 $('elapsedClock').textContent='ELAPSED '+fmtTime(state.elapsed);
 $('objectivePercent').textContent=`${Math.round(state.progress)}%`;$('objectiveBar').style.width=`${state.progress}%`;
 $('objectiveHint').textContent=state.thermalLocked?'THERMAL LOCK':state.paused?'PAUSED':state.mode==='long'?'OPEN ENDED':'MISSION ACTIVE';
 setMetric('power',state.power,0,100,'%');setMetric('temperature',state.temp,0,120,'°C');setMetric('comm',state.comm,0,100,'%');setMetric('fuel',state.fuel,0,100,'%');
 $('powerFoot').textContent=state.power<15?'CRITICAL':state.solarOn?'CHARGING':'DRAINING';
 $('temperatureFoot').textContent=state.temp>=90?'LOCKOUT':state.temp>=70?'ELEVATED':'NORMAL';
 $('commFoot').textContent=!state.commOn?'LINK OFF':state.comm<=15?'NO LOCK':'LOCKED';
 $('fuelFoot').textContent=state.fuel<=20?'LOW RESERVE':'AVAILABLE';
 $('scanRate').innerHTML=`${((state.mission?state.mission.scanRate:1)*state.effects.scan*(state.powerSave?.6:1)).toFixed(1)} <small>%/s</small>`;
 $('activeSystems').textContent=String([state.commOn,state.solarOn,!state.powerSave,state.cooling].filter(Boolean).length).padStart(2,'0');
 $('systemNote').textContent=state.thermalLocked?'Thermal protection active. Scan systems require manual restart.':state.diagTimer>0?'Diagnostics in progress…':state.diagHint||'Telemetry stream nominal. Monitor resource trends.';
 updateActiveEvents();renderControls();
}
function setMetric(name,value,min,max,suffix){
 const rounded=Math.round(value);$(`${name}Value`).textContent=rounded;
 const pct=name==='temperature'?clamp(value/120*100,0,100):clamp((value-min)/(max-min)*100,0,100);
 $(`${name}Bar`).style.width=`${pct}%`;
 const card=document.querySelector(`[data-metric="${name}"]`);card.classList.remove('warn','critical');
 let stateText='NOMINAL';
 if(name==='power'){stateText=value<=15?'CRITICAL':value<=30?'LOW':'NOMINAL';if(value<=15)card.classList.add('critical');else if(value<=30)card.classList.add('warn');}
 if(name==='temperature'){stateText=value>=90?'LOCKED':value>=70?'HIGH':'NOMINAL';if(value>=90)card.classList.add('critical');else if(value>=70)card.classList.add('warn');}
 if(name==='comm'){stateText=!state.commOn?'OFFLINE':value<=15?'LOST':value<=40?'WEAK':'ONLINE';if(value<=15)card.classList.add('critical');else if(value<=40)card.classList.add('warn');}
 if(name==='fuel'){stateText=value<=20?'LOW':'NOMINAL';if(value<=20)card.classList.add('warn');}
 $(`${name}State`).textContent=stateText;
}
function askConfirm(title,message,confirmText,callback){
 pendingConfirm=callback;$('dialogTitle').textContent=title;$('dialogMessage').textContent=message;$('dialogConfirm').textContent=confirmText;$('confirmDialog').classList.remove('hidden');
}
function closeDialog(){ $('confirmDialog').classList.add('hidden');pendingConfirm=null; }
function abortOperation(){
 if(!state.running||state.ended)return;
 const long=state.mode==='long';
 askConfirm(long?'End long-term operations?':'Abort current mission?',long?'The run will stop and a performance report will be generated.':'This mission will be marked ABORTED. Progress will not be saved as a clear.',long?'END OPERATION':'ABORT MISSION',()=>finish('aborted',long?'Operator ended long-term operations.':'Mission aborted by operator.'));
}
function returnToSelect(){stopTimer();state.running=false;state.paused=false;state.ended=true;showView('missionSelect');renderMissionCards();$('headerState').textContent='STANDBY';$('modeLabel').textContent='NO MISSION SELECTED';$('liveDot').classList.remove('paused');}
function copyLog(){
 const text=state.logs.map(e=>`[${e.time}] [${e.category}] ${e.message}`).join('\n');
 if(!text){toast('No log entries to copy.');return;}
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(()=>toast('Flight recorder copied.')).catch(()=>fallbackCopy(text));
 else fallbackCopy(text);
}
function fallbackCopy(text){
 const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
 try{document.execCommand('copy');toast('Flight recorder copied.');}catch(_){toast('Clipboard unavailable in this browser.');}area.remove();
}
function bind(){
 $('startLongTerm').addEventListener('click',startLongTerm);
 document.querySelectorAll('.control-btn').forEach(btn=>btn.addEventListener('click',()=>handleAction(btn.dataset.action)));
 $('pauseBtn').addEventListener('click',()=>pauseToggle());$('resumeOverlayBtn').addEventListener('click',()=>pauseToggle(false));
 $('abortBtn').addEventListener('click',abortOperation);$('copyLogBtn').addEventListener('click',copyLog);
 $('dialogCancel').addEventListener('click',closeDialog);$('dialogConfirm').addEventListener('click',()=>{const fn=pendingConfirm;closeDialog();if(fn)fn();});
 $('confirmDialog').addEventListener('click',e=>{if(e.target===$('confirmDialog'))closeDialog();});
 $('retryBtn').addEventListener('click',()=>state.mode==='long'?startLongTerm():startMission(state.mission.id));
 $('selectBtn').addEventListener('click',returnToSelect);
 document.addEventListener('visibilitychange',()=>{state.lastTick=performance.now();});
}
function init(){renderMissionCards();bind();showView('missionSelect');}
init();
})();