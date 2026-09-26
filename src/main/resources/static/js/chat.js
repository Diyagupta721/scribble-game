/**
 * ChatUI — rendering helpers for the chat / guess panel.
 */
const ChatUI = (function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollToBottom(logEl) {
    logEl.scrollTop = logEl.scrollHeight;
  }

  function appendMessage(logEl, msg, selfId) {
    const row = document.createElement('div');
    if (msg.type === 'correct') {
      row.className = 'chat-msg chat-correct';
      row.textContent = `🎉 ${msg.playerName} guessed correctly!`;
    } else if (msg.type === 'system') {
      row.className = 'chat-msg chat-system';
      row.textContent = msg.text;
    } else {
      row.className = 'chat-msg';
      const isSelf = msg.playerId === selfId;
      row.innerHTML = `<span class="chat-name">${escapeHtml(msg.playerName)}${isSelf ? ' (you)' : ''}:</span>${escapeHtml(msg.text)}`;
    }
    logEl.appendChild(row);
    scrollToBottom(logEl);

    // keep the log from growing unbounded
    while (logEl.children.length > 200) {
      logEl.removeChild(logEl.firstChild);
    }
  }

  function appendSystem(logEl, text) {
    appendMessage(logEl, { type: 'system', text }, null);
  }

  function clear(logEl) {
    logEl.innerHTML = '';
  }

  function initForm(formEl, inputEl, onSubmit) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;
      onSubmit(text);
      inputEl.value = '';
    });
  }

  return { appendMessage, appendSystem, clear, initForm, scrollToBottom };
})();
