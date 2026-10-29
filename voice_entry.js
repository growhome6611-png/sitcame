/* v53: launch a separate translation activity without navigating the camera page. */
(()=>{'use strict';
const app=window.DHApp;if(!app)return;
const names={vi:'Phiên dịch',en:'Translator',zh:'口语翻译',ja:'通訳',ko:'통역',th:'ล่าม',hi:'दुभाषिया',ar:'الترجمة الفورية',pt:'Intérprete',es:'Intérprete',fr:'Interprète',de:'Dolmetscher',ru:'Переводчик'};
const entry=document.createElement('button');entry.type='button';entry.id='openVoiceTranslator';
const row=document.querySelector('.plan-entry');if(!row)return;
row.append(entry);
const style=document.createElement('style');style.textContent='.plan-entry{flex-wrap:wrap}.plan-entry button{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere}.plan-entry #planSummary{flex:1;min-width:45px}';document.head.append(style);
function refresh(){entry.textContent=names[app.state.lang]||names.en}
entry.onclick=()=>{app.closeSettings();window.fieldPlan?.close();window.fieldDrive?.close();
 if(window.AndroidAppTools?.openVoiceTranslator)window.AndroidAppTools.openVoiceTranslator(app.state.lang);
 else window.location.assign('voice_translator.html?ui='+encodeURIComponent(app.state.lang));
};
window.DHVoiceEntry={refresh};refresh();
})();
