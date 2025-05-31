const WIDTH = 1000;
const HEIGHT = 300;
const CHUNK_MINUTES = 10;

let minTime, maxTime, totalChunks = 0;
let currentChunk = 0;
let vitals, drugs;

const svgVitals = d3.select("#chart").attr("width", WIDTH).attr("height", HEIGHT);
const svgDrugs = d3.select("#intervention-chart").attr("width", WIDTH).attr("height", HEIGHT);

const xScale = d3.scaleTime().range([60, WIDTH - 60]);
const yVitals = d3.scaleLinear().range([HEIGHT - 40, 20]);
const yDrugs = d3.scaleLinear().range([HEIGHT - 40, 20]);

const lineVitals = d3.line()
  .x(d => xScale(new Date(d.time)))
  .y(d => yVitals(d.value));

const lineDrugs = d3.line()
  .x(d => xScale(new Date(d.time)))
  .y(d => yDrugs(d.value));

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
]).then(([vitalData, drugData]) => {
  vitals = vitalData;
  drugs = drugData;

  const caseSelect = d3.select("#case-select");
  Object.keys(vitals).forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  caseSelect.on("change", () => {
    currentChunk = 0;
    loadCase(caseSelect.property("value"));
  });

  loadCase(Object.keys(vitals)[0]);
});

function loadCase(caseID) {
  const vData = vitals[caseID];
  const dData = drugs[caseID];

  const allTimes = [
    ...Object.values(vData).flatMap(arr => arr.map(d => new Date(d.time))),
    ...Object.values(dData).flatMap(arr => arr.map(d => new Date(d.time)))
  ];

  minTime = d3.min(allTimes);
  maxTime = d3.max(allTimes);
  totalChunks = Math.ceil((maxTime - minTime) / (CHUNK_MINUTES * 60000));

  d3.select("#chunk-slider")
    .attr("max", totalChunks - 1)
    .property("value", 0)
    .on("input", function () {
      currentChunk = +this.value;
      drawChunk(vData, dData);
    });

  drawChunk(vData, dData);
}

function drawChunk(vData, dData) {
  svgVitals.selectAll("*").remove();
  svgDrugs.selectAll("*").remove();

  const windowStart = new Date(minTime.getTime() + currentChunk * CHUNK_MINUTES * 60000);
  const windowEnd = new Date(windowStart.getTime() + CHUNK_MINUTES * 60000);
  xScale.domain([windowStart, windowEnd]);

  const yVals = Object.values(vData).flatMap(d => d.map(x => x.value));
  const yDvals = Object.values(dData).flatMap(d => d.map(x => x.value));

  yVitals.domain(d3.extent(yVals));
  yDrugs.domain(d3.extent(yDvals));

  Object.entries(vData).forEach(([key, arr], i) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= windowStart && t <= windowEnd;
    });
    svgVitals.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeTableau10[i % 10])
      .attr("stroke-width", 1.5)
      .attr("d", lineVitals);
  });

  Object.entries(dData).forEach(([key, arr], i) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= windowStart && t <= windowEnd;
    });
    svgDrugs.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeSet2[i % 8])
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 2")
      .attr("d", lineDrugs);
  });

  svgVitals.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svgVitals.append("g").attr("transform", "translate(60,0)").call(d3.axisLeft(yVitals));

  svgDrugs.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svgDrugs.append("g").attr("transform", "translate(60,0)").call(d3.axisLeft(yDrugs));

  d3.select("#chunk-label").text(`🕒 Window: ${formatTime(windowStart)} → ${formatTime(windowEnd)}`);
}

function formatTime(date) {
  const mins = Math.floor((date - minTime) / 60000);
  const mm = String(mins).padStart(2, "0");
  return `${mm}:00`;
}
