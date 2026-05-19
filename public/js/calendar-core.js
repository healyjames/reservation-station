export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderCalendarGrid(gridEl, year, month, options = {}) {
  const {
    selectedDate = null,
    isDisabled = () => false,
    isBlocked = () => false,
    onSelect = () => {},
    onBlockedSelect = () => {},
    cellClass = 'dp-day',
    headerClass = 'dp-day-name',
  } = options;

  const _today = new Date();
  const todayYear  = _today.getFullYear();
  const todayMonth = _today.getMonth();
  const todayDay   = _today.getDate();

  gridEl.innerHTML = '';

  DAY_NAMES.forEach(name => {
    const cell = document.createElement('div');
    cell.className = headerClass;
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-label', name);
    cell.textContent = name;
    gridEl.appendChild(cell);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const leadingEmpties = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = 0; i < leadingEmpties; i++) {
    const cell = document.createElement('div');
    cell.className = `${cellClass} empty`;
    cell.setAttribute('aria-hidden', 'true');
    gridEl.appendChild(cell);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = cellClass;
    cell.textContent = day;

    const isToday = year === todayYear && month === todayMonth && day === todayDay;
    const isPast  = year < todayYear ||
                    (year === todayYear && month < todayMonth) ||
                    (year === todayYear && month === todayMonth && day < todayDay);
    const disabled = isDisabled(year, month, day);
    const blocked  = !isPast && isBlocked(year, month, day);
    const isSelected = selectedDate &&
                       selectedDate.year  === year  &&
                       selectedDate.month === month &&
                       selectedDate.day   === day;

    if (isToday)    cell.classList.add('today');
    if (isPast)     cell.classList.add('past');
    if (blocked)    cell.classList.add(`${cellClass}--blocked`);
    if (isSelected) cell.classList.add('selected');

    if (disabled) {
      cell.setAttribute('aria-disabled', 'true');
      cell.setAttribute('role', 'gridcell');
      if (blocked) {
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click', () => onBlockedSelect(year, month, day, cell));
        cell.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onBlockedSelect(year, month, day, cell);
          }
        });
      }
    } else {
      const dateLabel = new Date(year, month, day).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', dateLabel);
      cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      cell.setAttribute('tabindex', '0');

      cell.addEventListener('click', () => onSelect(year, month, day));
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(year, month, day);
        }
      });
    }

    gridEl.appendChild(cell);
  }
}
