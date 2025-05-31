
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

  const vitalParams = Object.keys(vitalData["25"]);
  const drugParams = Object.keys(drugData["25"]);

  const colorVitals = d3.scaleOrdinal().domain(vitalParams).range(d3.schemeTableau10);
  const colorDrugs = d3.scaleOrdinal().domain(drugParams).range(d3.schemeSet2);

  const xScale = d3.scaleTime().range([60, width - 60]);
  const yVitals = d3.scaleLinear().range([height - 40, 20]);
  const yDrugs = d3.scaleLinear().range([height - 40, 20]);

  const lineVitals = d3.line().x(d => xScale(new Date(d.time))).y(d => yVitals(d.value));
  const lineDrugs = d3.line().x(d => xScale(new Date(d.time))).y(d => yDrugs(d.value));

  const verticalLine = vitalSvg.append("line").attr("stroke", "#333").attr("y1", 0).attr("y2", height);
  const drugLine = drugSvg.append("line").attr("stroke", "#333").attr("y1", 0).attr("y2", height);

  const xAxisVitals = vitalSvg.append("g").attr("transform", `translate(0,${height - 40})`);
  const yAxisVitals = vitalSvg.append("g").attr("transform", "translate(60,0)");
  const xAxisDrugs = drugSvg.append("g").attr("transform", `translate(0,${height - 40})`);
  const yAxisDrugs = drugSvg.append("g").attr("transform", `translate(${width - 60},0)`);

  // axis labels
  vitalSvg.append("text").attr("class", "axis-label")
    .attr("x", width / 2).attr("y", height - 5)
    .style("text-anchor", "middle").text("Time");

  vitalSvg.append("text").attr("class", "axis-label")
    .attr("x", -height / 2).attr("y", 20)
    .attr("transform", "rotate(-90)").style("text-anchor", "middle").text("Vitals");

  drugSvg.append("text").attr("class", "axis-label")
    .attr("x", width / 2).attr("y", height - 5)
    .style("text-anchor", "middle").text("Time");

  drugSvg.append("text").attr("class", "axis-label")
    .attr("x", -height / 2).attr("y", 20)
    .attr("transform", "rotate(-90)").style("text-anchor", "middle").text("Interventions");

  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  const vitalPaths = {}, drugPaths = {};
  let timeIndex = 0, timer = null, speed = 200, selectedCase = caseIds[0];

  function drawStaticLines(vData, dData) {
    const allTimes = [...vitalParams, ...drugParams].flatMap(p =>
      (vData[p] || dData[p] || []).map(d => new Date(d.time))
    );
    xScale.domain(d3.extent(allTimes));
    yVitals.domain([0, d3.max(vitalParams.flatMap(p => vData[p].map(d => d.value)))]);
    yDrugs.domain([0, d3.max(drugParams.flatMap(p => dData[p].map(d => d.value)))]);

    xAxisVitals.call(d3.axisBottom(xScale).ticks(5).tickSize(-height + 60));
    yAxisVitals.call(d3.axisLeft(yVitals).ticks(5).tickSize(-width + 120));
    xAxisDrugs.call(d3.axisBottom(xScale).ticks(5).tickSize(-height + 60));
    yAxisDrugs.call(d3.axisRight(yDrugs).ticks(5).tickSize(-width + 120));

    vitalParams.forEach(p => {
      if (!vitalPaths[p]) {
        vitalPaths[p] = vitalSvg.append("path").attr("stroke", colorVitals(p))
          .attr("fill", "none").attr("stroke-width", 2);
      }
      vitalPaths[p].datum(vData[p]).attr("d", lineVitals);
    });

    drugParams.forEach(p => {
      if (!drugPaths[p]) {
        drugPaths[p] = drugSvg.append("path").attr("stroke", colorDrugs(p))
          .attr("fill", "none").attr("stroke-width", 2);
      }
      drugPaths[p].datum(dData[p]).attr("d", lineDrugs);
    });

    legend.html("");
    vitalParams.forEach(p => legend.append("div").html(`<span style="color:${colorVitals(p)};">&#9632;</span> ${p}`));
    drugParams.forEach(p => legend.append("div").html(`<span style="color:${colorDrugs(p)};">&#9632;</span> ${p}`));
  }

  function drawFrame(vData, dData) {
    const t = new Date(vData[vitalParams[0]][timeIndex]?.time || 0);
    const x = xScale(t);
    verticalLine.attr("x1", x).attr("x2", x);
    drugLine.attr("x1", x).attr("x2", x);

    const vitalsLive = vitalParams.map(p => {
      const d = vData[p][timeIndex];
      return `<span style="color:${colorVitals(p)}">${p}</span>: ${d?.value ?? "--"}`;
    });
    const drugsLive = drugParams.map(p => {
      const d = dData[p][timeIndex];
      return `<span style="color:${colorDrugs(p)}">${p}</span>: ${d?.value ?? "--"}`;
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
    speed = speed === 200 ? 50 : 200;
    startAnimation(vData, dData);
  }

  function loadCase(id) {
    selectedCase = id;
    const vData = vitalData[id];
    const dData = drugData[id];
    timeIndex = 0;
    drawStaticLines(vData, dData);
    startAnimation(vData, dData);
  }

  d3.select("#play").on("click", () => loadCase(selectedCase));
  d3.select("#pause").on("click", pauseAnimation);
  d3.select("#speed").on("click", () => changeSpeed(vitalData[selectedCase], drugData[selectedCase]));
  
caseSelect.on("change", function () { loadCase(this.value); });

const speedSlider = d3.select("#speed-range");
speedSlider.on("input", function() {
  speed = +this.value;
  if (timer) {
    clearInterval(timer);
    startAnimation(vitalData[selectedCase], drugData[selectedCase]);
  }
});


  // loadCase(selectedCase);
});
