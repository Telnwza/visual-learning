const tools = [
  {
    number: "01",
    title: "Automata Studio",
    description: "Build, test, and inspect DFA, NFA, PDA, and Turing Machines.",
    category: "Automata",
    path: "./automata/",
    topics: ["DFA", "NFA", "PDA", "Turing Machine", "Simulation"],
  },
  {
    number: "02",
    title: "Logic Gates Lab",
    description: "Compose digital circuits and trace their truth tables and Boolean behavior.",
    category: "Digital systems",
    path: "./logic-gates/",
    topics: ["Logic Gates", "Truth Tables", "Boolean Algebra", "Circuits"],
  },
  {
    number: "03",
    title: "Vector Addition",
    description: "Explore magnitude, direction, and composition across two and three dimensions.",
    category: "Mathematics",
    path: "./vectors/",
    topics: ["Vectors", "2D", "3D", "Resultant", "Geometry"],
  },
  {
    number: "04",
    title: "Schematic Studio — Original",
    description: "The original schematic editor and VHDL generator for Spartan-7 and Vivado.",
    category: "FPGA design",
    path: "./schematic2vhdl/",
    topics: ["VHDL", "Schematic", "FPGA", "Spartan-7", "Vivado"],
  },
  {
    number: "05",
    title: "Block Schematic Studio",
    description: "Draw hierarchical digital systems with buses, real logic symbols, editable routes, and reusable sub-pages.",
    category: "Digital systems",
    path: "./block-schematic-studio/",
    topics: ["Schematic", "FPGA", "Logic Symbols", "Buses", "Sub-pages"],
  },
  {
    number: "06",
    title: "Schematic Studio v2",
    description: "Build with 64-bit components, editable VHDL modules, draft recovery, and faster wiring.",
    category: "FPGA design",
    path: "./schematic2vhdl-v2/",
    topics: ["VHDL Modules", "64-bit", "Schematic", "FPGA", "Vivado"],
  },
];

const searchInput = document.querySelector("#tool-search");
const toolsGrid = document.querySelector("#tools-grid");
const emptyState = document.querySelector("#empty-state");
const searchStatus = document.querySelector("#search-status");

function normalize(value) {
  return value.toLowerCase().trim();
}

function matchesSearch(tool, query) {
  const searchable = [tool.title, tool.description, tool.category, ...tool.topics].join(" ");
  return normalize(searchable).includes(normalize(query));
}

function renderTool(tool) {
  return `
    <a class="tool-row" href="${tool.path}" data-number="${tool.number}">
      <span class="tool-number">${tool.number}</span>
      <span class="tool-main">
        <span class="tool-category">${tool.category}</span>
        <strong>${tool.title}</strong>
        <span class="tool-description">${tool.description}</span>
      </span>
      <span class="tool-topics" aria-label="Topics: ${tool.topics.join(", ")}">
        ${tool.topics.slice(0, 3).map((topic) => `<span>${topic}</span>`).join("")}
      </span>
      <span class="tool-open">Open <span aria-hidden="true">→</span></span>
    </a>
  `;
}

function addRowInteractions() {
  toolsGrid.querySelectorAll(".tool-row").forEach((row) => {
    row.addEventListener("pointermove", (event) => {
      const bounds = row.getBoundingClientRect();
      row.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
      row.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    });
  });
}

function render() {
  const query = searchInput.value;
  const filteredTools = tools.filter((tool) => matchesSearch(tool, query));
  toolsGrid.innerHTML = filteredTools.map(renderTool).join("");
  emptyState.hidden = filteredTools.length > 0;
  searchStatus.textContent = query
    ? `${filteredTools.length} workbench${filteredTools.length === 1 ? "" : "es"} found`
    : `Showing all ${tools.length} workbenches`;
  addRowInteractions();
}

searchInput.addEventListener("input", render);

document.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  const isEditing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);

  if (event.key === "/" && !isEditing) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  if (event.altKey && /^[1-9]$/.test(event.key) && !isEditing) {
    const tool = tools[Number(event.key) - 1];
    if (tool) window.location.href = tool.path;
  }
});

render();
