"""Patch & Pot — extended plant catalogue.

This module holds the 150 plants added beyond the original 32 curated
entries that live in `core.py`. We keep them in a separate file so the
core catalogue stays diff-friendly and the headline list is easy to
maintain. They are merged into `core.PLANTS` and `core.COMPANIONS` at
import time (see `core.py` immediately after the original PLANTS list).

Schema matches the original entries:
    {id, name, category, difficulty, sun, water, soil, container,
     edible_part, summary, tags}
"""

# ── Cut flowers (72) ──────────────────────────────────────────────────
_CUT_FLOWERS = [
    {"id": "dahlia", "name": "Dahlia", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Tubers throw blooms from July till frost — pick weekly and they keep coming.", "tags": ["cut-flower", "summer", "tuber"]},
    {"id": "sweet-william", "name": "Sweet William", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Biennial clove-scented clusters in jewel tones — cottage garden classic.", "tags": ["cut-flower", "biennial", "fragrant"]},
    {"id": "snapdragon", "name": "Snapdragon", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich", "container": True, "edible_part": "Ornamental", "summary": "Spires of jaw-snap blooms — pinch tips for branching, cut deep for vase.", "tags": ["cut-flower", "spire", "long-bloom"]},
    {"id": "larkspur", "name": "Larkspur", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Annual cousin of delphinium — direct sow in autumn for tall spring spires.", "tags": ["cut-flower", "spire", "annual"]},
    {"id": "stock", "name": "Stock", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Clove-scented spikes that perfume a whole room — sow early for May cuts.", "tags": ["cut-flower", "fragrant", "spring"]},
    {"id": "ranunculus", "name": "Ranunculus", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Tissue-paper layers in painterly colours — soak corms before autumn planting.", "tags": ["cut-flower", "corm", "spring"]},
    {"id": "anemone-coronaria", "name": "Anemone (coronaria)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Jewel-bright poppy faces from corms — pairs beautifully with ranunculus.", "tags": ["cut-flower", "corm", "spring"]},
    {"id": "rudbeckia", "name": "Rudbeckia", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Golden black-eyed daisies that flower for months and shrug off heat.", "tags": ["cut-flower", "pollinator", "long-bloom"]},
    {"id": "scabiosa", "name": "Scabiosa", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Pincushion blooms on wiry stems — bees adore them and they last in the vase.", "tags": ["cut-flower", "pollinator", "long-bloom"]},
    {"id": "dianthus", "name": "Dianthus", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, alkaline", "container": True, "edible_part": "Petals", "summary": "Fringed petals with a clove scent — short stems but worth the snip.", "tags": ["cut-flower", "fragrant", "edible-flower"]},
    {"id": "cornflower", "name": "Cornflower", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Average", "container": True, "edible_part": "Petals", "summary": "Electric-blue thistles — direct sow into pots and they self-seed.", "tags": ["cut-flower", "edible-flower", "pollinator"]},
    {"id": "gypsophila", "name": "Gypsophila (Baby's Breath)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, alkaline", "container": True, "edible_part": "Ornamental", "summary": "Cloud of tiny stars — the filler every bouquet wants.", "tags": ["cut-flower", "filler", "drought"]},
    {"id": "statice", "name": "Statice", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Papery clusters that hold their colour dried — a market grower's mainstay.", "tags": ["cut-flower", "everlasting", "drought"]},
    {"id": "lisianthus", "name": "Lisianthus", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Rose-like blooms with a 2-week vase life — slow from seed but worth it.", "tags": ["cut-flower", "vase-life", "summer"]},
    {"id": "ammi-majus", "name": "Ammi majus", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Lacy white umbels — the elegant filler that makes everything look more expensive.", "tags": ["cut-flower", "filler", "pollinator"]},
    {"id": "nigella", "name": "Nigella (Love-in-a-Mist)", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Seeds", "summary": "Sky-blue blooms wrapped in ferny veils — followed by inflated seed pods.", "tags": ["cut-flower", "self-seeds", "pollinator"]},
    {"id": "tulip", "name": "Tulip", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Bulbs planted in autumn give pots the brightest spring impact going.", "tags": ["cut-flower", "bulb", "spring"]},
    {"id": "narcissus", "name": "Narcissus / Daffodil", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Reliable spring bulb — plant in autumn and forget until the trumpets arrive.", "tags": ["cut-flower", "bulb", "spring"]},
    {"id": "allium-globemaster", "name": "Allium 'Globemaster'", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Giant lavender pompoms on tall stems — architectural and bee-magnetic.", "tags": ["cut-flower", "bulb", "pollinator"]},
    {"id": "sweet-sultan", "name": "Sweet Sultan", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Cornflower's softer cousin — silky thistle heads in pastels.", "tags": ["cut-flower", "fragrant", "pollinator"]},
    {"id": "achillea", "name": "Achillea (Yarrow)", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Flat-topped plates in apricot, gold and red — dries beautifully too.", "tags": ["cut-flower", "drought", "pollinator"]},
    {"id": "china-aster", "name": "China Aster", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Late-summer chrysanthemum-style flowers in deep saturated colours.", "tags": ["cut-flower", "late-summer", "annual"]},
    {"id": "delphinium", "name": "Delphinium", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sky-blue spires up to 2 m — stake early and the show is unforgettable.", "tags": ["cut-flower", "spire", "perennial"]},
    {"id": "lupin", "name": "Lupin", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained, acidic", "container": True, "edible_part": "Ornamental", "summary": "Pea-family spires in candy colours — fixes its own nitrogen.", "tags": ["cut-flower", "spire", "pollinator"]},
    {"id": "eremurus", "name": "Eremurus (Foxtail Lily)", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Low", "soil": "Well-drained, sandy", "container": False, "edible_part": "Ornamental", "summary": "1.5 m bottlebrush spires — needs a big pot but the drama is unmatched.", "tags": ["cut-flower", "spire", "drought"]},
    {"id": "gladiolus", "name": "Gladiolus", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sword-leaved spikes in every shade — plant corms fortnightly for succession.", "tags": ["cut-flower", "corm", "spire"]},
    {"id": "asiatic-lily", "name": "Asiatic Lily", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Upturned trumpets that pack a sunny punch — easy from bulbs.", "tags": ["cut-flower", "bulb", "summer"]},
    {"id": "oriental-lily", "name": "Oriental Lily", "category": "Cut flower", "difficulty": "Medium", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Heady evening perfume — one stem scents a courtyard.", "tags": ["cut-flower", "bulb", "fragrant"]},
    {"id": "calla-lily", "name": "Calla Lily", "category": "Cut flower", "difficulty": "Medium", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Sculptural funnel-blooms — elegant on patios and in vases alike.", "tags": ["cut-flower", "tuber", "summer"]},
    {"id": "iris-bearded", "name": "Bearded Iris", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, alkaline", "container": True, "edible_part": "Ornamental", "summary": "Velvet falls and ruffled standards — divide rhizomes every 3 years.", "tags": ["cut-flower", "rhizome", "drought"]},
    {"id": "iris-dutch", "name": "Dutch Iris", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Slim spring bulbs in jewel shades — vase-life of 10 days.", "tags": ["cut-flower", "bulb", "spring"]},
    {"id": "freesia", "name": "Freesia", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained, sandy", "container": True, "edible_part": "Ornamental", "summary": "Funnel blooms with the most coveted floral perfume — corm-grown.", "tags": ["cut-flower", "corm", "fragrant"]},
    {"id": "hyacinth", "name": "Hyacinth", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Force bulbs indoors for January perfume that fills a kitchen.", "tags": ["cut-flower", "bulb", "fragrant"]},
    {"id": "amaryllis", "name": "Amaryllis", "category": "Cut flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Indoor winter showstopper — plant in November for Christmas trumpets.", "tags": ["cut-flower", "bulb", "winter"]},
    {"id": "carnation", "name": "Carnation", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained, alkaline", "container": True, "edible_part": "Petals", "summary": "Long-stemmed clove-scented blooms with two-week vase life.", "tags": ["cut-flower", "fragrant", "edible-flower"]},
    {"id": "wallflower", "name": "Wallflower", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, alkaline", "container": True, "edible_part": "Ornamental", "summary": "Spring perfume on a budget — biennial spires in spice colours.", "tags": ["cut-flower", "biennial", "fragrant"]},
    {"id": "sweet-rocket", "name": "Sweet Rocket (Hesperis)", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Cottage favourite with evening-scented mauve and white spires.", "tags": ["cut-flower", "biennial", "fragrant"]},
    {"id": "honesty", "name": "Honesty (Lunaria)", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Mauve spring blooms — then silvery seed pods that last all winter.", "tags": ["cut-flower", "biennial", "everlasting"]},
    {"id": "forget-me-not", "name": "Forget-me-not", "category": "Cut flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Moist", "container": True, "edible_part": "Ornamental", "summary": "Misty sky-blue carpet under tulips — self-seeds for free encore years.", "tags": ["cut-flower", "self-seeds", "spring"]},
    {"id": "sweet-alyssum", "name": "Sweet Alyssum", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Low", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Honey-scented frothy edging — works as a living mulch under taller crops.", "tags": ["cut-flower", "fragrant", "edging"]},
    {"id": "lobelia", "name": "Lobelia", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Trailing sapphire clouds that soften every basket edge.", "tags": ["cut-flower", "trailing", "summer"]},
    {"id": "petunia", "name": "Petunia", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Workhorse summer trailing colour — deadhead and feed weekly.", "tags": ["cut-flower", "trailing", "long-bloom"]},
    {"id": "impatiens", "name": "Impatiens (Busy Lizzie)", "category": "Cut flower", "difficulty": "Easy", "sun": "Partial sun", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Best shade-tolerant flower-power for north-facing balconies.", "tags": ["cut-flower", "shade", "long-bloom"]},
    {"id": "tuberous-begonia", "name": "Tuberous Begonia", "category": "Cut flower", "difficulty": "Medium", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Camellia-like blooms that thrive where sun is patchy — overwinter the tubers.", "tags": ["cut-flower", "tuber", "shade"]},
    {"id": "crocosmia", "name": "Crocosmia", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sword leaves and arching tangerine sprays — clumps up fast.", "tags": ["cut-flower", "corm", "late-summer"]},
    {"id": "agapanthus", "name": "Agapanthus", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Drumstick blue umbels — actually flowers better when pot-bound.", "tags": ["cut-flower", "perennial", "summer"]},
    {"id": "canna", "name": "Canna", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Tropical leaves and torchy blooms — instant exotic vibe on a patio.", "tags": ["cut-flower", "rhizome", "tropical"]},
    {"id": "nerine", "name": "Nerine", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, sandy", "container": True, "edible_part": "Ornamental", "summary": "Shimmering pink lily-stars in October when little else is flowering.", "tags": ["cut-flower", "bulb", "autumn"]},
    {"id": "tithonia", "name": "Tithonia (Mexican Sunflower)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Velvety orange daisies on tall stems — butterfly magnet.", "tags": ["cut-flower", "pollinator", "heat"]},
    {"id": "strawflower", "name": "Strawflower (Helichrysum)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Petals that feel like paper — the easiest dried flower going.", "tags": ["cut-flower", "everlasting", "drought"]},
    {"id": "craspedia", "name": "Craspedia (Billy Buttons)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Bright yellow drumstick balls — fresh, dried, or in wedding buttonholes.", "tags": ["cut-flower", "everlasting", "drought"]},
    {"id": "amaranthus", "name": "Amaranthus (Love-Lies-Bleeding)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Leaves & seeds", "summary": "Dramatic crimson tassels that trail to the floor — also edible.", "tags": ["cut-flower", "edible", "dramatic"]},
    {"id": "celosia", "name": "Celosia", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Leaves", "summary": "Coral-reef-like crests in vivid hues — heat lover, dries well.", "tags": ["cut-flower", "heat", "everlasting"]},
    {"id": "salvia-horminum", "name": "Salvia horminum (Clary Sage)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Painterly bracts in pink, blue and white — the bee's knees, literally.", "tags": ["cut-flower", "pollinator", "annual"]},
    {"id": "bells-of-ireland", "name": "Bells of Ireland", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Apple-green calyx towers — gives bouquets architectural height.", "tags": ["cut-flower", "green", "spire"]},
    {"id": "phlox-annual", "name": "Annual Phlox", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sweetly scented clusters in vintage candy colours.", "tags": ["cut-flower", "fragrant", "summer"]},
    {"id": "monarda", "name": "Monarda (Bee Balm)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Leaves & flowers", "summary": "Shaggy crowns on aromatic stems — leaves make a citrussy tea.", "tags": ["cut-flower", "pollinator", "edible-flower"]},
    {"id": "coreopsis", "name": "Coreopsis", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sunny daisies that flower from June till the first hard frost.", "tags": ["cut-flower", "drought", "long-bloom"]},
    {"id": "liatris", "name": "Liatris", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Fluffy magenta bottle-brush spires — opens top-down, unusually.", "tags": ["cut-flower", "spire", "pollinator"]},
    {"id": "veronica", "name": "Veronica", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Slim royal-blue spires — adds elegant verticals to mixed arrangements.", "tags": ["cut-flower", "spire", "pollinator"]},
    {"id": "nicotiana", "name": "Nicotiana (Tobacco Plant)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich", "container": True, "edible_part": "Ornamental", "summary": "Star-shaped night-scented trumpets — perfume drifts on summer dusk.", "tags": ["cut-flower", "fragrant", "evening"]},
    {"id": "cleome", "name": "Cleome (Spider Flower)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Tall airy heads with whiskery stamens — bumblebee favourite.", "tags": ["cut-flower", "pollinator", "tall"]},
    {"id": "orlaya", "name": "Orlaya (White Lace Flower)", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Refined white lace umbels — looks like wild carrot's elegant cousin.", "tags": ["cut-flower", "filler", "annual"]},
    {"id": "didiscus", "name": "Didiscus (Blue Lace Flower)", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Powder-blue lace umbels — rare and sought-after in bouquets.", "tags": ["cut-flower", "filler", "blue"]},
    {"id": "salpiglossis", "name": "Salpiglossis", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Velvety trumpets veined like stained glass — under-grown gem.", "tags": ["cut-flower", "annual", "dramatic"]},
    {"id": "matricaria", "name": "Matricaria (Feverfew)", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Tiny white daisies in profusion — the prettiest filler you can grow.", "tags": ["cut-flower", "filler", "self-seeds"]},
    {"id": "eucalyptus-cinerea", "name": "Eucalyptus 'Silver Dollar'", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Silver-blue round foliage — the foliage every modern bouquet wants.", "tags": ["cut-flower", "foliage", "evergreen"]},
    {"id": "dusty-miller", "name": "Dusty Miller", "category": "Cut flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Felted silver foliage that calms hot pinks and oranges in arrangements.", "tags": ["cut-flower", "foliage", "drought"]},
    {"id": "peony", "name": "Peony", "category": "Cut flower", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Three weeks of blowsy June glamour — needs a deep pot and patience.", "tags": ["cut-flower", "perennial", "fragrant"]},
    {"id": "heliopsis", "name": "Heliopsis", "category": "Cut flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Long-lasting golden daisies on sturdy stems — perennial.", "tags": ["cut-flower", "perennial", "long-bloom"]},
    {"id": "trachelium", "name": "Trachelium (Throatwort)", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Domed umbels of tiny purple flowers — long-stem, long vase life.", "tags": ["cut-flower", "filler", "pollinator"]},
    {"id": "ornamental-poppy", "name": "Iceland Poppy", "category": "Cut flower", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Tissue-paper blooms in sherbet shades — sear stem-ends for vase life.", "tags": ["cut-flower", "cool-season", "biennial"]},
]

# ── Pollinator & wildlife flowers (14) ────────────────────────────────
_POLLINATOR_FLOWERS = [
    {"id": "echinacea", "name": "Echinacea (Coneflower)", "category": "Flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Daisy-bright bee magnet — the seedheads feed goldfinches over winter.", "tags": ["pollinator", "perennial", "drought"]},
    {"id": "verbena-bonariensis", "name": "Verbena bonariensis", "category": "Flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Tall wiry stems with violet pompoms — butterflies fly in from streets away.", "tags": ["pollinator", "self-seeds", "drought"]},
    {"id": "salvia-amistad", "name": "Salvia 'Amistad'", "category": "Flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Inky purple tubular flowers from June to frost — hummingbird bait abroad.", "tags": ["pollinator", "long-bloom", "tender-perennial"]},
    {"id": "sedum-autumn-joy", "name": "Sedum 'Autumn Joy'", "category": "Flower", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Succulent plates that turn from pink to brick — September pollinator buffet.", "tags": ["pollinator", "drought", "autumn"]},
    {"id": "ajuga", "name": "Ajuga (Bugle)", "category": "Flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Ornamental", "summary": "Glossy ground-cover with cobalt spires — happy in dry shade.", "tags": ["pollinator", "shade", "ground-cover"]},
    {"id": "agastache", "name": "Agastache (Anise Hyssop)", "category": "Flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Leaves & flowers", "summary": "Liquorice-scented foliage and lavender bottle-brush spikes — bees go wild.", "tags": ["pollinator", "edible-flower", "drought"]},
    {"id": "eryngium", "name": "Eryngium (Sea Holly)", "category": "Flower", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, sandy", "container": True, "edible_part": "Ornamental", "summary": "Metallic blue thistles with steel-cut ruffs — pollinators love them.", "tags": ["pollinator", "drought", "architectural"]},
    {"id": "foxglove", "name": "Foxglove", "category": "Flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Bumblebee skyscrapers — biennial, self-seeds for years to come.", "tags": ["pollinator", "biennial", "shade"]},
    {"id": "hellebore", "name": "Hellebore", "category": "Flower", "difficulty": "Easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Nodding winter blooms when nothing else dares — feeds early bumblebees.", "tags": ["pollinator", "winter", "shade"]},
    {"id": "hollyhock", "name": "Hollyhock", "category": "Flower", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": False, "edible_part": "Ornamental", "summary": "Cottage giant up to 2.5 m — biennial, ridiculously productive.", "tags": ["pollinator", "biennial", "tall"]},
    {"id": "primrose", "name": "Primrose", "category": "Flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, moist", "container": True, "edible_part": "Petals", "summary": "First cheer of spring — divide clumps after flowering for free plants.", "tags": ["pollinator", "edible-flower", "spring"]},
    {"id": "snowdrop", "name": "Snowdrop", "category": "Flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Pierces January frost — plant 'in the green' just after flowering.", "tags": ["pollinator", "bulb", "winter"]},
    {"id": "crocus", "name": "Crocus", "category": "Flower", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Goblets in the lawn — vital nectar for early bumblebees waking up.", "tags": ["pollinator", "bulb", "spring"]},
    {"id": "scilla", "name": "Scilla", "category": "Flower", "difficulty": "Very easy", "sun": "Partial sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Sapphire bells in early spring — naturalises beautifully under trees.", "tags": ["pollinator", "bulb", "spring"]},
]

# ── Vegetables (18) ───────────────────────────────────────────────────
_VEG = [
    {"id": "runner-bean", "name": "Runner Bean", "category": "Legume", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Pods", "summary": "Twining climber with scarlet flowers — needs a tall wigwam.", "tags": ["climber", "summer", "productive"]},
    {"id": "french-bean", "name": "French Bean", "category": "Legume", "difficulty": "Very easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Pods", "summary": "Dwarf or climbing — fast cropper, pick young for stringless pods.", "tags": ["productive", "fast", "summer"]},
    {"id": "broad-bean", "name": "Broad Bean", "category": "Legume", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Beans", "summary": "Autumn-sown for an early hungry-gap crop — pinch tops to deter blackfly.", "tags": ["cool-season", "overwinter"]},
    {"id": "pea", "name": "Pea", "category": "Legume", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Peas", "summary": "Sweetest fresh from the pod — needs canes or netting to scramble up.", "tags": ["cool-season", "climber"]},
    {"id": "mangetout", "name": "Mangetout", "category": "Legume", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich", "container": True, "edible_part": "Whole pod", "summary": "Flat pods eaten whole — pick every other day to keep them coming.", "tags": ["cool-season", "climber"]},
    {"id": "sugar-snap-pea", "name": "Sugar Snap Pea", "category": "Legume", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich", "container": True, "edible_part": "Whole pod & peas", "summary": "Plump crunchy pods you can eat shell-and-all — kid favourite.", "tags": ["cool-season", "climber"]},
    {"id": "leek", "name": "Leek", "category": "Allium", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, deep", "container": True, "edible_part": "Stems", "summary": "Sweet winter staple — earth up the stems for blanched white shanks.", "tags": ["winter", "long-season"]},
    {"id": "shallot", "name": "Shallot", "category": "Allium", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Bulb", "summary": "Plant a single set, harvest a cluster — gourmet onion replacement.", "tags": ["beginner", "long-season"]},
    {"id": "onion", "name": "Onion", "category": "Allium", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Bulb", "summary": "Plant sets in March, harvest fat globes in August.", "tags": ["beginner", "long-season"]},
    {"id": "fennel-bulb", "name": "Florence Fennel", "category": "Vegetable", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Bulb & fronds", "summary": "Crunchy aniseed bulbs — sow after midsummer to prevent bolting.", "tags": ["aromatic", "summer-sown"]},
    {"id": "celery", "name": "Celery", "category": "Vegetable", "difficulty": "Medium", "sun": "Partial sun", "water": "Frequent", "soil": "Rich, moist", "container": True, "edible_part": "Stalks", "summary": "Thirsty plant that loves a deep boggy pot — sweetened by self-blanching.", "tags": ["thirsty", "long-season"]},
    {"id": "celeriac", "name": "Celeriac", "category": "Root", "difficulty": "Medium", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Root", "summary": "Knobbly nutty root — sow early indoors for a long growing season.", "tags": ["long-season", "winter"]},
    {"id": "swiss-chard", "name": "Swiss Chard", "category": "Leafy green", "difficulty": "Very easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich", "container": True, "edible_part": "Leaves & stems", "summary": "Rainbow stems — pick outer leaves for months on end.", "tags": ["beginner", "cut-and-come-again"]},
    {"id": "pak-choi", "name": "Pak Choi", "category": "Brassica", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Leaves & stems", "summary": "Fast Asian green — sow successionally in cool seasons to avoid bolting.", "tags": ["fast", "cool-season"]},
    {"id": "rocket", "name": "Rocket", "category": "Leafy green", "difficulty": "Very easy", "sun": "Full to partial", "water": "Regular", "soil": "Average", "container": True, "edible_part": "Leaves", "summary": "Peppery salad leaves ready in 4 weeks — sow fresh every fortnight.", "tags": ["fast", "cut-and-come-again"]},
    {"id": "watercress", "name": "Watercress", "category": "Leafy green", "difficulty": "Easy", "sun": "Partial sun", "water": "Frequent", "soil": "Constantly moist", "container": True, "edible_part": "Leaves", "summary": "Grow in a pot stood in a tray of water — peppery superfood.", "tags": ["thirsty", "fast"]},
    {"id": "sweetcorn", "name": "Sweetcorn", "category": "Vegetable", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich", "container": False, "edible_part": "Cobs", "summary": "Plant in blocks not rows for wind pollination — needs a big patch.", "tags": ["summer", "large-pot"]},
    {"id": "asparagus", "name": "Asparagus", "category": "Vegetable", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained, sandy", "container": True, "edible_part": "Spears", "summary": "Plant crowns once, harvest spears every spring for 20 years.", "tags": ["perennial", "spring"]},
]

# ── Brassicas (6) ─────────────────────────────────────────────────────
_BRASSICAS = [
    {"id": "broccoli", "name": "Broccoli (Calabrese)", "category": "Brassica", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, firm", "container": True, "edible_part": "Heads & sideshoots", "summary": "Main head plus weeks of side-shoots — net it against pigeons and caterpillars.", "tags": ["productive", "cool-season"]},
    {"id": "cauliflower", "name": "Cauliflower", "category": "Brassica", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, firm", "container": True, "edible_part": "Head", "summary": "Curds need shade — fold leaves over the head to keep them snow-white.", "tags": ["cool-season"]},
    {"id": "cabbage", "name": "Cabbage", "category": "Brassica", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, firm", "container": True, "edible_part": "Head", "summary": "Pick the right variety and you can have cabbage in every season.", "tags": ["long-season"]},
    {"id": "brussels-sprout", "name": "Brussels Sprout", "category": "Brassica", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, firm", "container": True, "edible_part": "Sprouts", "summary": "Stake each plant — wind-rock is the difference between firm and floppy sprouts.", "tags": ["winter", "stake"]},
    {"id": "kohlrabi", "name": "Kohlrabi", "category": "Brassica", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich", "container": True, "edible_part": "Swollen stem", "summary": "Looks like an alien turnip, tastes like a sweet apple-broccoli hybrid.", "tags": ["fast", "unusual"]},
    {"id": "romanesco", "name": "Romanesco", "category": "Brassica", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, firm", "container": True, "edible_part": "Head", "summary": "Lime-green fractal florets — looks alien, tastes like nutty cauliflower.", "tags": ["unusual", "cool-season"]},
]

# ── Squash/cucurbits (4) ──────────────────────────────────────────────
_SQUASH = [
    {"id": "pumpkin", "name": "Pumpkin", "category": "Squash", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Very rich", "container": True, "edible_part": "Fruit", "summary": "One vine, one big orange globe — feed weekly and keep off the ground.", "tags": ["summer", "large-pot"]},
    {"id": "butternut-squash", "name": "Butternut Squash", "category": "Squash", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich", "container": True, "edible_part": "Fruit", "summary": "Sweet keeper that stores for months — train up sturdy supports to save space.", "tags": ["storage", "summer"]},
    {"id": "melon", "name": "Melon", "category": "Squash", "difficulty": "Medium", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Fruit", "summary": "Sweetest under glass or on a sunny wall — train and net the fruit.", "tags": ["heat", "summer"]},
    {"id": "gherkin", "name": "Gherkin", "category": "Squash", "difficulty": "Easy", "sun": "Full sun", "water": "Frequent", "soil": "Rich, moist", "container": True, "edible_part": "Fruit", "summary": "Pick at finger-length for pickles, daily, to keep the vine cropping.", "tags": ["productive", "preserve"]},
]

# ── Patio fruit (12) ──────────────────────────────────────────────────
_FRUIT = [
    {"id": "blueberry", "name": "Blueberry", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Acidic (ericaceous)", "container": True, "edible_part": "Berries", "summary": "Pot-perfect — needs ericaceous compost and ideally rainwater.", "tags": ["acid-loving", "perennial"]},
    {"id": "raspberry", "name": "Raspberry", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Berries", "summary": "Summer or autumn fruiters — pick autumn for the simpler pruning life.", "tags": ["cane", "perennial"]},
    {"id": "blackberry", "name": "Blackberry", "category": "Fruit", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Berries", "summary": "Thornless varieties are kid-friendly and crop heavily on a wall.", "tags": ["cane", "vigorous"]},
    {"id": "gooseberry", "name": "Gooseberry", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Berries", "summary": "Bush or standard — pick under-ripe for crumbles, ripe for desserts.", "tags": ["bush", "perennial"]},
    {"id": "blackcurrant", "name": "Blackcurrant", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Berries", "summary": "Massive vitamin-C hit — leaves make a tea too.", "tags": ["bush", "perennial"]},
    {"id": "redcurrant", "name": "Redcurrant", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Berries", "summary": "Jewel-like strings of fruit — train as a fan against a fence.", "tags": ["bush", "perennial"]},
    {"id": "fig", "name": "Fig", "category": "Fruit", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Fruit", "summary": "Restricted roots make figs fruit better — perfect for a big pot.", "tags": ["mediterranean", "perennial"]},
    {"id": "lemon", "name": "Lemon", "category": "Fruit", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained, citrus mix", "container": True, "edible_part": "Fruit", "summary": "Indoors over winter, out in summer — feed with citrus food.", "tags": ["citrus", "tender"]},
    {"id": "dwarf-apple", "name": "Dwarf Apple", "category": "Fruit", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Fruit", "summary": "M27 rootstock keeps the tree under 2 m — fruit by year three.", "tags": ["tree", "perennial"]},
    {"id": "dwarf-pear", "name": "Dwarf Pear", "category": "Fruit", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Fruit", "summary": "Quince-rootstock pears stay compact and crop in 3 years.", "tags": ["tree", "perennial"]},
    {"id": "dwarf-cherry", "name": "Dwarf Cherry", "category": "Fruit", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Fruit", "summary": "Patio cherries on Gisela 5 rootstock — net against birds.", "tags": ["tree", "perennial"]},
    {"id": "rhubarb", "name": "Rhubarb", "category": "Fruit", "difficulty": "Very easy", "sun": "Full to partial", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Stems", "summary": "Force a crown under a bucket for tender pink January stems.", "tags": ["perennial", "spring"]},
]

# ── Herbs (10) ────────────────────────────────────────────────────────
_HERBS = [
    {"id": "sage", "name": "Sage", "category": "Herb", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained, sandy", "container": True, "edible_part": "Leaves", "summary": "Felted Mediterranean leaves — partner to onions, butter and brown butter.", "tags": ["mediterranean", "drought", "perennial"]},
    {"id": "oregano", "name": "Oregano", "category": "Herb", "difficulty": "Very easy", "sun": "Full sun", "water": "Low", "soil": "Sandy, well-drained", "container": True, "edible_part": "Leaves & flowers", "summary": "Pizza herb — and the pink flowers swarm with bees in July.", "tags": ["mediterranean", "drought", "pollinator"]},
    {"id": "lemon-balm", "name": "Lemon Balm", "category": "Herb", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Leaves", "summary": "Crush a leaf, get an instant lemon hit — gentle, calming tea.", "tags": ["beginner", "tea", "perennial"]},
    {"id": "dill", "name": "Dill", "category": "Herb", "difficulty": "Easy", "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True, "edible_part": "Leaves & seeds", "summary": "Feathery anise herb — short-lived, sow little and often.", "tags": ["fast", "succession"]},
    {"id": "fennel-herb", "name": "Fennel (herb)", "category": "Herb", "difficulty": "Easy", "sun": "Full sun", "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Leaves & seeds", "summary": "Bronze or green wisps with an aniseed punch — pollinator magnet.", "tags": ["pollinator", "self-seeds", "perennial"]},
    {"id": "lemongrass", "name": "Lemongrass", "category": "Herb", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Stems & leaves", "summary": "Root a supermarket stalk in water — overwinter indoors.", "tags": ["tropical", "kitchen"]},
    {"id": "tarragon", "name": "French Tarragon", "category": "Herb", "difficulty": "Medium", "sun": "Full sun", "water": "Low", "soil": "Well-drained, sandy", "container": True, "edible_part": "Leaves", "summary": "Buy a French variety plant — true tarragon doesn't come from seed.", "tags": ["perennial", "kitchen"]},
    {"id": "bay", "name": "Bay", "category": "Herb", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Leaves", "summary": "Evergreen shrub that takes happily to a pot — clip for shape.", "tags": ["evergreen", "shrub", "kitchen"]},
    {"id": "lovage", "name": "Lovage", "category": "Herb", "difficulty": "Very easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, moist", "container": True, "edible_part": "Leaves & seeds", "summary": "Tastes like supercharged celery — one big plant lasts years.", "tags": ["perennial", "kitchen"]},
    {"id": "chervil", "name": "Chervil", "category": "Herb", "difficulty": "Easy", "sun": "Partial sun", "water": "Moderate", "soil": "Rich, moist", "container": True, "edible_part": "Leaves", "summary": "Delicate aniseed parsley cousin — happy in shadier spots.", "tags": ["shade", "fast", "fine-herb"]},
]

# ── Windowsill / sprouting (6) ────────────────────────────────────────
_SPROUTS = [
    {"id": "microgreens", "name": "Microgreens", "category": "Sprouts", "difficulty": "Very easy", "sun": "Bright indoor light", "water": "Regular mist", "soil": "Shallow compost or pad", "container": True, "edible_part": "Tiny leaves", "summary": "Ten-day salad upgrade — flavour-packed first-leaf seedlings on a windowsill.", "tags": ["beginner", "indoor", "fast"]},
    {"id": "pea-shoots", "name": "Pea Shoots", "category": "Sprouts", "difficulty": "Very easy", "sun": "Bright indoor light", "water": "Regular", "soil": "Shallow compost", "container": True, "edible_part": "Tendrils & leaves", "summary": "Use dried marrowfat peas — cut-and-come-again sweet pea-pod flavour.", "tags": ["indoor", "fast", "cheap"]},
    {"id": "mustard-cress", "name": "Mustard & Cress", "category": "Sprouts", "difficulty": "Very easy", "sun": "Bright indoor light", "water": "Regular mist", "soil": "Damp tissue", "container": True, "edible_part": "Seedlings", "summary": "The egg-shell sandwich classic — peppery in 7 days flat.", "tags": ["beginner", "indoor", "fast"]},
    {"id": "sprouting-broccoli", "name": "Broccoli Sprouts", "category": "Sprouts", "difficulty": "Very easy", "sun": "Any", "water": "Rinse 2x daily", "soil": "Jar sprouter", "container": True, "edible_part": "Sprouts", "summary": "Sulforaphane superfood in 5 days — jar sprout, no soil needed.", "tags": ["indoor", "fast", "superfood"]},
    {"id": "baby-leaf-mix", "name": "Baby Leaf Salad Mix", "category": "Sprouts", "difficulty": "Very easy", "sun": "Bright indoor light", "water": "Regular", "soil": "Shallow compost", "container": True, "edible_part": "Leaves", "summary": "Bag a £2 seed mix for £30 of salad over a season.", "tags": ["indoor", "cut-and-come-again", "cheap"]},
    {"id": "alfalfa-sprouts", "name": "Alfalfa Sprouts", "category": "Sprouts", "difficulty": "Very easy", "sun": "Any", "water": "Rinse 2x daily", "soil": "Jar sprouter", "container": True, "edible_part": "Sprouts", "summary": "Nutty-sweet protein-packed sprouts ready in 4-5 days.", "tags": ["indoor", "fast", "superfood"]},
]

# ── Shrubs / climbers / structural (8) ────────────────────────────────
_SHRUBS = [
    {"id": "rose-shrub", "name": "Rose", "category": "Shrub", "difficulty": "Easy", "sun": "Full sun", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Petals & hips", "summary": "Pick a repeat-flowering variety in a 50 L pot — a generation of blooms.", "tags": ["perennial", "fragrant", "cut-flower"]},
    {"id": "hydrangea", "name": "Hydrangea", "category": "Shrub", "difficulty": "Easy", "sun": "Partial sun", "water": "Frequent", "soil": "Rich, moist", "container": True, "edible_part": "Ornamental", "summary": "Blousy mophead blooms — colour shifts with soil pH on some varieties.", "tags": ["shade", "perennial", "long-bloom"]},
    {"id": "clematis", "name": "Clematis", "category": "Climber", "difficulty": "Medium", "sun": "Full to partial", "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Cold feet, sunny head — shade the pot, train the stems for years of bloom.", "tags": ["climber", "perennial"]},
    {"id": "jasmine", "name": "Jasmine", "category": "Climber", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Star-flowered evening perfume — train up an obelisk in a tall pot.", "tags": ["climber", "fragrant", "evening"]},
    {"id": "wisteria", "name": "Wisteria", "category": "Climber", "difficulty": "Medium", "sun": "Full sun", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Cascades of lilac chains — needs the right pruning twice a year.", "tags": ["climber", "fragrant", "dramatic"]},
    {"id": "camellia", "name": "Camellia", "category": "Shrub", "difficulty": "Medium", "sun": "Partial sun", "water": "Regular", "soil": "Acidic (ericaceous)", "container": True, "edible_part": "Ornamental", "summary": "Glossy evergreen with rose-like winter blooms — ericaceous compost only.", "tags": ["acid-loving", "evergreen", "winter"]},
    {"id": "box-hedge", "name": "Box (Buxus)", "category": "Shrub", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Ornamental", "summary": "Evergreen clip-and-shape classic — watch for box tree caterpillar.", "tags": ["evergreen", "shape", "formal"]},
    {"id": "honeysuckle", "name": "Honeysuckle", "category": "Climber", "difficulty": "Easy", "sun": "Full to partial", "water": "Moderate", "soil": "Rich, well-drained", "container": True, "edible_part": "Ornamental", "summary": "Twining cottage classic with evening perfume — moth-pollinated.", "tags": ["climber", "fragrant", "evening"]},
]

# Assemble the master extra-plant list
EXTRA_PLANTS = (
    _CUT_FLOWERS
    + _POLLINATOR_FLOWERS
    + _VEG
    + _BRASSICAS
    + _SQUASH
    + _FRUIT
    + _HERBS
    + _SPROUTS
    + _SHRUBS
)


# ── Companion planting pairs for new plants ───────────────────────────
# Ids may reference both original PLANTS and the new EXTRA_PLANTS.
EXTRA_COMPANIONS = {
    # Cut flowers
    "dahlia": ["zinnia", "cosmos", "marigold"],
    "sweet-william": ["dianthus", "rose-shrub", "lavender"],
    "snapdragon": ["dianthus", "sweet-alyssum", "cosmos"],
    "larkspur": ["delphinium", "cornflower", "ammi-majus"],
    "stock": ["wallflower", "sweet-rocket", "ammi-majus"],
    "ranunculus": ["anemone-coronaria", "tulip", "narcissus"],
    "anemone-coronaria": ["ranunculus", "tulip", "narcissus"],
    "rudbeckia": ["echinacea", "salvia-amistad", "verbena-bonariensis"],
    "scabiosa": ["ammi-majus", "verbena-bonariensis", "achillea"],
    "dianthus": ["carnation", "sweet-william", "lavender"],
    "cornflower": ["larkspur", "ammi-majus", "nigella"],
    "gypsophila": ["dianthus", "rose-shrub", "lisianthus"],
    "statice": ["strawflower", "craspedia", "achillea"],
    "lisianthus": ["dianthus", "gypsophila", "rose-shrub"],
    "ammi-majus": ["scabiosa", "cornflower", "larkspur"],
    "nigella": ["cornflower", "ammi-majus", "calendula"],
    "tulip": ["forget-me-not", "narcissus", "wallflower"],
    "narcissus": ["tulip", "hyacinth", "crocus"],
    "allium-globemaster": ["lavender", "salvia-amistad", "achillea"],
    "sweet-sultan": ["cornflower", "scabiosa", "nigella"],
    "achillea": ["echinacea", "rudbeckia", "verbena-bonariensis"],
    "china-aster": ["zinnia", "cosmos", "marigold"],
    "delphinium": ["larkspur", "lupin", "rose-shrub"],
    "lupin": ["delphinium", "foxglove", "rose-shrub"],
    "eremurus": ["lavender", "achillea", "salvia-amistad"],
    "gladiolus": ["dahlia", "zinnia", "rudbeckia"],
    "asiatic-lily": ["oriental-lily", "agapanthus", "dahlia"],
    "oriental-lily": ["asiatic-lily", "phlox-annual", "agapanthus"],
    "calla-lily": ["agapanthus", "canna", "asiatic-lily"],
    "iris-bearded": ["peony", "lupin", "lavender"],
    "iris-dutch": ["narcissus", "tulip", "hyacinth"],
    "freesia": ["ranunculus", "anemone-coronaria", "tulip"],
    "hyacinth": ["narcissus", "tulip", "crocus"],
    "amaryllis": ["hyacinth", "narcissus"],
    "carnation": ["dianthus", "sweet-william", "gypsophila"],
    "wallflower": ["tulip", "forget-me-not", "honesty"],
    "sweet-rocket": ["honesty", "stock", "forget-me-not"],
    "honesty": ["wallflower", "sweet-rocket", "forget-me-not"],
    "forget-me-not": ["tulip", "wallflower", "primrose"],
    "sweet-alyssum": ["lobelia", "petunia", "snapdragon"],
    "lobelia": ["petunia", "sweet-alyssum", "impatiens"],
    "petunia": ["lobelia", "sweet-alyssum", "geranium"],
    "impatiens": ["lobelia", "tuberous-begonia", "sweet-alyssum"],
    "tuberous-begonia": ["impatiens", "lobelia"],
    "crocosmia": ["agapanthus", "rudbeckia", "dahlia"],
    "agapanthus": ["crocosmia", "salvia-amistad", "lavender"],
    "canna": ["dahlia", "agapanthus", "tithonia"],
    "nerine": ["sedum-autumn-joy", "agapanthus", "crocus"],
    "tithonia": ["zinnia", "rudbeckia", "cosmos"],
    "strawflower": ["statice", "craspedia", "achillea"],
    "craspedia": ["statice", "strawflower"],
    "amaranthus": ["cleome", "celosia", "tithonia"],
    "celosia": ["amaranthus", "tithonia", "zinnia"],
    "salvia-horminum": ["salvia-amistad", "agastache", "verbena-bonariensis"],
    "bells-of-ireland": ["snapdragon", "stock", "ammi-majus"],
    "phlox-annual": ["cleome", "zinnia", "rudbeckia"],
    "monarda": ["agastache", "echinacea", "salvia-amistad"],
    "coreopsis": ["rudbeckia", "echinacea", "verbena-bonariensis"],
    "liatris": ["echinacea", "rudbeckia", "achillea"],
    "veronica": ["agastache", "echinacea", "salvia-amistad"],
    "nicotiana": ["cleome", "cosmos", "verbena-bonariensis"],
    "cleome": ["zinnia", "tithonia", "amaranthus"],
    "orlaya": ["ammi-majus", "nigella", "scabiosa"],
    "didiscus": ["ammi-majus", "scabiosa", "orlaya"],
    "salpiglossis": ["petunia", "nicotiana", "snapdragon"],
    "matricaria": ["ammi-majus", "scabiosa", "nigella"],
    "eucalyptus-cinerea": ["lavender", "rose-shrub", "dusty-miller"],
    "dusty-miller": ["eucalyptus-cinerea", "lavender", "salvia-amistad"],
    "peony": ["iris-bearded", "lupin", "rose-shrub"],
    "heliopsis": ["echinacea", "rudbeckia", "verbena-bonariensis"],
    "trachelium": ["scabiosa", "ammi-majus", "agastache"],
    "ornamental-poppy": ["nigella", "cornflower", "larkspur"],

    # Pollinator flowers
    "echinacea": ["rudbeckia", "verbena-bonariensis", "achillea"],
    "verbena-bonariensis": ["echinacea", "rudbeckia", "salvia-amistad"],
    "salvia-amistad": ["agastache", "verbena-bonariensis", "echinacea"],
    "sedum-autumn-joy": ["nerine", "echinacea", "achillea"],
    "ajuga": ["primrose", "snowdrop", "hellebore"],
    "agastache": ["salvia-amistad", "monarda", "verbena-bonariensis"],
    "eryngium": ["echinacea", "achillea", "sedum-autumn-joy"],
    "foxglove": ["hellebore", "primrose", "rose-shrub"],
    "hellebore": ["snowdrop", "primrose", "ajuga"],
    "hollyhock": ["sunflower", "delphinium", "rose-shrub"],
    "primrose": ["snowdrop", "hellebore", "forget-me-not"],
    "snowdrop": ["crocus", "hellebore", "primrose"],
    "crocus": ["snowdrop", "scilla", "narcissus"],
    "scilla": ["crocus", "snowdrop", "narcissus"],

    # Vegetables
    "runner-bean": ["sweetcorn", "courgette", "nasturtium"],
    "french-bean": ["sweetcorn", "cucumber", "borage"],
    "broad-bean": ["carrot", "lettuce", "spring-onion"],
    "pea": ["carrot", "radish", "lettuce"],
    "mangetout": ["carrot", "radish", "lettuce"],
    "sugar-snap-pea": ["carrot", "radish", "lettuce"],
    "leek": ["carrot", "celery", "lettuce"],
    "shallot": ["carrot", "lettuce", "strawberry"],
    "onion": ["carrot", "beetroot", "kale"],
    "fennel-bulb": ["lettuce", "rocket"],
    "celery": ["leek", "cabbage", "tomato"],
    "celeriac": ["leek", "spring-onion", "carrot"],
    "swiss-chard": ["spring-onion", "lettuce", "kale"],
    "pak-choi": ["chives", "garlic", "calendula"],
    "rocket": ["lettuce", "radish", "carrot"],
    "watercress": ["pak-choi", "rocket", "spinach"],
    "sweetcorn": ["runner-bean", "courgette", "pumpkin"],
    "asparagus": ["parsley", "basil", "tomato"],

    # Brassicas
    "broccoli": ["chives", "garlic", "calendula"],
    "cauliflower": ["chives", "calendula", "celery"],
    "cabbage": ["chives", "garlic", "rosemary"],
    "brussels-sprout": ["chives", "garlic", "kale"],
    "kohlrabi": ["chives", "lettuce", "rocket"],
    "romanesco": ["chives", "calendula", "celery"],

    # Squash
    "pumpkin": ["sweetcorn", "runner-bean", "nasturtium"],
    "butternut-squash": ["sweetcorn", "nasturtium", "marigold"],
    "melon": ["nasturtium", "marigold", "basil"],
    "gherkin": ["coriander", "nasturtium", "borage"],

    # Fruit
    "blueberry": ["rhubarb", "strawberry", "thyme"],
    "raspberry": ["garlic", "marigold", "thyme"],
    "blackberry": ["garlic", "marigold"],
    "gooseberry": ["chives", "tomato"],
    "blackcurrant": ["chives", "garlic"],
    "redcurrant": ["chives", "garlic"],
    "fig": ["lavender", "rosemary", "thyme"],
    "lemon": ["lavender", "rosemary", "basil"],
    "dwarf-apple": ["chives", "nasturtium", "garlic"],
    "dwarf-pear": ["chives", "nasturtium", "garlic"],
    "dwarf-cherry": ["chives", "nasturtium", "garlic"],
    "rhubarb": ["blueberry", "strawberry", "garlic"],

    # Herbs
    "sage": ["rosemary", "thyme", "cabbage"],
    "oregano": ["rosemary", "thyme", "basil"],
    "lemon-balm": ["mint", "basil", "chives"],
    "dill": ["lettuce", "cucumber", "cabbage"],
    "fennel-herb": ["dill"],
    "lemongrass": ["basil", "coriander"],
    "tarragon": ["chives", "basil", "parsley"],
    "bay": ["rosemary", "thyme", "sage"],
    "lovage": ["celery", "chives", "parsley"],
    "chervil": ["parsley", "coriander", "lettuce"],

    # Sprouts (mostly no field companions — indoors)
    "microgreens": [],
    "pea-shoots": [],
    "mustard-cress": [],
    "sprouting-broccoli": [],
    "baby-leaf-mix": [],
    "alfalfa-sprouts": [],

    # Shrubs / climbers
    "rose-shrub": ["lavender", "chives", "garlic"],
    "hydrangea": ["hellebore", "primrose"],
    "clematis": ["rose-shrub", "lavender"],
    "jasmine": ["honeysuckle", "rose-shrub", "lavender"],
    "wisteria": ["rose-shrub", "clematis"],
    "camellia": ["hellebore", "primrose"],
    "box-hedge": ["lavender", "rose-shrub"],
    "honeysuckle": ["jasmine", "clematis", "rose-shrub"],
}
