// Keyboard and mouse state. `pressed` holds edge-triggered keys for exactly
// one fixed step: the main loop clears it after the frame's first step, so a
// single press can never fire twice (one E never buys two things).

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyE: 'interact',
  KeyF: 'enter',
  Space: 'brake',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyM: 'mute',
  Enter: 'confirm',
  Escape: 'pause',
};

export function createInput() {
  const input = {
    held: {},
    pressed: {},
    mouse: { x: 0, y: 0, down: false, clicked: false },
    attach(canvas) {
      window.addEventListener('keydown', (event) => {
        const name = KEYMAP[event.code];
        if (!name) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
        if (!event.repeat) input.pressed[name] = true;
        input.held[name] = true;
      });
      window.addEventListener('keyup', (event) => {
        const name = KEYMAP[event.code];
        if (name) input.held[name] = false;
      });
      window.addEventListener('blur', () => { input.held = {}; });
      canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        input.mouse.x = event.clientX - rect.left;
        input.mouse.y = event.clientY - rect.top;
      });
      canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
      });
      window.addEventListener('mouseup', () => { input.mouse.down = false; });
    },
    /** Call once per rendered frame, after the first fixed step. */
    endFrame() {
      input.pressed = {};
      input.mouse.clicked = false;
    },
  };
  return input;
}
