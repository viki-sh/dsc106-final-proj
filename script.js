// script.js

// --------------------------------------------------
// 1) Chart dimensions (must match your SVG sizes):
// --------------------------------------------------
const WIDTH   = 1000;
const HEIGHT  = 340;

// Window duration (in milliseconds) for the sliding‐window view.
// For example, 240000 ms = 4 minutes.
const WINDOW_MS = 240000;

// --------------------------------------------------
// 2) Load both JSON files (vital_data.json and proxy_drug_data.json).
//    If either fails, alert the user.
// --------------------------------------------------
Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
])
  .then(([vitalData, drugData]) => {
    initializeCharts(vitalData, drugData);
  })
  .catch(error => {
    console.error("Error loading JSON files:", error);
    alert(
      "Could not load 'vital_data.json' or 'proxy_drug_data.json'.\n" +
      "Ensure both files are in the same folder as index.html."
    );
  });

// --------------------------------------------------
// 3) Main initialization function: sets up everything
//    (SVGs, scales, axes, slider, play/pause/speed, etc.)
// --------------------------------------------------
function initializeCharts(vitalData, drugData) {
  // 3a) Grab DOM elements:
  const vitalSvg    = d3.select("#chart");
  const drugSvg     = d3.select("#intervention-chart");
  const legendBox   = d3.select("#legend");
  const liveValues  = d3.select("#live-values");
  const playBtn     = d3.select("#play");
  const pauseBtn    = d3.select("#pause");
  const speedBtn    = d3.select("#speed");
  const slider      = d3.select("#time-slider");
  const caseSelect  = d3.select("#case-select");

  // 3b) We'll keep references to each <path> in these objects:
  const vitalPaths = {};
  const drugPaths  = {};

  // 3c) Animation / state variables:
  let timeIndex    = 0;       // current frame index
  let timer        = null;    // holds our setInterval reference
  let speed        = 200;     // ms between frames (halved by “⚡ Speed”)
  let currentVData = null;    // vitalData[selectedCaseID]
  let currentDData = null;    // drugData[selectedCaseID]
  let firstTimestamp = null;  // earliest timestamp in the selected case

  // 3d) Build the “Select Case ID” dropdown from the keys of vitalData:
  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option")
      .attr("value", id)
      .text("Case " + id);
  });

  // 3e) Scales & Axes (shared across all cases):
  //    • xScale: time → [60, WIDTH - 60]
  //    • yVitals: vital values → [HEIGHT - 40, 20]
  //    • yDrugs: intervention values → [HEIGHT - 40, 20]
  const xScale  = d3.scaleTime().range([60, WIDTH - 60]);
  const yVitals = d3.scaleLinear().range([HEIGHT - 40, 20]);
  const yDrugs  = d3.scaleLinear().range([HEIGHT - 40, 20]);

  // Create axis‐group placeholders in each SVG:
  const xAxisVitals = vitalSvg.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`);
  const yAxisVitals = vitalSvg.append("g")
    .attr("transform", `translate(60, 0)`);

  const xAxisDrugs = drugSvg.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`);
  const yAxisDrugs = drugSvg.append("g")
    .attr("transform", `translate(${WIDTH - 60}, 0)`);

  // 3f) Draw static axis labels (these never change):
  //     “Time” along the bottom, and rotated “Vitals” / “Interventions” on the left.
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

  // 3g) Create vertical “playhead” lines (initially at x=0):
  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", HEIGHT);

  const drugLine = drugSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", HEIGHT);

  // 3h) Line generators (they reference xScale, yVitals, yDrugs):
  const lineVitals = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yVitals(d.value));

  const lineDrugs = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yDrugs(d.value));

  // 3i) drawStaticLines(vData, dData):
  //     • Finds the full time extent (t0..t1) for this case
  //     • Sets xScale.domain([t0, t1])
  //     • Computes y‐domains (min/max + 10% padding)
  //     • Draws grid‐lined axes
  //     • Appends one <path> per parameter (solid for vitals, dashed for drugs)
  //     • Builds the legend
  //     • Configures the slider ([0..numFrames−1]) and enables it
  function drawStaticLines(vData, dData) {
    // 1) Parameter names for this case:
    const vitalParams = Object.keys(vData);
    const drugParams  = Object.keys(dData);

    // 2) Compute full time extent across both vData and dData:
    const allTimes = [
      ...vitalParams.flatMap(p => vData[p].map(pt => new Date(pt.time))),
      ...drugParams.flatMap(p => dData[p].map(pt => new Date(pt.time)))
    ];
    allTimes.sort((a, b) => a - b);
    const t0 = allTimes[0];
    const t1 = allTimes[allTimes.length - 1];
    firstTimestamp = t0;

    // 3) Set xScale.domain to the full [t0, t1]:
    xScale.domain([t0, t1]);

    // 4) Compute Y‐domain for vitals (min → max + 10% padding):
    const allVitalVals = vitalParams.flatMap(p => vData[p].map(pt => pt.value));
    const vMin = d3.min(allVitalVals), vMax = d3.max(allVitalVals);
    const padV = (vMax - vMin) * 0.10;
    yVitals.domain([vMin - padV, vMax + padV]);

    // 5) Compute Y‐domain for interventions (min → max + 10% padding):
    const allDrugVals = drugParams.flatMap(p => dData[p].map(pt => pt.value));
    const dMin = d3.min(allDrugVals), dMax = d3.max(allDrugVals);
    const padD = (dMax - dMin) * 0.10;
    yDrugs.domain([dMin - padD, dMax + padD]);

    // 6) Draw grid‐lined axes on the Vitals SVG:
    xAxisVitals.call(
      d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(-HEIGHT + 60)   // full‐height grid lines
    );
    yAxisVitals.call(
      d3.axisLeft(yVitals)
        .ticks(5)
        .tickSize(-WIDTH + 120)   // full‐width grid lines
    );

    // 7) Draw grid‐lined axes on the Interventions SVG:
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

    // 8) Build vital‐parameter paths inside <g class="vital-lines">:
    const vitalGroup = vitalSvg.select("g.vital-lines");
    vitalGroup.selectAll("path").remove(); // clear old paths
    vitalParams.forEach((param, i) => {
      const color = d3.schemeTableau10[i % 10];
      vitalPaths[param] = vitalGroup.append("path")
        .attr("stroke", color)
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .datum(vData[param])
        .attr("d", lineVitals);
    });

    // 9) Build intervention‐parameter paths inside <g class="drug-lines">:
    const drugGroup = drugSvg.select("g.drug-lines");
    drugGroup.selectAll("path").remove();
    drugParams.forEach((param, i) => {
      const color = d3.schemeSet2[i % 8];
      drugPaths[param] = drugGroup.append("path")
        .attr("stroke", color)
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 2")
        .datum(dData[param])
        .attr("d", lineDrugs);
    });

    // 10) Build the legend:
    legendBox.html(""); // clear old legend
    vitalParams.forEach((param, i) => {
      const color = d3.schemeTableau10[i % 10];
      legendBox.append("div")
        .html(`<span style="color:${color};">&#9632;</span> ${param}`);
    });
    drugParams.forEach((param, i) => {
      const color = d3.schemeSet2[i % 8];
      legendBox.append("div")
        .html(`<span style="color:${color};">&#9632;</span> ${param}`);
    });

    // 11) Configure the slider (toggle bar):
    //     • One frame per timestamp in vData[vitalParams[0]] (we assume all arrays align)
    //     • Range = [0 .. numFrames − 1]
    //     • Enable it now that we know numFrames
    const numFrames = vData[vitalParams[0]].length;
    slider
      .attr("min", 0)
      .attr("max", numFrames - 1)
      .attr("value", 0)
      .property("disabled", false);
  }

  // --------------------------------------------------
  // 3j) drawFrame():
  //     • Updates xScale.domain to [currentTime - WINDOW_MS, currentTime]
  //     • Redraws grid‐lined axes so they scroll
  //     • Redraws each <path> (the clipPath hides anything outside the 4‐minute window)
  //     • Moves the vertical playhead
  //     • Moves the slider thumb
  //     • Updates “live values” on the right
  //     • Advances timeIndex (or stops if we’re at the last frame)
  // --------------------------------------------------
  function drawFrame() {
    const vitalParams = Object.keys(currentVData);
    const drugParams  = Object.keys(currentDData);
    const firstParam  = vitalParams[0];

    // 1) Get this frame’s timestamp, as a Date:
    const datum = currentVData[firstParam][timeIndex];
    const t = new Date(datum.time);

    // 2) Compute windowStart = max(firstTimestamp, t - WINDOW_MS):
    let windowStart = new Date(t.getTime() - WINDOW_MS);
    if (windowStart < firstTimestamp) windowStart = firstTimestamp;

    // 3) Update xScale domain to [windowStart, t]:
    xScale.domain([windowStart, t]);

    // 4) Redraw grid‐lined axes on both charts with the updated domain:
    xAxisVitals.call(d3.axisBottom(xScale).ticks(5).tickSize(-HEIGHT + 60));
    xAxisDrugs .call(d3.axisBottom(xScale).ticks(5).tickSize(-HEIGHT + 60));

    // 5) Redraw each path (the clipPath ensures only the 4-minute window is visible):
    vitalParams.forEach(param => {
      vitalPaths[param].attr("d", lineVitals);
    });
    drugParams.forEach(param => {
      drugPaths[param].attr("d", lineDrugs);
    });

    // 6) Move the vertical playhead to x = xScale(t):
    const x = xScale(t);
    verticalLine.attr("x1", x).attr("x2", x);
    drugLine   .attr("x1", x).attr("x2", x);

    // 7) Update the slider’s thumb to this timeIndex:
    slider.property("value", timeIndex);

    // 8) Update “live values” (list vitals + drugs at this timeIndex):
    const vitalsHTML = vitalParams.map((param, i) => {
      const entry = currentVData[param][timeIndex];
      const val   = entry ? entry.value : "--";
      const color = d3.schemeTableau10[i % 10];
      return `<span style="color:${color};">${param}</span>: ${val}`;
    });
    const drugsHTML = drugParams.map((param, i) => {
      const entry = currentDData[param][timeIndex];
      const val   = entry ? entry.value : "--";
      const color = d3.schemeSet2[i % 8];
      return `<span style="color:${color};">${param}</span>: ${val}`;
    });
    liveValues.html([...vitalsHTML, ...drugsHTML].join("<br>"));

    // 9) Advance timeIndex, or stop if at the end:
    const maxIndex = currentVData[firstParam].length - 1;
    if (timeIndex < maxIndex) {
      timeIndex++;
    } else {
      clearInterval(timer);
    }
  }

  // --------------------------------------------------
  // 3k) Playback controls:
  //     • startAnimation(): clear any old timer, then setInterval(drawFrame, speed)
  //     • pauseAnimation(): clearInterval(timer)
  //     • changeSpeed(): halve speed (down to a minimum of 50ms) and restart
  // --------------------------------------------------
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

  // --------------------------------------------------
  // 3l) loadCase(caseID):
  //     • Stops any existing timer
  //     • Resets timeIndex to 0
  //     • Assigns currentVData = vitalData[caseID], currentDData = drugData[caseID]
  //     • Calls drawStaticLines(...) to draw axes, curves, legend, slider
  //     • Immediately calls drawFrame() once to place everything at frame 0
  // --------------------------------------------------
  function loadCase(caseID) {
    if (timer) clearInterval(timer);
    timeIndex = 0;
    currentVData = vitalData[caseID];
    currentDData = drugData[caseID];

    if (!currentVData || !currentDData) {
      console.warn(`Case ${caseID} missing from data.`);
      return;
    }
    drawStaticLines(currentVData, currentDData);
    // Show the playhead and live-values at frame 0 immediately:
    drawFrame();
  }

  // --------------------------------------------------
  // 3m) Slider “input” event (toggle bar):
  //     • Whenever the user drags the slider, pause animation,
  //       set timeIndex = slider’s value, then drawFrame().
  // --------------------------------------------------
  slider.on("input", function() {
    const newIndex = +this.value;
    if (timer) clearInterval(timer);
    timeIndex = newIndex;
    drawFrame();
  });

  // --------------------------------------------------
  // 3n) Hook up the buttons & dropdown:
  // --------------------------------------------------
  playBtn.on("click", startAnimation);
  pauseBtn.on("click", pauseAnimation);
  speedBtn.on("click", changeSpeed);
  caseSelect.on("change", function() {
    loadCase(this.value);
  });

  // --------------------------------------------------
  // 3o) Initial load: draw the first case in the list (if any):
  // --------------------------------------------------
  if (caseIds.length > 0) {
    loadCase(caseIds[0]);
  } else {
    console.warn("No cases found in vital_data.json.");
  }
}
