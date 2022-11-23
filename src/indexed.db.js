import { typeOf, parseEntries, merge } from "./utils";
import { NotImplemented } from "./errors";
import { CantSave, ConnectedMessage } from "./messages";

export default class IDBCom {
  constructor() {
    this.connection = null;
    this.config = null;
    this.updgrading = false; // TODO remove this flag

    this.update = this.update.bind(this);
    this.upgrade = this.upgrade.bind(this);
    this.connect = this.connect.bind(this);
    this.table = this.table.bind(this);
    this.index = this.index.bind(this);
    this.insert = this.insert.bind(this);
    this.select = this.select.bind(this);
    this.store = this.store.bind(this);
    this.getAll = this.getAll.bind(this);
    this.getByIndex = this.getByIndex.bind(this);
    this.getByKey = this.getByKey.bind(this);
  }

  static promisify(request) {
    return new Promise((resolve, reject) => {
      request.oncomplete = request.onsuccess = () => resolve(request.result);
      request.onabort = request.onerror = () => reject(request.error);
    });
  }

  static typeOf = typeOf;
  static parseEntries = parseEntries;
  static merge = merge;
  static keyNames = ["id", "key"];

  get connected() {
    return !!this.connection;
  }

  async connect(config) {
    this.config = config;
    const { name, version = 1, schemas } = config;
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = this.upgrade;
    this.connection = await IDBCom.promisify(request);
    if (this.updgrading) await this.seed(schemas);
    new ConnectedMessage(name, version);
  }

  async initialize() {
    throw NotImplemented("initialize");
  }

  async upgrade(event) {
    this.updgrading = true;
    this.connection = event.target.result;
    if (event.oldVersion !== 0) throw NotImplemented("migration"); // TODO implement migration
    const { schemas } = this.config;
    for (const schema of schemas) {
      this.table(schema);
    }
  }

  async seed(schemas) {
    const seeds = [];
    for (const schema of schemas) {
      console.log("Seeding: ", schema);
      const { data, name } = schema;
      if (!data) continue;
      seeds.push(this.insert({ on: name, set: data }));
    }
    await Promise.all(seeds);
    this.updgrading = false;
  }

  table(schema) {
    const { name, options, indexes } = schema;
    const store = this.connection.createObjectStore(name, options);
    if (indexes) this.index(store, indexes);
  }

  async index(store, indexes) {
    for (const index of indexes) {
      const { name, keyPath, options } = index;
      store.createIndex(name, keyPath, options);
    }
  }

  store(name, mode) {
    const transaction = this.connection.transaction(name, mode);
    return transaction.objectStore(name);
  }

  async insert(query) {
    const { on, set } = query;
    const store = this.store(on, "readwrite");
    const type = IDBCom.typeOf(set);
    if (type === "array") set.forEach((obj) => store.add(obj));
    else if (type === "object") store.add(set);
    else {
      new CantSave(type);
      store.transaction.close();
    }
    await IDBCom.promisify(store.transaction);
    return set;
  }

  async getAll(store, limit) {
    const request = store.getAll(undefined, limit);
    return await IDBCom.promisify(request);
  }

  async getByKey(store, id) {
    const request = store.get(id);
    return await IDBCom.promisify(request);
  }

  getByIndex(store, key, value, limit) {
    const index = store.index(key);
    const result = [];
    const range = IDBKeyRange.only(value);
    const request = index.openCursor(range);
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return resolve(result);
        const data = cursor.value;
        if (data[key] === value) {
          const length = result.push(data);
          if (length === limit) return resolve(result);
        }
        cursor.continue();
      };
      request.onerror = () => reject();
    });
  }

  find(store, where) {
    const { range, ...rest } = where;
    if (range) return this.getByRange(store, range);
    const entries = IDBCom.parseEntries(rest);
    const indexed = entries.find(([key]) => store.indexNames.contains(key));
    if (indexed) {
      const [key, value] = indexed;
      return this.getByIndex(store, key, value);
    }
    return this.getAll(store);
  }

  async getByRange(store, ranges, limit) {
    const result = [];
    for (const { start, end } of ranges) {
      const range = IDBKeyRange.bound(start, end);
      const request = store.openCursor(range);
      await new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return resolve(result);
          const data = cursor.value;
          const length = result.push(data);
          if (length === limit) return resolve(result);
          cursor.continue();
        };
      });
    }
    return result;
  }

  async select(query) {
    const { from, where, limit } = query;
    const { range, ...rest } = where;
    const store = this.store(from, "readwrite");
    const entries = IDBCom.parseEntries(where);
    const filters = IDBCom.parseEntries(rest);

    if (entries.length === 0) return await this.getAll(store, limit);
    if (entries.length === 1) {
      const [[key, value]] = entries;
      if (IDBCom.keyNames.includes(key)) {
        return await this.getByKey(store, value);
      }
      if (range) {
        return await this.getByRange(store, range, limit);
      }
      if (store.indexNames.contains(key)) {
        return await this.getByIndex(store, key, value, limit);
      }
    }

    const all = await this.find(store, where);
    return all.filter((item) => {
      for (const [key, value] of filters) {
        if (item[key] !== value) return false;
        return true;
      }
    });
  }

  async update(query) {
    const { on, where, set, merge } = query;
    const store = this.store(on, "readwrite");
    const id = where.key || where.id;
    let data = set;
    if (!id) return;
    if (merge) {
      const item = await IDBCom.promisify(store.get(id));
      data = IDBCom.merge(item, set);
    }
    await IDBCom.promisify(store.put(data));
    return data;
  }

  async count(name) {
    const store = this.store(name, "readwrite");
    return await IDBCom.promisify(store.count());
  }

  async last(name) {
    const store = this.store(name, "readwrite");
    const keys = await IDBCom.promisify(store.getAllKeys());
    const last = keys.pop();
    return last;
  }

  async delete(query) {
    const { on, where } = query;
    const store = this.store(on, "readwrite");
    const key = where.key || where.id;
    return await IDBCom.promisify(store.delete(key));
  }
}
