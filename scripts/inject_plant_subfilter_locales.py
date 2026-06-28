"""Inject `plants.subfilter.*` translations into all non-English locales."""
import re, pathlib

LOCALES = pathlib.Path("/app/frontend/src/i18n/locales")

# Curated translations for the 9 new sub-filter keys.
T = {
  "de": {"bulbs":"Zwiebeln & Knollen","spires":"Blütenstände","fillers":"Füller","everlasting":"Trockenblumen","perennials":"Stauden","fragrant":"Duftend","drought":"Trockenheitsverträglich","shade":"Schattenverträglich","edible-petals":"Essbare Blütenblätter"},
  "es": {"bulbs":"Bulbos y cormos","spires":"Espigas","fillers":"Rellenos","everlasting":"Siemprevivas","perennials":"Perennes","fragrant":"Fragantes","drought":"Resistentes a sequía","shade":"Tolerantes a sombra","edible-petals":"Pétalos comestibles"},
  "fr": {"bulbs":"Bulbes et cormes","spires":"Épis","fillers":"Remplissages","everlasting":"Immortelles","perennials":"Vivaces","fragrant":"Parfumées","drought":"Résistantes à la sécheresse","shade":"Tolérantes à l’ombre","edible-petals":"Pétales comestibles"},
  "it": {"bulbs":"Bulbi e cormi","spires":"Spighe","fillers":"Riempitivi","everlasting":"Sempreverdi/secchi","perennials":"Perenni","fragrant":"Profumati","drought":"Resistenti alla siccità","shade":"Tolleranti all’ombra","edible-petals":"Petali commestibili"},
  "pt": {"bulbs":"Bulbos e cormos","spires":"Espigas","fillers":"Preenchimentos","everlasting":"Perpétuas","perennials":"Perenes","fragrant":"Perfumadas","drought":"Resistentes à seca","shade":"Tolerantes à sombra","edible-petals":"Pétalas comestíveis"},
  "nl": {"bulbs":"Bollen en knollen","spires":"Aren","fillers":"Vulplanten","everlasting":"Eeuwig bloeiend","perennials":"Vaste planten","fragrant":"Geurig","drought":"Droogtebestendig","shade":"Schaduwminnend","edible-petals":"Eetbare bloemblaadjes"},
  "pl": {"bulbs":"Cebule i bulwy","spires":"Kłosy","fillers":"Wypełniacze","everlasting":"Suszki","perennials":"Byliny","fragrant":"Pachnące","drought":"Odporne na suszę","shade":"Lubiące cień","edible-petals":"Jadalne płatki"},
  "ru": {"bulbs":"Луковичные и клубневые","spires":"Соцветия-свечи","fillers":"Наполнители","everlasting":"Сухоцветы","perennials":"Многолетники","fragrant":"Ароматные","drought":"Засухоустойчивые","shade":"Теневыносливые","edible-petals":"Съедобные лепестки"},
  "zh": {"bulbs":"球根类","spires":"穗状花","fillers":"配花","everlasting":"干花","perennials":"宿根","fragrant":"芳香","drought":"耐旱","shade":"耐阴","edible-petals":"可食花瓣"},
  "ja": {"bulbs":"球根・地下茎","spires":"穂状花","fillers":"フィラー","everlasting":"ドライフラワー","perennials":"宿根草","fragrant":"芳香","drought":"耐乾性","shade":"半日陰向き","edible-petals":"食用花弁"},
  "ko": {"bulbs":"구근 및 알줄기","spires":"수상꽃차례","fillers":"보조 소재","everlasting":"드라이플라워","perennials":"숙근","fragrant":"향기로움","drought":"내건성","shade":"음지 친화","edible-petals":"식용 꽃잎"},
  "ar": {"bulbs":"بصيلات وكورمات","spires":"سنابل","fillers":"حشو","everlasting":"دائمة الجمال","perennials":"معمرة","fragrant":"عطرية","drought":"تتحمل الجفاف","shade":"تتحمل الظل","edible-petals":"بتلات صالحة للأكل"},
  "hi": {"bulbs":"बल्ब और कॉर्म","spires":"लंबे फूल","fillers":"भराव","everlasting":"सूखने वाले","perennials":"बहुवर्षीय","fragrant":"सुगंधित","drought":"सूखा सहिष्णु","shade":"छाया अनुकूल","edible-petals":"खाद्य पंखुड़ियाँ"},
  "bn": {"bulbs":"কন্দ ও কর্ম","spires":"কাণ্ডফুল","fillers":"পরিপূরক","everlasting":"শুকনো ফুল","perennials":"বহুবর্ষজীবী","fragrant":"সুগন্ধি","drought":"খরা সহিষ্ণু","shade":"ছায়া উপযুক্ত","edible-petals":"ভোজ্য পাপড়ি"},
  "tr": {"bulbs":"Soğanlı ve yumrulu","spires":"Başaklı","fillers":"Dolgu","everlasting":"Kuru çiçek","perennials":"Çok yıllık","fragrant":"Kokulu","drought":"Kuraklığa dayanıklı","shade":"Gölgeyi seven","edible-petals":"Yenebilir taç yapraklar"},
  "vi": {"bulbs":"Củ và thân hành","spires":"Cụm hoa thẳng","fillers":"Phụ kiện","everlasting":"Hoa khô","perennials":"Cây lâu năm","fragrant":"Có hương","drought":"Chịu hạn","shade":"Ưa bóng","edible-petals":"Cánh hoa ăn được"},
  "th": {"bulbs":"หัวและเหง้า","spires":"ช่อตั้ง","fillers":"ดอกเสริม","everlasting":"แห้งเก็บได้","perennials":"ยืนต้น","fragrant":"มีกลิ่นหอม","drought":"ทนแล้ง","shade":"ชอบร่ม","edible-petals":"กลีบกินได้"},
  "id": {"bulbs":"Umbi dan kormus","spires":"Bunga tegak","fillers":"Pengisi","everlasting":"Bunga kering","perennials":"Tanaman tahunan","fragrant":"Wangi","drought":"Tahan kering","shade":"Toleran naungan","edible-petals":"Kelopak yang bisa dimakan"},
  "ms": {"bulbs":"Umbi dan kormus","spires":"Bunga tegak","fillers":"Pengisi","everlasting":"Bunga kering","perennials":"Pokok saka","fragrant":"Wangi","drought":"Tahan kemarau","shade":"Tahan teduh","edible-petals":"Kelopak boleh dimakan"},
  "tl": {"bulbs":"Bombilya at cormus","spires":"Matataas na bulaklak","fillers":"Panghalo","everlasting":"Walang kupas","perennials":"Pangmatagalan","fragrant":"Mabango","drought":"Tahanan sa tagtuyot","shade":"Mahilig sa lilim","edible-petals":"Nakakaing talulot"},
  "sv": {"bulbs":"Lökar och knölar","spires":"Ax","fillers":"Fyllning","everlasting":"Eviga blommor","perennials":"Perenner","fragrant":"Doftande","drought":"Torktåliga","shade":"Skuggtåliga","edible-petals":"Ätbara kronblad"},
  "nb": {"bulbs":"Løker og knoller","spires":"Aks","fillers":"Fyllblomster","everlasting":"Evighetsblomster","perennials":"Stauder","fragrant":"Duftende","drought":"Tørketålige","shade":"Skyggetålige","edible-petals":"Spiselige kronblad"},
  "da": {"bulbs":"Løg og knolde","spires":"Aks","fillers":"Fyldeblomster","everlasting":"Tørreblomster","perennials":"Stauder","fragrant":"Duftende","drought":"Tørkeresistente","shade":"Skyggetolerante","edible-petals":"Spiselige kronblade"},
  "fi": {"bulbs":"Sipulit ja mukulat","spires":"Tähkät","fillers":"Täytteet","everlasting":"Ikikukat","perennials":"Perennat","fragrant":"Tuoksuvat","drought":"Kuivuutta kestävät","shade":"Varjoa sietävät","edible-petals":"Syötävät terälehdet"},
  "is": {"bulbs":"Laukar og hnýði","spires":"Stönglar","fillers":"Fylling","everlasting":"Þurrblóm","perennials":"Fjölær","fragrant":"Ilmandi","drought":"Þolið þurrk","shade":"Skuggaþolið","edible-petals":"Æt krónublöð"},
  "cs": {"bulbs":"Cibuloviny a hlízy","spires":"Klasy","fillers":"Doplňky","everlasting":"Suchá květina","perennials":"Trvalky","fragrant":"Vonné","drought":"Suchovzdorné","shade":"Stínomilné","edible-petals":"Jedlé okvětní lístky"},
  "sk": {"bulbs":"Cibuľoviny a hľuzy","spires":"Klasy","fillers":"Doplnky","everlasting":"Suché kvety","perennials":"Trvalky","fragrant":"Voňavé","drought":"Odolné voči suchu","shade":"Tieňomilné","edible-petals":"Jedlé okvetné lístky"},
  "sl": {"bulbs":"Čebulnice in gomolji","spires":"Klasi","fillers":"Polnila","everlasting":"Suho cvetje","perennials":"Trajnice","fragrant":"Dišeče","drought":"Suši odporne","shade":"Senco prenašajoče","edible-petals":"Užitni cvetni listi"},
  "hr": {"bulbs":"Lukovice i gomolji","spires":"Klasovi","fillers":"Punila","everlasting":"Suho cvijeće","perennials":"Trajnice","fragrant":"Mirisno","drought":"Otporno na sušu","shade":"Voli sjenu","edible-petals":"Jestive latice"},
  "ro": {"bulbs":"Bulbi și cormi","spires":"Spice","fillers":"Umpluturi","everlasting":"Flori uscate","perennials":"Perene","fragrant":"Parfumate","drought":"Rezistente la secetă","shade":"Tolerante la umbră","edible-petals":"Petale comestibile"},
  "hu": {"bulbs":"Hagymások és gumósok","spires":"Kalász","fillers":"Töltelékek","everlasting":"Szárazvirágok","perennials":"Évelők","fragrant":"Illatos","drought":"Szárazságtűrő","shade":"Árnyéktűrő","edible-petals":"Ehető szirmok"},
  "el": {"bulbs":"Βολβοί και κόρμοι","spires":"Στάχυς","fillers":"Πλήρωσης","everlasting":"Αμάραντα","perennials":"Πολυετή","fragrant":"Αρωματικά","drought":"Ανθεκτικά στην ξηρασία","shade":"Σκιόφιλα","edible-petals":"Βρώσιμα πέταλα"},
  "bg": {"bulbs":"Луковични и грудкови","spires":"Класове","fillers":"Допълващи","everlasting":"Сухоцветни","perennials":"Многогодишни","fragrant":"Ароматни","drought":"Сухоустойчиви","shade":"Сенколюбиви","edible-petals":"Ядливи венчелистчета"},
  "uk": {"bulbs":"Цибулинні та бульбові","spires":"Колоски","fillers":"Наповнювачі","everlasting":"Сухоцвіти","perennials":"Багаторічники","fragrant":"Ароматні","drought":"Посухостійкі","shade":"Тіньовитривалі","edible-petals":"Їстівні пелюстки"},
  "be": {"bulbs":"Цыбулінныя і клубняплодныя","spires":"Каласы","fillers":"Дапаўненні","everlasting":"Сухацвет","perennials":"Шматгадовыя","fragrant":"Духмяныя","drought":"Засухаўстойлівыя","shade":"Ценявынослівыя","edible-petals":"Ядомыя пялёсткі"},
  "mt": {"bulbs":"Basal u kormi","spires":"Spigi","fillers":"Mili","everlasting":"Fjuri xotti","perennials":"Pjanti perennali","fragrant":"Tfuħ","drought":"Reżistenti għan-nixfa","shade":"Tolleranti għad-dell","edible-petals":"Petali tajbin għall-ikel"},
  "ga": {"bulbs":"Bleibíní agus coirm","spires":"Spuiríní","fillers":"Líontóirí","everlasting":"Bláthanna síoraí","perennials":"Ilbhliantúla","fragrant":"Cumhra","drought":"Triomach-fhulangach","shade":"Scáth-fhulangach","edible-petals":"Peitil inite"},
  "gd": {"bulbs":"Bleibean is coirm","spires":"Cuilbh","fillers":"Lìontairean","everlasting":"Flùraichean tioram","perennials":"Maireannach","fragrant":"Cùbhraidh","drought":"Tioram-fhulang","shade":"Sgàil-fhulang","edible-petals":"Peatail so-ithe"},
  "cy": {"bulbs":"Bylbiau a chormau","spires":"Tyrau","fillers":"Llenwyr","everlasting":"Tragwyddol","perennials":"Lluosflwydd","fragrant":"Persawrus","drought":"Goddef sychder","shade":"Goddef cysgod","edible-petals":"Petalau bwytadwy"},
  "mi": {"bulbs":"Pūtake me ngā kāwai","spires":"Putiputi roa","fillers":"Whakakī","everlasting":"Putiputi maroke","perennials":"Tau-roa","fragrant":"Kakara","drought":"Manawanui ki te maroke","shade":"Pai ki te ata","edible-petals":"Petara ka taea te kai"},
  "gu": {"bulbs":"કંદ અને કોર્મ","spires":"સ્પાઇક","fillers":"ભરણ","everlasting":"સૂકા ફૂલ","perennials":"બહુવર્ષાયુ","fragrant":"સુગંધિત","drought":"સૂકા સહિષ્ણુ","shade":"છાંયડા અનુકૂળ","edible-petals":"ખાવા યોગ્ય પાંખડીઓ"},
  "kn": {"bulbs":"ಕಂದ ಮತ್ತು ಕಾರ್ಮ್","spires":"ಸ್ಪೈಕ್","fillers":"ಪೂರಕ","everlasting":"ಒಣ ಹೂವುಗಳು","perennials":"ಬಹುವಾರ್ಷಿಕ","fragrant":"ಸುವಾಸನೆಯುಳ್ಳ","drought":"ಬರ ಸಹಿಷ್ಣು","shade":"ನೆರಳಿಗೆ ಸಹಿಷ್ಣು","edible-petals":"ತಿನ್ನಬಹುದಾದ ದಳಗಳು"},
  "ml": {"bulbs":"കിഴങ്ങും കാർമും","spires":"ഉയർന്ന പൂവ്","fillers":"പൂരകം","everlasting":"ഉണങ്ങിയ പൂക്കൾ","perennials":"വാർഷിക","fragrant":"സുഗന്ധമുള്ള","drought":"വരൾച്ച സഹിഷ്ണു","shade":"തണൽ ഇഷ്ടം","edible-petals":"ഭക്ഷ്യയോഗ്യ ഇതളുകൾ"},
  "mr": {"bulbs":"कंद आणि कॉर्म","spires":"उंच फुले","fillers":"भरणी","everlasting":"वाळवलेली फुले","perennials":"बहुवार्षिक","fragrant":"सुगंधी","drought":"दुष्काळ सहन","shade":"छाया अनुकूल","edible-petals":"खाद्य पाकळ्या"},
  "pa": {"bulbs":"ਕੰਦ ਅਤੇ ਕੌਰਮ","spires":"ਉੱਚੇ ਫੁੱਲ","fillers":"ਭਰਾਈ","everlasting":"ਸੁੱਕੇ ਫੁੱਲ","perennials":"ਬਹੁਸਾਲਾ","fragrant":"ਸੁਗੰਧਿਤ","drought":"ਸੋਕਾ ਸਹਿਣਸ਼ੀਲ","shade":"ਛਾਂ ਪਸੰਦ","edible-petals":"ਖਾਣ ਯੋਗ ਪੰਖੜੀਆਂ"},
  "ta": {"bulbs":"கிழங்கு மற்றும் கார்ம்","spires":"உயரம் பூக்கள்","fillers":"நிரப்பி","everlasting":"உலர்ந்த பூக்கள்","perennials":"வருடாந்திர","fragrant":"நறுமணமுள்ள","drought":"வறட்சி தாங்கும்","shade":"நிழல் தாங்கும்","edible-petals":"உண்ணக்கூடிய இதழ்கள்"},
  "te": {"bulbs":"గడ్డ మరియు కార్మ్","spires":"ఉన్నత పూలు","fillers":"నింపు","everlasting":"ఎండు పూలు","perennials":"బహువార్షిక","fragrant":"సుగంధ","drought":"కరువు తట్టుకునే","shade":"నీడ ఇష్టమైన","edible-petals":"తినదగిన రేకలు"},
  "ur": {"bulbs":"بلب اور کارم","spires":"بلند پھول","fillers":"بھرنے والے","everlasting":"خشک پھول","perennials":"بارہماسی","fragrant":"خوشبودار","drought":"خشک سالی برداشت کرنے والے","shade":"سایہ پسند","edible-petals":"کھانے کے قابل پنکھڑیاں"},
  "az": {"bulbs":"Soğanaqlar və kormalar","spires":"Sümbüllər","fillers":"Doldurucu","everlasting":"Quru çiçəklər","perennials":"Çoxillik","fragrant":"Ətirli","drought":"Quraqlığa davamlı","shade":"Kölgəyə dözümlü","edible-petals":"Yeyiləbilən ləçəklər"},
  "kk": {"bulbs":"Пияз және түйнек","spires":"Масақтар","fillers":"Толтырғыштар","everlasting":"Кепкен гүлдер","perennials":"Көпжылдық","fragrant":"Хош иісті","drought":"Қуаңшылыққа төзімді","shade":"Көлеңкеге төзімді","edible-petals":"Жеуге жарамды күлте"},
  "ky": {"bulbs":"Пияз жана түймөк","spires":"Машак","fillers":"Толтургучтар","everlasting":"Кургак гүлдөр","perennials":"Көп жылдык","fragrant":"Жыпар жыттуу","drought":"Кургакчылыкка туруктуу","shade":"Көлөкөгө туруктуу","edible-petals":"Жегенге боло турган гүл желекчелери"},
  "uz": {"bulbs":"Piyozboshlar va tugunaklar","spires":"Boshoqlar","fillers":"To‘ldiruvchilar","everlasting":"Quritilgan gullar","perennials":"Ko‘p yillik","fragrant":"Xushbo‘y","drought":"Qurg‘oqchilikka chidamli","shade":"Soyaga chidamli","edible-petals":"Yeyiladigan gul barglari"},
  "hy": {"bulbs":"Սոխուկներ և ճուտեր","spires":"Հասկեր","fillers":"Լրացուցիչներ","everlasting":"Չորացված ծաղիկներ","perennials":"Բազմամյա","fragrant":"Անուշահոտ","drought":"Երաշտադիմացկուն","shade":"Ստվերադիմացկուն","edible-petals":"Ուտելի թերթիկներ"},
  "ka": {"bulbs":"ბოლქვები და კოპლები","spires":"მაღალი ყვავილები","fillers":"შემავსებლები","everlasting":"გამხმარი ყვავილები","perennials":"მრავალწლიანი","fragrant":"სურნელოვანი","drought":"გვალვის ამტანი","shade":"ჩრდილის ამტანი","edible-petals":"საჭმელი ფურცლები"},
  "lt": {"bulbs":"Svogūnėliai ir gumbai","spires":"Žiedynai","fillers":"Užpildai","everlasting":"Sausgėlės","perennials":"Daugiamečiai","fragrant":"Kvapnūs","drought":"Sausrai atsparūs","shade":"Pavėsį mėgstantys","edible-petals":"Valgomi vainiklapiai"},
  "lv": {"bulbs":"Sīpoli un bumbuļi","spires":"Vārpas","fillers":"Pildījumi","everlasting":"Mūžīgie ziedi","perennials":"Daudzgadīgi","fragrant":"Smaržīgi","drought":"Sausumizturīgi","shade":"Ēnumīloši","edible-petals":"Ēdamas ziedlapas"},
  "et": {"bulbs":"Sibulad ja mugulad","spires":"Pead","fillers":"Täitjad","everlasting":"Igavesed lilled","perennials":"Püsililled","fragrant":"Lõhnav","drought":"Kuivataluvad","shade":"Varju taluvad","edible-petals":"Söödavad õielehed"},
}

KEYS = ["bulbs","spires","fillers","everlasting","perennials","fragrant","drought","shade","edible-petals"]

counts = {"ok":0, "skip-exists":0, "skip-no-trans":0, "no-anchor":0}
for f in sorted(LOCALES.glob("*.js")):
    if f.stem == "en": continue
    txt = f.read_text(encoding="utf-8")
    if "plants.subfilter.bulbs" in txt:
        counts["skip-exists"] += 1; continue
    if f.stem not in T:
        counts["skip-no-trans"] += 1; print(f"NO TRANS: {f.stem}"); continue
    block_lines = []
    for k in KEYS:
        val = T[f.stem][k].replace('"','\\"')
        block_lines.append(f'  "plants.subfilter.{k}": "{val}",')
    block = "\n".join(block_lines)
    new_txt, n = re.subn(
        r'(^[ \t]*"plants\.subcategory\.all":[^\n]*\n)',
        rf"\1{block}\n",
        txt, count=1, flags=re.MULTILINE
    )
    if n == 1:
        f.write_text(new_txt, encoding="utf-8")
        counts["ok"] += 1
    else:
        counts["no-anchor"] += 1; print(f"NO ANCHOR: {f.stem}")

print(counts)
