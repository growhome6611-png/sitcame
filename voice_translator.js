/* Dedicated two-way conversation. API keys stay in the native encrypted store. */
(()=>{'use strict';
const $=id=>document.getElementById(id),langs=window.DHVoiceLanguages,t=window.DHVoiceText,native=window.AndroidVoice;
const profiles={natural:{rate:1,pitch:0},clear:{rate:1.05,pitch:2},deep:{rate:.9,pitch:-4},bright:{rate:1.1,pitch:4},slow:{rate:.8,pitch:0}};
const clamp=(value,min,max,fallback)=>Number.isFinite(+value)?Math.max(min,Math.min(max,+value)):fallback;
function voiceProfile(value={},locale=''){
 value=value||{};
 return{gender:['AUTO','MALE','FEMALE'].includes(value.gender)?value.gender:'AUTO',style:profiles[value.style]?value.style:'natural',rate:clamp(value.rate,.6,1.5,1),pitch:clamp(value.pitch,-8,8,0),voiceName:typeof value.voiceName==='string'?value.voiceName.slice(0,200):'',locale:value.locale||locale};
}
let config={a:'vi',b:'ru',translateKey:'',ttsKey:'',voiceMode:'device',autoRead:true,uiLang:'vi'};
try{
 if(native)config={...config,...JSON.parse(native.config())}
 else{const ui=new URLSearchParams(location.search).get('ui');if(langs[ui])config.uiLang=ui}
}catch(_){config.keyError=true}
if(!langs[config.a])config.a='vi';if(!langs[config.b])config.b='ru';if(!langs[config.uiLang])config.uiLang='vi';
if(!['device','google'].includes(config.voiceMode))config.voiceMode='device';
config.voiceA=voiceProfile(config.voiceA,config.a);config.voiceB=voiceProfile(config.voiceB,config.b);
let mic=null,speaking=null,translation=null,sequence=0,version=0,browserRecognition=null,browserUtterance=null,lastOutputAt=0,lastMicStopAt=0;
const pending=new Map(),controllers=new Map(),voiceCache=new Map(),voiceLoads=new Map(),draft={a:{...config.voiceA},b:{...config.voiceB}},revisions={a:0,b:0};
const id=kind=>kind+'_'+Date.now()+'_'+(++sequence),codeLang=p=>$('lang-'+p).value,language=p=>langs[codeLang(p)],uiFor=p=>codeLang(p);
const profileKey=p=>p==='a'?'voiceA':'voiceB',modeLocale=(p,mode)=>mode==='google'?(language(p).cloud||language(p).stt):language(p).stt;
function status(p,key,error=false){$('status-'+p).textContent=key?t(uiFor(p),key):'';$('status-'+p).classList.toggle('error',error)}
function errorKey(code){return({NO_TRANSLATE_KEY:'missingTranslate',NO_TTS_KEY:'missingTts',MIC_DENIED:'micDenied',STT_UNAVAILABLE:'micUnavailable',STT_LANG_UNSUPPORTED:'languageUnsupported',NO_SPEECH:'noSpeech',BUSY:'micBusy',VOICE_MISSING:'voiceMissing',GENDER_MISSING:'genderUnavailable',TTS_UNAVAILABLE:'voiceMissing',AUDIO_LONG:'audioLong',AUTH:'authError',QUOTA:'quotaError',NETWORK:'networkError',INPUT:'inputError'})[code]||'serviceError'}
function languageTitle(key){return langs[key].shortName}
function render(){
 document.documentElement.lang=config.uiLang;document.title=t(config.uiLang,'title');
 const central={title:'title',swap:'swap','open-config':'settings','config-title':'settings','translate-key-label':'translateKey','tts-key-label':'ttsKey','voice-mode-label':'voiceMode','voice-device':'deviceVoice','voice-google':'googleVoice','auto-read-label':'autoRead','config-hint':'hint','save-config':'save'};
 for(const [el,key] of Object.entries(central))$(el).textContent=t(config.uiLang,key);
 $('close').setAttribute('aria-label',t(config.uiLang,'back'));$('close-config').setAttribute('aria-label',t(config.uiLang,'close'));
 $('settings-dialog').dir=config.uiLang==='ar'?'rtl':'ltr';$('settings-bar').dir=config.uiLang==='ar'?'rtl':'ltr';
 for(const p of ['a','b']){
  const l=language(p),target=language(p==='a'?'b':'a'),ui=uiFor(p),labels=langs[ui].ui,recording=mic?.person===p;
  $('person-'+p).dir=codeLang(p)==='ar'?'rtl':'ltr';$('person-'+p).lang=codeLang(p);
  $('person-'+p+'-label').textContent=t(ui,p==='a'?'personA':'personB');
  $('lang-'+p).disabled=!!translation;
  $('lang-'+p).setAttribute('aria-label',t(ui,'language'));
  $('text-'+p).placeholder=labels.placeholder;$('text-'+p).setAttribute('aria-label',t(ui,'text'));
  $('rec-'+p).textContent=recording?labels.stopBtn:labels.recordBtn;$('rec-'+p).classList.toggle('recording',recording);$('rec-'+p).setAttribute('aria-pressed',String(recording));$('rec-'+p).disabled=!!translation;
  $('trans-'+p).textContent=translation?.person===p?labels.processing:labels.transPrefix+' → '+target.shortName;
  $('trans-'+p).disabled=!!translation;$('read-'+p).textContent=t(ui,speaking?.person===p?'stopRead':'read');$('read-'+p).disabled=!!translation;
  $('voice-title-'+p).textContent=t(config.uiLang,p==='a'?'personA':'personB')+' · '+languageTitle(codeLang(p));
  for(const [suffix,key] of Object.entries({'gender-label':'voiceGender','style-label':'voiceStyle','voice-label':'voiceName','rate-label':'speed','pitch-label':'pitch','reload-voices':'reloadVoices','test-voice':'testVoice'}))$(suffix+'-'+p).textContent=t(config.uiLang,key);
 }
 $('tts-key-field').hidden=$('voice-mode').value!=='google';
}
function writeConfig(){config.a=codeLang('a');config.b=codeLang('b');
 if(!native)return true;try{return native.save(JSON.stringify(config))===true}catch(_){return false}
}
function request(type,call){const requestId=id(type);return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{pending.delete(requestId);if(type==='audio')native?.stopSpeaking();reject(Object.assign(Error(),{code:'NETWORK'}))},type==='audio'?600000:45000);
 pending.set(requestId,{type,resolve,reject,timer});try{call(requestId)}catch(_){finishRequest(requestId,null,'SERVICE')}
})}
function finishRequest(requestId,value,error){const task=pending.get(requestId);if(!task)return;clearTimeout(task.timer);pending.delete(requestId);if(error)task.reject(Object.assign(Error(),{code:error}));else task.resolve(value)}
function cancelRequests(type){for(const [key,task] of [...pending])if(!type||task.type===type)finishRequest(key,null,'CANCELLED')}
function stopMic(cancel=false){
 if(!mic)return;const current=mic;
 if(cancel){mic=null;lastMicStopAt=Date.now();clearTimeout(current.timer)}
 if(native){cancel?native.cancelListening():native.stopListening()}
 else{try{cancel?browserRecognition?.abort():browserRecognition?.stop()}catch(_){}}
 if(cancel){status(current.person,'');render()}
}
function stopAudio(){
 const current=speaking;speaking=null;
 if(current)lastOutputAt=Date.now();
 if(native)native.stopSpeaking();else{
  controllers.get(current?.networkId)?.abort();
  try{window.speechSynthesis?.cancel();browserUtterance?.audio?.pause()}catch(_){}
  if(browserUtterance){browserUtterance.reject(Object.assign(Error(),{code:'CANCELLED'}));browserUtterance=null}
 }
 cancelRequests('audio');if(current)status(current.person,'');render();
}
function transcript(person,requestId,text){
 if(mic?.id!==requestId)return;
 // A fresh turn replaces the translated/typed text. Partials replace each other too.
 $('text-'+person).value=String(text||'').slice(0,4000);revisions[person]++;
}
function listen(person){
 if(translation)return;if(mic?.person===person){if(mic.timer){stopMic(true)}else stopMic();return}
 stopMic(true);stopAudio();const requestId=id('mic');mic={id:requestId,person,timer:null};status(person,'preparingMic');render();
 if(native){native.listen(requestId,language(person).stt);return}
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){mic=null;status(person,'micUnavailable',true);render();return}
 const recognition=new Speech();browserRecognition=recognition;recognition.lang=language(person).stt;recognition.interimResults=true;recognition.continuous=false;
 const live=()=>mic?.id===requestId;
 recognition.onstart=()=>{if(live())status(person,'listening')};
 recognition.onresult=event=>{if(!live())return;let words='';for(let i=0;i<event.results.length;i++)words+=(i?' ':'')+event.results[i][0].transcript;if(words)transcript(person,requestId,words)};
 recognition.onerror=event=>{if(live()){mic=null;lastMicStopAt=Date.now();status(person,event.error==='not-allowed'?'micDenied':event.error==='no-speech'?'noSpeech':event.error==='language-not-supported'?'languageUnsupported':'networkError',true);render()}};
 recognition.onend=()=>{if(live()){mic=null;lastMicStopAt=Date.now();status(person,'');render()}};
 const start=()=>{if(!live())return;mic.timer=null;try{recognition.start()}catch(_){mic=null;status(person,'micUnavailable',true);render()}};
 const delay=Math.max(0,350-(Date.now()-lastOutputAt),200-(Date.now()-lastMicStopAt));if(delay)mic.timer=setTimeout(start,delay);else start();
}
async function api(endpoint,key,body,kind='service'){
 const controller=new AbortController(),networkId=id(kind);controllers.set(networkId,controller);
 if(kind==='audio'&&speaking)speaking.networkId=networkId;
 const timer=setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch(endpoint,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
  if(!response.ok)throw Object.assign(Error(),{code:[401,403].includes(response.status)?'AUTH':response.status===429?'QUOTA':response.status===400?'INPUT':'NETWORK'});
  return await response.json();
 }finally{clearTimeout(timer);controllers.delete(networkId)}
}
async function translate(person){
 if(translation)return;const other=person==='a'?'b':'a',text=$('text-'+person).value.trim();if(!text){status(person,'inputError',true);return}
 const source=codeLang(person),target=codeLang(other);
 if(source!==target&&!config.translateKey){status(person,'missingTranslate',true);openConfig();return}
 stopMic(true);stopAudio();const token=++version,targetBefore=$('text-'+other).value,targetRevision=revisions[other];
 translation={person,token};status(person,'processing');render();
 try{
  let output=text;
  if(source!==target){
   if(native)output=await request('translation',requestId=>native.translate(requestId,source,target,text));
   else{const response=await api('https://translation.googleapis.com/language/translate/v2',config.translateKey,{q:text,source,target,format:'text'},'translation');output=response.data.translations[0].translatedText}
  }
  if(token!==version)return;
  if(revisions[other]!==targetRevision||$('text-'+other).value!==targetBefore){status(person,'targetEdited',true);return}
  $('text-'+other).value=output;revisions[other]++;status(person,'translated');status(other,'');translation=null;render();if(config.autoRead)await read(other);
 }catch(error){if(token===version&&error.code!=='CANCELLED')status(person,errorKey(error.code||'NETWORK'),true)}
 finally{if(translation?.token===token)translation=null;render()}
}
function inferGender(name){if(/(?:^|[^a-z])female(?:[^a-z]|$)/i.test(name))return'FEMALE';if(/(?:^|[^a-z])male(?:[^a-z]|$)/i.test(name))return'MALE';return'AUTO'}
function sanitizeVoices(list){return(Array.isArray(list)?list:[]).filter(v=>v&&typeof v.name==='string'&&v.name.length<=200).map(v=>({...v,gender:['MALE','FEMALE'].includes(v.gender)?v.gender:'AUTO',pitchSupported:v.pitchSupported!==false}))}
async function voices(person,mode,force=false){
 const locale=modeLocale(person,mode),cacheKey=mode+'|'+locale,atVersion=version;
 if(force)voiceCache.delete(cacheKey);if(voiceCache.has(cacheKey))return voiceCache.get(cacheKey);if(voiceLoads.has(cacheKey))return voiceLoads.get(cacheKey);
 const task=(async()=>{
  let values;
  if(native)values=await request('voices',requestId=>native.voices(requestId,locale,mode));
  else if(mode==='google'){
   if(!config.ttsKey)throw Object.assign(Error(),{code:'NO_TTS_KEY'});
   const response=await api('https://texttospeech.googleapis.com/v1/voices?languageCode='+encodeURIComponent(locale),config.ttsKey,undefined,'voices');
   values=(response.voices||[]).filter(v=>!v.name?.includes('-Chirp-HD-')).map(v=>({name:v.name,gender:v.ssmlGender,locale:v.languageCodes?.find(tag=>tag===locale)||v.languageCodes?.[0]||locale,pitchSupported:/-(Standard|Wavenet|Neural2)-/.test(v.name)}));
  }else{
   const base=locale.toLowerCase().split('-')[0];values=(window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.toLowerCase().split('-')[0]===base).map(v=>({name:v.name,locale:v.lang,gender:inferGender(v.name),pitchSupported:true}));
  }
  const result=sanitizeVoices(values);if(atVersion===version)voiceCache.set(cacheKey,result);return result;
 })();voiceLoads.set(cacheKey,task);
 try{return await task}finally{if(voiceLoads.get(cacheKey)===task)voiceLoads.delete(cacheKey)}
}
function chooseVoice(values,profile,mode,locale){
 const named=profile.voiceName?values.find(v=>v.name===profile.voiceName):null;
 if(profile.voiceName&&!named)throw Object.assign(Error(),{code:'VOICE_MISSING'});
 let selected=named;
 if(!selected){
  let choices=values;
  if(profile.gender!=='AUTO'){choices=values.filter(v=>v.gender===profile.gender);if(!choices.length)throw Object.assign(Error(),{code:'GENDER_MISSING'})}
  choices=[...choices].sort((a,b)=>Number(b.locale===locale)-Number(a.locale===locale)||Number(b.pitchSupported)-Number(a.pitchSupported)||a.name.localeCompare(b.name));selected=choices[0];
 }
 if(!selected)throw Object.assign(Error(),{code:'VOICE_MISSING'});
 return{...profile,voiceName:selected.name,gender:selected.gender==='AUTO'?profile.gender:selected.gender,pitchSupported:selected.pitchSupported,locale:selected.locale||locale};
}
async function read(person,preview=false){
 if(speaking?.person===person&&!preview){stopAudio();return}
 const text=$('text-'+person).value.trim()||(preview?language(person).shortName:'');if(!text){status(person,'inputError',true);return}
 stopMic(true);stopAudio();const token=id('say'),mode=preview?$('voice-mode').value:config.voiceMode;
 const profile=voiceProfile(preview?formProfile(person):config[profileKey(person)],codeLang(person));
 if(profile.locale!==codeLang(person))profile.voiceName='';speaking={person,token};status(person,'speaking');render();
 try{
  const available=await voices(person,mode);if(speaking?.token!==token)return;
  const chosen=chooseVoice(available,profile,mode,modeLocale(person,mode)),options={...chosen,pitch:chosen.pitchSupported?chosen.pitch:0};
  if(native)await request('audio',requestId=>native.speak(requestId,text,language(person).stt,language(person).cloud||language(person).stt,mode,JSON.stringify(options)));
  else if(mode==='google'){
   if(new TextEncoder().encode(text).length>5000)throw Object.assign(Error(),{code:'AUDIO_LONG'});
   const voice={languageCode:chosen.locale,name:chosen.voiceName};if(chosen.gender!=='AUTO')voice.ssmlGender=chosen.gender;
   const audioConfig={audioEncoding:'MP3',speakingRate:chosen.rate};if(chosen.pitchSupported)audioConfig.pitch=chosen.pitch;
   const value=await api('https://texttospeech.googleapis.com/v1/text:synthesize',config.ttsKey,{input:{text},voice,audioConfig},'audio');if(speaking?.token!==token)return;
   await new Promise((resolve,reject)=>{const audio=new Audio('data:audio/mp3;base64,'+value.audioContent);browserUtterance={reject,audio};audio.onended=resolve;audio.onerror=()=>reject(Object.assign(Error(),{code:'TTS_UNAVAILABLE'}));audio.play().catch(()=>reject(Object.assign(Error(),{code:'TTS_UNAVAILABLE'})))})
  }else{
   if(!window.speechSynthesis)throw Object.assign(Error(),{code:'VOICE_MISSING'});
   await new Promise((resolve,reject)=>{const utterance=new SpeechSynthesisUtterance(text);utterance.lang=chosen.locale;utterance.voice=window.speechSynthesis.getVoices().find(v=>v.name===chosen.voiceName);utterance.rate=chosen.rate;utterance.pitch=Math.pow(2,chosen.pitch/12);utterance.onend=resolve;utterance.onerror=()=>reject(Object.assign(Error(),{code:'VOICE_MISSING'}));browserUtterance={reject};window.speechSynthesis.speak(utterance)})
  }
 }catch(error){if(speaking?.token===token&&error.code!=='CANCELLED')status(person,errorKey(error.code||'NETWORK'),true)}
 finally{if(speaking?.token===token){speaking=null;lastOutputAt=Date.now();browserUtterance=null;if(!$('status-'+person).classList.contains('error'))status(person,'');render()}}
}
function formProfile(p){return voiceProfile({gender:$('gender-'+p).value,style:$('style-'+p).value,voiceName:$('voice-'+p).value,rate:$('rate-'+p).value,pitch:$('pitch-'+p).value,locale:codeLang(p)})}
function fillVoiceForm(p){
 const current=voiceProfile(config[profileKey(p)],codeLang(p));if(current.locale!==codeLang(p))current.voiceName='';current.locale=codeLang(p);draft[p]=current;
 for(const [select,values] of [[$('gender-'+p),[['AUTO','autoVoice'],['MALE','male'],['FEMALE','female']]],[ $('style-'+p),[['natural','natural'],['clear','clearVoice'],['deep','deepVoice'],['bright','brightVoice'],['slow','slowVoice']]]]){
  select.replaceChildren();for(const [value,key] of values)select.add(new Option(t(config.uiLang,key),value));
 }
 $('gender-'+p).value=current.gender;$('style-'+p).value=current.style;$('rate-'+p).value=current.rate;$('pitch-'+p).value=current.pitch;renderVoiceOptions(p);
}
function renderVoiceOptions(p){
 const mode=$('voice-mode').value,cacheKey=mode+'|'+modeLocale(p,mode),values=voiceCache.get(cacheKey)||[],current=draft[p],select=$('voice-'+p);
 select.replaceChildren();select.add(new Option(t(config.uiLang,'autoVoice'),''));
 let list=values;if(mode==='google'&&current.gender!=='AUTO')list=list.filter(v=>v.gender===current.gender);
 list.forEach((v,index)=>{const gender=v.gender==='AUTO'?t(config.uiLang,'voiceName'):t(config.uiLang,v.gender==='MALE'?'male':'female');const label=mode==='google'?gender+' '+(index+1)+' · '+(v.name.match(/-(Standard|Wavenet|Neural2|Chirp3-HD|Studio)-/)?.[1]||v.name):String(index+1)+' · '+v.name;select.add(new Option(label,v.name))});
 if(current.voiceName&&!list.some(v=>v.name===current.voiceName))current.voiceName='';select.value=current.voiceName;
 let chosen;try{chosen=chooseVoice(values,current,mode,modeLocale(p,mode))}catch(_){}
 const pitchUnsupported=mode==='google'&&chosen?.pitchSupported===false;
 $('pitch-'+p).disabled=pitchUnsupported;$('rate-value-'+p).textContent=Number($('rate-'+p).value).toFixed(2)+'×';$('pitch-value-'+p).textContent=($('pitch-'+p).value>0?'+':'')+$('pitch-'+p).value;
 let hint=t(config.uiLang,mode==='google'?'voiceHintCloud':'voiceHintDevice');
 if(voiceCache.has(cacheKey)&&!values.length)hint+=' '+t(config.uiLang,'voiceMissing');
 else if(current.gender!=='AUTO'&&!current.voiceName&&!values.some(v=>v.gender===current.gender))hint+=' '+t(config.uiLang,'genderUnavailable');
 if(pitchUnsupported)hint+=' '+t(config.uiLang,'pitchUnsupported');$('voice-hint-'+p).textContent=hint;
}
async function loadVoiceForm(p,force=false){
 const locale=codeLang(p),mode=$('voice-mode').value,atVersion=version;$('voice-hint-'+p).textContent=t(config.uiLang,'loading');$('reload-voices-'+p).disabled=true;
 try{await voices(p,mode,force);if(locale===codeLang(p)&&mode===$('voice-mode').value&&atVersion===version)renderVoiceOptions(p)}
 catch(error){if(locale===codeLang(p)&&mode===$('voice-mode').value&&atVersion===version&&error.code!=='CANCELLED')$('voice-hint-'+p).textContent=t(config.uiLang,errorKey(error.code||'NETWORK'))}
 finally{$('reload-voices-'+p).disabled=false}
}
function openConfig(){
 suspend();$('config-status').textContent='';$('translate-key').value=config.translateKey;$('tts-key').value=config.ttsKey;$('voice-mode').value=config.voiceMode;$('auto-read').checked=config.autoRead;
 $('settings-dialog').hidden=false;for(const p of ['a','b']){fillVoiceForm(p);loadVoiceForm(p)}render();$('voice-mode').focus();
}
function closeConfig(){stopAudio();$('settings-dialog').hidden=true;$('open-config').focus()}
function languageChanged(person){
 suspend();for(const p of ['a','b'])status(p,'');config[profileKey(person)]={...config[profileKey(person)],voiceName:'',locale:codeLang(person)};writeConfig();render();
}
function onNativeEvent(event){
 if(event.type==='speech'){
  if(mic?.id!==event.id)return;const {person}=mic;
  if((event.phase==='partial'||event.phase==='done')&&event.text)transcript(person,event.id,event.text);
  if(['done','error','stopped'].includes(event.phase)){mic=null;status(person,event.phase==='error'?errorKey(event.code):'',event.phase==='error');render()}
  else if(event.phase==='processing')status(person,'processing');else if(event.phase==='listening')status(person,'listening');
 }else if(event.type==='translation')finishRequest(event.id,event.text,event.phase==='error'?event.code:null);
 else if(event.type==='voices')finishRequest(event.id,event.data,event.phase==='error'?event.code:null);
 else if(event.type==='audio'&&['done','error','stopped'].includes(event.phase))finishRequest(event.id,null,event.phase==='error'?event.code:event.phase==='stopped'?'CANCELLED':null);
 else if(event.type==='voiceReady'){
  for(const key of voiceCache.keys())if(key.startsWith('device|'))voiceCache.delete(key);if(!$('settings-dialog').hidden&&$('voice-mode').value==='device')for(const p of ['a','b'])loadVoiceForm(p);
 }
}
function suspend(){version++;translation=null;stopMic(true);stopAudio();cancelRequests();for(const controller of controllers.values())controller.abort();voiceLoads.clear();native?.cancelOperations?.();render()}
for(const p of ['a','b']){for(const [key,row] of Object.entries(langs))$('lang-'+p).add(new Option(row.dropdown,key));$('lang-'+p).value=config[p]}
for(const person of ['a','b']){
 $('lang-'+person).onchange=()=>languageChanged(person);
 $('text-'+person).oninput=()=>{revisions[person]++;if(mic?.person===person)stopMic(true)};
 $('rec-'+person).onclick=()=>listen(person);$('trans-'+person).onclick=()=>translate(person);$('read-'+person).onclick=()=>read(person);
 $('gender-'+person).onchange=()=>{draft[person]=formProfile(person);draft[person].voiceName='';renderVoiceOptions(person)};
 $('style-'+person).onchange=()=>{const preset=profiles[$('style-'+person).value]||profiles.natural;$('rate-'+person).value=preset.rate;$('pitch-'+person).value=preset.pitch;draft[person]=formProfile(person);renderVoiceOptions(person)};
 $('voice-'+person).onchange=()=>{draft[person]=formProfile(person);renderVoiceOptions(person)};
 for(const key of ['rate','pitch'])$(key+'-'+person).oninput=()=>{draft[person]=formProfile(person);renderVoiceOptions(person)};
 $('reload-voices-'+person).onclick=()=>loadVoiceForm(person,true);$('test-voice-'+person).onclick=()=>read(person,true);
}
$('translate-key').value=config.translateKey;$('tts-key').value=config.ttsKey;$('voice-mode').value=config.voiceMode;$('auto-read').checked=config.autoRead;for(const p of ['a','b'])fillVoiceForm(p);
$('swap').onclick=()=>document.body.classList.toggle('swapped');$('open-config').onclick=openConfig;$('close-config').onclick=closeConfig;
$('voice-mode').onchange=()=>{stopAudio();for(const p of ['a','b']){draft[p]=formProfile(p);draft[p].voiceName='';renderVoiceOptions(p);loadVoiceForm(p)}render()};
$('save-config').onclick=()=>{
 const before={...config};config={...config,translateKey:$('translate-key').value.trim(),ttsKey:$('tts-key').value.trim(),voiceMode:$('voice-mode').value,autoRead:$('auto-read').checked,voiceA:formProfile('a'),voiceB:formProfile('b')};
 const ok=writeConfig();if(!ok)config=before;else{suspend();voiceCache.clear();for(const p of ['a','b']){draft[p]={...config[profileKey(p)]};loadVoiceForm(p)}}
 $('config-status').textContent=t(config.uiLang,ok?(native?'saved':'savedSession'):'saveError');$('config-status').classList.toggle('error',!ok);
};
$('close').onclick=()=>{suspend();if(native)native.close();else if(history.length>1)history.back();else location.assign('index.html')};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(!$('settings-dialog').hidden)closeConfig();else $('close').click()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend()});window.addEventListener('pagehide',suspend);
window.speechSynthesis?.addEventListener?.('voiceschanged',()=>onNativeEvent({type:'voiceReady'}));
window.DHVoice={onNativeEvent,suspend};render();if(config.keyError){openConfig();$('config-status').textContent=t(config.uiLang,'saveError')}
})();
