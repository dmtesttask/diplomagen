User: Твоя задача:

Помоги составить проектную документацию для разработки приложения. Пока не нужно писать код, но нужно подробно текстом,  на простом английском  расписать проект А в идеале написать эпики, стори, и таски. 
По сделанной тобой документации я буду запускать модели ИИ для последовательного поэтапного выполнения задач.

Описание проекта:
Я хочу создать сервис, который бы помогал генерировать наградные дипломы организаторам конференций или соревнований. 

Организатор предоставляет список участников в таблице ексель (имена, фамилии, какое место получено), а так же пдф или качественный jpeg шаблон диплома.  

После этого  система позволяет организатору с помощью мышки указать на макете диплома позиции для фамилии, имени, отчества, а так же других необходимых данных , например даты, номер диплома. 

После того как пользователь-организатор расставит позиции для данных происходит пакетная генерация дипломов и выгрузка их в виде архива пдф файлов либо в гугл диск.


Я пока представляю себе такой функционал:

- Загрузка Excel + шаблона PDF/JPEG, Визуальная расстановка полей мышью, Пакетная генерация PDF, Скачивание ZIP с дипломами

- Веб-приложение (браузер)

- пользователь сам сопоставляет колонки полям диплома

- Мультиязычность, английский и дефолтный украинский, т.к. это на украинский рынок в первую очередь

- форматы шаблона диплома поддерживаем PDF/JPEG/PNG



Фронтенд я хочу на Angular последней версии. Бекенд - Express, а в идеале - serverless функция из GCP.


Если у тебя есть какие-то уточняющие вопросы - задавай я предоставлю ответы.




GitHub Copilot: Before writing the full documentation, I have a few questions that will significantly affect the architecture and scope. 

Asked 4 questions (Auth, Persistence, Google Drive, Text styling)

Great answers. Now I have everything I need. Let me write the full documentation. 

Created 4 todos

Created [](file:///c%3A/_c/_sertif_/PROJECT_DOCUMENTATION.md)

Completed: *Write project overview* (1/4)

Documentation written to PROJECT_DOCUMENTATION.md. Here's what's inside:

---

**Structure:**
- Project overview and explanation in plain English
- Goals / Non-Goals (what's MVP, what's deferred)
- User roles
- Step-by-step user flow
- Architecture diagram (Angular → GCP Cloud Functions → Firestore + Cloud Storage)
- Full tech stack table with reasoning
- 4 data models: `User`, `Project`, `Field`, `GenerationJob`

**9 Epics with Stories and Tasks:**

| Epic | What it covers |
|---|---|
| 1 — Infrastructure | Project scaffold, CI/CD, GCP setup |
| 2 — Authentication | Google OAuth, sign-in/out, user profile creation |
| 3 — Project Management | Create, rename, delete, list projects |
| 4 — Template Upload | PDF/JPEG/PNG upload, dimension resolution, replace |
| 5 — Excel + Column Mapping | Upload Excel, extract columns, define fields, map columns to fields |
| 6 — Visual Field Editor | Fabric.js canvas, drag-and-drop placement, full text styling, live preview |
| 7 — Batch Generation & Download | Async job, `pdf-lib` PDF rendering, ZIP creation, progress bar, download |
| 8 — Multilingual UI | Angular i18n, Ukrainian default, English second, language switcher |
| 9 — UX Polish | Error handling, loading/empty states, accessibility |

Each story has concrete, actionable dev tasks that an AI model (or human dev) can pick up and execute sequentially without needing further clarification.

Made changes.

User: нужно ли что-то еще описать до старта разработки или уже можно начинать?

GitHub Copilot: Документация достаточно полная для начала, но есть несколько вещей, которые **стоит добавить до старта** — иначе AI-модели будут принимать несогласованные решения в разных эпиках:

---

**Критично (без этого фронт и бэк будут несовместимы):**

1. **REST API Specification** — для каждого эндпоинта нужно расписать точные request/response JSON-схемы. Сейчас в доке только названия эндпоинтов. Без этого модель, пишущая Angular-сервис, и модель, пишущая Cloud Function, сделают разные структуры данных.

2. **Firestore collection paths** — конкретные пути, например:
   - `users/{uid}`
   - `users/{uid}/projects/{projectId}`
   - `users/{uid}/projects/{projectId}/jobs/{jobId}`
   Сейчас они не определены явно, и разные задачи могут обратиться к разным путям.

3. **Стратегия встраивания шрифтов в PDF** — это технически сложный момент, который вообще не упомянут. `pdf-lib` требует бинарного `.ttf`/`.otf` файла для каждого шрифта. Кириллические шрифты (Arial, PT Serif) нельзя просто указать по имени — их нужно загружать из GCS или бандлить с функцией. Это нужно решить на уровне документации, иначе задача 7.2 провалится.

4. **Система координат** — нужно явно описать как именно координаты из canvas-редактора (display px, масштабированные) конвертируются в координаты PDF (pt, origin снизу-слева в pdf-lib). Это граница между эпиком 6 и эпиком 7.

---

**Желательно (ускорит работу AI):**

5. **Детальная структура папок Angular** — конкретное дерево файлов: какие модули, какие компоненты в каких feature-папках.

6. **Список переменных окружения** — имена всех env vars для Angular (`environment.ts`) и Cloud Functions.

7. **Ограничения системы** — максимальное количество строк в Excel, лимит времени выполнения Cloud Function (GCP 2nd gen: max 60 мин), что делать если участников > N.

---

**Можно пропустить:**

- Wireframes/макеты — если у вас нет дизайна, AI справится без них.
- CI/CD детали — Story 1.4 достаточно подробная.

---

**Вывод:** добавьте пункты 1–4, и можно стартовать. Хотите, я дополню документацию этими разделами?

User: создай отдельно файл и опиши в нем свои наилучшие предложения по пунктам 1-4

GitHub Copilot: Created [](file:///c%3A/_c/_sertif_/TECHNICAL_SPEC.md)

Файл TECHNICAL_SPEC.md создан. Вот что в нём описано:

---

**Раздел 1 — REST API (полная спецификация)**
- 12 эндпоинтов с точными JSON-схемами запросов и ответов
- Стратегия аутентификации (Bearer token на каждый запрос)
- Единая структура ошибок с кодами
- Двухшаговый upload шаблона (signed URL → confirm), чтобы файлы не шли через функцию

**Раздел 2 — Структура Firestore**
- Точные пути: `/users/{uid}/projects/{projectId}/jobs/{jobId}`
- Полные схемы всех документов с типами
- Готовые Firestore Security Rules
- Структура папок в Cloud Storage с lifecycle rules (ZIP удаляется через 24ч)

**Раздел 3 — Стратегия шрифтов в PDF**
- Выбраны 5 шрифтов с полной поддержкой кириллики, все open-source: PT Serif, PT Sans, Roboto, Open Sans, Times New Roman
- Схема разрешения файла шрифта по `fontFamily` + `bold` + `italic`
- Таблица маппинга: ключ в Firestore → Google Fonts CSS name для Fabric.js — чтобы canvas и PDF выглядели одинаково

**Раздел 4 — Система координат**
- Описаны все три системы: canvas display px → template px → PDF points (pt)
- Точные формулы конвертации с учётом того, что в pdf-lib ось Y идёт снизу вверх
- Логика смещения для выравнивания text (left/center/right)
- Правило инференса DPI по размеру шаблона (без запроса у пользователя)

Made changes.

User: Создай еще один документ в котором порекомендуй наилучшую структуру папок проекта а так же - какие библиотеки и какие их версии ты рекомендуешь использовать.

GitHub Copilot: Created [](file:///c%3A/_c/_sertif_/PROJECT_STRUCTURE_AND_DEPS.md)

Файл PROJECT_STRUCTURE_AND_DEPS.md создан. Вот что в нём:

---

**Раздел 1 — Monorepo layout**
Один репозиторий с тремя папками: `frontend/`, `functions/`, `shared/` (общие TypeScript-типы). Объяснено почему monorepo, а не два отдельных репо.

**Раздел 2 — Angular folder structure**
Полное дерево файлов по принципу feature-based: `core/` (синглтоны), `features/auth|projects|workspace|editor|generation/` (один каталог на эпик), `shared/` (переиспользуемые компоненты), `layout/`, `i18n/`, `styles/`.

**Раздел 3 — Cloud Functions folder structure**
Чистое разделение: `routes/` → `services/` → `middleware/` → `triggers/`. Каждый роутер соответствует своему эндпоинту из TECHNICAL_SPEC.

**Раздел 4 — Frontend зависимости с версиями**
Angular 21, AngularFire 21, Firebase SDK 11, Fabric.js **6.4** (не 5!), RxJS 7.8, Angular Material 21. Для каждой библиотеки объяснено почему выбрана именно она, а не альтернативы.

**Раздел 5 — Backend зависимости с версиями**
Express 4 (не 5 — нестабилен в serverless), pdf-lib 1.17, xlsx **0.18.5** (жёстко зафиксирована — v0.19+ сменила MIT на проприетарную лицензию), sharp 0.33, archiver 7, zod 3.23. Отдельная заметка про сборку `sharp` для Linux при деплое с Windows.

**Раздел 6 — Shared tooling**
Схема пакета `@diplomagen/shared` для общих типов, `.nvmrc` с Node 22, обоснование выбора npm.

**Раздел 7 — Environment variables**
Полный список env vars для Angular (`environment.ts`) и Cloud Functions с рекомендованными значениями.

**Матрица совместимости** — сводная таблица всех версий с проверкой совместимости.

Made changes.