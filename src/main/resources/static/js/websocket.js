 /**
 * ScribbleSocket — thin wrapper around SockJS + STOMP.js used by
 * lobby.js and game.js. Handles connect / reconnect / subscribe / send.
 */
(function (global) {
  function ScribbleSocket() {
    this.client = null;
    this.connected = false;
    this.subscriptions = [];
    this.onConnectHandlers = [];
    this.onDisconnectHandlers = [];
    this.reconnectAttempts = 0;
  }

  ScribbleSocket.prototype.connect = function () {
    const self = this;

    return new Promise((resolve) => {

      this.client = new StompJs.Client({

        /*
         * IMPORTANT:
         *
         * Create a NEW SockJS connection every time STOMP tries
         * to connect/reconnect.
         *
         * Do NOT create SockJS once outside this function and
         * return the same closed connection during reconnect.
         */
        webSocketFactory: () => {
          return new SockJS('/ws-scribble');
        },

        /*
         * STOMP automatically attempts to reconnect after a
         * connection failure.
         */
        reconnectDelay: 2000,

        /*
         * Generous heartbeat intervals so temporary browser
         * throttling does not unnecessarily kill the connection.
         */
        heartbeatIncoming: 30000,
        heartbeatOutgoing: 30000,

        debug: () => {},
      });

      this.client.onConnect = () => {
        self.connected = true;
        self.reconnectAttempts = 0;

        /*
         * onConnect is called again after a successful reconnect.
         *
         * game.js/lobby.js already put their subscriptions and
         * /player/join logic inside their onConnect handlers.
         * Therefore those handlers will run again automatically
         * after reconnecting.
         */
        self.onConnectHandlers.forEach((fn) => fn());

        resolve(self);
      };

      this.client.onWebSocketClose = () => {
        self.connected = false;

        /*
         * This only tells the UI that the connection has closed.
         * STOMP itself will continue trying to reconnect because
         * reconnectDelay is enabled.
         */
        self.onDisconnectHandlers.forEach((fn) => fn());
      };

      this.client.onStompError = () => {
        self.connected = false;

        self.onDisconnectHandlers.forEach((fn) => fn());
      };

      this.client.activate();
    });
  };

  ScribbleSocket.prototype.onConnect = function (fn) {
    this.onConnectHandlers.push(fn);
  };

  ScribbleSocket.prototype.onDisconnect = function (fn) {
    this.onDisconnectHandlers.push(fn);
  };

  ScribbleSocket.prototype.subscribe = function (
    destination,
    callback
  ) {
    if (!this.client || !this.connected) return;

    const sub = this.client.subscribe(
      destination,
      (message) => {
        try {
          callback(JSON.parse(message.body));
        } catch (e) {
          callback(message.body);
        }
      }
    );

    this.subscriptions.push(sub);

    return sub;
  };

  ScribbleSocket.prototype.send = function (
    destination,
    body
  ) {
    if (!this.client || !this.connected) return;

    this.client.publish({
      destination: destination,
      body: JSON.stringify(body || {})
    });
  };

  ScribbleSocket.prototype.disconnect = function () {
    if (this.client) {
      this.client.deactivate();
    }

    this.connected = false;
  };

  global.ScribbleSocket = ScribbleSocket;

})(window);


/* ---------- small shared UI helpers used across pages ---------- */

function showToast(text, kind) {
  const stack = document.getElementById('toast-stack');

  if (!stack) return;

  const el = document.createElement('div');

  el.className =
    'toast' + (kind ? ' toast-' + kind : '');

  el.textContent = text;

  stack.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}


function showConnBanner(text) {
  let banner =
    document.getElementById('conn-banner');

  if (!banner) {
    banner = document.createElement('div');

    banner.id = 'conn-banner';

    document.body.appendChild(banner);
  }

  banner.textContent = text;

  banner.classList.add('show');
}


function hideConnBanner() {
  const banner =
    document.getElementById('conn-banner');

  if (banner) {
    banner.classList.remove('show');
  }
}


function getSession() {
  const raw =
    sessionStorage.getItem('scribble-session');

  return raw ? JSON.parse(raw) : null;
}


function setSession(data) {
  sessionStorage.setItem(
    'scribble-session',
    JSON.stringify(data)
  );
}