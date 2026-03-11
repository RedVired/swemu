# swemu
swemu — это настраиваемая среда выполнения для микроконтроллеров Stormworks SWLua и симуляции связи между ними.

Среда основана на Lua-эмуляторе Fengari и позволяет запускать несколько микроконтроллеров и моделировать их взаимодействие через composite-bus.
# Использование API
## Подключение
Установка:
``` js
npm install swemu
```
Подключение:
``` js
import * as swemu from “swemu”
```
## Объект конфигурации
Микроконтроллеры и связи между ними настраиваются с помощью одного объекта конфигурации.

Этот объект можно создать вручную или получить парсингом YAML/YML файла.

Вид файла конфигурации:
```js
{
  services: {
    a: { filePath: "/a.lua" },
    b: { filePath: "/b.lua" },
  },
  links: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
  log: { console: true, bus: false },
  simulation: {tickHz: 60}
}
```

Более подробное описание в /docs
## Создание среды
Среда выполнения представлена классом SWSimulator

Создание конфига:
```js
const config = {
  services: {
    a: { filePath: "/a.lua" },
    b: { filePath: "/b.lua" },
  },
  links: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
}
```
Создание объекта среды:
``` js
const sim = new swemu.SWSimulator(config)
```
## Запуск
Есть 2 способа запуска:
- Запуск симуляции в реальном времени:
```js
sim.run({log: true})
```
 - Запуск мгновенной симуляции некоторого кол-ва тиков:
 ```js
 sim.runInterval(steps,{log: true})
 ```

Более подробное описание параметров запуска в /docs
## Пример
```js
import * as swemu from ‘swemu’

const config = {
  services: {
    a: { filePath: "./a.lua" },
    b: { filePath: "./b.lua" },
  },
  links: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
}

const sim = swemu.SWSimulator(config)

sim.run({log: true})
```

# Добавленный lua api
- `print()`
- `getNumber(index, value)`
- `getBool(index, value)`
- `setNumber(index, value)`
- `setBool(index, value)`
api соответствует pony ide api
# Отсутствующие функции
- cli-утилита
- yaml/yml конфигурация
