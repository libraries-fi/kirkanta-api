/**
 * Event manager that executes async listeners in sequential order.
 */
class PromiseEvents {
  constructor() {
    this.__listeners = new Map;
  }

  on(event_id, callback) {
    if (!this.__listeners.has(event_id)) {
      this.__listeners.set(event_id, [callback]);
    } else {
      this.__listeners.get(event_id).push(callback);
    }
    return this;
  }

  async emit(event_id, data) {
    if (this.__listeners.has(event_id)) {
      for (let callback of this.__listeners.get(event_id)) {
        await callback(data);
      }
    }
  }
}

module.exports = { PromiseEvents };
