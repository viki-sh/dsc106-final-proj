const WIDTH = 1000;
const HEIGHT = 340;
const CHUNK_MINUTES = 10;

let minTime, maxTime, totalChunks;
let currentChunk = 0;
let vitalData, drugData;

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
]).then(([vData, dData]) => {
  vitalData = vData;
  drugData = dData;

  const caseSelect = d3.select("#case-select");
  Object.keys(vitalData).forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  caseSelect.on("change", () => {
    currentChunk = 0;
    loadCase(caseSelect.property("value"));
  });

  loadCase(Object.keys(vitalData)[0]);
});

function loadCase(caseID) {
  const vData = vitalData[caseID];
  const dData = drugData[caseID];

  const caseTimes = Object.values(vData)
    .flatMap(arr => arr.map(d => new Date(d.time)))
    .sort((a, b) => a - b);

  minTime = caseTimes[0];
  maxTime = caseTimes[caseTimes.length - 1];
  totalChunks = Math.ceil((maxTime - minTime) / (CHUNK_MINUTES * 60000));

  d3.select("#chunk-slider")
    .attr("max", totalChunks - 1)
    .property("value", currentChunk)
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

  const vitalParams = Object.keys(vData);
  const drugParams = Object.keys(dData);

  const vVals = vitalParams.flatMap(p => vData[p].map(d => d.value));
  const dVals = drugParams.flatMap(p => dData[p].map(d => d.value));
  yVitals.domain(d3.extent(vVals));
  yDrugs.domain(d3.extent(dVals));

  vitalParams.forEach((p, i) => {
    const filtered = vData[p].filter(d => {
      const t = new Date(d.time);
      return t >= windowStart && t <= windowEnd;
    });
    svgVitals.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeTableau10[i % 10])
      .attr("stroke-width", 2)
      .attr("d", lineVitals);
  });

  drugParams.forEach((p, i) => {
    const filtered = dData[p].filter(d => {
      const t = new Date(d.time);
      return t >= windowStart && t <= windowEnd;
    });
    svgDrugs.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeSet2[i % 8])
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 2")
      .attr("d", lineDrugs);
  });

  svgVitals.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(5));
  svgVitals.append("g")
    .attr("transform", "translate(60,0)")
    .call(d3.axisLeft(yVitals));

  svgDrugs.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(5));
  svgDrugs.append("g")
    .attr("transform", "translate(60,0)")
    .call(d3.axisLeft(yDrugs));

  d3.select("#chunk-label").text(`🕒 Window: ${formatTime(windowStart)} → ${formatTime(windowEnd)}`);
}

function formatTime(date) {
  const mins = Math.floor((date - minTime) / 60000);
  const mm = String(mins).padStart(2, "0");
  return `${mm}:00`;
}
