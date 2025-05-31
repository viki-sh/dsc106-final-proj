// script.js

// ------------------------------
// 1) Chart dimensions (must match your <svg width="1000" height="340"> in index.html):
// ------------------------------
const WIDTH = 1000;
const HEIGHT = 340;

// ------------------------------
// 2) Load both JSON files simultaneously.
//    If either fails, log an error.
// ------------------------------
Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
])
  .then(([vitalData, drugData]) => {
    // Once both files are loaded, call the main initializer:
    initializeCharts(vitalData, drugData);
  })
  .catch(error => {
    console.error("Error loading JSON files:", error);
    alert("Could not load 'vital_data.json' or 'proxy_drug_data.json'.\nCheck that both files are in the same folder as index.html.");
  });

// ------------------------------
// 3) Main function: set up SVGs, scales, axes, dropdown, and animation controls.
// ------------------------------
function initializeCharts(vitalData, drugData) {
  // ------------------------------
  // 3a) Select all of our DOM elements:
  // ------------------------------
  const vitalSvg    = d3.select("#chart");
  const drugSvg     = d3.select("#intervention-chart");
  const caseSelect  = d3.select("#case-select");
  const legendBox   = d3.select("#legend");
  const liveValues  = d3.select("#live-values");
  const playBtn     = d3.select("#play");
  const pauseBtn    = d3.select("#pause");
  const speedBtn    = d3.select("#speed");

  // ------------------------------
  // 3b) Prepare containers for the D3 <path> elements (we’ll draw/update them per case):
  // ------------------------------
  const vitalPaths = {};
  const drugPaths  = {};

  // ------------------------------
  // 3c) Animation state:
  //    timeIndex = current frame
  //    timer     = setInterval reference
  //    speed     = ms between frames (halved each “⚡ Speed” click)
  //    currentVData, currentDData = the data objects for the selected case
  // ------------------------------
  let timeIndex    = 0;
  let timer        = null;
  let speed        = 200;  // start at 200 ms per frame
  let currentVData = null; // will be assigned to vitalData[caseID]
  let currentDData = null; // will be assigned to drugData[caseID]

  // ------------------------------
  // 3d) Build the “Case ID” dropdown.
  //    We assume vitalData is an object whose keys are case IDs (e.g. "1", "2", "3", …).
  // ------------------------------
  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option")
      .attr("value", id)
      .text("Case " + id);
  });

  // ------------------------------
  // 3e) Scales & Axes (shared across all cases):
  //    - xScale: time scale → [60, WIDTH - 60]
  //    - yVitals: linear scale for “Vitals” → [HEIGHT - 40, 20]
  //    - yDrugs:  linear scale for “Interventions” → [HEIGHT - 40, 20]
  // ------------------------------
  const xScale  = d3.scaleTime().range([60, WIDTH - 60]);
  const yVitals = d3.scaleLinear().range([HEIGHT - 40, 20]);
  const yDrugs  = d3.scaleLinear().range([HEIGHT - 40, 20]);

  // Axes groups (we’ll call .call(d3.axis...) inside drawStaticLines()):
  const xAxisVitals = vitalSvg.append("g").attr("transform", `translate(0, ${HEIGHT - 40})`);
  const yAxisVitals = vitalSvg.append("g").attr("transform", "translate(60, 0)");

  const xAxisDrugs = drugSvg.append("g").attr("transform", `translate(0, ${HEIGHT - 40})`);
  const yAxisDrugs = drugSvg.append("g").attr("transform", `translate(${WIDTH - 60}, 0)`);

  // ------------------------------
  // 3f) Draw the axis labels (static text) on both SVGs:
  // ------------------------------
  /* Vitals Chart: “Time” (bottom) & “Vitals” (rotated) */
  vitalSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", WIDTH / 2)
    .attr("y", HEIGHT - 5)
    .style("text-anchor", "middle")
    .text("Time");

  vitalSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", -HEIGHT / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .text("Vitals");

  /* Interventions Chart: “Time” (bottom) & “Interventions” (rotated) */
  drugSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", WIDTH / 2)
    .attr("y", HEIGHT - 5)
    .style("text-anchor", "middle")
    .text("Time");

  drugSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", -HEIGHT / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .text("Interventions");

  // ------------------------------
  // 3g) Create the vertical “playhead” line on each SVG (initially at x=0):
  // ------------------------------
  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", HEIGHT);

  const drugLine = drugSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", HEIGHT);

  // ------------------------------
  // 3h) Line generators (they reference xScale, yVitals, yDrugs):
  // ------------------------------
  const lineVitals = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yVitals(d.value));

  const lineDrugs = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yDrugs(d.value));

  // ------------------------------
  // 3i) Function: drawStaticLines(vData, dData)
  //     → Draws the static gridlines, axes, and all the <path> elements (one per parameter).
  // ------------------------------
  function drawStaticLines(vData, dData) {
    // 1) Compute vitalParams & drugParams *for this case*
    //    (we assume each vData[p] is an array of {time: "...", value: ...})
    const vitalParams = Object.keys(vData);
    const drugParams  = Object.keys(dData);

    // 2) Compute the combined time extent (for X axis) from both datasets:
    const allTimes = [
      ...vitalParams.flatMap(p => vData[p].map(pt => new Date(pt.time))),
      ...drugParams.flatMap(p => dData[p].map(pt => new Date(pt.time)))
    ];
    xScale.domain(d3.extent(allTimes));

    // 3) Compute the Y‐domain for vitals: find min/max across all vital values, add 10% padding
    const allVitalValues = vitalParams.flatMap(p => vData[p].map(pt => pt.value));
    const vMin = d3.min(allVitalValues);
    const vMax = d3.max(allVitalValues);
    const padV = (vMax - vMin) * 0.10;
    yVitals.domain([vMin - padV, vMax + padV]);

    // 4) Compute the Y‐domain for interventions: same idea, 10% padding
    const allDrugValues = drugParams.flatMap(p => dData[p].map(pt => pt.value));
    const dMin = d3.min(allDrugValues);
    const dMax = d3.max(allDrugValues);
    const padD = (dMax - dMin) * 0.10;
    yDrugs.domain([dMin - padD, dMax + padD]);

    // 5) Draw the grid‐lined axes on the Vitals SVG:
    xAxisVitals.call(
      d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(-HEIGHT + 60)   // gridlines spanning top to bottom
    );
    yAxisVitals.call(
      d3.axisLeft(yVitals)
        .ticks(5)
        .tickSize(-WIDTH + 120)   // gridlines spanning left to right
    );

    // 6) Draw the grid‐lined axes on the Interventions SVG:
    xAxisDrugs.call(
      d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(-HEIGHT + 60)
    );
    yAxisDrugs.call(
      d3.axisRight(yDrugs)
        .ticks(5)
        .tickSize(-WIDTH + 120)
    );

    // 7) Clear out any old "vital" <path> elements, then redraw each:
    vitalParams.forEach(param => {
      // If this <path> doesn't exist, create it now:
      if (!vitalPaths[param]) {
        vitalPaths[param] = vitalSvg.append("path")
          .attr("stroke", d3.schemeTableau10[vitalParams.indexOf(param) % 10])
          .attr("fill", "none")
          .attr("stroke-width", 2);
      }
      // Bind the data array vData[param] and set its "d" attribute via lineVitals():
      vitalPaths[param]
        .datum(vData[param])
        .attr("d", lineVitals);
    });

    // 8) Clear out any old "intervention" <path> elements, then redraw each (dashed):
    drugParams.forEach(param => {
      if (!drugPaths[param]) {
        drugPaths[param] = drugSvg.append("path")
          .attr("stroke", d3.schemeSet2[drugParams.indexOf(param) % 8])
          .attr("fill", "none")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4 2");
      }
      drugPaths[param]
        .datum(dData[param])
        .attr("d", lineDrugs);
    });

    // 9) Build the legend: clear old contents, then append one line per parameter
    legendBox.html("");
    vitalParams.forEach(param => {
      const color = d3.schemeTableau10[vitalParams.indexOf(param) % 10];
      legendBox.append("div")
        .html(`<span style="color:${color};">&#9632;</span> ${param}`);
    });
    drugParams.forEach(param => {
      const color = d3.schemeSet2[drugParams.indexOf(param) % 8];
      legendBox.append("div")
        .html(`<span style="color:${color};">&#9632;</span> ${param}`);
    });
  }

  // ------------------------------
  // 3j) Function: drawFrame()
  //     → Moves the vertical “playhead” based on timeIndex, updates live-values.
  // ------------------------------
  function drawFrame() {
    // Get the timestamp from the first vital parameter’s data at this timeIndex.
    // (We assume every vitalParam array is the same length and aligned by index.)
    const firstVitalParam = Object.keys(currentVData)[0];
    const datum = currentVData[firstVitalParam][timeIndex];
    const t = new Date(datum.time);
    const x = xScale(t);

    // Move the vertical lines on both SVGs:
    verticalLine.attr("x1", x).attr("x2", x);
    drugLine   .attr("x1", x).attr("x2", x);

    // Build the “live‐values” HTML string:
    const vitalParams = Object.keys(currentVData);
    const drugParams  = Object.keys(currentDData);

    const vitalsHTML = vitalParams.map(param => {
      const entry = currentVData[param][timeIndex];
      const val   = entry ? entry.value : "--";
      const color = d3.schemeTableau10[vitalParams.indexOf(param) % 10];
      return `<span style="color:${color};">${param}</span>: ${val}`;
    });

    const drugsHTML = drugParams.map(param => {
      const entry = currentDData[param][timeIndex];
      const val   = entry ? entry.value : "--";
      const color = d3.schemeSet2[drugParams.indexOf(param) % 8];
      return `<span style="color:${color};">${param}</span>: ${val}`;
    });

    liveValues.html([...vitalsHTML, ...drugsHTML].join("<br>"));

    // Advance timeIndex until the last data point; then stop the timer.
    const maxIndex = currentVData[firstVitalParam].length - 1;
    if (timeIndex < maxIndex) {
      timeIndex++;
    } else {
      clearInterval(timer);
    }
  }

  // ------------------------------
  // 3k) Playback controls:
  //     - startAnimation():   clear any old interval, setInterval(drawFrame, speed)
  //     - pauseAnimation():   clearInterval(timer)
  //     - changeSpeed():      halve speed (floor at 50ms), restart interval
  // ------------------------------
  function startAnimation() {
    if (timer) clearInterval(timer);
    timer = setInterval(drawFrame, speed);
  }

  function pauseAnimation() {
    if (timer) clearInterval(timer);
  }

  function changeSpeed() {
    if (timer) clearInterval(timer);
    speed = Math.max(50, speed / 2);
    timer = setInterval(drawFrame, speed);
  }

  // ------------------------------
  // 3l) loadCase(caseID):  
  //     - Stop any existing timer  
  //     - Reset timeIndex to 0  
  //     - Assign currentVData = vitalData[caseID], currentDData = drugData[caseID]  
  //     - Call drawStaticLines() to redraw axes, grid, curves, and legend.  
  // ------------------------------
  function loadCase(caseID) {
    if (timer) clearInterval(timer);
    timeIndex = 0;
    currentVData = vitalData[caseID];
    currentDData = drugData[caseID];
    if (!currentVData || !currentDData) {
      console.warn(`Case ${caseID} does not exist in one of the datasets.`);
      return;
    }
    drawStaticLines(currentVData, currentDData);
  }

  // ------------------------------
  // 3m) Wire up the UI controls:
  // ------------------------------
  playBtn.on("click", startAnimation);
  pauseBtn.on("click", pauseAnimation);
  speedBtn.on("click", changeSpeed);

  caseSelect.on("change", function() {
    const selectedID = this.value;
    loadCase(selectedID);
  });

  // ------------------------------
  // 3n) Initial invocation: load the first case in the list
  // ------------------------------
  if (caseIds.length > 0) {
    loadCase(caseIds[0]);
  } else {
    console.warn("No case IDs found in vital_data.json");
  }
}
