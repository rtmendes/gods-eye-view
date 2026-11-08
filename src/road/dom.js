export const $ = (id) => document.getElementById(id);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function link(text, url) {
  const node = el('a', text);
  node.href = url;
  if (url.startsWith('https:')) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  return node;
}
export function stateGrid(states, selected, onSelect, query = '') {
  const grid = $('state-grid');
  grid.replaceChildren();
  for (const state of states.filter((s) =>
    `${s.code} ${s.name}`.toLowerCase().includes(query.toLowerCase().trim()),
  )) {
    const button = el(
      'button',
      null,
      `state-button ${state.rules ? 'reviewed' : ''}`,
    );
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.code === selected));
    button.setAttribute(
      'aria-label',
      `${state.name}: ${state.rules ? `${state.rules} reviewed speeding rules` : 'legal review pending'}`,
    );
    button.append(
      el('strong', state.code),
      el('span', state.name),
      el(
        'span',
        state.rules ? `${state.rules} reviewed rules` : 'Review pending',
      ),
    );
    button.addEventListener('click', () => onSelect(state.code));
    grid.append(button);
  }
}
