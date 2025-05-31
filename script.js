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

  const xScale = d3.scaleTime().range([50, width - 50]);
  const yVitals = d3.scaleLinear().range([height - 30, 10]);
  const yDrugs = d3.scaleLinear().range([height - 30, 10]);

  const lineVitals = d3.line().x(d => xScale(new Date(d.time))).y(d => yVitals(d.value));
  const lineDrugs = d3.line().x(d => xScale(new Date(d.time))).y(d => yDrugs(d.value));

  const verticalLine = vitalSvg.append("line").attr("stroke", "#333").attr("y1", 0).attr("y2", height);
  const drugLine = drugSvg.append("line").attr("stroke", "#333").attr("y1", 0).attr("y2", height);

  const xAxisVitals = vitalSvg.append("g").attr("transform", `translate(0,${height - 30})`);
  const yAxisVitals = vitalSvg.append("g").attr("transform", "translate(50,0)");
  const yAxisDrugs = drugSvg.append("g").attr("transform", `translate(${width - 50},0)`);

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

    xAxisVitals.call(d3.axisBottom(xScale).ticks(5));
    yAxisVitals.call(d3.axisLeft(yVitals));
    yAxisDrugs.call(d3.axisRight(yDrugs));

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
          .attr("fill", "none").attr("stroke-width", 2).attr("stroke-dasharray", "4 2");
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
    speed = speed === 200 ? 100 : 200;
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

  loadCase(selectedCase);
});
