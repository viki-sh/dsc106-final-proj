// script.js

// --------------------------------------------
// GLOBAL CONFIGURATION
// --------------------------------------------

// 10 minutes = 600 seconds
const WINDOW_SIZE = 600;

// Animation controls
let playInterval = null;
let playSpeed = 1;
const NORMAL_SPEED = 1;
const FAST_SPEED = 5;

// SVG margins/sizes
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const chartWidth = 900 - margin.left - margin.right;
const chartHeight = 250 - margin.top - margin.bottom;
const interChartHeight = 200 - margin.top - margin.bottom;

// Color scales
const vitalColor = d3.scaleOrdinal(d3.schemeTableau10);
const interColor = d3.scaleOrdinal(d3.schemeSet2);

// Containers
const liveValuesContainer = d3.select("#live-values");
const caseSelect = d3.select("#case-select");
const playBtn = d3.select("#play-btn");
const pauseBtn = d3.select("#pause-btn");
const speedBtn = d3.select("#speed-btn");
const slider = d3.select("#time-slider");

// Scales & axes (initialized later)
let xScaleVitals, yScaleVitals, xAxisVitals, yAxisVitals, xGridVitals, yGridVitals;
let xScaleInter, yScaleInter, xAxisInter, yAxisInter, xGridInter, yGridInter;

// Create the two SVG groups inside the DIVs
const vitalSVG = d3
  .select("#vital-chart")
  .append("svg")
  .attr("width", chartWidth + margin.left + margin.right)
  .attr("height", chartHeight + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const interSVG = d3
  .select("#intervention-chart")
  .append("svg")
  .attr("width", chartWidth + margin.left + margin.right)
  .attr("height", interChartHeight + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Data holders
let allVitalData = {};
let allInterData = {};
let currentCaseID = null;
let currentVitals = [];
let currentInters = [];
let duration = 0;
let currentTime = 0;

// --------------------------------------------
// 1) LOAD JSON & INITIALIZE
// --------------------------------------------

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json"),
])
  .then(([vitalDataJSON, interDataJSON]) => {
    allVitalData = vitalDataJSON;
    allInterData = interDataJSON;

    // Populate the dropdown with sorted Case IDs
    const caseIDs = Object.keys(allVitalData).sort((a, b) => +a - +b);
    caseSelect
      .selectAll("option")
      .data(caseIDs)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => "Case " + d);

    // Default to the first case
    currentCaseID = caseIDs[0];
    caseSelect.property("value", currentCaseID);

    // On change, re-draw
    caseSelect.on("change", () => {
      currentCaseID = caseSelect.property("value");
      resetAndDrawForCase(currentCaseID);
    });

    // Initial draw
    resetAndDrawForCase(currentCaseID);
  })
  .catch(error => {
    console.error("Error loading data:", error);
  });

// --------------------------------------------
// 2) RESET & DRAW FOR SELECTED CASE
// --------------------------------------------

function resetAndDrawForCase(caseID) {
  stopAnimation();
  vitalSVG.selectAll("*").remove();
  interSVG.selectAll("*").remove();
  liveValuesContainer.selectAll("*").remove();

  // Convert each parameter’s array of { time, value }
  currentVitals = Object.entries(allVitalData[caseID]).map(([param, arr]) => ({
    param: param,
    // ↳ HERE we map d.time and d.value, because the JSON is { time:…, value:… }
    values: arr.map(d => ({ time: +d.time, value: +d.value })),
  }));
  currentInters = Object.entries(allInterData[caseID]).map(([param, arr]) => ({
    param: param,
    values: arr.map(d => ({ time: +d.time, value: +d.value })),
  }));

  // Compute total duration (max timestamp across all vitals)
  duration = d3.max(currentVitals, d => d3.max(d.values, v => v.time));
  currentTime = 0;

  // Configure the slider: from 0 → (duration − WINDOW_SIZE)
  slider
    .attr("min", 0)
    .attr("max", Math.max(0, duration - WINDOW_SIZE))
    .attr("step", 1)
    .property("value", 0);
  slider.on("input", () => {
    currentTime = +slider.property("value");
    updateCharts(currentTime);
  });

  // Build scales & axes
  configureVitalScales();
  configureInterScales();

  // Draw legend & live‐values placeholders
  drawLegendAndLiveValues();

  // Draw empty chart skeletons (axes, gridlines, titles, borders)
  drawCharts();

  // Perform the first update (window = [0, WINDOW_SIZE])
  updateCharts(currentTime);
}

// --------------------------------------------
// 3) CONFIGURE SCALES & AXES FOR VITALS
// --------------------------------------------

function configureVitalScales() {
  xScaleVitals = d3
    .scaleLinear()
    .domain([0, WINDOW_SIZE])
    .range([0, chartWidth]);

  const allVals = currentVitals.flatMap(d => d.values.map(v => v.value));
  const yMin = d3.min(allVals) * 0.9;
  const yMax = d3.max(allVals) * 1.1;

  yScaleVitals = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .range([chartHeight, 0]);

  xAxisVitals = d3
    .axisBottom(xScaleVitals)
    .ticks(6)
    .tickFormat(d => {
      const m = Math.floor(d / 60),
        s = d % 60;
      return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    });
  yAxisVitals = d3.axisLeft(yScaleVitals).ticks(6);

  xGridVitals = d3
    .axisBottom(xScaleVitals)
    .tickSize(-chartHeight)
    .tickFormat("")
    .ticks(6);
  yGridVitals = d3
    .axisLeft(yScaleVitals)
    .tickSize(-chartWidth)
    .tickFormat("")
    .ticks(6);
}

// --------------------------------------------
// 4) CONFIGURE SCALES & AXES FOR INTERVENTIONS
// --------------------------------------------

function configureInterScales() {
  xScaleInter = d3
    .scaleLinear()
    .domain([0, WINDOW_SIZE])
    .range([0, chartWidth]);

  const allVals = currentInters.flatMap(d => d.values.map(v => v.value));
  const yMax = d3.max(allVals) * 1.1;

  yScaleInter = d3
    .scaleLinear()
    .domain([0, yMax])
    .range([interChartHeight, 0]);

  xAxisInter = d3
    .axisBottom(xScaleInter)
    .ticks(6)
    .tickFormat(d => {
      const m = Math.floor(d / 60),
        s = d % 60;
      return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    });
  yAxisInter = d3.axisLeft(yScaleInter).ticks(6);

  xGridInter = d3
    .axisBottom(xScaleInter)
    .tickSize(-interChartHeight)
    .tickFormat("")
    .ticks(6);
  yGridInter = d3
    .axisLeft(yScaleInter)
    .tickSize(-chartWidth)
    .tickFormat("")
    .ticks(6);
}

// --------------------------------------------
// 5) DRAW LEGEND & LIVE‐VALUES CONTAINERS
// --------------------------------------------

function drawLegendAndLiveValues() {
  const legendContainer = d3.select("#legend");
  legendContainer.selectAll("*").remove();

  // Vitals legend
  legendContainer.append("div").html("<strong>Vitals:</strong>");
  const vitalLegend = legendContainer.append("ul").attr("class", "legend-list");
  currentVitals.forEach((d, i) => {
    const li = vitalLegend.append("li");
    li.append("span")
      .style("display", "inline-block")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", vitalColor(i))
      .style("margin-right", "6px");
    li.append("span").text(d.param);
  });

  // Interventions legend
  legendContainer
    .append("div")
    .style("margin-top", "12px")
    .html("<strong>Interventions:</strong>");
  const interLegend = legendContainer.append("ul").attr("class", "legend-list");
  currentInters.forEach((d, i) => {
    const li = interLegend.append("li");
    li.append("span")
      .style("display", "inline-block")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", interColor(i))
      .style("margin-right", "6px");
    li.append("span").text(d.param);
  });

  // Live values placeholders
  const liveVitals = liveValuesContainer
    .append("div")
    .attr("class", "live-section")
    .html("<strong>Live Values (Vitals):</strong>");
  currentVitals.forEach(d => {
    liveVitals
      .append("div")
      .attr("id", `live-${sanitizeParam(d.param)}`)
      .text(`${d.param}: –`);
  });

  const liveInters = liveValuesContainer
    .append("div")
    .attr("class", "live-section")
    .style("margin-top", "12px")
    .html("<strong>Live Values (Interventions):</strong>");
  currentInters.forEach(d => {
    liveInters
      .append("div")
      .attr("id", `live-inter-${sanitizeParam(d.param)}`)
      .text(`${d.param}: –`);
  });
}

// Utility: sanitize parameter names for ID usage
function sanitizeParam(str) {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// --------------------------------------------
// 6) DRAW THE INITIAL (EMPTY) CHARTS
// --------------------------------------------

function drawCharts() {
  // — VITALS CHART —
  vitalSVG
    .append("g")
    .attr("class", "x grid")
    .attr("transform", `translate(0, ${chartHeight})`)
    .call(xGridVitals);

  vitalSVG.append("g").attr("class", "y grid").call(yGridVitals);

  vitalSVG
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${chartHeight})`)
    .call(xAxisVitals);

  vitalSVG.append("g").attr("class", "y axis").call(yAxisVitals);

  // Axis labels
  vitalSVG
    .append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", chartWidth)
    .attr("y", chartHeight + margin.bottom - 5)
    .text("Time (MM:SS)");

  vitalSVG
    .append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -margin.top)
    .text("Vitals");

  // Chart title
  vitalSVG
    .append("text")
    .attr("class", "chart-title")
    .attr("x", chartWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .text("Vitals");

  // Placeholder lines
  currentVitals.forEach((d, i) => {
    vitalSVG
      .append("path")
      .datum(d.values)
      .attr("class", "vital-line")
      .attr("id", `vital-path-${sanitizeParam(d.param)}`)
      .attr("fill", "none")
      .attr("stroke", vitalColor(i))
      .attr("stroke-width", 2);
  });

  // EKG border
  vitalSVG
    .append("rect")
    .attr("class", "ekg-border")
    .attr("x", -margin.left + 5)
    .attr("y", -margin.top + 5)
    .attr("width", chartWidth + margin.left + margin.right - 10)
    .attr("height", chartHeight + margin.top + margin.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);

  // — INTERVENTIONS CHART —
  interSVG
    .append("g")
    .attr("class", "x grid")
    .attr("transform", `translate(0, ${interChartHeight})`)
    .call(xGridInter);

  interSVG.append("g").attr("class", "y grid").call(yGridInter);

  interSVG
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${interChartHeight})`)
    .call(xAxisInter);

  interSVG.append("g").attr("class", "y axis").call(yAxisInter);

  // Axis labels
  interSVG
    .append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", chartWidth)
    .attr("y", interChartHeight + margin.bottom - 5)
    .text("Time (MM:SS)");

  interSVG
    .append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -margin.top)
    .text("Interventions");

  // Chart title
  interSVG
    .append("text")
    .attr("class", "chart-title")
    .attr("x", chartWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .text("Interventions");

  // Placeholder lines
  currentInters.forEach((d, i) => {
    interSVG
      .append("path")
      .datum(d.values)
      .attr("class", "inter-line")
      .attr("id", `inter-path-${sanitizeParam(d.param)}`)
      .attr("fill", "none")
      .attr("stroke", interColor(i))
      .attr("stroke-width", 2);
  });

  // EKG border
  interSVG
    .append("rect")
    .attr("class", "ekg-border")
    .attr("x", -margin.left + 5)
    .attr("y", -margin.top + 5)
    .attr("width", chartWidth + margin.left + margin.right - 10)
    .attr("height", interChartHeight + margin.top + margin.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);
}

// --------------------------------------------
// 7) UPDATE CHARTS FOR A GIVEN WINDOW
// --------------------------------------------

function updateCharts(startTime) {
  const windowStart = startTime;
  const windowEnd = startTime + WINDOW_SIZE;

  xScaleVitals.domain([windowStart, windowEnd]);
  xScaleInter.domain([windowStart, windowEnd]);

  vitalSVG.select(".x.axis").call(xAxisVitals);
  vitalSVG.select(".y.axis").call(yAxisVitals);
  vitalSVG.select(".x.grid").call(xGridVitals);
  vitalSVG.select(".y.grid").call(yGridVitals);

  interSVG.select(".x.axis").call(xAxisInter);
  interSVG.select(".y.axis").call(yAxisInter);
  interSVG.select(".x.grid").call(xGridInter);
  interSVG.select(".y.grid").call(yGridInter);

  // Redraw vital lines
  currentVitals.forEach(d => {
    const filtered = d.values.filter(v => v.time >= windowStart && v.time <= windowEnd);
    const lineGen = d3
      .line()
      .x(v => xScaleVitals(v.time))
      .y(v => yScaleVitals(v.value))
      .curve(d3.curveMonotoneX);

    vitalSVG
      .select(`#vital-path-${sanitizeParam(d.param)}`)
      .datum(filtered)
      .attr("d", lineGen);
  });

  // Redraw intervention lines
  currentInters.forEach(d => {
    const filtered = d.values.filter(v => v.time >= windowStart && v.time <= windowEnd);
    const lineGen = d3
      .line()
      .x(v => xScaleInter(v.time))
      .y(v => yScaleInter(v.value))
      .curve(d3.curveStepAfter);

    interSVG
      .select(`#inter-path-${sanitizeParam(d.param)}`)
      .datum(filtered)
      .attr("d", lineGen);
  });

  // Update “live values” text (last data point ≤ windowEnd)
  currentVitals.forEach(d => {
    const upTo = d.values.filter(v => v.time <= windowEnd);
    const last = upTo.length ? upTo[upTo.length - 1] : null;
    const txt = last ? last.value.toFixed(1) : "–";
    d3.select(`#live-${sanitizeParam(d.param)}`).text(`${d.param}: ${txt}`);
  });
  currentInters.forEach(d => {
    const upTo = d.values.filter(v => v.time <= windowEnd);
    const last = upTo.length ? upTo[upTo.length - 1] : null;
    const txt = last ? last.value : "–";
    d3.select(`#live-inter-${sanitizeParam(d.param)}`).text(`${d.param}: ${txt}`);
  });

  slider.property("value", windowStart);
}

// --------------------------------------------
// 8) PLAY / PAUSE / SPEED CONTROL LOGIC
// --------------------------------------------

playBtn.on("click", () => {
  if (playInterval) return; // already playing
  playInterval = setInterval(() => {
    currentTime += playSpeed;
    if (currentTime > duration - WINDOW_SIZE) {
      currentTime = duration - WINDOW_SIZE;
      stopAnimation();
    }
    updateCharts(currentTime);
  }, 1000);
});

pauseBtn.on("click", () => {
  stopAnimation();
});

speedBtn.on("click", () => {
  playSpeed = playSpeed === NORMAL_SPEED ? FAST_SPEED : NORMAL_SPEED;
  speedBtn.text(`⚡ Speed ${playSpeed}x`);
  if (playInterval) {
    stopAnimation();
    playBtn.dispatch("click");
  }
});

function stopAnimation() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}
