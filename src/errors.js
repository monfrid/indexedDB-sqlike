export class NotImplemented extends Error {
  constructor(name) {
    super(`Not implemented yet ${name}`);
  }
}
