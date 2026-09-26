(function () {
try {
  window.scribbleDebugLog('game.js starting…');
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const session = getSession();
  window.scribbleDebugLog('roomId=' + roomId + ' session=' + JSON.stringify(session));

  if (!roomId || !session || session.roomId !== roomId) {
    window.scribbleDebugLog('No valid room/session — redirecting to index.html');
    window.location.href = 'index.html?join=' + (roomId || '');
    return;
  }

  const socket = new ScribbleSocket();
  const canvasEl = document.getElementById('draw-canvas');
  const drawer = new ScribbleCanvas(canvasEl);

  const el = {
    loader: document.getElementById('page-loader'),
    shell: document.getElementById('game-shell'),
    round: document.getElementById('hud-round'),
    timerWrap: document.getElementById('hud-timer'),
    timerRing: document.getElementById('timer-ring-fg'),
    timerValue: document.getElementById('timer-value'),
    wordBar: document.getElementById('word-bar'),
    wordBarText: document.getElementById('word-bar-text'),
    playerList: document.getElementById('player-list'),
    playersPanel: document.getElementById('players-panel'),
    togglePlayersBtn: document.getElementById('btn-toggle-players'),
    leaveBtn: document.getElementById('btn-leave-game'),
    chatLog: document.getElementById('chat-log'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    canvasLock: document.getElementById('canvas-lock'),
    toolButtons: document.getElementById('tool-buttons'),
    undoBtn: document.getElementById('btn-undo'),
    redoBtn: document.getElementById('btn-redo'),
    clearBtn: document.getElementById('btn-clear'),
    sizeInput: document.getElementById('brush-size'),
    colorGroup: document.getElementById('color-group'),
    roundOverlay: document.getElementById('round-overlay'),
    roundArtistLine: document.getElementById('round-artist-line'),
    roundWordValue: document.getElementById('round-word-value'),
    roundEarners: document.getElementById('round-earners'),
    roundCountdown: document.getElementById('round-countdown'),
    winnerOverlay: document.getElementById('winner-overlay'),
    winnerList: document.getElementById('winner-list'),
    winnerCrown: document.getElementById('winner-crown'),
    playAgainBtn: document.getElementById('btn-play-again'),
    exitBtn: document.getElementById('btn-exit-game'),
  };

  const TIMER_CIRCUMFERENCE = 119.4;
  let latestState = null;
  let wasFinished = false;
  let timerTotalSeconds = 80;
  let roundEndCountdownTimer = null;
  let myWord = null; // filled in from ROUND_STARTED when we are the artist

  /* ---------------------------------------------------------------- */
  /* Canvas / toolbar wiring                                           */
  /* ---------------------------------------------------------------- */

  drawer.renderPalette(el.colorGroup);
  drawer.setSize(el.sizeInput.value);

  drawer.localEventHandler = (message) => {
    message.roomId = roomId;
    message.playerId = session.playerId;
    if (message.type === 'clear') {
      socket.send('/app/clear', message);
    } else {
      socket.send('/app/draw', message);
    }
  };

  el.toolButtons.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.toolButtons.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      drawer.setTool(btn.dataset.tool);
    });
  });

  el.sizeInput.addEventListener('input', () => drawer.setSize(el.sizeInput.value));
  el.undoBtn.addEventListener('click', () => drawer.undo());
  el.redoBtn.addEventListener('click', () => drawer.redo());
  el.clearBtn.addEventListener('click', () => drawer.clear());

  el.togglePlayersBtn.addEventListener('click', () => {
    el.playersPanel.classList.toggle('mobile-open');
  });

  /* ---------------------------------------------------------------- */
  /* Chat                                                               */
  /* ---------------------------------------------------------------- */

  ChatUI.initForm(el.chatForm, el.chatInput, (text) => {
    socket.send('/app/chat', { roomId, playerId: session.playerId, text });
  });

  /* ---------------------------------------------------------------- */
  /* Rendering helpers                                                  */
  /* ---------------------------------------------------------------- */

  function initials(name) {
    return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPlayers(state) {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    el.playerList.innerHTML = '';
    sorted.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'score-row' +
        (p.id === session.playerId ? ' self' : '') +
        (p.id === state.currentArtistId ? ' drawing' : '');
      row.innerHTML = `
        <span class="rank">${idx + 1}</span>
        <div class="avatar" style="background:${p.avatarColor}">${initials(p.name)}</div>
        <div class="row-info">
          <div class="row-name">
            ${escapeHtml(p.name)}${p.id === session.playerId ? ' (you)' : ''}
            ${p.id === state.currentArtistId ? '<span class="artist-tag">ARTIST</span>' : ''}
            ${p.hasGuessedCorrectly ? '<span class="correct-tag">✓</span>' : ''}
          </div>
        </div>
        <div class="row-score">${p.score}</div>
      `;
      el.playerList.appendChild(row);
    });
  }

  function renderWordBar(state) {
    const isArtist = state.currentArtistId === session.playerId;
    el.wordBar.classList.remove('is-artist', 'is-guessing');
    if (state.status !== 'PLAYING' || !state.currentArtistId) {
      el.wordBarText.textContent = state.status === 'FINISHED'
        ? 'Game over — thanks for playing!'
        : 'Waiting for the round to start…';
      return;
    }
    if (isArtist) {
      el.wordBar.classList.add('is-artist');
      el.wordBarText.textContent = myWord ? myWord.toUpperCase() : 'Get ready to draw…';
    } else {
      el.wordBar.classList.add('is-guessing');
      const blanks = Array.from({ length: state.wordLength || 0 }, () => '_').join(' ');
      el.wordBarText.textContent = blanks || 'Guess the word!';
    }
  }

  function renderCanvasLock(state) {
    const isArtist = state.currentArtistId === session.playerId;
    const playing = state.status === 'PLAYING';
    drawer.setEnabled(isArtist && playing);
    el.canvasLock.classList.toggle('hidden', isArtist || !playing);
    [el.undoBtn, el.redoBtn, el.clearBtn, ...el.toolButtons.querySelectorAll('.tool-btn')].forEach((btn) => {
      btn.disabled = !(isArtist && playing);
    });
    el.sizeInput.disabled = !(isArtist && playing);
  }

  function render(state) {
    latestState = state;
    const amIArtist = state.currentArtistId === session.playerId;
    window.scribbleDebugLog('STATE: status=' + state.status + ' round=' + state.currentRound + '/' + state.maxRounds +
      ' artistId=' + state.currentArtistId + ' myId=' + session.playerId + ' amIArtist=' + amIArtist +
      ' players=' + state.players.length);
    // self-healing fallback: if the canvas still has no real size by the time a
    // state update arrives, force a resize. Only fires while unsized, so it can
    // never wipe an already-in-progress drawing.
    if (!drawer.hasSize()) {
      drawer.resize();
      window.scribbleDebugLog('Canvas was unsized on STATE — forced resize to ' + canvasEl.width + 'x' + canvasEl.height);
    }
    el.round.textContent = `Round ${Math.max(state.currentRound, 1)}/${state.maxRounds}`;
    timerTotalSeconds = state.roundDurationSeconds || timerTotalSeconds;
    renderPlayers(state);
    renderWordBar(state);
    renderCanvasLock(state);

    if (state.status === 'LOBBY' && wasFinished) {
      window.location.href = `lobby.html?room=${roomId}`;
    }
    wasFinished = state.status === 'FINISHED';
  }

  function updateTimer(remaining) {
    el.timerValue.textContent = remaining;
    const ratio = Math.max(0, Math.min(1, remaining / timerTotalSeconds));
    el.timerRing.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - ratio));
    el.timerWrap.classList.remove('warn', 'urgent');
    if (remaining <= 10) el.timerWrap.classList.add('urgent');
    else if (remaining <= 20) el.timerWrap.classList.add('warn');
    if (remaining === 0) showToast("⏰ Time's up!", 'warn');
  }

  function showRoundOverlay(payload) {
    el.roundArtistLine.textContent = `🎨 ${payload.artistName} was the artist`;
    el.roundWordValue.textContent = payload.word ? payload.word.toUpperCase() : '—';
    el.roundEarners.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    (payload.earners || []).forEach((e, idx) => {
      const row = document.createElement('div');
      row.className = 'earner-row';
      row.innerHTML = `<span>${medals[idx] || '⭐'} ${escapeHtml(e.name)}</span><span>${e.score} pts</span>`;
      el.roundEarners.appendChild(row);
    });
    if (!payload.earners || payload.earners.length === 0) {
      const row = document.createElement('div');
      row.className = 'earner-row';
      row.innerHTML = `<span>No one guessed it this time</span><span>—</span>`;
      el.roundEarners.appendChild(row);
    }

    let secondsLeft = 5;
    el.roundCountdown.textContent = secondsLeft;
    el.roundOverlay.classList.remove('hidden');
    clearInterval(roundEndCountdownTimer);
    roundEndCountdownTimer = setInterval(() => {
      secondsLeft -= 1;
      el.roundCountdown.textContent = Math.max(secondsLeft, 0);
      if (secondsLeft <= 0) clearInterval(roundEndCountdownTimer);
    }, 1000);
  }

  function hideRoundOverlay() {
    el.roundOverlay.classList.add('hidden');
    clearInterval(roundEndCountdownTimer);
  }

  function showWinnerOverlay(results) {
    el.winnerList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    results.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'winner-row' + (idx === 0 ? ' first' : '');
      row.innerHTML = `
        <span class="w-rank">${medals[idx] || idx + 1}</span>
        <span class="w-name">${escapeHtml(r.name)}${r.id === session.playerId ? ' (you)' : ''}</span>
        <span class="w-score">${r.score}</span>
      `;
      el.winnerList.appendChild(row);
    });
    el.winnerCrown.textContent = results.length ? '👑' : '';
    el.winnerOverlay.classList.remove('hidden');
    launchConfetti();

    const me = latestState ? latestState.players.find((p) => p.id === session.playerId) : null;
    el.playAgainBtn.classList.toggle('hidden', !(me && me.host));
  }

  /* ---------------------------------------------------------------- */
  /* Confetti (lightweight canvas animation)                           */
  /* ---------------------------------------------------------------- */

  function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#ff5d73', '#ffc93c', '#2ec4b6', '#6c5ce7', '#fffdf7'];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      size: 5 + Math.random() * 6,
      speed: 2 + Math.random() * 3,
      drift: -1 + Math.random() * 2,
      rotation: Math.random() * Math.PI,
      spin: -0.2 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    const maxFrames = 260;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.speed;
        p.x += p.drift;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      frame++;
      if (frame < maxFrames) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    tick();
  }

  /* ---------------------------------------------------------------- */
  /* WebSocket wiring                                                   */
  /* ---------------------------------------------------------------- */

  socket.onConnect(() => {
    window.scribbleDebugLog('✅ WebSocket CONNECTED');
    hideConnBanner();

    socket.subscribe(`/topic/room/${roomId}`, (msg) => {
      // GameMessage envelopes always carry a "payload" key (even when null);
      // ChatMessage frames carry "playerId"/"text" instead. Route by shape.
      if (Object.prototype.hasOwnProperty.call(msg, 'payload')) {
        handleGameMessage(msg);
      } else {
        handleChatMessage(msg);
      }
    });

    socket.subscribe(`/topic/room/${roomId}/draw`, (message) => {
      if (message.playerId === session.playerId) return; // already rendered locally
      drawer.applyRemote(message);
    });

    socket.send('/app/player/join', { roomId, playerId: session.playerId });
    window.scribbleDebugLog('Sent /app/player/join roomId=' + roomId + ' playerId=' + session.playerId);

    el.loader.classList.add('hidden');
    el.shell.classList.remove('hidden');
    // The canvas was measured while its container was display:none (0x0 result).
    // Retry the resize a few times on the way out, in case layout/fonts/CSS are
    // still settling — this is self-healing rather than relying on one perfectly
    // timed call, since that's proven unreliable across browsers/machines.
    [0, 50, 150, 400, 1000].forEach((delay) => {
      setTimeout(() => {
        drawer.resize();
        window.scribbleDebugLog(`Canvas resize attempt (+${delay}ms): ${canvasEl.width}x${canvasEl.height}`);
      }, delay);
    });
  });

  socket.onDisconnect(() => {
    window.scribbleDebugLog('❌ WebSocket DISCONNECTED');
    showConnBanner('Connection lost — reconnecting…');
  });

  function handleGameMessage(msg) {
    window.scribbleDebugLog('GameMessage: ' + msg.type + ' ' + JSON.stringify(msg.payload));
    switch (msg.type) {
      case 'STATE':
        render(msg.payload);
        break;
      case 'PLAYER_JOINED':
        if (msg.payload.playerId !== session.playerId) {
          ChatUI.appendSystem(el.chatLog, `${msg.payload.playerName} joined the room`);
        }
        break;
      case 'PLAYER_LEFT':
        ChatUI.appendSystem(el.chatLog, `${msg.payload.playerName || 'A player'} left the room`);
        break;
      case 'GAME_STARTED':
        ChatUI.clear(el.chatLog);
        ChatUI.appendSystem(el.chatLog, 'The game has started! Good luck 🎨');
        hideRoundOverlay();
        break;
      case 'ROUND_STARTED':
        hideRoundOverlay();
        myWord = (msg.payload.artistId === session.playerId) ? msg.payload.word : null;
        drawer.clear(false);
        timerTotalSeconds = msg.payload.durationSeconds || timerTotalSeconds;
        updateTimer(timerTotalSeconds);
        if (msg.payload.artistId === session.playerId) {
          ChatUI.appendSystem(el.chatLog, `Your turn! Draw the word for the others.`);
        } else {
          ChatUI.appendSystem(el.chatLog, `🎨 ${msg.payload.artistName} is drawing!`);
        }
        break;
      case 'TIMER':
        updateTimer(msg.payload.remaining);
        break;
      case 'SCORE_UPDATE':
        showToast(`⭐ ${msg.payload.playerName} +${msg.payload.points} points!`, 'success');
        break;
      case 'ROUND_ENDED':
        showRoundOverlay(msg.payload);
        break;
      case 'GAME_OVER':
        showWinnerOverlay(msg.payload.results || []);
        break;
      default:
        break;
    }
  }

  function handleChatMessage(msg) {
    ChatUI.appendMessage(el.chatLog, msg, session.playerId);
  }

  socket.connect();

  /* ---------------------------------------------------------------- */
  /* Overlay actions                                                    */
  /* ---------------------------------------------------------------- */

  el.playAgainBtn.addEventListener('click', () => {
    socket.send('/app/game/restart', { roomId, playerId: session.playerId });
  });

  el.exitBtn.addEventListener('click', () => {
    socket.disconnect();
    sessionStorage.removeItem('scribble-session');
    window.location.href = 'index.html';
  });

  el.leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    sessionStorage.removeItem('scribble-session');
    window.location.href = 'index.html';
  });

  window.addEventListener('beforeunload', () => socket.disconnect());

  window.scribbleDebugLog('game.js setup complete, connecting…');
} catch (err) {
  window.scribbleDebugLog('❌ FATAL ERROR in game.js: ' + err.message);
  window.scribbleDebugLog(err.stack || '(no stack trace)');
  console.error(err);
}
})();

