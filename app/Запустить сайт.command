#!/bin/zsh
set -e
SUPPLY_APP_DIR="${0:A:h}"
SUPPLY_PROJECT_DIR="${SUPPLY_APP_DIR:h}"
cd "$SUPPLY_APP_DIR"
export PATH="$SUPPLY_PROJECT_DIR/.tools/node/bin:$PATH"
SUPPLY_URL='http://127.0.0.1:4173/#/'
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print 'Для запуска нужна Node.js24. На исходном компьютере она находится в папке .tools проекта.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'Устанавливаю зависимости сайта по зафиксированным версиям…'
  npm ci
fi
npm run build
SUPPLY_HTML="$(curl --silent --max-time 1 http://127.0.0.1:4173/ || true)"
if [[ "$SUPPLY_HTML" == *'Отдел снабжения'* ]]; then
  print "Сайт уже запущен: $SUPPLY_URL"
  if [[ "${SUPPLY_NO_OPEN:-0}" != '1' ]]; then open "$SUPPLY_URL"; fi
  exit 0
fi
print "Запускаю сайт: $SUPPLY_URL"
print 'Оставьте это окно открытым. Чтобы остановить сайт, нажмите Ctrl+C.'
if [[ "${SUPPLY_NO_OPEN:-0}" != '1' ]]; then (sleep 1; open "$SUPPLY_URL") & fi
exec npm run preview
