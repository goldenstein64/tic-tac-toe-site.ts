import "htmx.org";

const dateCells = document.querySelectorAll(
  "main td.date-time",
) as NodeListOf<HTMLTableCellElement>;

for (const cell of dateCells) {
  const date = new Date(cell.textContent);

  cell.innerHTML = `<span class="no-wrap">${date.toLocaleDateString()}</span>, <span class="no-wrap">${date.toLocaleTimeString()}</span>`;
}
