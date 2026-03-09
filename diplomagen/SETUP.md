# DiplomaGen — Инструкция по развёртыванию проекта

Это пошаговая инструкция по запуску проекта **с нуля** на новом компьютере. Читайте каждый шаг по порядку.

---

## Содержание

1. [Что нужно установить](#1-что-нужно-установить)
2. [Клонирование проекта](#2-клонирование-проекта)
3. [Установка зависимостей](#3-установка-зависимостей)
4. [Настройка Firebase](#4-настройка-firebase)
5. [Первый запуск](#5-первый-запуск)
6. [Обычный запуск (в дальнейшем)](#6-обычный-запуск-в-дальнейшем)
7. [Как остановить приложение](#7-как-остановить-приложение)
8. [Адреса сервисов](#8-адреса-сервисов)
9. [Решение типичных проблем](#9-решение-типичных-проблем)

---

## 1. Что нужно установить

Установите по порядку. Ничего из этого пропускать нельзя.

### 1.1 Node.js 22 LTS

Скачайте с официального сайта: https://nodejs.org/  
Выберите версию **22 LTS** (не последнюю, а именно LTS).

Проверка после установки:
```powershell
node --version   # должно показать v22.x.x
npm --version    # должно показать 10.x.x или выше
```

---

### 1.2 Java (JDK 21 или новее)

Firebase эмуляторам (Firestore, Auth) нужна Java.

Скачайте **Eclipse Temurin JDK** (бесплатный):  
https://adoptium.net/temurin/releases/

Выберите: **Windows** → **x64** → **JDK** → **installer (.msi)**. Подойдёт любая версия от 21 и выше.

Проверка после установки (в **новом** окне терминала):
```powershell
java -version   # должно показать openjdk version "21..." или новее
```

> ⚠️ Если `java` не найдена после установки — обязательно откройте **новый** терминал. Если всё равно не работает, см. [раздел 8](#-java-не-найдена).

---

### 1.3 Firebase CLI

Это инструмент командной строки для работы с Firebase эмуляторами.

```powershell
npm install -g firebase-tools
```

Проверка:
```powershell
firebase --version   # должно показать 13.x.x или выше
```

---

### 1.4 Angular CLI (опционально, но удобно)

```powershell
npm install -g @angular/cli
```

Проверка:
```powershell
ng version
```

> Без Angular CLI тоже можно работать через `npm start`, просто некоторые команды будут длиннее.

---

## 2. Клонирование проекта

Если у вас уже есть папка с проектом — пропустите этот шаг.

```powershell
git clone <URL репозитория>
cd diplomagen
```

Структура папки после клонирования:
```
diplomagen/
├── frontend/      ← Angular приложение
├── functions/     ← Cloud Functions (бэкенд)
├── shared/        ← общие TypeScript-типы
├── firebase.json  ← конфиг Firebase
└── start-local.ps1← скрипт запуска
```

---

## 3. Установка зависимостей

Нужно установить зависимости в трёх папках. Выполняйте команды по порядку.

Откройте PowerShell и перейдите в корень проекта:
```powershell
cd путь\к\diplomagen
```

### Шаг 1 — собрать shared-пакет

```powershell
cd shared
npm install
npm run build
cd ..
```

> Shared — это общие TypeScript-типы, которые используются и фронтендом, и бэкендом. Собрать нужно один раз (и повторять при изменении файлов в `shared/src/`).

### Шаг 2 — установить зависимости фронтенда

```powershell
cd frontend
npm install
cd ..
```

### Шаг 3 — установить зависимости бэкенда

```powershell
cd functions
npm install
cd ..
```

> После `npm install` в `functions/` могут быть предупреждения про `sharp` — это норма.

---

## 4. Настройка Firebase

### 4.1 Войти в Firebase CLI

```powershell
firebase login
```

Откроется браузер с запросом на авторизацию через Google-аккаунт. Войдите под аккаунтом, у которого есть доступ к Firebase-проекту `diplomagen-dev`.

Проверка:
```powershell
firebase projects:list   # должен показать diplomagen-dev в списке
```

> Если у вас **нет доступа** к проекту `diplomagen-dev` — создайте свой (см. раздел 4.2). Если есть доступ — переходите к разделу 5.

---

### 4.2 Создание нового Firebase-проекта (только если нет доступа к diplomagen-dev)

1. Откройте https://console.firebase.google.com/
2. Нажмите **Add project** → введите название → создайте
3. В проекте включите:
   - **Authentication** → Sign-in method → **Google** (Enable)
   - **Firestore Database** → Create database → **Start in test mode** → выберите регион `europe-central2`
   - **Storage** → Get started → **Start in test mode**

4. Скопируйте конфигурацию: шестерёнка → **Project settings** → вкладка **Your apps** → Web app → **Config**

5. Откройте файл [frontend/src/environments/environment.ts](frontend/src/environments/environment.ts) и замените содержимое:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "ВСТАВЬТЕ_СЮДА",
    authDomain: "ВАШ_ПРОЕКТ.firebaseapp.com",
    projectId: "ВАШ_ПРОЕКТ",
    storageBucket: "ВАШ_ПРОЕКТ.firebasestorage.app",
    messagingSenderId: "ВСТАВЬТЕ_СЮДА",
    appId: "ВСТАВЬТЕ_СЮДА",
  },
  apiBaseUrl: 'http://localhost:5001/ВАШ_ПРОЕКТ/europe-central2/api',
};
```

6. Обновите `.firebaserc` в корне проекта:

```json
{
  "projects": {
    "default": "ВАШ_ПРОЕКТ_ID"
  }
}
```

---

## 5. Первый запуск

### Вариант A — через скрипт (самый простой)

В корне проекта есть готовый скрипт `start-local.ps1`. Он сам соберёт бэкенд и запустит всё.

```powershell
cd путь\к\diplomagen
powershell -ExecutionPolicy Bypass -File ".\start-local.ps1"
```

> ⚠️ Именно так, через `powershell -ExecutionPolicy Bypass -File` — не просто `.\start-local.ps1`.  
> Это нужно из-за политики выполнения скриптов в Windows, которая по умолчанию запрещает запуск `.ps1` файлов.

Скрипт откроет два дополнительных окна:
- одно с Firebase эмуляторами
- одно с Angular

Подождите ~15 секунд пока всё поднимется, затем откройте http://localhost:4200

Нажмите **ENTER** в основном (первом) окне скрипта, чтобы остановить все процессы.

---

### Вариант B — вручную (три отдельных терминала)

Если скрипт не запускается, используйте три терминала:

**Терминал 1 — сборка бэкенда:**
```powershell
cd путь\к\diplomagen\functions
npm run build
```

**Терминал 2 — Firebase эмуляторы:**
```powershell
cd путь\к\diplomagen
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

Подождите сообщения: `All emulators ready!`

**Терминал 3 — Angular:**
```powershell
cd путь\к\diplomagen\frontend
npm start
```

Подождите сообщения: `Local: http://localhost:4200/`

---

### Проверка

Откройте в браузере http://localhost:4200

Должна открыться страница входа. Нажмите **Sign in with Google** — откроется **фейковый экран входа** от Firebase эмулятора (это нормально, это не настоящий Google). Введите любой email (например, `test@test.com`) и войдите.

---

## 6. Обычный запуск (в дальнейшем)

После первого сетапа каждый следующий запуск — просто:

```powershell
cd путь\к\diplomagen
powershell -ExecutionPolicy Bypass -File ".\start-local.ps1"
```

Если вы изменяли файлы в `functions/src/` — скрипт пересобирает их автоматически перед запуском.

Если вы изменяли файлы в `shared/src/` — нужно вручную пересобрать shared:
```powershell
cd shared
npm run build
```

---

## 7. Как остановить приложение

### Способ 1 — через скрипт (если окно ещё открыто)

В основном окне, где вы запускали `start-local.ps1`, нажмите **ENTER**.
Скрипт завершит оба процесса (эмуляторы + Angular) и сохранит данные Firestore в папку `emulator-data/`.

---

### Способ 2 — если закрыли окно скрипта или процессы зависли

Выполните в PowerShell:

```powershell
# Останавливает всё что слушает порты приложения
@(4000, 4200, 5001, 8080, 9099, 9199) | ForEach-Object {
    $port = $_
    netstat -ano | Select-String ":$port " | ForEach-Object {
        $pid_ = ($_ -split '\s+')[-1]
        if ($pid_ -match '^\d+$' -and $pid_ -ne '0') {
            Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped PID $pid_ (port $port)"
        }
    }
}
```

> ⚠️ Если останавливаете таким способом — данные Firestore **не сохранятся** (не будет `--export-on-exit`).  
> Чтобы не терять данные, используйте Способ 1 (ENTER в окне скрипта).

---

### Способ 3 — перезагрузка компьютера

Просто перезагрузите — все порты освободятся автоматически. Данные Firestore сохранены в папке `emulator-data/` с прошлого корректного завершения.

---

## 8. Адреса сервисов

| Сервис | URL | Что там |
|---|---|---|
| Приложение | http://localhost:4200 | Angular UI |
| Firebase Emulator UI | http://localhost:4000 | Панель эмуляторов — просмотр Firestore, Auth, Storage |
| API (Cloud Functions) | http://localhost:5001/diplomagen-dev/europe-central2/api | REST API бэкенда |
| Auth эмулятор | http://localhost:9099 | Эмулятор Firebase Auth |
| Firestore эмулятор | http://localhost:8080 | Эмулятор базы данных |
| Storage эмулятор | http://localhost:9199 | Эмулятор хранилища файлов |

### Полезные URL в Emulator UI (http://localhost:4000):

- **Firestore** — можно просматривать и редактировать документы в базе
- **Authentication** — список пользователей, можно добавить тестового
- **Storage** — посмотреть загруженные файлы

---

## 9. Решение типичных проблем

---

### ❌ Скрипт не запускается (`start-local.ps1` not recognized)

```
.\start-local.ps1 : The term '.\start-local.ps1' is not recognized...
```

**Причина:** Windows по умолчанию блокирует запуск `.ps1` файлов через `.\`.

**Решение:** всегда запускайте скрипт через:
```powershell
powershell -ExecutionPolicy Bypass -File ".\start-local.ps1"
```

Либо один раз разрешите скрипты в системе (для своего пользователя):
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
После этого `.\start-local.ps1` тоже заработает.

---

### ❌ `firebase` не найден

```
firebase : The term 'firebase' is not recognized...
```

**Решение:** установите Firebase CLI и перезапустите терминал:
```powershell
npm install -g firebase-tools
```

---

### ❌ `java` не найдена

```
java : The term 'java' is not recognized...
```

**Решение 1:** перезапустите терминал (или систему) после установки JDK.

**Решение 2:** укажите путь вручную. Сначала найдите точное имя папки:
```powershell
Get-ChildItem "C:\Program Files\Eclipse Adoptium"
# выведет что-то вроде: jdk-25.0.2.10-hotspot
```

Затем пропишите путь:
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"  # замените на реальную версию
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
java -version
```

Чтобы не делать это каждый раз — `start-local.ps1` уже содержит эту строку внутри и прописывает путь автоматически.

---

### ❌ Порт уже занят

```
Error: Could not start Emulator... port 8080 is in use
```

**Решение:** завершите уже запущенные эмуляторы. Найдите и убейте процесс:
```powershell
netstat -ano | Select-String ":8080"
# Запомните PID (последнее число)
Stop-Process -Id <PID> -Force
```

Или просто перезапустите компьютер.

---

### ❌ `npm install` падает в `functions/` из-за `sharp`

`sharp` — это нативный модуль для обработки изображений. Может не собраться без правильной версии Node.js.

**Решение:** убедитесь что используете Node.js 22:
```powershell
node --version   # нужно v22.x.x
```

Если нет — установите nvm для Windows: https://github.com/coreybutler/nvm-windows  
Потом:
```powershell
nvm install 22
nvm use 22
```

---

### ❌ Ошибка при входе через Google в эмуляторе

В эмуляторе Auth фейковый экран входа появляется только если Angular правильно подключён к эмулятору. Проверьте [frontend/src/app/app.config.ts](frontend/src/app/app.config.ts) — там должен быть `connectAuthEmulator`.

---

### ❌ API не отвечает (403 / 401)

Убедитесь что:
1. Firebase эмуляторы запущены (порт 5001 доступен)
2. Вы вошли в приложение через Google (токен должен передаваться в каждом запросе)
3. URL в `environment.ts` совпадает с вашим project ID

---

### ❌ Данные пропали после перезапуска

По умолчанию эмуляторы сохраняют данные в папку `emulator-data/` при выключении (флаг `--export-on-exit`). Если запускать **без этого флага** — данные сбрасываются.

`start-local.ps1` использует `--import=./emulator-data --export-on-exit=./emulator-data` — данные сохраняются автоматически.

---

## Краткая шпаргалка

```powershell
# ──── Первый раз (один раз после клонирования) ────
cd shared      ; npm install ; npm run build
cd ..
cd frontend    ; npm install
cd ..
cd functions   ; npm install
cd ..

firebase login

# ──── Каждый раз для запуска ────
cd путь\к\diplomagen
powershell -ExecutionPolicy Bypass -File ".\start-local.ps1"

# ──── Адреса ────
# Приложение:   http://localhost:4200
# Emulator UI:  http://localhost:4000
# API:          http://localhost:5001/diplomagen-dev/europe-central2/api
```
