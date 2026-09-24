# Tinos (label font)

The font every label is lettered in, inlined into the client bundle (see `LabelText`). Licensed under the
SIL Open Font License 1.1 ([OFL.txt](OFL.txt)); no Reserved Font Name is declared.

`Tinos-Regular-Latin.ttf` is a subset of `ofl/tinos/Tinos-Regular.ttf` (version 1.340) from
[google/fonts](https://github.com/google/fonts) at commit `ba95515f1333efe9342c2ad988b9c2f6bef6dbad`: Latin
only, with no hinting and no layout tables (so no kerning or ligatures can make browsers space it
differently). The copyright and license name records are kept. Made with fontTools:

```bash
pyftsubset Tinos-Regular.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --no-hinting --layout-features='' \
  --drop-tables+=GSUB,GPOS,GDEF,kern,hdmx,LTSH,VDMX,gasp,DSIG \
  --name-IDs=0,1,2,3,4,5,6,13,14 --notdef-outline \
  --output-file=Tinos-Regular-Latin.ttf
```
