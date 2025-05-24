const PARAMETERS = {
  'Solar8000/HR': 'Heart Rate',
  'Solar8000/ART_MBP': 'Arterial BP',
  'Solar8000/PLETH_SPO2': 'Oxygen Saturation',
  'Solar8000/ETCO2': 'End-Tidal CO2',
  'Solar8000/RR': 'Respiratory Rate',
  'Solar8000/PLETH_HR': 'Pleth HR',
  'Solar8000/ART_SBP': 'Systolic BP',
  'Solar8000/ART_DBP': 'Diastolic BP',
  'Solar8000/NIBP_MBP': 'NIBP Mean BP',
  'Solar8000/CVP': 'Central Venous Pressure',
  'Vigileo/CO': 'Cardiac Output',
  'Vigileo/SV': 'Stroke Volume',
  'Vigilance/HR_AVG': 'Average HR',
  'CardioQ/HR': 'CardioQ HR'
};

const svgWidth = 1000, svgHeight = 400;
const margin = { top: 30, right: 20, bottom: 30, left: 50 };
const plotWidth = svgWidth - margin.left - margin.right;
const plotHeight = svgHeight - margin.top - margin.bottom;
const color = d3.scaleOrdinal(d3.schemeCategory10);

let fullData = {}, currentBins = [];

const svg = d3.select("#chart").append("svg")
  .attr("width", svgWidth)
  .attr("height", svgHeight);

const plot = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().range([0, plotWidth]);
const yScale = d3.scaleLinear().range([plotHeight, 0]);
const xAxis = plot.append("g").attr("transform", `translate(0,${plotHeight})`);
const yAxis = plot.append("g");

const line = d3.line()
  .x(d => xScale(d.time))
  .y(d => yScale(d.value));

document.getElementById("caseid").addEventListener("change", async (e) => {
  const caseid = e.target.value;
  if (!caseid) return;

  const trks = await fetch(`https://api.vitaldb.net/trks?caseid=${caseid}`)
    .then(res => res.text())
    .then(text => d3.csvParse(text));

  const matched = trks.filter(t => PARAMETERS[t.tname]);
  const promises = matched.map(async t => {
    const text = await fetch(`https://api.vitaldb.net/${t.tid}`).then(r => r.text());
    const values = text.trim().split("\n").map(row => {
      const [time, value] = row.split(',').map(parseFloat);
      return { time, value };
    }).filter(d => !isNaN(d.time) && !isNaN(d.value));
    return { label: PARAMETERS[t.tname], data: values };
  });

  const results = (await Promise.all(promises)).filter(d => d.data.length);
  fullData = Object.fromEntries(results.map(d => [d.label, d.data]));
  currentBins = Array.from(new Set(results.flatMap(d => d.data.map(p => Math.floor(p.time))))).sort((a, b) => a - b);

  if (!currentBins.length) {
    alert("No valid time bins available.");
    return;
  }

  document.getElementById("slider").max = currentBins.length - 1;
  updateChart(currentBins[0]);
});

document.getElementById("slider").addEventListener("input", (e) => {
  const time = currentBins[+e.target.value];
  updateChart(time);
});

function updateChart(timeBin) {
  document.getElementById("timeDisplay").textContent = `Time: ${timeBin}s`;

  const displayData = Object.entries(fullData).map(([label, arr]) => {
    const points = arr.filter(d => Math.floor(d.time) === timeBin);
    return points.length ? { label, data: points } : null;
  }).filter(Boolean);

  const allValues = displayData.flatMap(d => d.data.map(p => p.value));
  if (!allValues.length) return;

  xScale.domain([timeBin, timeBin + 1]);
  yScale.domain([d3.min(allValues), d3.max(allValues)]);

  xAxis.call(d3.axisBottom(xScale));
  yAxis.call(d3.axisLeft(yScale));

  // Update chart lines
  const paths = plot.selectAll("path").data(displayData, d => d.label);
  paths.enter().append("path")
    .merge(paths)
    .attr("fill", "none")
    .attr("stroke", d => color(d.label))
    .attr("d", d => line(d.data));

  paths.exit().remove();

  // Update legend
  const legend = d3.select("#legend").html("");
  displayData.forEach(d => {
    legend.append("div")
      .style("color", color(d.label))
      .style("margin", "2px 0")
      .text(d.label);
  });

  // Tooltip circles
  plot.selectAll("circle").remove();
  displayData.forEach(d => {
    plot.selectAll(`.dot-${d.label}`)
      .data(d.data)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.time))
      .attr("cy", d => yScale(d.value))
      .attr("r", 3)
      .attr("fill", color(d.label))
      .append("title")
      .text(d => `${d.label}: ${d.value.toFixed(2)} @ ${d.time.toFixed(1)}s`);
  });
}
