# Добавление нового шрифта

Конфигурация шрифтов распределена по двум файлам — по одному на фронтенд и бэкенд.
Всё остальное (TypeScript-типы, Zod-валидация, пикер шрифтов, загрузка в браузере) обновляется **автоматически**.

---

## Быстрый чеклист

```
[ ] 1. shared/src/fonts.ts          — добавить запись в FONT_REGISTRY
[ ] 2. functions/src/fonts.config.ts — добавить запись в FONT_FILE_MAP
[ ] 3. functions/assets/fonts/<Ключ>/ — скопировать 4 файла TTF
```

---

## Шаг 1 — `shared/src/fonts.ts`

Добавить объект в массив `FONT_REGISTRY`:

```typescript
{
  key:              'Montserrat',        // уникальный ключ, хранится в Firestore
  label:            'Montserrat',        // название в пикере шрифтов UI
  cssName:          'Montserrat',        // значение CSS font-family для превью в браузере
  googleFontsQuery: 'Montserrat:ital,wght@0,400;0,700;1,400;1,700',
  //                 ↑ фрагмент URL Google Fonts (то, что идёт после "family=")
  //                   null — если шрифт не нужно грузить с Google (напр. системный)
},
```

---

## Шаг 2 — `functions/src/fonts.config.ts`

Добавить запись в объект `FONT_FILE_MAP`:

```typescript
Montserrat: {
  base:       'Montserrat/Montserrat-Regular.ttf',
  bold:       'Montserrat/Montserrat-Bold.ttf',
  italic:     'Montserrat/Montserrat-Italic.ttf',
  boldItalic: 'Montserrat/Montserrat-BoldItalic.ttf',
},
```

> Если какое-то начертание у шрифта отсутствует — продублируйте путь к Regular.
> Иначе при его использовании PDF-сервис упадёт в фоллбэк на Helvetica и потеряет кириллицу.

---

## Шаг 3 — файлы TTF

Создать папку `functions/assets/fonts/<Ключ>/` и положить в неё 4 файла:

```
functions/assets/fonts/Montserrat/
  ├── Montserrat-Regular.ttf
  ├── Montserrat-Bold.ttf
  ├── Montserrat-Italic.ttf
  └── Montserrat-BoldItalic.ttf
```

Имена файлов должны точно совпадать с путями в `fonts.config.ts`.

### Где получить шрифты

| Источник | Ссылка |
|---|---|
| Google Fonts | https://fonts.google.com — кнопка «Download family» |
| jsDelivr (скрипты) | `functions/assets/fonts/download-fonts-jsdelivr.ps1` |
| Windows | `C:\Windows\Fonts\` — для системных шрифтов (Times New Roman и т. п.) |

Все шрифты Google Fonts распространяются под лицензией OFL (Open Font License).

---

## Что происходит автоматически после этих трёх шагов

| Место | Эффект |
|---|---|
| `FontFamily` (TypeScript union) | ключ появляется в типе автоматически |
| Zod-схема в API (`projects.router.ts`) | новый ключ принимается валидатором |
| Пикер шрифтов в редакторе | шрифт появляется в списке |
| Google Fonts в браузере | подключается автоматически через `loadEditorFonts()` в `main.ts` |
| PDF-генерация | шрифт встраивается в PDF через pdf-lib |

---

## Архитектура реестра (для справки)

```
shared/src/fonts.ts          ← FONT_REGISTRY (ключ + label + cssName + Google Fonts query)
  └─ используется:
       frontend/src/main.ts               (динамическая загрузка Google Fonts)
       frontend/.../editor-page.component (пикер шрифтов и CSS-рендеринг)
       shared/src/models/project.model.ts (тип FontFamily)

functions/src/fonts.config.ts ← FONT_FILE_MAP + FONT_KEYS (пути к TTF)
  └─ используется:
       functions/src/services/pdf.service.ts  (встраивание в PDF)
       functions/src/routes/projects.router.ts (Zod-валидация)
```
