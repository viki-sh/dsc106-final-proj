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

  const vitalParams = Object.keys(vitalData["25"]);
  const drugParams = Object.keys(drugData["25"]);

  const colors = d3.scaleOrdinal()
    .domain(vitalParams)
    .range(d3.schemeTableau10);

  const drugColors = d3.scaleOrdinal()
    .domain(drugParams)
    .range(d3.schemeSet2);

  const caseIds = Object.keys(vitalData);
  caseIds.forEach(id => {
    caseSelect.append("option").attr("value", id).text("Case " + id);
  });

  let timeIndex = 0;
  let timer = null;
  let speed = 200;
  let selectedCase = caseIds[0];

  const xScale = d3.scaleLinear().range([40, width - 20]);
  const yScale = d3.scaleLinear().range([height - 30, 10]);

  const line = d3.line()
    .x(d => xScale(d.time))
    .y(d => yScale(d.value));

  const vitalPaths = {};
  const drugPaths = {};
  const vitalValues = {};
  const drugValues = {};

  // Build legends
  vitalParams.forEach(key => {
    legend.append("div")
      .html(`<span style="color:${colors(key)};">&#9632;</span> ${key}`);
  });

  // Initialize SVG paths
  vitalParams.forEach(key => {
    vitalPaths[key] = vitalSvg.append("path")
      .attr("stroke", colors(key))
      .attr("fill", "none")
      .attr("stroke-width", 2);
  });

  drugParams.forEach(key => {
    drugPaths[key] = drugSvg.append("path")
      .attr("stroke", drugColors(key))
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 2");
  });

  const verticalLine = vitalSvg.append("line")
    .attr("stroke", "#333")
    .attr("y1", 0)
    .attr("y2", height)
    .attr("x1", 0)
    .attr("x2", 0);

  function drawFrame() {
    const vData = vitalData[selectedCase];
    const dData = drugData[selectedCase];

    const maxTime = d3.max(vitalParams, key =>
      d3.max(vData[key], d => d.time)
    );

    xScale.domain([0, maxTime]);

    const allValues = [
      ...vitalParams.flatMap(k => vData[k].map(d => d.value)),
      ...drugParams.flatMap(k => dData[k].map(d => d.value))
    ];

    yScale.domain([0, d3.max(allValues)]);

    vitalParams.forEach(key => {
      const data = vData[key].slice(0, timeIndex);
      vitalPaths[key].datum(data).attr("d", line);
    });

    drugParams.forEach(key => {
      const data = dData[key].slice(0, timeIndex);
      drugPaths[key].datum(data).attr("d", line);
    });

    const x = xScale(vData[vitalParams[0]][timeIndex]?.time || 0);
    verticalLine.attr("x1", x).attr("x2", x);

    const vitalsLive = vitalParams.map(p => {
      const d = vData[p][timeIndex];
      return `${p}: ${d?.value ?? '--'}`;
    });

    const drugsLive = drugParams.map(p => {
      const d = dData[p][timeIndex];
      return `${p}: ${d?.value ?? '--'}`;
    });

    liveValues.html([...vitalsLive, ...drugsLive].join("<br>"));

    if (timeIndex < vData[vitalParams[0]].length - 1) timeIndex++;
    else clearInterval(timer);
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(drawFrame, speed);
  }

  function pause() {
    if (timer) clearInterval(timer);
  }

  function changeSpeed() {
    speed = speed === 200 ? 100 : 200;
    start();
  }

  d3.select("#play").on("click", start);
  d3.select("#pause").on("click", pause);
  d3.select("#speed").on("click", changeSpeed);
  caseSelect.on("change", function () {
    selectedCase = this.value;
    timeIndex = 0;
    start();
  });

  start();
});
