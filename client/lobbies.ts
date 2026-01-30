import "htmx.org";

function noWrap(textContent: string) {
  return `<span class="no-wrap">${textContent}</span>`;
}

const dateCells =
  document.querySelectorAll<HTMLTableCellElement>("main td.date-time");

for (const cell of dateCells) {
  const dateObj: Date = new Date(cell.textContent);
  const date: string = dateObj.toLocaleDateString();
  const time: string = dateObj.toLocaleTimeString();

  cell.innerHTML = `${noWrap(date)}, ${noWrap(time)}`;
}
