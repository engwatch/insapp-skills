# Audio Script — расшифровка звонков и скрипт для колл-бота

Расшифровывает аудиозаписи звонков (MP3, M4A, WAV) через локальный Whisper и создаёт готовый скрипт для AI колл-бота с ветками возражений.

## Команда

```
/audio_script [папка с записями]
/audio_script ~/Downloads/calls
/audio_script "Call centr"
```

## Что делает

1. Находит все аудиофайлы в папке
2. Устанавливает `openai-whisper` и `ffmpeg` если не установлены
3. Расшифровывает каждый звонок (модель `small`, язык `ru`)
4. Размечает реплики «Менеджер / Клиент» по контексту
5. Создаёт `TRANSCRIPT_RAW.md` — все расшифровки с разметкой спикеров
6. Анализирует паттерны: типовые возражения, успешные ответы, USP
7. Создаёт `CALLBOT_SCRIPT.md` — готовый скрипт с системным промптом, ветками, стоп-фразами, JSON-конфигом

## Пример вывода

```
call-folder/
├── call_001.mp3
├── call_002.mp3
├── TRANSCRIPT_RAW.md      ← расшифровки с разметкой
└── CALLBOT_SCRIPT.md      ← скрипт для AI колл-бота
```

**Структура CALLBOT_SCRIPT.md:**
- Системный промпт с переменными `{CLIENT_NAME}`, `{PRODUCT_NAME}` и т.д.
- Приветствие (дословно из записей)
- Ветки возражений — по одной на каждый тип из реальных звонков
- Завершение разговора
- Таблица ключевых фактов (кэшбэки, USP, условия)
- Стоп-фразы и реакция бота
- JSON-конфиг (таймаут, перезвон, эскалация на оператора)

## Требования

- Python 3
- `openai-whisper` (`pip3 install openai-whisper`)
- `ffmpeg` (`brew install ffmpeg`)

```bash
pip3 install openai-whisper --break-system-packages
brew install ffmpeg   # macOS
# sudo apt install ffmpeg  # Ubuntu/Debian
```
