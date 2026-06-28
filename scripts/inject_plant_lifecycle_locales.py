"""Inject lifecycle + hardiness translations into all non-English locales."""
import re, pathlib

LOCALES = pathlib.Path("/app/frontend/src/i18n/locales")

# {lc_code: {short_key: translation}}
T = {
 "de": {"lifecycle.label":"Lebenszyklus","annual":"Einjährig","biennial":"Zweijährig","perennial":"Mehrjährig","hardiness.label":"Winterhärte","hardy":"Winterhart","half-hardy":"Bedingt winterhart","tender":"Frostempfindlich","indoor":"Zimmerpflanze","plant.lifecycle":"Lebenszyklus","plant.hardiness":"Winterhärte"},
 "es": {"lifecycle.label":"Ciclo de vida","annual":"Anual","biennial":"Bienal","perennial":"Perenne","hardiness.label":"Rusticidad","hardy":"Resistente","half-hardy":"Semi-resistente","tender":"Sensible","indoor":"Interior","plant.lifecycle":"Ciclo de vida","plant.hardiness":"Rusticidad"},
 "fr": {"lifecycle.label":"Cycle de vie","annual":"Annuelle","biennial":"Bisannuelle","perennial":"Vivace","hardiness.label":"Rusticité","hardy":"Rustique","half-hardy":"Semi-rustique","tender":"Gélive","indoor":"Intérieur","plant.lifecycle":"Cycle de vie","plant.hardiness":"Rusticité"},
 "it": {"lifecycle.label":"Ciclo vitale","annual":"Annuale","biennial":"Biennale","perennial":"Perenne","hardiness.label":"Rusticità","hardy":"Rustica","half-hardy":"Semi-rustica","tender":"Delicata","indoor":"Da interno","plant.lifecycle":"Ciclo vitale","plant.hardiness":"Rusticità"},
 "pt": {"lifecycle.label":"Ciclo de vida","annual":"Anual","biennial":"Bienal","perennial":"Perene","hardiness.label":"Rusticidade","hardy":"Rústica","half-hardy":"Semi-rústica","tender":"Sensível","indoor":"Interior","plant.lifecycle":"Ciclo de vida","plant.hardiness":"Rusticidade"},
 "nl": {"lifecycle.label":"Levenscyclus","annual":"Eenjarig","biennial":"Tweejarig","perennial":"Vaste plant","hardiness.label":"Winterhardheid","hardy":"Winterhard","half-hardy":"Halfwinterhard","tender":"Vorstgevoelig","indoor":"Binnen","plant.lifecycle":"Levenscyclus","plant.hardiness":"Winterhardheid"},
 "pl": {"lifecycle.label":"Cykl życia","annual":"Roczna","biennial":"Dwuletnia","perennial":"Wieloletnia","hardiness.label":"Mrozoodporność","hardy":"Mrozoodporna","half-hardy":"Średnio odporna","tender":"Wrażliwa","indoor":"Doniczkowa","plant.lifecycle":"Cykl życia","plant.hardiness":"Mrozoodporność"},
 "ru": {"lifecycle.label":"Жизненный цикл","annual":"Однолетник","biennial":"Двулетник","perennial":"Многолетник","hardiness.label":"Зимостойкость","hardy":"Зимостойкая","half-hardy":"Среднезимостойкая","tender":"Незимостойкая","indoor":"Комнатная","plant.lifecycle":"Жизненный цикл","plant.hardiness":"Зимостойкость"},
 "zh": {"lifecycle.label":"生命周期","annual":"一年生","biennial":"二年生","perennial":"多年生","hardiness.label":"耐寒性","hardy":"耐寒","half-hardy":"半耐寒","tender":"不耐寒","indoor":"室内","plant.lifecycle":"生命周期","plant.hardiness":"耐寒性"},
 "ja": {"lifecycle.label":"ライフサイクル","annual":"一年草","biennial":"二年草","perennial":"多年草","hardiness.label":"耐寒性","hardy":"耐寒性あり","half-hardy":"半耐寒性","tender":"非耐寒性","indoor":"室内栽培","plant.lifecycle":"ライフサイクル","plant.hardiness":"耐寒性"},
 "ko": {"lifecycle.label":"생활 주기","annual":"일년초","biennial":"이년초","perennial":"다년초","hardiness.label":"내한성","hardy":"내한성","half-hardy":"반내한성","tender":"비내한성","indoor":"실내용","plant.lifecycle":"생활 주기","plant.hardiness":"내한성"},
 "ar": {"lifecycle.label":"دورة الحياة","annual":"حولية","biennial":"ثنائية الحول","perennial":"معمرة","hardiness.label":"تحمل البرد","hardy":"تتحمل البرد","half-hardy":"نصف متحملة","tender":"حساسة للصقيع","indoor":"داخلي","plant.lifecycle":"دورة الحياة","plant.hardiness":"تحمل البرد"},
 "hi": {"lifecycle.label":"जीवन चक्र","annual":"वार्षिक","biennial":"द्विवार्षिक","perennial":"बहुवर्षीय","hardiness.label":"ठंड सहनशीलता","hardy":"कठोर","half-hardy":"मध्यम कठोर","tender":"नाजुक","indoor":"इंडोर","plant.lifecycle":"जीवन चक्र","plant.hardiness":"ठंड सहनशीलता"},
 "bn": {"lifecycle.label":"জীবনচক্র","annual":"বার্ষিক","biennial":"দ্বিবার্ষিক","perennial":"বহুবর্ষজীবী","hardiness.label":"শীত সহনশীলতা","hardy":"শক্ত","half-hardy":"আধা-শক্ত","tender":"কোমল","indoor":"ইনডোর","plant.lifecycle":"জীবনচক্র","plant.hardiness":"শীত সহনশীলতা"},
 "tr": {"lifecycle.label":"Yaşam döngüsü","annual":"Tek yıllık","biennial":"İki yıllık","perennial":"Çok yıllık","hardiness.label":"Soğuğa dayanıklılık","hardy":"Soğuğa dayanıklı","half-hardy":"Yarı dayanıklı","tender":"Hassas","indoor":"İç mekan","plant.lifecycle":"Yaşam döngüsü","plant.hardiness":"Soğuğa dayanıklılık"},
 "vi": {"lifecycle.label":"Vòng đời","annual":"Một năm","biennial":"Hai năm","perennial":"Lâu năm","hardiness.label":"Chịu lạnh","hardy":"Chịu lạnh tốt","half-hardy":"Chịu lạnh trung bình","tender":"Không chịu lạnh","indoor":"Trong nhà","plant.lifecycle":"Vòng đời","plant.hardiness":"Chịu lạnh"},
 "th": {"lifecycle.label":"วงจรชีวิต","annual":"ฤดูเดียว","biennial":"สองปี","perennial":"ยืนต้น","hardiness.label":"ทนหนาว","hardy":"ทนหนาวได้","half-hardy":"ทนหนาวปานกลาง","tender":"ไม่ทนหนาว","indoor":"ในบ้าน","plant.lifecycle":"วงจรชีวิต","plant.hardiness":"ทนหนาว"},
 "id": {"lifecycle.label":"Siklus hidup","annual":"Setahun","biennial":"Dua tahun","perennial":"Tahunan","hardiness.label":"Ketahanan dingin","hardy":"Tahan dingin","half-hardy":"Setengah tahan","tender":"Tidak tahan","indoor":"Dalam ruangan","plant.lifecycle":"Siklus hidup","plant.hardiness":"Ketahanan dingin"},
 "ms": {"lifecycle.label":"Kitaran hidup","annual":"Setahun","biennial":"Dua tahun","perennial":"Saka","hardiness.label":"Ketahanan sejuk","hardy":"Tahan sejuk","half-hardy":"Separuh tahan","tender":"Tidak tahan","indoor":"Dalam rumah","plant.lifecycle":"Kitaran hidup","plant.hardiness":"Ketahanan sejuk"},
 "tl": {"lifecycle.label":"Ikot ng buhay","annual":"Pang-isang taon","biennial":"Dalawang-taon","perennial":"Pangmatagalan","hardiness.label":"Tibay sa lamig","hardy":"Matibay","half-hardy":"Bahagyang matibay","tender":"Sensitibo","indoor":"Loob","plant.lifecycle":"Ikot ng buhay","plant.hardiness":"Tibay sa lamig"},
 "sv": {"lifecycle.label":"Livscykel","annual":"Ettåring","biennial":"Tvåårig","perennial":"Perenn","hardiness.label":"Härdighet","hardy":"Härdig","half-hardy":"Halvhärdig","tender":"Frostkänslig","indoor":"Inomhus","plant.lifecycle":"Livscykel","plant.hardiness":"Härdighet"},
 "nb": {"lifecycle.label":"Livssyklus","annual":"Ettårig","biennial":"Toårig","perennial":"Flerårig","hardiness.label":"Herdighet","hardy":"Herdig","half-hardy":"Halvherdig","tender":"Frostømfintlig","indoor":"Innendørs","plant.lifecycle":"Livssyklus","plant.hardiness":"Herdighet"},
 "da": {"lifecycle.label":"Livscyklus","annual":"Etårig","biennial":"Toårig","perennial":"Flerårig","hardiness.label":"Hårdførhed","hardy":"Hårdfør","half-hardy":"Halvhårdfør","tender":"Frostfølsom","indoor":"Indendørs","plant.lifecycle":"Livscyklus","plant.hardiness":"Hårdførhed"},
 "fi": {"lifecycle.label":"Elinkaari","annual":"Yksivuotinen","biennial":"Kaksivuotinen","perennial":"Monivuotinen","hardiness.label":"Talvenkestävyys","hardy":"Talvenkestävä","half-hardy":"Puolihalla","tender":"Hallanarka","indoor":"Sisätila","plant.lifecycle":"Elinkaari","plant.hardiness":"Talvenkestävyys"},
 "is": {"lifecycle.label":"Lífsferill","annual":"Einærar","biennial":"Tvíærar","perennial":"Fjölærar","hardiness.label":"Vetrarþol","hardy":"Vetrarþolið","half-hardy":"Hálfþolið","tender":"Frostnæmt","indoor":"Innan dyra","plant.lifecycle":"Lífsferill","plant.hardiness":"Vetrarþol"},
 "cs": {"lifecycle.label":"Životní cyklus","annual":"Jednoletka","biennial":"Dvouletka","perennial":"Trvalka","hardiness.label":"Mrazuvzdornost","hardy":"Mrazuvzdorná","half-hardy":"Polomrazuvzdorná","tender":"Choulostivá","indoor":"Pokojová","plant.lifecycle":"Životní cyklus","plant.hardiness":"Mrazuvzdornost"},
 "sk": {"lifecycle.label":"Životný cyklus","annual":"Jednoročka","biennial":"Dvojročka","perennial":"Trvalka","hardiness.label":"Mrazuvzdornosť","hardy":"Mrazuvzdorná","half-hardy":"Polomrazuvzdorná","tender":"Citlivá","indoor":"Izbová","plant.lifecycle":"Životný cyklus","plant.hardiness":"Mrazuvzdornosť"},
 "sl": {"lifecycle.label":"Življenjski cikel","annual":"Enoletnica","biennial":"Dvoletnica","perennial":"Trajnica","hardiness.label":"Mrazoodpornost","hardy":"Mrazoodporna","half-hardy":"Polmrazoodporna","tender":"Občutljiva","indoor":"Sobna","plant.lifecycle":"Življenjski cikel","plant.hardiness":"Mrazoodpornost"},
 "hr": {"lifecycle.label":"Životni ciklus","annual":"Jednogodišnja","biennial":"Dvogodišnja","perennial":"Trajnica","hardiness.label":"Otpornost na zimu","hardy":"Otporna","half-hardy":"Polu-otporna","tender":"Osjetljiva","indoor":"Sobna","plant.lifecycle":"Životni ciklus","plant.hardiness":"Otpornost na zimu"},
 "ro": {"lifecycle.label":"Ciclu de viață","annual":"Anuală","biennial":"Bienală","perennial":"Perenă","hardiness.label":"Rezistență la frig","hardy":"Rezistentă","half-hardy":"Semi-rezistentă","tender":"Sensibilă","indoor":"De interior","plant.lifecycle":"Ciclu de viață","plant.hardiness":"Rezistență la frig"},
 "hu": {"lifecycle.label":"Életciklus","annual":"Egynyári","biennial":"Kétnyári","perennial":"Évelő","hardiness.label":"Télállóság","hardy":"Télálló","half-hardy":"Félig télálló","tender":"Fagyérzékeny","indoor":"Beltéri","plant.lifecycle":"Életciklus","plant.hardiness":"Télállóság"},
 "el": {"lifecycle.label":"Κύκλος ζωής","annual":"Ετήσιο","biennial":"Διετές","perennial":"Πολυετές","hardiness.label":"Αντοχή στο κρύο","hardy":"Ανθεκτικό","half-hardy":"Μέτρια ανθεκτικό","tender":"Ευαίσθητο","indoor":"Εσωτερικού χώρου","plant.lifecycle":"Κύκλος ζωής","plant.hardiness":"Αντοχή στο κρύο"},
 "bg": {"lifecycle.label":"Жизнен цикъл","annual":"Едногодишно","biennial":"Двугодишно","perennial":"Многогодишно","hardiness.label":"Студоустойчивост","hardy":"Студоустойчиво","half-hardy":"Полу-студоустойчиво","tender":"Чувствително","indoor":"За закрито","plant.lifecycle":"Жизнен цикъл","plant.hardiness":"Студоустойчивост"},
 "uk": {"lifecycle.label":"Життєвий цикл","annual":"Однорічник","biennial":"Дворічник","perennial":"Багаторічник","hardiness.label":"Морозостійкість","hardy":"Морозостійкий","half-hardy":"Помірно стійкий","tender":"Чутливий","indoor":"Кімнатний","plant.lifecycle":"Життєвий цикл","plant.hardiness":"Морозостійкість"},
 "be": {"lifecycle.label":"Жыццёвы цыкл","annual":"Аднагадовая","biennial":"Двухгадовая","perennial":"Шматгадовая","hardiness.label":"Маразаўстойлівасць","hardy":"Маразаўстойлівая","half-hardy":"Сярэдне-стойкая","tender":"Адчувальная","indoor":"Пакаёвая","plant.lifecycle":"Жыццёвы цыкл","plant.hardiness":"Маразаўстойлівасць"},
 "mt": {"lifecycle.label":"Ċiklu tal-ħajja","annual":"Annwali","biennial":"Bienjali","perennial":"Perennali","hardiness.label":"Reżistenza għall-bard","hardy":"Reżistenti","half-hardy":"Nofs reżistenti","tender":"Sensittiva","indoor":"Ġewwa","plant.lifecycle":"Ċiklu tal-ħajja","plant.hardiness":"Reżistenza għall-bard"},
 "ga": {"lifecycle.label":"Saolré","annual":"Bliantúil","biennial":"Débhliantúil","perennial":"Ilbhliantúil","hardiness.label":"Buaine","hardy":"Buan","half-hardy":"Leath-bhuan","tender":"Bog","indoor":"Faoi dhíon","plant.lifecycle":"Saolré","plant.hardiness":"Buaine"},
 "gd": {"lifecycle.label":"Cuairt-bheatha","annual":"Bliadhnail","biennial":"Dà-bhliadhnail","perennial":"Maireannach","hardiness.label":"Cruadalas","hardy":"Cruadalach","half-hardy":"Leth-chruadalach","tender":"Sèimh","indoor":"A-staigh","plant.lifecycle":"Cuairt-bheatha","plant.hardiness":"Cruadalas"},
 "cy": {"lifecycle.label":"Cylch bywyd","annual":"Blynyddol","biennial":"Dwy flynyddol","perennial":"Lluosflwydd","hardiness.label":"Caledwch","hardy":"Caled","half-hardy":"Lled-galed","tender":"Tyner","indoor":"Dan do","plant.lifecycle":"Cylch bywyd","plant.hardiness":"Caledwch"},
 "mi": {"lifecycle.label":"Hurihanga ora","annual":"Tau kotahi","biennial":"Tau rua","perennial":"Tau-roa","hardiness.label":"Manawanui ki te makariri","hardy":"Manawanui","half-hardy":"Haurua manawanui","tender":"Ngāwari","indoor":"Roto whare","plant.lifecycle":"Hurihanga ora","plant.hardiness":"Manawanui ki te makariri"},
 "gu": {"lifecycle.label":"જીવનચક્ર","annual":"વાર્ષિક","biennial":"દ્વિવાર્ષિક","perennial":"બહુવર્ષાયુ","hardiness.label":"ઠંડી સહનશીલતા","hardy":"કઠોર","half-hardy":"અર્ધ-કઠોર","tender":"નાજુક","indoor":"ઇન્ડોર","plant.lifecycle":"જીવનચક્ર","plant.hardiness":"ઠંડી સહનશીલતા"},
 "kn": {"lifecycle.label":"ಜೀವನ ಚಕ್ರ","annual":"ವಾರ್ಷಿಕ","biennial":"ದ್ವಿವಾರ್ಷಿಕ","perennial":"ಬಹುವಾರ್ಷಿಕ","hardiness.label":"ಶೀತ ಸಹಿಷ್ಣುತೆ","hardy":"ಗಟ್ಟಿ","half-hardy":"ಅರ್ಧ ಗಟ್ಟಿ","tender":"ಸೂಕ್ಷ್ಮ","indoor":"ಒಳಾಂಗಣ","plant.lifecycle":"ಜೀವನ ಚಕ್ರ","plant.hardiness":"ಶೀತ ಸಹಿಷ್ಣುತೆ"},
 "ml": {"lifecycle.label":"ജീവിത ചക്രം","annual":"വാർഷിക","biennial":"ദ്വിവാർഷിക","perennial":"ബഹുവാർഷിക","hardiness.label":"തണുപ്പ് സഹിഷ്ണുത","hardy":"പ്രതിരോധശേഷിയുള്ള","half-hardy":"അർദ്ധ-പ്രതിരോധശേഷിയുള്ള","tender":"ലോലമായ","indoor":"ഇൻഡോർ","plant.lifecycle":"ജീവിത ചക്രം","plant.hardiness":"തണുപ്പ് സഹിഷ്ണുത"},
 "mr": {"lifecycle.label":"जीवनचक्र","annual":"वार्षिक","biennial":"द्विवार्षिक","perennial":"बहुवार्षिक","hardiness.label":"थंडी सहनशीलता","hardy":"कठोर","half-hardy":"अर्ध-कठोर","tender":"नाजूक","indoor":"इनडोर","plant.lifecycle":"जीवनचक्र","plant.hardiness":"थंडी सहनशीलता"},
 "pa": {"lifecycle.label":"ਜੀਵਨ ਚੱਕਰ","annual":"ਸਾਲਾਨਾ","biennial":"ਦੋ-ਸਾਲਾ","perennial":"ਬਹੁ-ਸਾਲਾ","hardiness.label":"ਠੰਡ ਸਹਿਣਸ਼ੀਲਤਾ","hardy":"ਕਠੋਰ","half-hardy":"ਅੱਧ-ਕਠੋਰ","tender":"ਨਾਜ਼ੁਕ","indoor":"ਅੰਦਰੂਨੀ","plant.lifecycle":"ਜੀਵਨ ਚੱਕਰ","plant.hardiness":"ਠੰਡ ਸਹਿਣਸ਼ੀਲਤਾ"},
 "ta": {"lifecycle.label":"வாழ்க்கைச் சுழற்சி","annual":"வருடாந்திர","biennial":"இரு வருட","perennial":"பல வருட","hardiness.label":"குளிர் தாங்கும் திறன்","hardy":"வலிமையான","half-hardy":"அரை-வலிமையான","tender":"நாஜுக்கான","indoor":"உள்வீட்டில்","plant.lifecycle":"வாழ்க்கைச் சுழற்சி","plant.hardiness":"குளிர் தாங்கும் திறன்"},
 "te": {"lifecycle.label":"జీవన చక్రం","annual":"వార్షిక","biennial":"ద్వివార్షిక","perennial":"బహువార్షిక","hardiness.label":"చలి తట్టుకునే శక్తి","hardy":"దృఢమైన","half-hardy":"అర్ధ-దృఢమైన","tender":"సుకుమార","indoor":"ఇంటి లోపల","plant.lifecycle":"జీవన చక్రం","plant.hardiness":"చలి తట్టుకునే శక్తి"},
 "ur": {"lifecycle.label":"زندگی کا چکر","annual":"سالانہ","biennial":"دو سالہ","perennial":"بارہماسی","hardiness.label":"سردی برداشت","hardy":"سخت جان","half-hardy":"نیم سخت","tender":"نازک","indoor":"اندرونی","plant.lifecycle":"زندگی کا چکر","plant.hardiness":"سردی برداشت"},
 "az": {"lifecycle.label":"Həyat dövrü","annual":"Birillik","biennial":"İkillik","perennial":"Çoxillik","hardiness.label":"Şaxtaya davamlılıq","hardy":"Şaxtaya davamlı","half-hardy":"Yarı davamlı","tender":"Həssas","indoor":"Otaq bitkisi","plant.lifecycle":"Həyat dövrü","plant.hardiness":"Şaxtaya davamlılıq"},
 "kk": {"lifecycle.label":"Өмірлік цикл","annual":"Біржылдық","biennial":"Екіжылдық","perennial":"Көпжылдық","hardiness.label":"Қысқа төзімділік","hardy":"Қысқа төзімді","half-hardy":"Жартылай төзімді","tender":"Сезімтал","indoor":"Бөлме өсімдігі","plant.lifecycle":"Өмірлік цикл","plant.hardiness":"Қысқа төзімділік"},
 "ky": {"lifecycle.label":"Жашоо цикли","annual":"Бир жылдык","biennial":"Эки жылдык","perennial":"Көп жылдык","hardiness.label":"Кышка туруктуулук","hardy":"Кышка туруктуу","half-hardy":"Жарым туруктуу","tender":"Назик","indoor":"Бөлмөдө","plant.lifecycle":"Жашоо цикли","plant.hardiness":"Кышка туруктуулук"},
 "uz": {"lifecycle.label":"Hayot tsikli","annual":"Bir yillik","biennial":"Ikki yillik","perennial":"Ko‘p yillik","hardiness.label":"Sovuqqa chidamlilik","hardy":"Sovuqqa chidamli","half-hardy":"Yarim chidamli","tender":"Nozik","indoor":"Xona o‘simligi","plant.lifecycle":"Hayot tsikli","plant.hardiness":"Sovuqqa chidamlilik"},
 "hy": {"lifecycle.label":"Կենսացիկլ","annual":"Միամյա","biennial":"Երկամյա","perennial":"Բազմամյա","hardiness.label":"Ցրտադիմացկունություն","hardy":"Ցրտադիմացկուն","half-hardy":"Կիսադիմացկուն","tender":"Զգայուն","indoor":"Փակ տարածքի","plant.lifecycle":"Կենսացիկլ","plant.hardiness":"Ցրտադիմացկունություն"},
 "ka": {"lifecycle.label":"სასიცოცხლო ციკლი","annual":"ერთწლიანი","biennial":"ორწლიანი","perennial":"მრავალწლიანი","hardiness.label":"ყინვაგამძლეობა","hardy":"ყინვაგამძლე","half-hardy":"ნახევრად გამძლე","tender":"მგრძნობიარე","indoor":"შინაური","plant.lifecycle":"სასიცოცხლო ციკლი","plant.hardiness":"ყინვაგამძლეობა"},
 "lt": {"lifecycle.label":"Gyvavimo ciklas","annual":"Vienametis","biennial":"Dvimetis","perennial":"Daugiametis","hardiness.label":"Atsparumas šalčiui","hardy":"Atsparus","half-hardy":"Vidutiniškai atsparus","tender":"Jautrus","indoor":"Vidaus","plant.lifecycle":"Gyvavimo ciklas","plant.hardiness":"Atsparumas šalčiui"},
 "lv": {"lifecycle.label":"Dzīves cikls","annual":"Viengadīgs","biennial":"Divgadīgs","perennial":"Daudzgadīgs","hardiness.label":"Salizturība","hardy":"Salizturīgs","half-hardy":"Vidēji izturīgs","tender":"Jūtīgs","indoor":"Iekštelpu","plant.lifecycle":"Dzīves cikls","plant.hardiness":"Salizturība"},
 "et": {"lifecycle.label":"Elutsükkel","annual":"Üheaastane","biennial":"Kaheaastane","perennial":"Mitmeaastane","hardiness.label":"Külmakindlus","hardy":"Külmakindel","half-hardy":"Poolkülmakindel","tender":"Õrn","indoor":"Toataim","plant.lifecycle":"Elutsükkel","plant.hardiness":"Külmakindlus"},
}

# Map dotted key suffix → simple key in T[lang]
SUFFIXES = [
    ("plants.lifecycle.label", "lifecycle.label"),
    ("plants.lifecycle.annual", "annual"),
    ("plants.lifecycle.biennial", "biennial"),
    ("plants.lifecycle.perennial", "perennial"),
    ("plants.hardiness.label", "hardiness.label"),
    ("plants.hardiness.hardy", "hardy"),
    ("plants.hardiness.half-hardy", "half-hardy"),
    ("plants.hardiness.tender", "tender"),
    ("plants.hardiness.indoor", "indoor"),
    ("plant.lifecycle", "plant.lifecycle"),
    ("plant.hardiness", "plant.hardiness"),
]

counts = {"ok": 0, "skip-exists": 0, "skip-no-trans": 0, "no-anchor": 0}
for f in sorted(LOCALES.glob("*.js")):
    if f.stem == "en":
        continue
    txt = f.read_text(encoding="utf-8")
    if "plants.lifecycle.annual" in txt:
        counts["skip-exists"] += 1; continue
    if f.stem not in T:
        counts["skip-no-trans"] += 1; print("NO TRANS", f.stem); continue
    block_lines = []
    for full, short in SUFFIXES:
        val = T[f.stem][short].replace('"', '\\"')
        block_lines.append(f'  "{full}": "{val}",')
    block = "\n".join(block_lines)
    new_txt, n = re.subn(
        r'(^[ \t]*"plants\.subfilter\.edible-petals":[^\n]*\n)',
        rf"\1{block}\n",
        txt, count=1, flags=re.MULTILINE
    )
    if n == 1:
        f.write_text(new_txt, encoding="utf-8")
        counts["ok"] += 1
    else:
        counts["no-anchor"] += 1; print("NO ANCHOR", f.stem)

print(counts)
