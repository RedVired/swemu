// swemu.js (ESM)
import fs from "node:fs";
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from "fengari";

/**
 * CompositeBus: 32 number channels (24-bit notionally) + 32 bool channels.
 * В симуляторе мы храним как JS number/boolean. Ограничения (24-bit) можно добавить позже.
 */
export class CompositeBus {
  constructor(numChannels = 32, boolChannels = 32) {
    this.num = new Array(numChannels).fill(0);
    this.bool = new Array(boolChannels).fill(false);
  }
}

/**
 * One SW-like microcontroller runtime:
 * - One Lua state (VM)
 * - Injects: input.getNumber(i), input.getBool(i), output.setNumber(i, v), output.setBool(i, v)
 * - Runs Lua code once, then ticks by calling global onTick()
 */
export class SWMicrocontroller {
  constructor({ luaCode, name = "mc", consolelog } = {}) {
    this.name = name;
    this.consolelog = consolelog;
    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);

    // local "hardware" state
    this.input = {
      num: new Array(32).fill(0),
      bool: new Array(32).fill(false),
    };
    this.output = {
      num: new Array(32).fill(0),
      bool: new Array(32).fill(false),
    };

    // Inject SW-like API into Lua global env
    this.#injectIO();

    // Load & execute Lua script ONCE
    this.#runLuaChunk(luaCode);

    // Ensure onTick exists (optional but helpful)
    this.hasOnTick = this.#hasGlobalFunction("onTick");
  }

  static fromFile(path, opts = {}) {
    const luaCode = fs.readFileSync(path, "utf8");
    return new SWMicrocontroller({ luaCode, ...opts });
  }

  /** Copy bus -> inputs */
  readFromBus(bus) {
    for (let i = 0; i < this.input.num.length && i < bus.num.length; i++)
      this.input.num[i] = bus.num[i];
    for (let i = 0; i < this.input.bool.length && i < bus.bool.length; i++)
      this.input.bool[i] = bus.bool[i];
  }

  /** Copy outputs -> bus */
  writeToBus(bus) {
    for (let i = 0; i < this.output.num.length && i < bus.num.length; i++)
      bus.num[i] = this.output.num[i];
    for (let i = 0; i < this.output.bool.length && i < bus.bool.length; i++)
      bus.bool[i] = this.output.bool[i];
  }

  /** One tick: call onTick() if present */
  tick() {
    if (!this.hasOnTick) return;

    // push global function onTick onto Lua stack
    lua.lua_getglobal(this.L, to_luastring("onTick"));

    // call with 0 args, 0 results
    const status = lua.lua_pcall(this.L, 0, 0, 0);
    if (status !== lua.LUA_OK) {
      const err = this.#popError();
      throw new Error(`[${this.name}] Lua onTick error: ${err}`);
    }
  }

  // -------------------- internals --------------------

  #runLuaChunk(code) {
    if (typeof code !== "string")
      throw new TypeError("luaCode must be a string");
    const status = lauxlib.luaL_dostring(this.L, to_luastring(code));
    if (status !== lua.LUA_OK) {
      const err = this.#popError();
      throw new Error(`[${this.name}] Lua load error: ${err}`);
    }
  }

  #popError() {
    const msg = to_jsstring(lua.lua_tostring(this.L, -1));
    lua.lua_pop(this.L, 1);
    return msg;
  }

  #hasGlobalFunction(name) {
    lua.lua_getglobal(this.L, to_luastring(name));
    const isFunc = lua.lua_type(this.L, -1) === lua.LUA_TFUNCTION;
    lua.lua_pop(this.L, 1);
    return isFunc;
  }

  #injectIO() {
    // Create global table "input" with functions getNumber/getBool
    this.#setGlobalTable("input", {
      getNumber: (idx) => this.#ioGetNumber(idx),
      getBool: (idx) => this.#ioGetBool(idx),
    });

    // Create global table "output" with functions setNumber/setBool
    this.#setGlobalTable("output", {
      setNumber: (idx, val) => this.#ioSetNumber(idx, val),
      setBool: (idx, val) => this.#ioSetBool(idx, val),
    });

    // Optional: print alias with prefix (debug)
    this.#setGlobalFunction("print", (...args) => {
      if (this.consolelog) {
        console.log(`[${this.name}]`, ...args);
      }
    });
  }

  #setGlobalFunction(name, fn) {
    lua.lua_pushcfunction(this.L, (L) => {
      // Lua passes args on stack 1..n
      const n = lua.lua_gettop(L);
      const args = [];
      for (let i = 1; i <= n; i++) {
        const t = lua.lua_type(L, i);
        if (t === lua.LUA_TNUMBER) args.push(lua.lua_tonumber(L, i));
        else if (t === lua.LUA_TBOOLEAN)
          args.push(lua.lua_toboolean(L, i) !== 0);
        else if (t === lua.LUA_TSTRING)
          args.push(to_jsstring(lua.lua_tostring(L, i)));
        else args.push(`[lua:${t}]`);
      }
      fn(...args);
      return 0; // return values count to Lua
    });
    lua.lua_setglobal(this.L, to_luastring(name));
  }

  #setGlobalTable(tableName, methods) {
    lua.lua_newtable(this.L); // push new table

    for (const [k, jsFn] of Object.entries(methods)) {
      lua.lua_pushstring(this.L, to_luastring(k));
      lua.lua_pushcfunction(this.L, (L) => {
        // expect args: (idx, [val])
        const n = lua.lua_gettop(L);

        // 1st arg: channel index (1-based like SW)
        const idx = n >= 1 ? lua.lua_tonumber(L, 1) : 0;

        // 2nd arg optional
        const val =
          n >= 2
            ? lua.lua_type(L, 2) === lua.LUA_TBOOLEAN
              ? lua.lua_toboolean(L, 2) !== 0
              : lua.lua_tonumber(L, 2)
            : undefined;

        const result = jsFn(idx, val);

        // If jsFn returns something, push it
        if (result === undefined) return 0;

        if (typeof result === "boolean") lua.lua_pushboolean(L, result ? 1 : 0);
        else if (typeof result === "number") lua.lua_pushnumber(L, result);
        else lua.lua_pushstring(L, to_luastring(String(result)));

        return 1;
      });
      lua.lua_settable(this.L, -3); // table[k] = function
    }

    lua.lua_setglobal(this.L, to_luastring(tableName)); // _G[tableName] = table
  }

  // IO: channel indices in SW are 1-based
  #ioGetNumber(idx) {
    const i = (idx | 0) - 1;
    if (i < 0 || i >= this.input.num.length) return 0;
    return this.input.num[i];
  }

  #ioGetBool(idx) {
    const i = (idx | 0) - 1;
    if (i < 0 || i >= this.input.bool.length) return false;
    return this.input.bool[i];
  }

  #ioSetNumber(idx, val) {
    const i = (idx | 0) - 1;
    if (i < 0 || i >= this.output.num.length) return;
    // Optional 24-bit clamp (Stormworks-ish). Можешь включить.
    // const v = (val ?? 0) | 0;
    // this.output.num[i] = (v & 0xFFFFFF);
    this.output.num[i] = Number(val ?? 0);
  }

  #ioSetBool(idx, val) {
    const i = (idx | 0) - 1;
    if (i < 0 || i >= this.output.bool.length) return;
    this.output.bool[i] = !!val;
  }
}

/**
 * Two-node tick simulator with a shared bus.
 * You decide order: A tick then B tick (or vice versa).
 */
export class SWTwinSimulator {
  constructor({ a, b, bus = new CompositeBus(), tickHz = 60 } = {}) {
    this.a = a;
    this.b = b;
    this.bus = bus;
    this.tick = 0;
    this.tickHz = tickHz;
  }

  stepOnce({ order = "AthenB" } = {}) {
    this.tick++;

    // Both read current bus into inputs at the start of tick
    this.a.readFromBus(this.bus);
    this.b.readFromBus(this.bus);

    if (order === "AthenB") {
      this.a.tick();
      // After A tick, it writes outputs to bus
      this.a.writeToBus(this.bus);

      // B sees updated bus on same step? В SW это зависит от модели.
      // Если хочешь "один тик на data, следующий тик на ack", НЕ обновляй inputs B здесь.
      // Сейчас модель "последовательно в рамках шага".
      this.b.readFromBus(this.bus);
      this.b.tick();
      this.b.writeToBus(this.bus);
    } else {
      this.b.tick();
      this.b.writeToBus(this.bus);

      this.a.readFromBus(this.bus);
      this.a.tick();
      this.a.writeToBus(this.bus);
    }
  }

  run(steps = 60, opts = {}) {
    for (let i = 0; i < steps; i++) this.stepOnce(opts);
  }
}

{
  //fake code
  let config = {
    services: {
      a: { filePath: "" },
      b: { filePath: "" },
    },
    links: [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ],
    log: { console: true, bus: false },
    simulation: {tickHz: 60}
  };
}

//the entry point for simulator
export class SWSimulator {
  constructor(config) {
    this.servicesConfig = config.services ?? {};
    this.links = config.links ?? {};
    this.tick = 0;

    this.tickHz = config.simulation?.tickHz ?? 60;

    this.consolelog = config.log?.console ?? false;
    this.buslog = config.log?.bus ?? false;

    this.services = {};
    this.buses = {};

    //servisec init
    for (let key in this.servicesConfig) {
      this.services[key] = SWMicrocontroller.fromFile(
        this.servicesConfig[key].filePath,
        { name: key, consolelog: this.consolelog },
      );
    }

    //buses init
    for (let i of this.links) {
      if (!this.buses[i.from]) {
        //bus init
        this.buses[i.from] = new CompositeBus();
      } else {
        console.log("!OVERWRITING BUS! check the configuration file");
      }

      let currentBus = this.buses[i.from];

      //setting bus writer
      this.services[i.from].outputBus = currentBus;

      //setting bus listners
      for (let t of i.to) {
        if (this.services[t].inputBus) {
          console.log(
            "!OVERWRITING INPUT(links: to)! check the configuration file",
          );
        }
        this.services[t].inputBus = currentBus;
      }
    }
  }

  stepOnce() {
    this.tick++;

    for (let service of Object.values(this.services)) {
      service.readFromBus(service.inputBus);
      service.tick();
      service.writeToBus(service.outputBus);
    }
  }

  run() {
    this.stepOnce();

    if (this.buslog) {
      console.log(this.buses);
    }

    setTimeout(() => this.run({ log }), 1000 / this.tickHz);
  }

  runInterval(steps = 10) {
    for (let i = 0; i < steps; i++) {
      this.stepOnce();
      if (this.buslog) {
      console.log(this.buses);
    }
    }
  }
}
