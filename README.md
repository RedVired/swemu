# swemu

**swemu** is a configurable runtime environment for **Stormworks SWLua microcontrollers** and a simulator for communication between them.

The runtime is based on the **Fengari Lua emulator** and allows running multiple microcontrollers while simulating their interaction through a **composite bus**.

---

# Getting Started

## Installation

```bash
npm install swemu
```

## Import

```javascript
import * as swemu from "swemu"
```

---

# Configuration Object

Microcontrollers and the connections between them are configured using a single configuration object.

This object can be created manually or obtained by parsing a **YAML/YML configuration file**.

## Example configuration

```javascript
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

  simulation: { tickHz: 60 }
}
```

A more detailed description is available in **/docs**.

---

# Creating the Runtime

The runtime environment is represented by the **SWSimulator** class.

## Creating a configuration

```javascript
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

## Creating the simulator instance

```javascript
const sim = new swemu.SWSimulator(config)
```

---

# Running the Simulation

There are two ways to run the simulation.

## Real-time simulation

```javascript
sim.run({ log: true })
```

## Run a fixed number of ticks

```javascript
sim.runInterval(steps, { log: true })
```

A more detailed description of the parameters is available in **/docs**.

---

# Example

```javascript
import * as swemu from "swemu"

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

const sim = new swemu.SWSimulator(config)

sim.run({ log: true })
```

---

# Added Lua API

The following Lua functions are available inside the simulated environment:

- `print()`
- `getNumber(index, value)`
- `getBool(index, value)`
- `setNumber(index, value)`
- `setBool(index, value)`

The API is compatible with the **Pony IDE API**.

---

# Missing Features

Planned features:

- CLI utility
- YAML/YML configuration support
