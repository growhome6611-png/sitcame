/* Shared PDF / Excel contractor summary. Counts are pins, not photos or repetitions. */
(function(root){
'use strict';
const levels=['low','medium','high','critical'],colors=['#23885c','#65b98a','#ed8828','#d4323c'];
const words={
 vi:['THỐNG KÊ VÀ XẾP HẠNG NHÀ THẦU','Hạng','Tổng lỗi','Chưa xác định','Tổng cộng','Kèm thống kê và xếp hạng nhà thầu','Mỗi ghim tính một lỗi, kể cả đã sửa; chỉ thống kê các ghim trong báo cáo. Xếp hạng theo tổng lỗi, bằng tổng thì cùng hạng.'],
 en:['CONTRACTOR ISSUE SUMMARY AND RANKING','Rank','Total issues','Unassigned','Grand total','Include contractor summary and ranking','Each pin counts as one issue, including closed issues; only report pins are counted. Ranked by total issues; equal totals share a rank.'],
 zh:['承包商问题统计与排名','排名','问题总数','未指定','合计','包含承包商统计和排名','每个标记计为一个问题，包括已整改问题；仅统计本报告中的标记。按问题总数排名，总数相同则并列。'],
 ja:['施工業者別の不具合集計と順位','順位','不具合総数','未指定','合計','施工業者別の集計と順位を含める','各ピンを1件として、修正済みを含む報告対象のみを集計。総数順、同数は同順位。'],
 ko:['시공업체별 하자 통계 및 순위','순위','총 하자','미지정','합계','시공업체 통계 및 순위 포함','수리 완료 건을 포함하여 보고서의 핀 하나를 하자 한 건으로 집계합니다. 총 건수순이며 동률은 같은 순위입니다.'],
 th:['สรุปข้อบกพร่องและอันดับผู้รับเหมา','อันดับ','ข้อบกพร่องรวม','ไม่ระบุ','รวมทั้งหมด','รวมสรุปและอันดับผู้รับเหมา','นับแต่ละหมุดเป็นหนึ่งข้อบกพร่อง รวมที่แก้ไขแล้ว เฉพาะหมุดในรายงาน เรียงตามจำนวนรวม จำนวนเท่ากันได้อันดับเดียวกัน'],
 hi:['ठेकेदार दोष सारांश और रैंकिंग','रैंक','कुल दोष','अनिर्दिष्ट','कुल योग','ठेकेदार सारांश और रैंकिंग शामिल करें','रिपोर्ट में हर पिन एक दोष है, सुधारे गए दोष भी शामिल हैं। कुल दोष के अनुसार रैंक; बराबर कुल पर समान रैंक।'],
 ar:['ملخص عيوب المقاولين وترتيبهم','الترتيب','إجمالي العيوب','غير محدد','المجموع','تضمين ملخص المقاولين وترتيبهم','كل علامة عيب واحد بما في ذلك العيوب المعالجة، وتُحسب علامات التقرير فقط. الترتيب حسب الإجمالي والمتساوون في نفس المرتبة.'],
 fr:['SYNTHÈSE ET CLASSEMENT DES ENTREPRISES','Rang','Total défauts','Non attribué','Total général','Inclure la synthèse et le classement des entreprises','Chaque repère compte pour un défaut, même corrigé, parmi les repères du rapport. Classement par total ; les totaux égaux partagent le même rang.'],
 de:['MÄNGELÜBERSICHT UND RANGFOLGE DER AUFTRAGNEHMER','Rang','Mängel gesamt','Nicht zugeordnet','Gesamtsumme','Auftragnehmerübersicht und Rangfolge hinzufügen','Jede Markierung zählt als ein Mangel, auch behobene; nur Markierungen im Bericht werden gezählt. Nach Gesamtzahl sortiert; gleiche Summen erhalten denselben Rang.'],
 es:['RESUMEN Y CLASIFICACIÓN DE CONTRATISTAS','Puesto','Total defectos','Sin asignar','Total general','Incluir resumen y clasificación de contratistas','Cada marcador cuenta como un defecto, incluidos los corregidos, solo dentro del informe. Orden por total; totales iguales comparten puesto.'],
 pt:['RESUMO E CLASSIFICAÇÃO DE EMPREITEIROS','Posição','Total de defeitos','Não atribuído','Total geral','Incluir resumo e classificação de empreiteiros','Cada marcador conta como um defeito, incluindo os corrigidos, apenas neste relatório. Ordem por total; totais iguais recebem a mesma posição.'],
 ru:['СВОДКА ДЕФЕКТОВ И РЕЙТИНГ ПОДРЯДЧИКОВ','Место','Всего дефектов','Не назначено','Итого','Включить сводку и рейтинг подрядчиков','Каждая отметка — один дефект, включая устранённые; учитываются только отметки отчёта. По общему числу; одинаковые суммы имеют одно место.']
};
function label(lang,key){return (words[lang]||words.en)[key]}
function labels(primary,secondary,t){const pair=(a,b)=>a===b?a:a+' / '+b;return {title:pair(label(primary,0),label(secondary,0)),rank:pair(label(primary,1),label(secondary,1)),total:pair(label(primary,2),label(secondary,2)),unknown:pair(label(primary,3),label(secondary,3)),grand:pair(label(primary,4),label(secondary,4)),note:pair(label(primary,6),label(secondary,6)),contractor:t.headers[4],severity:t.severity,project:t.project,page:t.page};}
function aggregate(items,unknown='—'){
 const groups=new Map(),seen=new Set();
 for(const pin of items){if(pin.id!=null){if(seen.has(pin.id))continue;seen.add(pin.id)}const name=String(pin.contractor||'').normalize('NFC').trim().replace(/\s+/g,' '),key=name.toLowerCase();let g=groups.get(key);if(!g){g={name:name||unknown,counts:[0,0,0,0],total:0};groups.set(key,g)}const index=levels.indexOf(pin.severity);g.counts[index<0?1:index]++;g.total++;}
 const rows=[...groups.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));let rank=0,previous=-1;
 rows.forEach((r,i)=>{if(r.total!==previous)rank=i+1;r.rank=rank;previous=r.total});return rows;
}
function chunks(rows,size=8){const pages=[];for(let i=0;i<rows.length;i+=size)pages.push(rows.slice(i,i+size));return pages;}
function text(ctx,value,x,y,w,h,size=28,bold=false,align='left',color='#18334b'){
 ctx.save();ctx.font=`${bold?'700':'400'} ${size}px 'Noto Sans', 'DejaVu Sans', 'Noto Sans CJK SC', sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign=align;
 const str=String(value),rtl=/[\u0600-\u06ff]/.test(str);ctx.direction=rtl?'rtl':'ltr';if(rtl&&align==='left')ctx.textAlign='right';
 function wrap(font){ctx.font=`${bold?'700':'400'} ${font}px 'Noto Sans', 'DejaVu Sans', 'Noto Sans CJK SC', sans-serif`;const out=[];
  for(const para of str.split('\n')){let line='';for(const word of para.split(/\s+/)){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=w){line=candidate;continue}if(line){out.push(line);line=''}for(const ch of Array.from(word)){if(ctx.measureText(line+ch).width>w&&line){out.push(line);line=ch}else line+=ch}}out.push(line)}return out;
 }
 let lines=wrap(size),max=Math.max(1,Math.floor(h/(size*1.3)));
 while(lines.length>max&&size>16){size--;lines=wrap(size);max=Math.max(1,Math.floor(h/(size*1.3)))}
 if(lines.length>max){lines.length=max;let last=lines[max-1];while(last&&ctx.measureText(last+'…').width>w)last=Array.from(last).slice(0,-1).join('');lines[max-1]=last+'…'}
 const anchor=ctx.textAlign==='center'?x+w/2:ctx.textAlign==='right'?x+w:x;lines.forEach((s,i)=>ctx.fillText(s,anchor,y+i*size*1.3));ctx.restore();
}
function drawPage(ctx,rows,L,meta,page,pageCount,allRows){
 ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,1684,2380);
 text(ctx,meta.company,50,30,360,70,28,true);text(ctx,L.project+': '+meta.project,430,30,800,70,28,true,'center');text(ctx,meta.date,1250,30,384,70,28,false,'right');
 text(ctx,L.title,50,130,1584,135,40,true,'center');text(ctx,meta.plan,50,280,1584,80,28,false,'center');
 const left=155,right=1595,top=460,bottom=1080,height=bottom-top,max=Math.max(1,...rows.map(r=>r.total));const step=Math.max(1,Math.ceil(max/5)),limit=Math.ceil(max/step)*step;
 for(let n=0;n<=limit;n+=step){const y=bottom-height*n/limit;ctx.strokeStyle='#d9e3eb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();text(ctx,n,50,y-18,85,40,25,false,'right')}
 const slot=(right-left)/rows.length,bar=Math.min(110,slot*.62);
 rows.forEach((r,i)=>{const x=left+slot*(i+.5)-bar/2;let y=bottom;r.counts.forEach((count,j)=>{if(!count)return;const h=count/limit*height;y-=h;ctx.fillStyle=colors[j];ctx.fillRect(x,y,bar,h);if(h>=24)text(ctx,count,x,y+(h-24)/2,bar,30,Math.min(26,h*.7),true,'center','#fff')});text(ctx,r.total,x-12,y-44,bar+24,40,28,true,'center');text(ctx,r.name,left+slot*i+6,bottom+18,slot-12,135,25,true,'center')});
 L.severity.forEach((s,i)=>{const x=50+i*396;ctx.fillStyle=colors[i];ctx.fillRect(x,1250,30,30);text(ctx,s,x+42,1244,338,100,26,true)});
 const widths=[105,499,190,190,190,190,220],heads=[L.rank,L.contractor,...L.severity,L.total],tableTop=1390,rowH=80;
 function row(cells,y,header=false,total=false){let x=50;cells.forEach((v,i)=>{ctx.fillStyle=header?'#e7f1f8':total?'#edf6f1':'#fff';ctx.fillRect(x,y,widths[i],rowH);ctx.strokeStyle='#9eb3c3';ctx.lineWidth=1;ctx.strokeRect(x,y,widths[i],rowH);text(ctx,v,x+8,y+12,widths[i]-16,rowH-16,header?23:i===1?24:27,header||total,i===1?'left':'center');x+=widths[i]})}
 // Widths sum to 1584; table retains full contractor names with wrapping.
 row(heads,tableTop,true);rows.forEach((r,i)=>row([r.rank,r.name,...r.counts,r.total],tableTop+(i+1)*rowH));
 if(page===pageCount-1){const totals=allRows.reduce((a,r)=>a.map((v,i)=>v+r.counts[i]),[0,0,0,0]);row(['',L.grand,...totals,totals.reduce((a,b)=>a+b,0)],tableTop+(rows.length+1)*rowH,false,true)}
 text(ctx,L.note,50,2200,1584,110,22);text(ctx,meta.author,50,2330,1200,45,24);text(ctx,`${L.page} ${page+1}/${pageCount}`,1270,2330,364,45,24,false,'right');ctx.restore();
}
const esc=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const relNS='http://schemas.openxmlformats.org/package/2006/relationships',office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
async function addExcel(zip,rows,L,meta){
 const cell=(col,r,v,n=false,style=5)=>`<c r="${col}${r}" s="${style}"${n?'':' t="inlineStr"'}>${n?`<v>${v}</v>`:`<is><t xml:space="preserve">${esc(v)}</t></is>`}</c>`;
 const heads=[L.rank,L.contractor,...L.severity,L.total];let data=`<row r="1" ht="60" customHeight="1">${cell('A',1,L.title,false,1)}</row><row r="2" ht="50" customHeight="1">${cell('A',2,meta.project+' · '+meta.plan+' · '+meta.date,false,2)}</row><row r="3" ht="65" customHeight="1">${cell('A',3,L.note,false,2)}</row><row r="4" ht="55" customHeight="1">${heads.map((v,i)=>cell('ABCDEFG'[i],4,v,false,3)).join('')}</row>`;
 rows.forEach((r,i)=>{const n=i+5;data+=`<row r="${n}" ht="44" customHeight="1">${[r.rank,r.name,...r.counts,r.total].map((v,j)=>cell('ABCDEFG'[j],n,v,j!==1)).join('')}</row>`});const totalRow=rows.length+5,totals=rows.reduce((a,r)=>a.map((v,i)=>v+r.counts[i]),[0,0,0,0]);data+=`<row r="${totalRow}" ht="44" customHeight="1">${['',L.grand,...totals,totals.reduce((a,b)=>a+b,0)].map((v,i)=>cell('ABCDEFG'[i],totalRow,v,i>1)).join('')}</row>`;
 const groups=chunks(rows),anchors=[],relationships=[];
 groups.forEach((group,k)=>{
  const id=k+1,start=5+k*8,end=start+group.length-1,chartName=`contractor${id}`;
  const cat=`<c:strRef><c:f>'Contractor summary'!$B$${start}:$B$${end}</c:f><c:strCache><c:ptCount val="${group.length}"/>${group.map((r,i)=>`<c:pt idx="${i}"><c:v>${esc(r.name)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef>`;
  const series=L.severity.map((name,j)=>`<c:ser><c:idx val="${j}"/><c:order val="${j}"/><c:tx><c:v>${esc(name)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${colors[j].slice(1)}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:cat>${cat}</c:cat><c:val><c:numRef><c:f>'Contractor summary'!$${'CDEF'[j]}$${start}:$${'CDEF'[j]}$${end}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${group.length}"/>${group.map((r,i)=>`<c:pt idx="${i}"><c:v>${r.counts[j]}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val></c:ser>`).join('');
  zip.file(`xl/charts/${chartName}.xml`,`<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(L.title)} (${k+1}/${groups.length})</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/><c:varyColors val="0"/>${series}<c:dLbls><c:numFmt formatCode="0;-0;;" sourceLinked="0"/><c:dLblPos val="ctr"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls><c:gapWidth val="60"/><c:overlap val="100"/><c:axId val="101"/><c:axId val="102"/></c:barChart><c:catAx><c:axId val="101"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="102"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/></c:catAx><c:valAx><c:axId val="102"/><c:scaling><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart></c:chartSpace>`);
  const row=totalRow+2+k*25;anchors.push(`<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row+24}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Contractor chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${office}" r:id="rId${id}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);relationships.push(`<Relationship Id="rId${id}" Type="${office}/chart" Target="../charts/${chartName}.xml"/>`);
 });
 zip.file('xl/worksheets/sheet2.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${office}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:G${totalRow+groups.length*25+3}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="7" width="21" customWidth="1"/></cols><sheetData>${data}</sheetData><mergeCells count="3"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/><mergeCell ref="A3:G3"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><drawing r:id="rId1"/></worksheet>`);
 zip.file('xl/worksheets/_rels/sheet2.xml.rels',`<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${office}/drawing" Target="../drawings/contractor.xml"/></Relationships>`);
 zip.file('xl/drawings/contractor.xml',`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`);
 zip.file('xl/drawings/_rels/contractor.xml.rels',`<Relationships xmlns="${relNS}">${relationships.join('')}</Relationships>`);
 const content=await zip.file('[Content_Types].xml').async('string');zip.file('[Content_Types].xml',content.replace('</Types>',`<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/contractor.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${groups.map((_,i)=>`<Override PartName="/xl/charts/contractor${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('')}</Types>`));
 const workbook=await zip.file('xl/workbook.xml').async('string');zip.file('xl/workbook.xml',workbook.replace('</sheets>','<sheet name="Contractor summary" sheetId="2" r:id="rId3"/></sheets>'));
 const relations=await zip.file('xl/_rels/workbook.xml.rels').async('string');zip.file('xl/_rels/workbook.xml.rels',relations.replace('</Relationships>',`<Relationship Id="rId3" Type="${office}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`));
}
root.ContractorStats={aggregate,chunks,labels,label,drawPage,addExcel,levels,colors};
})(window);
