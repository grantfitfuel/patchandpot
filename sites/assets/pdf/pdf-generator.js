window.PP_PDF = (function(){
  const { jsPDF } = window.jspdf;

  function generate(){
    const orient = document.querySelector('input[name="pdf-orient"]:checked')?.value || 'portrait';
    const region = document.getElementById('pp-region')?.value || 'scotland';
    const cat = document.getElementById('pp-category')?.value || 'all';

    const doc = new jsPDF({ orientation: orient, unit:'pt', format:'a4' });

    // Title
    doc.setFont('helvetica','bold');
    doc.setFontSize(20);
    doc.text(`Patch & Pot Seasonal Calendar`, 40, 50);
    doc.setFontSize(14);
    doc.setFont('helvetica','normal');
    doc.text(`Region: ${region[0].toUpperCase()+region.slice(1)}, Category: ${cat}`, 40, 70);

    // Basics text
    const basics = window.DATA?.[region]?.basics || {};
    let y = 100;
    if(basics.notes){
      doc.setFontSize(12);
      doc.text(`Basics: ${basics.notes}`, 40, y, { maxWidth: 500 });
      y += 40;
    }

    // Pestwatch text
    const m = new Date().getMonth();
    const pests = window.DATA?.[region]?.pestwatch?.[m]?.items || [];
    if(pests.length){
      doc.setFont('helvetica','bold'); doc.text('Pest Watch:', 40, y);
      y += 20; doc.setFont('helvetica','normal');
      pests.forEach(p=>{ doc.text(`• ${p}`, 60, y, { maxWidth: 480 }); y += 16; });
      y += 20;
    }

    // Crops grid
    const crops = window.DATA?.[region]?.crops || [];
    doc.setFontSize(10);
    const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const colW = (doc.internal.pageSize.width-100)/13;
    const startX = 40; let posY = y;

    // Header row
    doc.setFont('helvetica','bold');
    doc.text("Crop", startX, posY);
    months.forEach((m,i)=> doc.text(m, startX+(i+1)*colW, posY));
    posY += 20;

    doc.setFont('helvetica','normal');
    crops.forEach(c=>{
      if(cat!=='all' && (c.category||'other')!==cat) return;
      if(posY > doc.internal.pageSize.height-100){ doc.addPage(); posY=60; }
      doc.text(c.name, startX, posY);
      months.forEach((m,i)=>{
        const marks=[];
        if((c.months?.sow||[]).includes(i)) marks.push("🌱");
        if((c.months?.plant||[]).includes(i)) marks.push("🪴");
        if((c.months?.harvest||[]).includes(i)) marks.push("🥕");
        if(marks.length) doc.text(marks.join(' '), startX+(i+1)*colW, posY);
      });
      posY += 16;
    });

    // Footer
    const pageH = doc.internal.pageSize.height;
    const midX = doc.internal.pageSize.width/2;
    doc.addImage('img/patchandpot-icon.png','PNG',midX-18,pageH-70,36,36);
    doc.setFontSize(10);
    doc.text("© Patch & Pot | Created by Grant Cameron Anthony", midX, pageH-20,{align:'center'});

    doc.save(`patchandpot-${region}-${cat}.pdf`);
  }

  function init(){
    const btn=document.getElementById('pp-generate-pdf');
    btn && btn.addEventListener('click', generate);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded',()=>window.PP_PDF.init());
