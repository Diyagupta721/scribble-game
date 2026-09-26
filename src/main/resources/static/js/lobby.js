(function () {
try {
  if (window.scribbleDebugLog) window.scribbleDebugLog('lobby.js starting…');
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const session = getSession();

  if (!roomId || !session || session.roomId !== roomId) {
    window.location.href = 'index.html?join=' + (roomId || '');
    return;
  }

  const socket = new ScribbleSocket();
  let latestState = null;

  const el = {
    loader: document.getElementById('page-loader'),
    wrap: document.getElementById('lobby-wrap'),
    roomCode: document.getElementById('room-code-value'),
    status: document.getElementById('lobby-status'),
    grid: document.getElementById('player-grid'),
    count: document.getElementById('player-count'),
    startBtn: document.getElementById('btn-start-game'),
    waitingNote: document.getElementById('waiting-note'),
    leaveBtn: document.getElementById('btn-leave-lobby'),
    copyBtn: document.getElementById('btn-copy-code'),
  };

  el.roomCode.textContent = roomId;

  function initials(name) {
    return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function render(state) {
    latestState = state;
    el.grid.innerHTML = '';
    state.players.forEach((p) => {
      const tile = document.createElement('div');
      tile.className = 'player-tile' + (p.id === session.playerId ? ' self' : '');
      tile.innerHTML = `
        <div class="avatar" style="background:${p.avatarColor}">${initials(p.name)}</div>
        <div class="p-name">${escapeHtml(p.name)}${p.id === session.playerId ? ' (you)' : ''}</div>
        ${p.host ? '<span class="p-badge">HOST</span>' : ''}
      `;
      el.grid.appendChild(tile);
    });

    el.count.textContent = `Players: ${state.players.length} / ${state.maxPlayers}`;

    const me = state.players.find((p) => p.id === session.playerId);
    const isHost = me ? me.host : false;
    const canStart = state.players.length >= 2;

    el.startBtn.classList.toggle('hidden', !isHost);
    el.waitingNote.classList.toggle('hidden', isHost);
    el.startBtn.disabled = !canStart;
    el.startBtn.textContent = canStart ? 'Start Game' : 'Need at least 2 players';

    if (state.status === 'PLAYING' || state.status === 'ROUND_END') {
      window.location.href = `game.html?room=${roomId}`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  socket.onConnect(() => {
    hideConnBanner();
    socket.subscribe(`/topic/room/${roomId}`, (msg) => {
      if (msg.type === 'STATE') {
        render(msg.payload);
      } else if (msg.type === 'PLAYER_JOINED' && latestState) {
        if (msg.payload.playerId !== session.playerId) {
          showToast(`${msg.payload.playerName} joined the room`, 'success');
        }
      } else if (msg.type === 'PLAYER_LEFT') {
        showToast(`${msg.payload.playerName || 'A player'} left the room`, 'warn');
      } else if (msg.type === 'GAME_STARTED') {
        window.location.href = `game.html?room=${roomId}`;
      }
    });

    socket.send('/app/player/join', { roomId, playerId: session.playerId });

    el.loader.classList.add('hidden');
    el.wrap.classList.remove('hidden');
  });

  socket.onDisconnect(() => {
    showConnBanner('Reconnecting…');
  });

  socket.connect();

  el.startBtn.addEventListener('click', () => {
    socket.send('/app/game/start', { roomId, playerId: session.playerId });
  });

  el.leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    sessionStorage.removeItem('scribble-session');
    window.location.href = 'index.html';
  });

  el.copyBtn.addEventListener('click', async () => {
    const url = `${window.location.origin}/?join=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied!', 'success');
    } catch (e) {
      showToast(`Room code: ${roomId}`, 'success');
    }
  });

  window.addEventListener('beforeunload', () => socket.disconnect());
  if (window.scribbleDebugLog) window.scribbleDebugLog('lobby.js setup complete, connecting…');
} catch (err) {
  if (window.scribbleDebugLog) {
    window.scribbleDebugLog('❌ FATAL ERROR in lobby.js: ' + err.message);
    window.scribbleDebugLog(err.stack || '(no stack trace)');
  }
  console.error(err);
}
})();
