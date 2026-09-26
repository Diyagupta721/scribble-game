/**
 * ScribbleCanvas — encapsulates all HTML5 canvas drawing logic:
 * mouse + touch drawing, tool/color/size state, undo/redo via
 * snapshot stack, and hooks for real-time network sync.
 */
function ScribbleCanvas(canvasEl) {
  this.canvas = canvasEl;
  this.ctx = canvasEl.getContext('2d');
  this.drawing = false;
  this.last = { x: 0, y: 0 };
  this.tool = 'brush';
  this.color = '#1b1b3a';
  this.size = 6;
  this.enabled = false; // only the artist can draw
  this.undoStack = [];
  this.redoStack = [];
  this.localEventHandler = null; // (DrawingMessage-like) => void
  this._resizeObserver = null;

  this._bindEvents();
  this._setupResize();
}

ScribbleCanvas.COLORS = [
  '#1b1b3a', '#ffffff', '#ff5d73', '#ff9f43', '#ffc93c',
  '#2ec4b6', '#0984e3', '#6c5ce7', '#e84393', '#7a4a2b',
  '#e17055', '#00b894', '#636e72', '#fd79a8', '#00cec9',
  '#a29bfe', '#d63031', '#fab1a0', '#2d3436', '#dfe6e9',
];

/** Returns true if the canvas currently has a real, drawable size. */
ScribbleCanvas.prototype.hasSize = function () {
  return this.canvas.width > 0 && this.canvas.height > 0;
};

ScribbleCanvas.prototype._setupResize = function () {
  const self = this;
  const resize = () => self._resizeToContainer();
  window.addEventListener('resize', resize);
  resize();
};

/** Public: re-measure and resize against the current container size.
 *  Must be called again after the canvas becomes visible (e.g. once a
 *  parent that was `display:none` is shown), since measuring while
 *  hidden yields a 0x0 canvas that nothing can be drawn on. */
ScribbleCanvas.prototype.resize = function () {
  this._resizeToContainer();
};

ScribbleCanvas.prototype._resizeToContainer = function () {
  const rect = this.canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const prev = this.undoStack.length
    ? this.undoStack[this.undoStack.length - 1]
    : null;

  this.canvas.width = Math.round(rect.width * dpr);
  this.canvas.height = Math.round(rect.height * dpr);

  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  this.ctx.fillStyle = '#fffdf7';
  this.ctx.fillRect(0, 0, rect.width, rect.height);

  this.ctx.lineJoin = 'round';
  this.ctx.lineCap = 'round';

  if (prev) {
    this._drawImageFromDataUrl(prev);
  }
};

ScribbleCanvas.prototype._drawImageFromDataUrl = function (dataUrl) {
  const img = new Image();
  const ctx = this.ctx;
  const rect = this.canvas.getBoundingClientRect();

  img.onload = () => {
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
  };

  img.src = dataUrl;
};

ScribbleCanvas.prototype._pointerPos = function (e) {
  const rect = this.canvas.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;

  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top
  };
};

ScribbleCanvas.prototype._bindEvents = function () {
  const self = this;

  const start = (e) => {
    if (!self.enabled) {
      if (window.scribbleDebugLog) {
        window.scribbleDebugLog(
          'Draw blocked: canvas not enabled for this player right now'
        );
      }
      return;
    }

    e.preventDefault();

    self.drawing = true;
    self.last = self._pointerPos(e);

    if (window.scribbleDebugLog) {
      window.scribbleDebugLog(
        'Draw started at ' +
        JSON.stringify(self.last) +
        ' (canvas size ' +
        self.canvas.width +
        'x' +
        self.canvas.height +
        ')'
      );
    }
  };

  const move = (e) => {
    if (!self.enabled || !self.drawing) return;

    e.preventDefault();

    const pos = self._pointerPos(e);

    self._strokeSegment(
      self.last.x,
      self.last.y,
      pos.x,
      pos.y,
      self.color,
      self.size,
      self.tool
    );

    self._emitLocal({
      type: 'draw',
      prevX: self.last.x,
      prevY: self.last.y,
      x: pos.x,
      y: pos.y,
      color: self.color,
      size: self.size,
      tool: self.tool,
    });

    self.last = pos;
  };

  const end = () => {
    if (!self.enabled || !self.drawing) return;

    self.drawing = false;

    /*
     * Keep the snapshot locally for undo/redo.
     *
     * IMPORTANT:
     * Do NOT send the snapshot through WebSocket here.
     *
     * canvas.toDataURL() creates a potentially very large Base64
     * image. Sending that large message every time the artist
     * releases the mouse/pen was causing the WebSocket connection
     * to fail.
     */
    self._pushUndoSnapshot();
  };

  this.canvas.addEventListener('mousedown', start);
  this.canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  this.canvas.addEventListener('touchstart', start, { passive: false });
  this.canvas.addEventListener('touchmove', move, { passive: false });
  this.canvas.addEventListener('touchend', end);
  this.canvas.addEventListener('touchcancel', end);
};

ScribbleCanvas.prototype._strokeSegment = function (
  x0,
  y0,
  x1,
  y1,
  color,
  size,
  tool
) {
  const ctx = this.ctx;

  ctx.save();

  if (tool === 'eraser') {
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = size * 2.2;
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth =
      tool === 'pencil'
        ? Math.max(1.5, size * 0.45)
        : size;

    ctx.globalAlpha =
      tool === 'pencil'
        ? 0.85
        : 1;
  }

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // draw a dot for single clicks / very short strokes
  if (Math.hypot(x1 - x0, y1 - y0) < 1) {
    ctx.beginPath();
    ctx.arc(
      x1,
      y1,
      ctx.lineWidth / 2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  ctx.restore();
};

ScribbleCanvas.prototype._emitLocal = function (message) {
  if (this.localEventHandler) {
    this.localEventHandler(message);
  }
};

/**
 * Saves a snapshot locally for undo/redo.
 *
 * IMPORTANT:
 * This snapshot is intentionally NOT emitted to the server.
 * Large Base64 canvas snapshots can break the WebSocket connection.
 */
ScribbleCanvas.prototype._pushUndoSnapshot = function () {
  this.undoStack.push(
    this.canvas.toDataURL('image/png')
  );

  if (this.undoStack.length > 30) {
    this.undoStack.shift();
  }

  this.redoStack = [];
};

/* ---------- public API ---------- */

ScribbleCanvas.prototype.setEnabled = function (enabled) {
  this.enabled = enabled;
  this.canvas.style.cursor =
    enabled ? 'crosshair' : 'not-allowed';
};

ScribbleCanvas.prototype.setColor = function (color) {
  this.color = color;
};

ScribbleCanvas.prototype.setTool = function (tool) {
  this.tool = tool;
};

ScribbleCanvas.prototype.setSize = function (size) {
  this.size = size;
};

ScribbleCanvas.prototype.clear = function (emit) {
  const rect = this.canvas.getBoundingClientRect();

  this.ctx.fillStyle = '#fffdf7';
  this.ctx.fillRect(
    0,
    0,
    rect.width,
    rect.height
  );

  this.undoStack = [];
  this.redoStack = [];

  if (emit !== false) {
    this._emitLocal({
      type: 'clear'
    });
  }
};

ScribbleCanvas.prototype.undo = function () {
  if (this.undoStack.length === 0) {
    this.clear();
    return;
  }

  const current = this.undoStack.pop();

  this.redoStack.push(current);

  const target = this.undoStack.length
    ? this.undoStack[this.undoStack.length - 1]
    : null;

  if (target) {
    this._drawImageFromDataUrl(target);

    this._emitLocal({
      type: 'snapshot',
      snapshot: target
    });
  } else {
    this.clear(false);

    this._emitLocal({
      type: 'clear'
    });
  }
};

ScribbleCanvas.prototype.redo = function () {
  if (this.redoStack.length === 0) return;

  const target = this.redoStack.pop();

  this.undoStack.push(target);

  this._drawImageFromDataUrl(target);

  this._emitLocal({
    type: 'snapshot',
    snapshot: target
  });
};

/** Applies a message received from another player over the websocket. */
ScribbleCanvas.prototype.applyRemote = function (message) {
  if (message.type === 'draw') {
    this._strokeSegment(
      message.prevX,
      message.prevY,
      message.x,
      message.y,
      message.color,
      message.size,
      message.tool
    );
  } else if (message.type === 'clear') {
    this.clear(false);
  } else if (
    message.type === 'snapshot' &&
    message.snapshot
  ) {
    this._drawImageFromDataUrl(message.snapshot);
  }
};

ScribbleCanvas.prototype.getSnapshot = function () {
  return this.canvas.toDataURL('image/png');
};

/** Renders the palette swatches into the given container element. */
ScribbleCanvas.prototype.renderPalette = function (
  container,
  onPick
) {
  const self = this;

  container.innerHTML = '';

  ScribbleCanvas.COLORS.forEach((hex, idx) => {
    const swatch = document.createElement('button');

    swatch.type = 'button';

    swatch.className =
      'color-swatch' +
      (idx === 0 ? ' active' : '');

    swatch.style.background = hex;
    swatch.title = hex;

    swatch.addEventListener('click', () => {
      container
        .querySelectorAll('.color-swatch')
        .forEach((s) =>
          s.classList.remove('active')
        );

      swatch.classList.add('active');

      self.setColor(hex);

      if (onPick) {
        onPick(hex);
      }
    });

    container.appendChild(swatch);
  });

  const custom = document.createElement('label');

  custom.className =
    'color-swatch custom';

  custom.title = 'Custom color';

  custom.innerHTML =
    '<input type="color" value="#1b1b3a" />';

  const input = custom.querySelector('input');

  input.addEventListener('input', () => {
    container
      .querySelectorAll('.color-swatch')
      .forEach((s) =>
        s.classList.remove('active')
      );

    custom.classList.add('active');

    self.setColor(input.value);

    if (onPick) {
      onPick(input.value);
    }
  });

  container.appendChild(custom);
};

