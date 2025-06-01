// script.js

// --------------------------------------------
// GLOBAL CONFIGURATION
// --------------------------------------------

// Window size in seconds (10 minutes = 600 seconds)
const WINDOW_SIZE = 600;

// Animation settings
let playInterval = null;
let playSpeed = 1; // 1× speed by default
const NORMAL_SPEED = 1;
const FAST_SPEED = 5;

// SVG and margin setup
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const chartWidth = 700 - margin.left - margin.right; // matches #vital-chart width
const vitalChartHeight = 300 - margin.top - margin.bottom;
const interChartHeight = 250 - margin.top - margin.bottom;

// Color scales for vitals and interventions
const vitalColor = d3.scaleOrdinal(d3.schemeTableau10);
const interColor = d3.scaleOrdinal(d3.schemeSet2);

// Container for live values (in the sidebar)
const liveValuesContainer = d3.select("#live-values");

// Case dropdown selector
const caseSelect = d3.select("#case-select");

// Buttons (matching IDs in index.html)
const playBtn  = d3.select("#play-btn");
const pauseBtn = d3.select("#pause-btn");
const speedBtn = d3.select("#speed-btn");

// Time slider
const slider = d3.select("#time-slider");

// Scales & axes (will be configured per case)
let xScaleVitals, yScaleVitals, xAxisVitals, yAxisVitals, xGridVitals, yGridVitals;
let xScaleInter, yScaleInter, xAxisInter, yAxisInter, xGridInter, yGridInter;

// SVG containers
const vitalSVG = d3
  .select("#vital-chart")
  .append("svg")
  .attr("width", chartWidth + margin.left + margin.right)
  .attr("height", vitalChartHeight + margin.top + margin.bottom)
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
let currentVitals = [];      // Array of { param: string, values: [ {time: Number, value: Number}, ... ] }
let currentInters = [];      // Array of { param: string, values: [ {time, value}, ... ] }
let duration = 0;            // Total duration (in seconds) for the selected case
let currentTime = 0;         // Current window start time (in seconds)

// --------------------------------------------
// LOAD JSON DATA & INITIALIZE
// --------------------------------------------

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json"),
]).then(([vitalDataJSON, interDataJSON]) => {
  allVitalData = vitalDataJSON;
  allInterData = interDataJSON;

  // Populate the case dropdown with all case IDs
  const caseIDs = Object.keys(allVitalData).sort((a, b) => +a - +b);
  caseSelect
    .selectAll("option")
    .data(caseIDs)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => "Case " + d);

  // Initialize with the first case
  currentCaseID = caseIDs[0];
  caseSelect.property("value", currentCaseID);

  // When the user changes the dropdown, redraw everything
  caseSelect.on("change", () => {
    currentCaseID = caseSelect.property("value");
    resetAndDrawForCase(currentCaseID);
  });

  // Draw for the default case
  resetAndDrawForCase(currentCaseID);
}).catch(error => {
  console.error("Error loading data:", error);
});

// --------------------------------------------
// RESET & DRAW FOR A GIVEN CASE ID
// --------------------------------------------

function resetAndDrawForCase(caseID) {
  // Stop any animation in progress
  stopAnimation();

  // Clear previous SVG elements and live-values text
  vitalSVG.selectAll("*").remove();
  interSVG.selectAll("*").remove();
  liveValuesContainer.selectAll("*").remove();

  // Convert each parameter’s array [time, value] to { time, value }
  currentVitals = Object.entries(allVitalData[caseID]).map(([param, arr]) => ({
    param: param,
    values: arr.map(d => ({ time: +d[0], value: +d[1] })),
  }));

  currentInters = Object.entries(allInterData[caseID]).map(([param, arr]) => ({
    param: param,
    values: arr.map(d => ({ time: +d[0], value: +d[1] })),
  }));

  // Determine total duration (maximum timestamp across all vitals)
  duration = d3.max(currentVitals, d => d3.max(d.values, v => v.time));

  // Reset currentTime to 0
  currentTime = 0;

  // Configure slider: 0 → (duration – WINDOW_SIZE)
  slider
    .attr("min", 0)
    .attr("max", Math.max(0, duration - WINDOW_SIZE))
    .attr("step", 1)
    .property("value", 0);

  slider.on("input", () => {
    currentTime = +slider.property("value");
    updateCharts(currentTime);
  });

  // Build scales & axes based on this case’s data
  configureVitalScales();
  configureInterScales();

  // Draw legend & live-values placeholders
  drawLegendAndLiveValues();

  // Draw the empty chart skeletons (axes, gridlines, titles, borders)
  drawCharts();

  // Perform the first update (window [0, WINDOW_SIZE])
  updateCharts(currentTime);
}

// --------------------------------------------
// CONFIGURE SCALES & AXES FOR VITALS
// --------------------------------------------

function configureVitalScales() {
  // X-scale: initial domain [0, WINDOW_SIZE]
  xScaleVitals = d3
    .scaleLinear()
    .domain([0, WINDOW_SIZE])
    .range([0, chartWidth]);

  // Y-scale: find global min/max across all vital parameters
  const allValues = currentVitals.flatMap(d => d.values.map(v => v.value));
  const yMin = d3.min(allValues) * 0.9;
  const yMax = d3.max(allValues) * 1.1;

  yScaleVitals = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .range([vitalChartHeight, 0]);

  // Axes
  xAxisVitals = d3.axisBottom(xScaleVitals)
    .ticks(6)
    .tickFormat(d => {
      const m = Math.floor(d / 60);
      const s = d % 60;
      return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    });

  yAxisVitals = d3.axisLeft(yScaleVitals).ticks(6);

  // Grid lines
  xGridVitals = d3.axisBottom(xScaleVitals)
    .tickSize(-vitalChartHeight)
    .tickFormat("")
    .ticks(6);

  yGridVitals = d3.axisLeft(yScaleVitals)
    .tickSize(-chartWidth)
    .tickFormat("")
    .ticks(6);
}

// --------------------------------------------
// CONFIGURE SCALES & AXES FOR INTERVENTIONS
// --------------------------------------------

function configureInterScales() {
  // X-scale: same window width [0, WINDOW_SIZE]
  xScaleInter = d3
    .scaleLinear()
    .domain([0, WINDOW_SIZE])
    .range([0, chartWidth]);

  // Y-scale: find max across all interventions
  const allValues = currentInters.flatMap(d => d.values.map(v => v.value));
  const yMax = d3.max(allValues) * 1.1;

  yScaleInter = d3
    .scaleLinear()
    .domain([0, yMax])
    .range([interChartHeight, 0]);

  // Axes
  xAxisInter = d3.axisBottom(xScaleInter)
    .ticks(6)
    .tickFormat(d => {
      const m = Math.floor(d / 60);
      const s = d % 60;
      return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    });

  yAxisInter = d3.axisLeft(yScaleInter).ticks(6);

  // Grid lines
  xGridInter = d3.axisBottom(xScaleInter)
    .tickSize(-interChartHeight)
    .tickFormat("")
    .ticks(6);

  yGridInter = d3.axisLeft(yScaleInter)
    .tickSize(-chartWidth)
    .tickFormat("")
    .ticks(6);
}

// --------------------------------------------
// DRAW LEGEND & LIVE-VALUES CONTAINERS
// --------------------------------------------

function drawLegendAndLiveValues() {
  // Clear any existing legend/live-values
  const legendContainer = d3.select("#legend");
  legendContainer.selectAll("*").remove();

  // Vitals legend
  legendContainer
    .append("div")
    .html("<strong>Vitals:</strong>");
  const vitalLegend = legendContainer
    .append("ul")
    .attr("class", "legend-list");
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
  const interLegend = legendContainer
    .append("ul")
    .attr("class", "legend-list");
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

  // Live values: placeholders for each vital and intervention
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

// Utility: sanitize parameter names for use in element IDs
function sanitizeParam(str) {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// --------------------------------------------
// DRAW THE INITIAL (EMPTY) CHARTS
// --------------------------------------------

function drawCharts() {
  // ------ VITALS CHART ------
  // Gridlines
  vitalSVG
    .append("g")
    .attr("class", "x grid")
    .attr("transform", `translate(0, ${vitalChartHeight})`)
    .call(xGridVitals);

  vitalSVG
    .append("g")
    .attr("class", "y grid")
    .call(yGridVitals);

  // Axes
  vitalSVG
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${vitalChartHeight})`)
    .call(xAxisVitals);

  vitalSVG
    .append("g")
    .attr("class", "y axis")
    .call(yAxisVitals);

  // Axis labels
  vitalSVG
    .append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", chartWidth)
    .attr("y", vitalChartHeight + margin.bottom - 5)
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

  // Placeholder <path> for each vital parameter
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

  // EKG-style border rectangle
  vitalSVG
    .append("rect")
    .attr("class", "ekg-border")
    .attr("x", -margin.left + 5)
    .attr("y", -margin.top + 5)
    .attr("width", chartWidth + margin.left + margin.right - 10)
    .attr("height", vitalChartHeight + margin.top + margin.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);

  // ------ INTERVENTIONS CHART ------
  // Gridlines
  interSVG
    .append("g")
    .attr("class", "x grid")
    .attr("transform", `translate(0, ${interChartHeight})`)
    .call(xGridInter);

  interSVG
    .append("g")
    .attr("class", "y grid")
    .call(yGridInter);

  // Axes
  interSVG
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${interChartHeight})`)
    .call(xAxisInter);

  interSVG
    .append("g")
    .attr("class", "y axis")
    .call(yAxisInter);

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

  // Placeholder <path> for each intervention parameter
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

  // EKG-style border rectangle
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
// UPDATE CHARTS FOR A GIVEN WINDOW [startTime, startTime + WINDOW_SIZE]
//
//  • Filters every series to that 600‐second window
//  • Redraws axes, gridlines
//  • Updates each <path> to only those (time, value) points
//  • Updates “live values” to the last point at or before windowEnd
//  • Moves the slider handle to windowStart
// --------------------------------------------

function updateCharts(startTime) {
  const windowStart = startTime;
  const windowEnd = startTime + WINDOW_SIZE;

  // Update X domains
  xScaleVitals.domain([windowStart, windowEnd]);
  xScaleInter.domain([windowStart, windowEnd]);

  // Redraw axes & grids
  vitalSVG.select(".x.axis").call(xAxisVitals);
  vitalSVG.select(".y.axis").call(yAxisVitals);
  vitalSVG.select(".x.grid").call(xGridVitals);
  vitalSVG.select(".y.grid").call(yGridVitals);

  interSVG.select(".x.axis").call(xAxisInter);
  interSVG.select(".y.axis").call(yAxisInter);
  interSVG.select(".x.grid").call(xGridInter);
  interSVG.select(".y.grid").call(yGridInter);

  // Update each vital’s line (filter to [windowStart, windowEnd])
  currentVitals.forEach((d) => {
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

  // Update each intervention’s line
  currentInters.forEach((d) => {
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

  // Update live values (the last data point at or before windowEnd)
  currentVitals.forEach((d) => {
    const upToWindow = d.values.filter(v => v.time <= windowEnd);
    const lastPoint = upToWindow.length ? upToWindow[upToWindow.length - 1] : null;
    const text = lastPoint ? lastPoint.value.toFixed(1) : "–";
    d3.select(`#live-${sanitizeParam(d.param)}`).text(`${d.param}: ${text}`);
  });

  currentInters.forEach((d) => {
    const upToWindow = d.values.filter(v => v.time <= windowEnd);
    const lastPoint = upToWindow.length ? upToWindow[upToWindow.length - 1] : null;
    const text = lastPoint ? lastPoint.value : "–";
    d3.select(`#live-inter-${sanitizeParam(d.param)}`).text(`${d.param}: ${text}`);
  });

  // Move slider handle without re-triggering “input”
  slider.property("value", windowStart);
}

// --------------------------------------------
// PLAY / PAUSE / SPEED CONTROLS
// --------------------------------------------

playBtn.on("click", () => {
  if (playInterval) return; // Already playing

  // Disable Play, enable Pause
  playBtn.property("disabled", true);
  pauseBtn.property("disabled", false);

  playInterval = setInterval(() => {
    currentTime += playSpeed;
    if (currentTime > duration - WINDOW_SIZE) {
      currentTime = duration - WINDOW_SIZE;
      stopAnimation();
    }
    updateCharts(currentTime);
  }, 1000); // Tick every second
});

pauseBtn.on("click", () => {
  stopAnimation();
});

speedBtn.on("click", () => {
  // Toggle between 1× and 5× speed
  playSpeed = playSpeed === NORMAL_SPEED ? FAST_SPEED : NORMAL_SPEED;
  speedBtn.text(`⚡ Speed ${playSpeed}x`);

  // If currently playing, restart interval at new speed
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
  // Re-enable Play, disable Pause
  playBtn.property("disabled", false);
  pauseBtn.property("disabled", true);
}
