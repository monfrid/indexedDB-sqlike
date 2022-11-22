class Message {
  constructor(message) {
    console.log(message);
  }
}
export class ConnectedMessage extends Message {
  constructor(name, version) {
    super(`DB: connected succesfully. Name: ${name} | Version: ${version}`);
  }
}

export class CantSave extends Message {
  constructor(type) {
    super(`DB: can not save this type of data to IndexedDB - ${type}`);
  }
}
