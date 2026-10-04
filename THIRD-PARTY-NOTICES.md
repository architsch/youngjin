# Third-Party Notices

ThingsPool bundles and depends on third-party work. This file records what that
work is and under what terms it is used. It supplements, and does not modify,
[LICENSE](LICENSE) and [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

## Bundled assets

### Texture packs — Screaming Brain Studios

Twelve texture packs under `public/app/assets/resources/` are the work of
[Screaming Brain Studios](https://screamingbrainstudios.itch.io/) and are
released under
[CC0 1.0 Universal (Public Domain Dedication)](https://creativecommons.org/publicdomain/zero/1.0/).
CC0 places no restriction on use, commercial or otherwise, and requires no
credit; the attribution below is given because it is deserved, not because it is
demanded.

| Directory | Source |
|---|---|
| `FloorTileTexturePack/` | Screaming Brain Studios |
| `HolidayTexturePack/` | Screaming Brain Studios |
| `HorrorTexturePack/` | Screaming Brain Studios |
| `LiquidTexturePack/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack1/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack2/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack3/` | Screaming Brain Studios |
| `PortraitFramePack/` | Screaming Brain Studios |
| `SyntheticTexturePack/` | Screaming Brain Studios |
| `TexturePack1/` | [Tiny Texture Pack](https://screamingbrainstudios.itch.io/tiny-texture-pack) |
| `TexturePack2/` | [Tiny Texture Pack 2](https://screamingbrainstudios.itch.io/tiny-texture-pack-2) |
| `TexturePack3/` | [Tiny Texture Pack 3](https://screamingbrainstudios.itch.io/tiny-texture-pack-3) |

Each directory keeps its own `License.txt` as received. Those files are the
authoritative terms and should not be removed when the assets are.

### Label font — Tinos

`public/app/assets/resources/Tinos/Tinos-Regular-Latin.ttf` is a Latin subset of
[Tinos](https://github.com/googlefonts/tinos) Regular, Copyright 2026 The Tinos
Project Authors, released under the
[SIL Open Font License 1.1](https://openfontlicense.org). No Reserved Font Name
is declared. The game inlines it into the client bundle to letter labels, and the
font keeps its copyright and license notice in its own name records.

The directory keeps `OFL.txt`, the authoritative terms, and a `README.md`
recording how the subset was made. The OFL covers the font alone; the code that
uses it stays under Apache-2.0.

### Pictures from third parties

The pictures listed below, under `public/app/assets/pictures/` (with their
`.thumbnail.webp` copies), are photographs by the people their rows name,
each used under the license its row names; an empty table means none ships. The
[Unsplash License](https://unsplash.com/license) lets a photo be used,
commercially or not, without permission or credit; not sold without significant
modification, nor compiled into a service that competes with Unsplash. Every
Unsplash photo here is a free one, not an Unsplash+ one.

Each was sampled from its photo, and straightened, cut out of its background or
retouched, in the image map editor (`npm run imageMapEditor`). The editor keeps
each sample at full resolution under `dev/assets/pictures/2/` (never shipped),
and writes this table from the map's manifest. A disabled entry's image is parked
under `dev/assets/disabled_pictures/` and left out of this table, since it
doesn't ship. Every sample and parked image keeps the photographer and license of
the photo it came from, which the manifest names for each entry, enabled or not.
The original photos are never committed; only their index,
`dev/assets/picture_sources/index.json`, naming where each came from.
The license grants no trademark or likeness rights, so prominent logos and brand
plates were painted out; small incidental labels on goods remain.

<!-- pictures:begin (written by the image map editor) -->
| File | Title | Author | Source | License |
|---|---|---|---|---|
| `2/3.webp` | Oven | Erik Mclean | [aPoF91L-n6k](https://unsplash.com/photos/white-and-black-gas-range-oven-aPoF91L-n6k) | Unsplash License |
| `2/4.webp` | Pepperoni Pizza | Fernando Andrade | [_P76trHTWDE](https://unsplash.com/photos/pizza-with-pepperoni-and-ham-_P76trHTWDE) | Unsplash License |
| `2/7.webp` | Boombox | Eric Nopanen | [8e0EHPUx3Mo](https://unsplash.com/photos/person-with-vintage-silver-boombox-8e0EHPUx3Mo) | Unsplash License |
| `2/8.webp` | Tube Radio | Gayatri Pandkar | [Q1KJomEl70c](https://unsplash.com/photos/an-old-radio-sitting-on-top-of-a-wooden-table-Q1KJomEl70c) | Unsplash License |
| `2/9.webp` | Portable TV | Diego González | [-I8lDurtfAo](https://unsplash.com/photos/grey-and-orange-crt-tv--I8lDurtfAo) | Unsplash License |
| `2/11.webp` | Wall Clock | Ocean Ng | [L0xOtAnv94Y](https://unsplash.com/photos/round-analog-wall-clock-pointing-at-1009-L0xOtAnv94Y) | Unsplash License |
| `2/16.webp` | Tiny Metal TV | Jason Leung | [QErbOGxDzDE](https://unsplash.com/photos/brown-and-black-digital-device-QErbOGxDzDE) | Unsplash License |
| `2/19.webp` | Macintosh | Jason Leung | [VeUSCLJrLf4](https://unsplash.com/photos/turned-off-macintosh-monitor-VeUSCLJrLf4) | Unsplash License |
| `2/20.webp` | Volt and Ampere Meters | Ronald Crow | [LqvEdaJVSxw](https://unsplash.com/photos/a-close-up-of-a-radio-with-volts-and-ammeters-LqvEdaJVSxw) | Unsplash License |
| `2/23.webp` | Beige PC Tower | Lennon Cheng | [K-BMOC8_GO4](https://unsplash.com/photos/white-and-black-computer-tower-K-BMOC8_GO4) | Unsplash License |
| `2/27.webp` | Pendulum Clock Face | C | [G_YvG3ZIlkQ](https://unsplash.com/photos/an-old-wooden-clock-face-shows-the-time-G_YvG3ZIlkQ) | Unsplash License |
| `2/30.webp` | Payphone | Waldemar Brandt | [rDrGfuplEm8](https://unsplash.com/photos/red-telephone-on-yellow-paper-rDrGfuplEm8) | Unsplash License |
| `2/33.webp` | Keyboard | Andrey Matveev | [yLG3Zog38tw](https://unsplash.com/photos/a-computer-keyboard-sitting-on-top-of-a-table-yLG3Zog38tw) | Unsplash License |
| `2/40.webp` | Book Cubby | Wesley Tingey | [ghHUi-j_eko](https://unsplash.com/photos/full-bookshelf-ghHUi-j_eko) | Unsplash License |
| `2/41.webp` | Book Cubby with Notebooks | Wesley Tingey | [ghHUi-j_eko](https://unsplash.com/photos/full-bookshelf-ghHUi-j_eko) | Unsplash License |
| `2/42.webp` | Crate of Red Peppers | nrd | [D6Tu_L3chLE](https://unsplash.com/photos/bunch-of-vegetables-D6Tu_L3chLE) | Unsplash License |
| `2/43.webp` | Crate of Zucchini | nrd | [D6Tu_L3chLE](https://unsplash.com/photos/bunch-of-vegetables-D6Tu_L3chLE) | Unsplash License |
| `2/46.webp` | Candy Bar Spirals | Denny Müller | [In51lypcCDA](https://unsplash.com/photos/red-and-black-vending-machine-In51lypcCDA) | Unsplash License |
| `2/47.webp` | Drink Spirals | Denny Müller | [In51lypcCDA](https://unsplash.com/photos/red-and-black-vending-machine-In51lypcCDA) | Unsplash License |
| `2/48.webp` | Vending Machine Keypad | Denny Müller | [In51lypcCDA](https://unsplash.com/photos/red-and-black-vending-machine-In51lypcCDA) | Unsplash License |
| `2/50.webp` | Snack Bar Spirals | Estera | [5HgdQjUdYpc](https://unsplash.com/photos/assorted-food-packs-on-shelf-5HgdQjUdYpc) | Unsplash License |
| `2/52.webp` | Card Catalog Drawers | Erol Ahmed | [Y3KEBQlB1Zk](https://unsplash.com/photos/close-up-photography-of-brown-wooden-card-catalog-Y3KEBQlB1Zk) | Unsplash License |
| `2/56.webp` | Dartboard | Simon Ray | [1Bdsg4xqdYs](https://unsplash.com/photos/a-dart-hitting-in-the-center-of-a-dartboard-on-a-wooden-wall-1Bdsg4xqdYs) | Unsplash License |
| `2/57.webp` | Popcorn Sign | Rita Vicari | [kGGnJBw78Vo](https://unsplash.com/photos/popcorn-signage-kGGnJBw78Vo) | Unsplash License |
| `2/58.webp` | Popcorn Machine Window | Vitya Lapatey | [Q-dusXpAH0I](https://unsplash.com/photos/popcorn-on-white-and-red-box-Q-dusXpAH0I) | Unsplash License |
| `2/63.webp` | Candy Dispenser | Erik Mclean | [CMmyYQmgFes](https://unsplash.com/photos/assorted-candies-in-black-plastic-container-CMmyYQmgFes) | Unsplash License |
| `2/69.webp` | Fridge Shelf of Orange Soda | Onur Burak Akin | [B3cqR6OZOWU](https://unsplash.com/photos/a-refrigerator-filled-with-lots-of-green-and-yellow-bottles-B3cqR6OZOWU) | Unsplash License |
| `2/77.webp` | Bookshelf Speaker | Caleb Woods | [VVuRLhyTmXM](https://unsplash.com/photos/green-plant-on-brown-pot-VVuRLhyTmXM) | Unsplash License |
| `2/78.webp` | Vinyl Record | Markus Spiske | [ui79XsmHTos](https://unsplash.com/photos/vinyl-record-on-white-surface-ui79XsmHTos) | Unsplash License |
| `2/85.webp` | Arch Vase Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/86.webp` | Vase Pair Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/87.webp` | Sculpture Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/88.webp` | Rack of Bread Rolls | Leslie Saunders | [1vhNkMq6_aM](https://unsplash.com/photos/a-group-of-pastries-in-a-fridge-1vhNkMq6_aM) | Unsplash License |
| `2/89.webp` | Oven Window | Kam Idris | [Ot2iTXgC6fY](https://unsplash.com/photos/white-ceramic-mug-on-white-ceramic-saucer-on-white-wooden-cabinet-Ot2iTXgC6fY) | Unsplash License |
| `2/96.webp` | Vintage Black CRT TV | Lucrezia Carnelos | [esPwOIfkz5U](https://unsplash.com/photos/vintage-black-crt-tv-turned-on-near-lighted-table-lamp-esPwOIfkz5U) | Unsplash License |
| `2/98.webp` | Sink Taps | Jennifer Grismer | [ybyCGhe2HHI](https://unsplash.com/photos/an-old-sink-in-a-room-with-a-green-wall-ybyCGhe2HHI) | Unsplash License |
| `2/99.webp` | No Smoking Plaque | Benjamin Lehman | [1wxXo58XOjk](https://unsplash.com/photos/a-bathroom-with-a-no-smoking-sign-on-the-wall-1wxXo58XOjk) | Unsplash License |
| `2/100.webp` | Apples Soaking in a Sink | Giorgio Trovato | [9LnqAaMnUL8](https://unsplash.com/photos/a-bowl-of-apples-sitting-on-top-of-a-sink-9LnqAaMnUL8) | Unsplash License |
| `2/101.webp` | Library Card Catalog | Jan Antonin Kolar | [lRoX0shwjUQ](https://unsplash.com/photos/brown-wooden-drawer-lRoX0shwjUQ) | Unsplash License |
| `2/102.webp` | Cutlery Drawer | Orgalux | [Ho4ymAUhBFs](https://unsplash.com/photos/a-cabinet-with-utensils-and-spoons-in-it-Ho4ymAUhBFs) | Unsplash License |
| `2/103.webp` | Rusty Drawers | Ries Bosch | [pO0pdJn6QPk](https://unsplash.com/photos/an-old-desk-with-a-sink-and-a-stool-pO0pdJn6QPk) | Unsplash License |
| `2/104.webp` | Mini Drawer Cabinet | Merylove Art | [7WXsn8Rof-8](https://unsplash.com/photos/two-maroon-sewing-threads-on-cube-shelf-7WXsn8Rof-8) | Unsplash License |
| `2/106.webp` | Cubbies of Folded Socks | H&CO | [uzw4MvfG5ps](https://unsplash.com/photos/white-and-yellow-textiles-on-brown-wooden-shelf-uzw4MvfG5ps) | Unsplash License |
| `2/107.webp` | Cubbies of Brown and Yellow Socks | H&CO | [uzw4MvfG5ps](https://unsplash.com/photos/white-and-yellow-textiles-on-brown-wooden-shelf-uzw4MvfG5ps) | Unsplash License |
| `2/108.webp` | Post Office Box Doors | Joel Dunn | [f3Ug9b50KwI](https://unsplash.com/photos/black-and-white-abstract-painting-f3Ug9b50KwI) | Unsplash License |
| `2/109.webp` | Parts Organizer Drawers | Raymond Rasmusson | [7EhAf2dBthg](https://unsplash.com/photos/plastic-organizer-with-labels-7EhAf2dBthg) | Unsplash License |
| `2/111.webp` | Cards, Dice and Chips | James Nilsson | [Ih32pz1tMis](https://unsplash.com/photos/playing-cards-and-dice-on-a-black-background-Ih32pz1tMis) | Unsplash License |
| `2/112.webp` | Plate of Chocolates | Mockuuups | [sRVHOiBdjiU](https://unsplash.com/photos/a-plate-of-chocolates-and-a-card-on-a-pink-background-sRVHOiBdjiU) | Unsplash License |
| `2/114.webp` | Spiral Notebook and Pen | Justin Morgan | [Hx-4TbpsoIw](https://unsplash.com/photos/black-pen-on-white-notebook-Hx-4TbpsoIw) | Unsplash License |
| `2/116.webp` | Composition Notebook | Kelly Sikkema | [LtIqWwDs70s](https://unsplash.com/photos/black-and-white-frame-with-white-printer-paper-LtIqWwDs70s) | Unsplash License |
| `2/117.webp` | Tray of Pulled Pork | Ana Maltez | [hLM6EJesBHY](https://unsplash.com/photos/a-table-topped-with-lots-of-trays-of-food-hLM6EJesBHY) | Unsplash License |
| `2/119.webp` | Tray of Sweet and Sour Meatballs | Bunly Hort | [rwu15ZJvQvM](https://unsplash.com/photos/healthy-meal-prep-meatballs-sweet-potatoes-cucumbers-and-leafy-greens-rwu15ZJvQvM) | Unsplash License |
| `2/120.webp` | Tray of Cucumbers and Basil | Bunly Hort | [rwu15ZJvQvM](https://unsplash.com/photos/healthy-meal-prep-meatballs-sweet-potatoes-cucumbers-and-leafy-greens-rwu15ZJvQvM) | Unsplash License |
| `2/121.webp` | Bowl of Pita Chips | Michaja Sudar | [mARMLhaEY90](https://unsplash.com/photos/a-table-full-of-food-mARMLhaEY90) | Unsplash License |
| `2/123.webp` | Tray of Loaded Nachos | Spencer Davis | [H6yXLfZDrjM](https://unsplash.com/photos/assorted-variant-of-food-lot-H6yXLfZDrjM) | Unsplash License |
| `2/125.webp` | Chicken with Roasted Carrots | oh_ja_that_oke | [86Wwvs0rtgE](https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-utensils-86Wwvs0rtgE) | Unsplash License |
| `2/126.webp` | Bowl of Tomato Soup | oh_ja_that_oke | [86Wwvs0rtgE](https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-utensils-86Wwvs0rtgE) | Unsplash License |
| `2/127.webp` | Grilled Vegetables with Feta | oh_ja_that_oke | [86Wwvs0rtgE](https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-utensils-86Wwvs0rtgE) | Unsplash License |
| `2/129.webp` | Payphone Keypad | Luis Chavez | [TC3qJxz0uv4](https://unsplash.com/photos/a-public-phone-screen-advertises-free-national-calls-TC3qJxz0uv4) | Unsplash License |
| `2/130.webp` | Building Intercom | Dokyung Kim | [06nHHMyhl4w](https://unsplash.com/photos/green-metal-gate-with-intercom-and-notice-06nHHMyhl4w) | Unsplash License |
| `2/131.webp` | Mechanical Keyboard | JL Cabrera | [p5rgceFiOH0](https://unsplash.com/photos/a-black-and-white-keyboard-with-red-keys-p5rgceFiOH0) | Unsplash License |
| `2/133.webp` | Water Dispenser | Pavel Brilla | [DUK3g0D_e04](https://unsplash.com/photos/a-glass-of-water-sitting-on-top-of-a-stove-DUK3g0D_e04) | Unsplash License |
| `2/136.webp` | Cheese Slices on a Board | Thomas Park | [G3oLwnxlQUA](https://unsplash.com/photos/a-variety-of-food-is-laid-out-on-a-table-G3oLwnxlQUA) | Unsplash License |
| `2/138.webp` | Grilled Tortilla with Pulled Pork | Madie Hamilton | [Q9yr-cvJr30](https://unsplash.com/photos/grilled-meat-on-black-pan-Q9yr-cvJr30) | Unsplash License |
| `2/139.webp` | Pork Terrine | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/140.webp` | Oysters on the Half Shell | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/141.webp` | Seared Scallops | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/142.webp` | Cheese-Topped Croquettes | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/145.webp` | Cup of Black Coffee | Usman Yousaf | [2s2gd-EgrO4](https://unsplash.com/photos/sliced-bread-with-sliced-lemon-and-green-vegetable-on-white-ceramic-plate-2s2gd-EgrO4) | Unsplash License |
| `2/146.webp` | Charcuterie Board | Rafael Pedroso | [-A0-2phS5fo](https://unsplash.com/photos/charcuterie-board-with-bread-cheese-tomatoes-and-olives--A0-2phS5fo) | Unsplash License |
| `2/148.webp` | No Unauthorized Access Sign | Waldemar Brandt | [Dae6gNfmOos](https://unsplash.com/photos/red-and-white-no-smoking-sign-Dae6gNfmOos) | Unsplash License |
| `2/149.webp` | High Voltage Sign | Waldemar Brandt | [Dae6gNfmOos](https://unsplash.com/photos/red-and-white-no-smoking-sign-Dae6gNfmOos) | Unsplash License |
| `2/150.webp` | Green Arrow Sign | Tasha Kostyuk | [UgPP50i3_5c](https://unsplash.com/photos/green-sign-with-white-arrow-pointing-left-on-brick-wall-UgPP50i3_5c) | Unsplash License |
| `2/157.webp` | Gas Stove Burner | Vishal Dhanda | [tLGIrv8ZiN8](https://unsplash.com/photos/a-frying-pan-filled-with-food-on-top-of-a-stove-tLGIrv8ZiN8) | Unsplash License |
| `2/158.webp` | Bread Pakora Frying in a Pan | Vishal Dhanda | [tLGIrv8ZiN8](https://unsplash.com/photos/a-frying-pan-filled-with-food-on-top-of-a-stove-tLGIrv8ZiN8) | Unsplash License |
| `2/161.webp` | Carton of Brown Eggs | Fabrizio Bucella | [8-V0kdrwNs4](https://unsplash.com/photos/six-brown-fowl-eggs-in-tray-8-V0kdrwNs4) | Unsplash License |
| `2/162.webp` | Pizza Meats on a Cutting Board | Rudy Issa | [KVacTm0QeEA](https://unsplash.com/photos/sliced-meat-on-white-ceramic-plate-KVacTm0QeEA) | Unsplash License |
| `2/163.webp` | Chopped Vegetables on a Paddle Board | Rudy Issa | [KVacTm0QeEA](https://unsplash.com/photos/sliced-meat-on-white-ceramic-plate-KVacTm0QeEA) | Unsplash License |
| `2/164.webp` | Bowl of Eggs | Rudy Issa | [KVacTm0QeEA](https://unsplash.com/photos/sliced-meat-on-white-ceramic-plate-KVacTm0QeEA) | Unsplash License |
| `2/165.webp` | Bowls of Pizza Toppings | Rudy Issa | [KVacTm0QeEA](https://unsplash.com/photos/sliced-meat-on-white-ceramic-plate-KVacTm0QeEA) | Unsplash License |
| `2/166.webp` | Sea Bream on a Platter | henry perks | [ThwSJkPjkW8](https://unsplash.com/photos/fish-on-white-and-blue-floral-ceramic-plate-ThwSJkPjkW8) | Unsplash License |
| `2/167.webp` | Empty Plate with Knife and Fork | Jonathan Greenaway | [_2KiLVROy-c](https://unsplash.com/photos/a-plate-with-a-fork-and-knife-on-it-_2KiLVROy-c) | Unsplash License |
| `2/168.webp` | Vintage Plates and Knives | Tracey Hocking | [NcFBGQBiRDo](https://unsplash.com/photos/flat-lay-photography-of-stem-glasses-saucers-plate-and-bread-and-butter-knives-NcFBGQBiRDo) | Unsplash License |
| `2/169.webp` | Lemon Meringue Tart | Ira Ushak | [taiSXoS_wRM](https://unsplash.com/photos/white-ceramic-round-plate-with-silver-fork-taiSXoS_wRM) | Unsplash License |
| `2/170.webp` | Figs on a Saucer | Sonia | [Y8fR4Qapmrs](https://unsplash.com/photos/two-figs-on-a-plate-on-a-blue-table-Y8fR4Qapmrs) | Unsplash License |
| `2/172.webp` | Mesh Cabinet Door | Mayur Roxan | [l25poGqsBgA](https://unsplash.com/photos/a-kitchen-with-a-stove-top-oven-next-to-a-counter-l25poGqsBgA) | Unsplash License |
| `2/178.webp` | Shelf of Serving Bowls | David Nabil | [ocQcix1Rgcg](https://unsplash.com/photos/woman-in-blue-denim-jacket-standing-in-front-of-brown-wooden-shelf-ocQcix1Rgcg) | Unsplash License |
| `2/180.webp` | Baskets of Berries | Will | [fqkrXYMosT4](https://unsplash.com/photos/assorted-berries-fqkrXYMosT4) | Unsplash License |
| `2/190.webp` | Organ Keys | Mark Foster | [_TWQ7o8v4zU](https://unsplash.com/photos/brown-wooden-upright-piano-with-black-and-white-piano-keys-_TWQ7o8v4zU) | Unsplash License |
| `2/191.webp` | Closed Laptop | Neil Soni | [09tYbU3JaNs](https://unsplash.com/photos/silver-ipad-on-brown-wooden-table-09tYbU3JaNs) | Unsplash License |
| `2/192.webp` | Cup of Latte | Neil Soni | [09tYbU3JaNs](https://unsplash.com/photos/silver-ipad-on-brown-wooden-table-09tYbU3JaNs) | Unsplash License |
| `2/225.webp` | Espresso Machine | Mineragua Sparkling Water | [A7sSuhCxgaM](https://unsplash.com/photos/a-microwave-oven-sitting-on-top-of-a-counter-A7sSuhCxgaM) | Unsplash License |
| `2/226.webp` | Stacks of Paper Cups | Harshal | [qscFs9IJFxs](https://unsplash.com/photos/a-coffee-machine-sitting-on-top-of-a-counter-qscFs9IJFxs) | Unsplash License |
<!-- pictures:end -->

## Software dependencies

Dependencies are resolved from npm at build time rather than vendored into this
repository, so their license texts live in `node_modules/` once installed.

Every direct dependency and development dependency is under a permissive
license — **MIT**, **Apache-2.0** or **ISC**. There is no copyleft-licensed
dependency in the tree, which is what leaves the Apache-2.0 choice for this
project's own code unconstrained.

The substantive ones, for attribution:

| Package | License | Role |
|---|---|---|
| [three](https://github.com/mrdoob/three.js) | MIT | 3D rendering |
| [react](https://github.com/facebook/react) / react-dom | MIT | UI |
| [socket.io](https://github.com/socketio/socket.io) / socket.io-client | MIT | real-time networking |
| [express](https://github.com/expressjs/express) | MIT | HTTP server |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | MIT | styling |
| [firebase-admin](https://github.com/firebase/firebase-admin-node) | Apache-2.0 | database and storage |
| [@google-cloud/secret-manager](https://github.com/googleapis/google-cloud-node) | Apache-2.0 | secret loading |
| [ejs](https://github.com/mde/ejs) | Apache-2.0 | templating |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 | compiler (dev) |
| [webpack](https://github.com/webpack/webpack) | MIT | bundler (dev) |
| [vitest](https://github.com/vitest-dev/vitest) | MIT | integration tests (dev) |
| [@playwright/test](https://github.com/microsoft/playwright) | Apache-2.0 | E2E tests (dev) |
| [fast-check](https://github.com/dubzzz/fast-check) | MIT | property-based testing (dev) |

Anyone redistributing a **built** artifact of this project is redistributing
those dependencies too, and takes on their obligations — in particular,
preserving the `NOTICE` file of any Apache-2.0 dependency that ships one.

To regenerate a current inventory, including transitive dependencies:

```bash
npx license-checker --summary
```

Development dependencies included: the packages the client is built from (three,
react, socket.io-client, tailwindcss) are among them, since only the build needs
them installed, yet they ship inside the client bundle.

The picture preparation script (`npm run imagePrep`) fetches three things on
first use rather than at install, into the gitignored `temp/`; the image map
editor fetches the two that cut a thing out, likewise, when a source is first
preprocessed that way. None is a
dependency in `package.json`, and none is ever committed, bundled or shipped;
their licenses cover the programs and models and set no terms on the pictures
made with them.

| Fetched | License | When |
|---|---|---|
| [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN), its macOS build and models | BSD-3-Clause | a picture is to be enlarged |
| [ONNX Runtime](https://github.com/microsoft/onnxruntime), as its `onnxruntime-node` and `onnxruntime-common` packages | MIT | a thing is to be cut out of its background |
| [Segment Anything 2](https://github.com/facebookresearch/sam2) (Meta), its large model in the [ONNX export](https://huggingface.co/vietanhdev/segment-anything-2-onnx-models) by Viet-Anh Nguyen | Apache-2.0 | likewise |

## Fonts

One font file is bundled: Tinos, for label text (see *Bundled assets* above).
Everything else on the site and in the game renders in the reader's own system
fonts, and no web font is fetched from a provider.
