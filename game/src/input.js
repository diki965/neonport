// Keyboard and mouse state, in canvas coordinates. The game reads this, never
// the DOM events directly, so the same input works for real players and for the
// screenshot scenes that drive the game through staged keys.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // keys pressed since the last poll, cleared by endFrame
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    wheel: 0,
    anyKey: false,
  };

  const keyName = (e) => {
    const k = e.key.toLowerCase();
    return k === ' ' ? 'space' : k;
  };

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(k)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(k);
      input.pressed.add(k);
      input.anyKey = true;
    }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(keyName(e)));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
      input.anyKey = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.down = (k) => input.keys.has(k);
  // Pure read: several systems check the same key in one step ('e' means
  // both "enter a car" and "use the shop"), so consuming on read would starve
  // the later ones. The frame loop clears `pressed` after its first fixed
  // step instead, so one press still fires exactly once per frame.
  input.wasPressed = (k) => input.pressed.has(k);
  input.axis = () => {
    let x = 0;
    let y = 0;
    if (input.down('a') || input.down('arrowleft')) x -= 1;
    if (input.down('d') || input.down('arrowright')) x += 1;
    if (input.down('w') || input.down('arrowup')) y -= 1;
    if (input.down('s') || input.down('arrowdown')) y += 1;
    return { x, y };
  };
  input.endFrame = () => {
    input.pressed.clear();
    input.mousePressed = false;
    input.anyKey = false;
  };
  return input;
}
