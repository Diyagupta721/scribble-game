(function () {
  const views = {
    create: document.getElementById('view-create'),
    join: document.getElementById('view-join'),
    howto: document.getElementById('view-howto'),
  };

  function open(view) {
    Object.values(views).forEach((v) => v.classList.add('hidden'));
    views[view].classList.remove('hidden');
    const firstInput = views[view].querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 60);
  }

  function closeAll() {
    Object.values(views).forEach((v) => v.classList.add('hidden'));
  }

  document.getElementById('btn-open-create').addEventListener('click', () => open('create'));
  document.getElementById('btn-open-join').addEventListener('click', () => open('join'));
  document.getElementById('btn-open-howto').addEventListener('click', () => open('howto'));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', closeAll);
  });

  document.querySelectorAll('.view-modal').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAll();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input.classList.toggle('input-error', Boolean(message));
    error.textContent = message || '';
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }
    return data;
  }

  // ---------- CREATE GAME ----------
  const createForm = document.getElementById('form-create');
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('create-name').value.trim();
    setFieldError('create-name', 'create-name-error', '');
    if (!name) {
      setFieldError('create-name', 'create-name-error', 'Please enter your name.');
      return;
    }

    const rounds = parseInt(document.getElementById('create-rounds').value, 10);
    const players = parseInt(document.getElementById('create-players').value, 10);
    const submitBtn = document.getElementById('btn-create-submit');
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
      const data = await postJson('/api/rooms', { hostName: name, maxRounds: rounds, maxPlayers: players });
      setSession({ roomId: data.roomId, playerId: data.playerId, playerName: data.playerName, host: true });
      window.location.href = `lobby.html?room=${data.roomId}`;
    } catch (err) {
      setFieldError('create-name', 'create-name-error', err.message);
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  });

  // ---------- JOIN GAME ----------
  const joinForm = document.getElementById('form-join');
  const joinCodeInput = document.getElementById('join-code');
  joinCodeInput.addEventListener('input', () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('join-name').value.trim();
    const code = joinCodeInput.value.trim();
    setFieldError('join-name', 'join-name-error', '');
    setFieldError('join-code', 'join-code-error', '');

    let hasError = false;
    if (!name) { setFieldError('join-name', 'join-name-error', 'Please enter your name.'); hasError = true; }
    if (!code || code.length < 4) { setFieldError('join-code', 'join-code-error', 'Enter a valid room code.'); hasError = true; }
    if (hasError) return;

    const submitBtn = document.getElementById('btn-join-submit');
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
      const data = await postJson(`/api/rooms/${code}/join`, { name });
      setSession({ roomId: data.roomId, playerId: data.playerId, playerName: data.playerName, host: false });
      window.location.href = `lobby.html?room=${data.roomId}`;
    } catch (err) {
      setFieldError('join-code', 'join-code-error', err.message);
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  });

  // deep-link support: /?join=CODE opens the join modal pre-filled
  const params = new URLSearchParams(window.location.search);
  if (params.get('join')) {
    open('join');
    joinCodeInput.value = params.get('join').toUpperCase();
  }
})();
