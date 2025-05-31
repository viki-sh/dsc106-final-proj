const width = 700;
const height = 360;

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
]).then(([vitalData, drugData]) => {
  const vitalSvg = d3.select("#chart");
  const drugSvg = d3.select("#intervention-chart");
  const caseSelect = d3.select("#case-select");
  const legend = d3.select("#legend");
  const liveValues = d3.select("#live-values");

  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  const vitalParams = Object.keys(vitalData["25"]);
  const drugParams = Object.keys(drugData["25"]);

  const colors = d3.scaleOrdinal()
    .domain(vitalParams)
    .range(d3.schemeTableau10);

  const drugColors = d3.scaleOrdinal()
    .domain(drugParams)
    .range(d3.schemeSet2);

  const xScale = d3.scaleLinear().range([40, width - 20]);
  const yScaleVitals = d3.scaleLinear().range([height - 30, 10]);
  const yScaleDrugs = d3.scaleLinear().range([height - 30, 10]);

  const lineVitals = d3.line()
    .x(d => xScale(d.time))
    .y(d => yScaleVitals(d.value));

  const lineDrugs = d3.line()
    .x(d => xScale(d.time))
    .y(d => yScaleDrugs(d.value));

  let timeIndex = 0;
  let timer = null;
  let speed = 200;
  let selectedCase = caseIds[0];

  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height);

  // Legends
  [...vitalParams, ...drugParams].forEach(p => {
    legend.append("div").html(
      `<span style="color:${colors(p) || drugColors(p)};">&#9632;</span> ${p}`
    );
  });

  const vitalPaths = {};
  const drugPaths = {};

  function drawStaticLines(vData, dData) {
    const maxTime = Math.max(
      ...vitalParams.map(p => d3.max(vData[p], d => d.time)),
      ...drugParams.map(p => d3.max(dData[p], d => d.time))
    );
    xScale.domain([0, maxTime]);

    const vitalsAll = vitalParams.flatMap(p => vData[p].map(d => d.value));
    const drugsAll = drugParams.flatMap(p => dData[p].map(d => d.value));

    yScaleVitals.domain([0, d3.max(vitalsAll)]);
    yScaleDrugs.domain([0, d3.max(drugsAll)]);

    // Draw full vital lines
    vitalParams.forEach(p => {
      if (!vitalPaths[p]) {
        vitalPaths[p] = vitalSvg.append("path")
          .attr("stroke", colors(p))
          .attr("fill", "none")
          .attr("stroke-width", 2);
      }
      vitalPaths[p].datum(vData[p]).attr("d", lineVitals);
    });

    // Draw full drug lines
    drugParams.forEach(p => {
      if (!drugPaths[p]) {
        drugPaths[p] = drugSvg.append("path")
          .attr("stroke", drugColors(p))
          .attr("fill", "none")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4 2");
      }
      drugPaths[p].datum(dData[p]).attr("d", lineDrugs);
    });
  }

  function drawFrame(vData, dData) {
    const time = vData[vitalParams[0]][timeIndex]?.time || 0;
    const x = xScale(time);
    verticalLine.attr("x1", x).attr("x2", x);

    const vitalsLive = vitalParams.map(p => {
      const d = vData[p][timeIndex];
      return `<span style="color:${colors(p)}">${p}</span>: ${d?.value ?? '--'}`;
    });

    const drugsLive = drugParams.map(p => {
      const d = dData[p][timeIndex];
      return `<span style="color:${drugColors(p)}">${p}</span>: ${d?.value ?? '--'}`;
    });

    liveValues.html([...vitalsLive, ...drugsLive].join("<br>"));

    if (timeIndex < vData[vitalParams[0]].length - 1) timeIndex++;
    else clearInterval(timer);
  }

  function startAnimation(vData, dData) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => drawFrame(vData, dData), speed);
  }

  function pauseAnimation() {
    if (timer) clearInterval(timer);
  }

  function changeSpeed(vData, dData) {
    speed = speed === 200 ? 100 : 200;
    startAnimation(vData, dData);
  }

  function updateCase(caseId) {
    selectedCase = caseId;
    const vData = vitalData[caseId];
    const dData = drugData[caseId];
    timeIndex = 0;
    drawStaticLines(vData, dData);
    startAnimation(vData, dData);
  }

  d3.select("#play").on("click", () => updateCase(selectedCase));
  d3.select("#pause").on("click", pauseAnimation);
  d3.select("#speed").on("click", () => changeSpeed(vitalData[selectedCase], drugData[selectedCase]));
  caseSelect.on("change", function () {
    updateCase(this.value);
  });

  updateCase(selectedCase);
});
