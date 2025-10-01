<script>
/* ===== Month + region helpers ===== */
const PP_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const today = new Date();
const CUR_M_IDX = today.getMonth(); // 0..11

/* ===== Minimal starter dataset (expand anytime) =====
 Each crop: { name, notes?, months:{ sow:[idx...], plant:[idx...], harvest:[idx...] } }
*/
const DATA = {
  scotland: {
    pestwatch: {
      8: { // Sep (index 8)
        title: "Pest Watch – September (Scotland)",
        items: [
          "Slugs/snails after rain – use beer traps, copper tape, night picks.",
          "Cabbage white caterpillars – check undersides, hand-remove.",
          "Late blight risk on potatoes/tomatoes – remove affected foliage early."
        ]
      },
      9: { // Oct
        title: "Pest Watch – October (Scotland)",
        items: [
          "Slugs in damp weather – keep rims dry, elevate pots.",
          "Grey mould on salads – ventilate, avoid overhead watering.",
          "Rodents after harvest – secure stored crops."
        ]
      }
    },
    crops: [
      { name:"Potatoes (bags)", months:{ sow:[2,3], plant:[3,4], harvest:[6,7,8] } },
      { name:"Carrots (tubs)", months:{ sow:[2,3,5], plant:[], harvest:[7,8,9,10] } },
      { name:"Beetroot (pots)", months:{ sow:[3,4,5], plant:[], harvest:[8,9,10] } },
      { name:"Spinach", months:{ sow:[2,3,7,8], plant:[], harvest:[3,4,8,9,10,11] } },
      { name:"Leeks", months:{ sow:[2], plant:[4], harvest:[9,10,11,12] } },
      { name:"Garlic (tubs)", months:{ sow:[8,9,10], plant:[8,9,10], harvest:[6,7] } }
    ],
    todayCombos: [
      "Garlic + Strawberries (pest deterrence near tubs)",
      "Carrots + Spring Onions (confuse carrot fly)"
    ]
  },
  ireland: {
    pestwatch: {
      8: { title:"Pest Watch – September (Ireland)", items:[
        "Slugs/snails – sustained moisture increases activity.",
        "Aphids on greens – wash off, encourage ladybirds.",
        "Blight if warm/wet – prune affected tomato leaves."
      ]},
      9: { title:"Pest Watch – October (Ireland)", items:[
        "Snails under rims – upend pots occasionally.",
        "Mildew on courgettes – remove worst leaves, improve airflow.",
        "Wireworm after potato lifts – inspect soil when replanting."
      ]}
    },
    crops: [
      { name:"Potatoes (bags)", months:{ sow:[1,2,3], plant:[2,3,4], harvest:[6,7,8] } },
      { name:"Carrots (tubs)", months:{ sow:[1,2,3], plant:[], harvest:[7,8,9] } },
      { name:"Beetroot (pots)", months:{ sow:[2,3,4], plant:[], harvest:[7,8,9,10] } },
      { name:"Lettuce", months:{ sow:[1,2,3,8,9], plant:[3,4,9], harvest:[3,4,5,6,8,9,10] } },
      { name:"Peas (dwarf)", months:{ sow:[1,2], plant:[2,3], harvest:[6,7] } },
      { name:"Garlic", months:{ sow:[8,9,10], plant:[8,9,10], harvest:[6,7] } }
    ],
    todayCombos: [
      "Lettuce + Chives (flavour + light pest masking)",
      "Carrots + Leeks (classic partners)"
    ]
  },
  england: {
    pestwatch: {
      8: { title:"Pest Watch – September (England)", items:[
        "Aphids on brassicas – soft soap spray; encourage hoverflies.",
        "Powdery mildew on courgettes – water soil, not leaves.",
        "Carrot fly – keep rims high, avoid bruising foliage."
      ]},
      9: { title:"Pest Watch – October (England)", items:[
        "Slugs in wet spells – tidy debris, raise pots.",
        "Whitefly in sheltered patios – yellow cards, hose leaves.",
        "Pigeons on winter greens – mesh/cloches."
      ]}
    },
    crops: [
      { name:"Potatoes (bags)", months:{ sow:[1,2,3], plant:[2,3,4], harvest:[6,7,8] } },
      { name:"Carrots (tubs)", months:{ sow:[2,3,4], plant:[], harvest:[7,8,9,10] } },
      { name:"Beetroot (pots)", months:{ sow:[2,3,4,5], plant:[], harvest:[7,8,9] } },
      { name:"Spinach", months:{ sow:[1,2,3,7,8,9], plant:[], harvest:[3,4,8,9,10,11] } },
      { name:"Tomatoes (tubs)", months:{ sow:[2], plant:[4,5], harvest:[7,8,9] } },
      { name:"Spring Onions", months:{ sow:[2,3,8,9], plant:[], harvest:[5,6,10,11] } }
    ],
    todayCombos: [
      "Tomato + Basil (classics in warm corners)",
      "Carrot + Leek (mutual benefit)"
    ]
  },
  wales: {
    pestwatch: {
      8: { title:"Pest Watch – September (Wales)", items:[
        "Mildew in damp air – ventilate, don’t overwater evenings.",
        "Aphids on late brassicas – rinse, encourage predators.",
        "Slugs – use barriers, tidy hiding spots."
      ]},
      9: { title:"Pest Watch – October (Wales)", items:[
        "Blight in wet spells – prune affected foliage promptly.",
        "White rust on rocket – rotate/succession sow.",
        "Vine weevils in pots – check compost when repotting."
      ]}
    },
    crops: [
      { name:"Potatoes (bags)", months:{ sow:[1,2,3], plant:[2,3,4], harvest:[6,7,8] } },
      { name:"Carrots (tubs)", months:{ sow:[2,3,4], plant:[], harvest:[7,8,9] } },
      { name:"Beetroot (pots)", months:{ sow:[2,3,4,5], plant:[], harvest:[7,8,9] } },
      { name:"Lettuce", months:{ sow:[1,2,3,8,9], plant:[3,4,9], harvest:[3,4,5,6,8,9,10] } },
      { name:"Peas (dwarf)", months:{ sow:[1,2], plant:[2,3], harvest:[6,7] } },
      { name:"Garlic", months:{ sow:[8,9,10], plant:[8,9,10], harvest:[6,7] } }
    ],
    todayCombos: [
      "Lettuce + Nasturtium (trap aphids to flowers)",
      "Beetroot + Mint (aroma confusion for pests)"
    ]
  }
};

/* ===== Render: Pest Watch ===== */
function renderPestWatch(regionKey) {
  const mon = CUR_M_IDX;
  const entry = (DATA[regionKey].pestwatch[mon] || {title:"Pest Watch", items:["No major alerts. Keep an eye on slugs after rain."]});
  const el = document.getElementById('pp-pestwatch');
  el.innerHTML = `<strong>${entry.title}</strong><small>${PP_MONTHS[mon]} – small spaces edition</small><ul>${entry.items.map(i=>`<li>${i}</li>`).join("")}</ul>`;
}

/* ===== Render: Today tool (what to sow/plant now) ===== */
function renderToday(regionKey) {
  const mon = CUR_M_IDX;
  document.getElementById('pp-month-hint').textContent = `It’s ${PP_MONTHS[mon]}. Here’s what’s suitable for containers now.`;
  const list = document.getElementById('pp-today-list');
  const items = [];
  DATA[regionKey].crops.forEach(c=>{
    const inSow = (c.months.sow||[]).includes(mon);
    const inPlant = (c.months.plant||[]).includes(mon);
    const inHarvest = (c.months.harvest||[]).includes(mon);
    if (inSow || inPlant || inHarvest) {
      const flags = [
        inSow ? '<span class="pp-flag pp-flag-sow"><span class="pp-dot pp-sow"></span>Sow</span>' : '',
        inPlant ? '<span class="pp-flag pp-flag-plant"><span class="pp-dot pp-plant"></span>Plant</span>' : '',
        inHarvest ? '<span class="pp-flag pp-flag-harvest"><span class="pp-dot pp-harvest"></span>Harvest</span>' : ''
      ].filter(Boolean).join(' ');
      items.push(`<li><strong>${c.name}</strong> ${flags}</li>`);
    }
  });
  // Add 1–2 companion combos as extra hints for the month
  const combos = DATA[regionKey].todayCombos || [];
  if (combos.length) items.push(`<li><em>Companion ideas:</em> ${combos.slice(0,2).join(' • ')}</li>`);
  list.innerHTML = items.length ? items.join("") : `<li>No ideal tasks this month. Try prep/cleanup or plan ahead.</li>`;
}

/* ===== Render: Calendar grid ===== */
function renderCalendar(regionKey) {
  const wrap = document.getElementById('pp-calendar');
  const header = `
    <div class="pp-row" role="row">
      <div class="pp-head" role="columnheader">Crop</div>
      ${PP_MONTHS.map(m=>`<div class="pp-head" role="columnheader">${m}</div>`).join("")}
    </div>`;
  const rows = DATA[regionKey].crops.map(c=>{
    const cells = PP_MONTHS.map((_, idx)=>{
      const sow = (c.months.sow||[]).includes(idx);
      const plant = (c.months.plant||[]).includes(idx);
      const harv = (c.months.harvest||[]).includes(idx);
      const marks = [ sow ? "🌱" : "", plant ? "🪴" : "", harv ? "🥕" : "" ].join(" ");
      return `<div class="pp-cell" role="cell" aria-label="${c.name} ${PP_MONTHS[idx]}">${marks || ""}</div>`;
    }).join("");
    return `
      <div class="pp-row" role="row">
        <div class="pp-cell pp-crop" role="rowheader">${c.name}</div>
        ${cells}
      </div>`;
  }).join("");
  wrap.innerHTML = header + rows;
}

/* ===== Optional: swap homepage hero based on region/month ===== */
function swapHero(regionKey){
  const hero = document.getElementById('pp-hero');
  if (!hero) return;
  // Simple example image mapping (replace with your real image paths)
  const mon = CUR_M_IDX;
  const seasonTag = [11,0,1].includes(mon) ? "winter"
                   : [2,3,4].includes(mon) ? "spring"
                   : [5,6,7].includes(mon) ? "summer"
                   : "autumn";
  hero.src = `/assets/images/hero/${regionKey}-${seasonTag}.jpg`;
  hero.alt = `Seasonal container garden – ${regionKey} • ${seasonTag}`;
}

/* ===== Init & events ===== */
function initPPSeasonal(){
  const sel = document.getElementById('pp-region');
  const region = (localStorage.getItem('pp-region') || 'scotland');
  sel.value = region;
  const renderAll = () => {
    const r = sel.value;
    localStorage.setItem('pp-region', r);
    renderPestWatch(r);
    renderToday(r);
    renderCalendar(r);
    swapHero(r);
  };
  sel.addEventListener('change', renderAll);
  renderAll();
}

document.addEventListener('DOMContentLoaded', initPPSeasonal);
</script>
