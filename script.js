const margin = { top: 50, right: 200, bottom: 100, left: 50 };
const width = 1600;  // stretched from 1000
const height = 400;

let vitalsData, interventionsData;
let currentCase = "1";
let playing = false;
let speed = 1;
let interval;
let currentIndex = 0;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const g = svg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleTime().range([0, 1600]);  // stretched
const y = d3.scaleLinear().range([height, 0]);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const line = d3
  .line()
  .x(d => x(new Date(d.time)))
  .y(d => y(d.value));

d3.json("vital_data.json").then(data => {
  vitalsData = data;
  init();
});

d3.json("proxy_drug_data.json").then(data => {
  interventionsData = data;
});

function init() {
  const caseData = vitalsData[currentCase];

  const vitals = Object.keys(caseData);
  const allValues = vitals.flatMap(key => caseData[key].map(d => d.value));
  const allTimes = vitals.flatMap(key => caseData[key].map(d => new Date(d.time)));

  x.domain(d3.extent(allTimes));
  y.domain([0, d3.max(allValues)]);

  color.domain(vitals);

  vitals.forEach((key, i) => {
    g.append("path")
      .datum(caseData[key])
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 1.5)
      .attr("d", line)
      .attr("class", `line ${key}`);
  });

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  g.append("g").call(d3.axisLeft(y));

  const legend = svg
    .append("g")
    .attr("transform", `translate(${width + margin.left + 20}, ${margin.top})`);

  vitals.forEach((key, i) => {
    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", i * 20)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color(key));

    legend
      .append("text")
      .attr("x", 20)
      .attr("y", i * 20 + 9)
      .text(key);
  });

  updateSidebar();
}

function updateSidebar() {
  const vitals = Object.keys(vitalsData[currentCase]);
  const container = d3.select("#vital-values").html("");

  vitals.forEach(key => {
    container
      .append("div")
      .attr("class", "vital-value")
      .attr("id", `vital-${key}`)
      .text(`${key}: N/A`);
  });
}

// Control buttons
d3.select("#play-btn").on("click", () => {
  if (!playing) {
    playing = true;
    interval = setInterval(() => {
      updateChart();
      currentIndex++;
    }, 1000 / speed);
  }
});

d3.select("#pause-btn").on("click", () => {
  playing = false;
  clearInterval(interval);
});

d3.select("#speed-btn").on("click", () => {
  speed = speed === 1 ? 2 : 1;
  if (playing) {
    clearInterval(interval);
    interval = setInterval(() => {
      updateChart();
      currentIndex++;
    }, 1000 / speed);
  }
});

function updateChart() {
  const caseData = vitalsData[currentCase];
  const vitals = Object.keys(caseData);

  vitals.forEach(key => {
    const data = caseData[key].slice(0, currentIndex);
    g.select(`.line.${key}`).attr("d", line(data));

    const last = data[data.length - 1];
    d3.select(`#vital-${key}`).text(`${key}: ${last ? last.value : "N/A"}`);
  });
}

// Case selector
d3.select("#case-selector").on("change", function () {
  currentCase = this.value;
  g.selectAll("*").remove();
  currentIndex = 0;
  init();
});
