const width = 700;
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

  const colorVitals = d3.scaleOrdinal()
    .domain(vitalParams)
    .range(d3.schemeTableau10);

  const colorDrugs = d3.scaleOrdinal()
    .domain(drugParams)
    .range(d3.schemeSet2);

  const xScale = d3.scaleLinear().range([40, width - 20]);
  const yVitals = d3.scaleLinear().range([height - 30, 10]);
  const yDrugs = d3.scaleLinear().range([height - 30, 10]);

  const lineVitals = d3.line()
    .x(d => xScale(d.time))
    .y(d => yVitals(d.value));

  const lineDrugs = d3.line()
    .x(d => xScale(d.time))
    .y(d => yDrugs(d.value));

  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height);

  const drugLine = drugSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height);

  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  const vitalPaths = {};
  const drugPaths = {};
  let timeIndex = 0;
  let timer = null;
  let speed = 200;
  let selectedCase = caseIds[0];

  function drawStaticLines(vData, dData) {
    const allTimes = [
      ...vitalParams.flatMap(p => vData[p].map(d => d.time)),
      ...drugParams.flatMap(p => dData[p].map(d => d.time)),
    ];
    const maxTime = d3.max(allTimes);
    xScale.domain([0, maxTime]);

    yVitals.domain([0, d3.max(vitalParams.flatMap(p => vData[p].map(d => d.value)))]);
    yDrugs.domain([0, d3.max(drugParams.flatMap(p => dData[p].map(d => d.value)))]);

    vitalParams.forEach(p => {
      if (!vitalPaths[p]) {
        vitalPaths[p] = vitalSvg.append("path")
          .attr("stroke", colorVitals(p))
          .attr("fill", "none")
          .attr("stroke-width", 2);
      }
      vitalPaths[p].datum(vData[p]).attr("d", lineVitals);
    });

    drugParams.forEach(p => {
      if (!drugPaths[p]) {
        drugPaths[p] = drugSvg.append("path")
          .attr("stroke", colorDrugs(p))
          .attr("fill", "none")
          .attr("stroke-dasharray", "4 2")
          .attr("stroke-width", 2);
      }
      drugPaths[p].datum(dData[p]).attr("d", lineDrugs);
    });

    // Legend
    legend.html("");
    vitalParams.forEach(p => {
      legend.append("div").html(`<span style="color:${colorVitals(p)};">&#9632;</span> ${p}`);
    });
    drugParams.forEach(p => {
      legend.append("div").html(`<span style="color:${colorDrugs(p)};">&#9632;</span> ${p}`);
    });
  }

  function drawFrame(vData, dData) {
    const t = vData[vitalParams[0]][timeIndex]?.time || 0;
    const x = xScale(t);
    verticalLine.attr("x1", x).attr("x2", x);
    drugLine.attr("x1", x).attr("x2", x);

    const liveVitals = vitalParams.map(p => {
      const d = vData[p][timeIndex];
      return `<span style="color:${colorVitals(p)}">${p}</span>: ${d?.value ?? "--"}`;
    });

    const liveDrugs = drugParams.map(p => {
      const d = dData[p][timeIndex];
      return `<span style="color:${colorDrugs(p)}">${p}</span>: ${d?.value ?? "--"}`;
    });

    liveValues.html([...liveVitals, ...liveDrugs].join("<br>"));

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
  caseSelect.on("change", function () {
    loadCase(this.value);
  });

  loadCase(selectedCase);
});
