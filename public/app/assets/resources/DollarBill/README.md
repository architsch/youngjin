# Dollar bill (texture)

The face of the $1 bills that blow about multiplayer rooms, inlined into the client bundle (see
`DollarBillGameObject`).

`dollarBill.webp` is [File:US one dollar bill, obverse, series 2009.jpg](https://commons.wikimedia.org/wiki/File:US_one_dollar_bill,_obverse,_series_2009.jpg)
from Wikimedia Commons, a scan by ESEMES of a United States banknote. Commons lists it as public domain, the note being a
work of the United States government, with a `currency` restriction: that is no copyright, but the law on picturing
money (18 U.S.C. § 504, 31 CFR Part 411).

So it is kept to what that law asks of a color illustration as far as a game can: one side only (the same image on both
sides of the mesh, mirrored behind), far below print resolution, and smaller than three quarters of the real thing at
screen density. The original (1216 x 519 px, SHA-256 `2f16ecf1...46a`) isn't kept here. Made from it with sharp:

```js
sharp(original).resize(320, 137, {kernel: "lanczos3"}).sharpen({sigma: 0.5}).webp({quality: 75, effort: 6})
```
