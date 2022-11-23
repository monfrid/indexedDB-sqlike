# IndexedDB SQLike

Nothing special just a class promysifying the API. Work with IndexedDB the easy way. 

### Example

* Usage
```
  async create(data) => {
    await db.insert({
      on: "posts",
      set: data,
    });
  }
```

* Schema

Do not worry, you do not have to index all the fields you want to be on the model and you do not have to mention it in the schema at all. (AND you can have nested whatever if you want you, you wont be able to update it easylu though)
```
{
  name: "posts",
  options: { autoIncrement: false, keyPath: "id" },
  indexes: [
    { name: "userId", keyPath: "userId", unique: false },
    { name: "id", keyPath: "id", unique: true },
    { name: "createdAt", keyPath: "createdAt", unique: false },
  ],
};

```