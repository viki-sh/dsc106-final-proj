const width = 1000;
const height = 340;

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
]).then(([vitalData, drugData]) => {
  const vitalSvg = d3.select("#chart");
  const drugSvg = d3.select("#intervention-chart");
  const caseSelect = d3.select("#case-select");
  const legend = d3.select("#legend");
  const liveValues = d3.select("#live-values");

  // Assume every case has the same parameter keys, so just grab "25" (or any existing case)
  const vitalParams = Object.keys(vitalData["25"]);
  const drugParams = Object.keys(drugData["25"]);

  // Color scales for vitals and interventions
  const colorVitals = d3.scaleOrdinal().domain(vitalParams).range(d3.schemeTableau10);
  const colorDrugs  = d3.scaleOrdinal().domain(drugParams).range(d3.schemeSet2);

  // x‐axis: time (scaled to [60, width−60])
  const xScale = d3.scaleTime().range([60, width - 60]);
  // y‐axes, one for vitals and one for interventions (scaled to [height−40, 20])
  const yVitals = d3.scaleLinear().range([height - 40, 20]);
  const yDrugs  = d3.scaleLinear().range([height - 40, 20]);

  // Line generators
  const lineVitals = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yVitals(d.value));

  const lineDrugs  = d3.line()
    .x(d => xScale(new Date(d.time)))
    .y(d => yDrugs(d.value));

  // Vertical “playhead” lines on each chart
  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height);

  const drugLine = drugSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height);

  // Axis groups
  const xAxisVitals = vitalSvg.append("g").attr("transform", `translate(0,${height - 40})`);
  const yAxisVitals = vitalSvg.append("g").attr("transform", "translate(60,0)");

  const xAxisDrugs = drugSvg.append("g").attr("transform", `translate(0,${height - 40})`);
  const yAxisDrugs = drugSvg.append("g").attr("transform", `translate(${width - 60},0)`);

  // Add “Time” and “Vitals” labels for the vitals chart
  vitalSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .style("text-anchor", "middle")
    .text("Time");

  vitalSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .text("Vitals");

  // Add “Time” and “Interventions” labels for the interventions chart
  drugSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .style("text-anchor", "middle")
    .text("Time");

  drugSvg.append("text")
    .attr("class", "axis-label")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .text("Interventions");

  // Populate the case‐dropdown (“Case 1”, “Case 2”, …)
  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  // Containers for the <path> elements (so we can update them later)
  const vitalPaths = {};
  const drugPaths  = {};

  // Animation control variables
  let timeIndex     = 0;
  let timer         = null;
  let speed         = 200; // milliseconds between frames
  let currentVData  = null;
  let currentDData  = null;

  // Draw all the static lines & axes once per case (but do NOT start animating)
  function drawStaticLines(vData, dData) {
    // Combine every timestamp for both vitals+drugs to compute the x‐domain
    const allTimes = [...vitalParams, ...drugParams].flatMap(p =>
      (vData[p] || dData[p] || []).map(d => new Date(d.time))
    );
    xScale.domain(d3.extent(allTimes));

    // Compute Y‐domain for vitals by taking min/max over every vital parameter, then add 10% padding
    const vValues = vitalParams.flatMap(p => vData[p].map(d => d.value));
    const vMin = d3.min(vValues);
    const vMax = d3.max(vValues);
    const vPadding = (vMax - vMin) * 0.10;
    yVitals.domain([vMin - vPadding, vMax + vPadding]);

    // Compute Y‐domain for drugs (interventions) by taking min/max, then 10% padding
    const dValues = drugParams.flatMap(p => dData[p].map(d => d.value));
    const dMin = d3.min(dValues);
    const dMax = d3.max(dValues);
    const dPadding = (dMax - dMin) * 0.10;
    yDrugs.domain([dMin - dPadding, dMax + dPadding]);

    // Draw grid‐lined axes
    xAxisVitals.call(
      d3.axisBottom(xScale).ticks(5).tickSize(-height + 60)
    );
    yAxisVitals.call(
      d3.axisLeft(yVitals).ticks(5).tickSize(-width + 120)
    );
    xAxisDrugs.call(
      d3.axisBottom(xScale).ticks(5).tickSize(-height + 60)
    );
    yAxisDrugs.call(
      d3.axisRight(yDrugs).ticks(5).tickSize(-width + 120)
    );

    // Draw each “vital” line
    vitalParams.forEach(p => {
      if (!vitalPaths[p]) {
        vitalPaths[p] = vitalSvg.append("path")
          .attr("stroke", colorVitals(p))
          .attr("fill", "none")
          .attr("stroke-width", 2);
      }
      vitalPaths[p].datum(vData[p]).attr("d", lineVitals);
    });

    // Draw each “intervention” line (dashed)
    drugParams.forEach(p => {
      if (!drugPaths[p]) {
        drugPaths[p] = drugSvg.append("path")
          .attr("stroke", colorDrugs(p))
          .attr("fill", "none")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4 2");
      }
      drugPaths[p].datum(dData[p]).attr("d", lineDrugs);
    });

    // Re‐build the legend contents (clearing old entries first)
    legend.html("");
    vitalParams.forEach(p => {
      legend.append("div")
        .html(`<span style="color:${colorVitals(p)};">&#9632;</span> ${p}`);
    });
    drugParams.forEach(p => {
      legend.append("div")
        .html(`<span style="color:${colorDrugs(p)};">&#9632;</span> ${p}`);
    });
  }

  // On each frame of the animation, move the vertical “playhead” and update live values
  function drawFrame() {
    const t = new Date(currentVData[vitalParams[0]][timeIndex]?.time || 0);
    const x = xScale(t);

    verticalLine.attr("x1", x).attr("x2", x);
    drugLine.attr("x1", x).attr("x2", x);

    // Build the HTML for “live values” (vitals + interventions at timeIndex)
    const vitalsLive = vitalParams.map(p => {
      const dpt = currentVData[p][timeIndex];
      return `<span style="color:${colorVitals(p)};">${p}</span>: ${dpt?.value ?? "--"}`;
    });
    const drugsLive = drugParams.map(p => {
      const dpt = currentDData[p][timeIndex];
      return `<span style="color:${colorDrugs(p)};">${p}</span>: ${dpt?.value ?? "--"}`;
    });

    liveValues.html([...vitalsLive, ...drugsLive].join("<br>"));

    // Advance timeIndex (or stop if we’ve reached the end)
    if (timeIndex < currentVData[vitalParams[0]].length - 1) {
      timeIndex++;
    } else {
      clearInterval(timer);
    }
  }

  // Start the playback animation (called when “Play” is clicked)
  function startAnimation() {
    if (timer) clearInterval(timer);
    timer = setInterval(drawFrame, speed);
  }

  // Pause the animation (called when “Pause” is clicked)
  function pauseAnimation() {
    if (timer) clearInterval(timer);
  }

  // Speed up the animation (called when “Speed” is clicked)
  function changeSpeed() {
    if (timer) clearInterval(timer);
    // Halve the delay each time, but floor at 50ms
    speed = Math.max(50, speed / 2);
    timer = setInterval(drawFrame, speed);
  }

  // Load a new case: clear any existing interval, reset timeIndex, draw static lines
  function loadCase(id) {
    if (timer) clearInterval(timer);
    const vData = vitalData[id];
    const dData = drugData[id];
    currentVData = vData;
    currentDData = dData;
    timeIndex = 0;
    drawStaticLines(vData, dData);
  }

  // Bind the UI controls
  d3.select("#play").on("click",     startAnimation);
  d3.select("#pause").on("click",    pauseAnimation);
  d3.select("#speed").on("click",    changeSpeed);
  caseSelect.on("change", function() { loadCase(this.value); });

  // Initial load (use the first case in the list)
  loadCase(caseIds[0]);
});
