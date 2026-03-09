# Font Assets

Place TrueType (`.ttf`) font files here so they are embedded into generated PDFs.
Without these files the PDF service falls back to Helvetica / Times Roman standard
fonts, which **do not support Cyrillic / Ukrainian characters**.

## Required structure

```
fonts/
├── PTSerif/
│   ├── PTSerif-Regular.ttf
│   ├── PTSerif-Bold.ttf
│   ├── PTSerif-Italic.ttf
│   └── PTSerif-BoldItalic.ttf
├── PTSans/
│   ├── PTSans-Regular.ttf
│   ├── PTSans-Bold.ttf
│   ├── PTSans-Italic.ttf
│   └── PTSans-BoldItalic.ttf
├── Roboto/
│   ├── Roboto-Regular.ttf
│   ├── Roboto-Bold.ttf
│   ├── Roboto-Italic.ttf
│   └── Roboto-BoldItalic.ttf
├── OpenSans/
│   ├── OpenSans-Regular.ttf
│   ├── OpenSans-Bold.ttf
│   ├── OpenSans-Italic.ttf
│   └── OpenSans-BoldItalic.ttf
└── TimesNewRoman/
    ├── times.ttf
    ├── timesbd.ttf
    ├── timesi.ttf
    └── timesbi.ttf
```

## Where to obtain them

| Font family     | Source                                                                 |
|-----------------|------------------------------------------------------------------------|
| PT Serif        | https://fonts.google.com/specimen/PT+Serif                             |
| PT Sans         | https://fonts.google.com/specimen/PT+Sans                              |
| Roboto          | https://fonts.google.com/specimen/Roboto                               |
| Open Sans       | https://fonts.google.com/specimen/Open+Sans                            |
| Times New Roman | Ships with Windows/macOS — locate in `C:\Windows\Fonts` or `/Library/Fonts` |

All Google Fonts are available under the Open Font License (OFL).
