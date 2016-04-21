"use strict";

/**
 * Allows to decorate another object with event emitter calls.
 */
class EventsAwareObject {
  constructor(events) {
    Object.defineProperty(this, "_events", {
      enumerable: false,
      value: events
    });
  }

  on(...args) {
    return this._events.on(...args)
  }

  off(...args) {
    return this._events.off(...args);
  }

  once(...args) {
    return this._events.once(...args);
  }

  emit(...args) {
    return this._events.emit(...args);
  }
}

class EventManager {
  constructor() {
    // this.listeners = {};
    this.listeners = new Map;
  }

  on(event, callback, context) {
    let listener = {callback: callback, context: context || null};

    if (this.listeners.has(event)) {
      this.listeners.get(event).push(listener);
    } else {
      this.listeners.set(event, [listener]);
    }
    return this;
  }

  off(event, callback, context) {
    if (this.listeners.has(event)) {
      this.listeners.set(event, this.listeners.get(event).filter(listener => {
        return listener.callback != callback || listener.context != context;
      }));
    }
    return this;
  }

  once(event, listener, context) {
    this.on.apply(this, arguments);
    let i = this.listeners.get(event).length - 1;
    this.listeners.get(event)[i].once = true;
    return this;
  }

  emit(event) {
    if (event != "*") {
      this.triggerGlobalListeners.apply(this, arguments);
    }

    if (this.listeners.has(event)) {
      let args = Array.prototype.slice.call(arguments, 1);
      let listeners = this.listeners.get(event);
      let i = 0;
      listeners.forEach(listener => {
        listener.callback.apply(listener.context, args);
        if (listener.once) {
          listeners.splice(i, 1);
          i--;
        }
        i++;
      });
    }
    return this;
  }

  triggerGlobalListeners(event) {
    // if ("*" in this.listeners) {
      let args = Array.prototype.slice.call(arguments, 1);
      return this.emit("*", event, args);
    // }
  }
}

class AsyncEventManager extends EventManager {
  emit(event) {
    return new Promise((resolve, reject) => {
      let args = Array.prototype.slice.call(arguments, 1);
      let listeners = this.listeners.get(event) || [];
      let events = this;

      let trigger = function() {
        let copy = listeners.slice();
        let i = 0;

        let next = function() {
          if (i > 0 && listeners[i-1].once) {
            listeners.splice(i, 1);
            i--;
          }
          if (i >= listeners.length) {
            return resolve();
          }

          i++;

          let listener = copy.shift();

          try {
            let value = listener.callback.apply(listener.context, args);
            Promise.resolve(value).then(next, reject);
          } catch (error) {
            reject(error);
          }
          // Promise.resolve(value).then(next, error => {
          //   console.error("FAILED", error);
          // });

          // if (value instanceof Promise) {
          //   value.then(next, reject);
          // } else {
          //   // Remove this if intend to support passing 'next' as last argument
          //   // to listeners
          //   next();
          // }
        };

        // args.push(next);
        next();
      };

      if (event != "*") {
        events.triggerGlobalListeners.apply(events, [event].concat(args)).then(trigger, reject);
      } else {
        trigger();
      }
    });
  }

  triggerGlobalListeners(event) {
    let promise = super.triggerGlobalListeners.apply(this, arguments);
    return new Promise((resolve, reject) => {
      promise.then(resolve, reject);
    });
  }
}

exports.EventsAwareObject = EventsAwareObject;
exports.EventManager = EventManager;
exports.AsyncEventManager = AsyncEventManager;
