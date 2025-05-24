const color = d3.scaleOrdinal(d3.schemeCategory10);
let fullData = {}, currentBins = [];

const svg = d3.select("#chart").append("svg")
  .attr("width", 1000)
  .attr("height", 400);

const plot = svg.append("g").attr("transform", "translate(50,30)");
const xScale = d3.scaleLinear().range([0, 900]);
const yScale = d3.scaleLinear().range([300, 0]);
const xAxis = plot.append("g").attr("transform", "translate(0,300)");
const yAxis = plot.append("g");

const line = d3.line()
  .x(d => xScale(d.time))
  .y(d => yScale(d.value));

document.getElementById("caseid").addEventListener("change", async e => {
  const id = e.target.value;
  if (!id) return;
  const data = await fetch(`data/case_${id}.json`).then(r => r.json());
  fullData = data;
  currentBins = Array.from(new Set(Object.values(data).flatMap(d => d.map(p => Math.floor(p.time))))).sort((a, b) => a - b);
  document.getElementById("slider").max = currentBins.length - 1;
  updateChart(currentBins[0]);
});

document.getElementById("slider").addEventListener("input", e => {
  updateChart(currentBins[+e.target.value]);
});

function updateChart(timeBin) {
  document.getElementById("timeDisplay").textContent = `Time: ${timeBin}s`;
  const filtered = Object.entries(fullData).map(([label, arr]) => {
    const pts = arr.filter(p => Math.floor(p.time) === timeBin);
    return pts.length ? { label, data: pts } : null;
  }).filter(Boolean);

  const values = filtered.flatMap(d => d.data.map(p => p.value));
  if (!values.length) return;

  xScale.domain([timeBin, timeBin + 1]);
  yScale.domain([d3.min(values), d3.max(values)]);
  xAxis.call(d3.axisBottom(xScale));
  yAxis.call(d3.axisLeft(yScale));

  const paths = plot.selectAll("path").data(filtered, d => d.label);
  paths.enter().append("path")
    .merge(paths)
    .attr("fill", "none")
    .attr("stroke", d => color(d.label))
    .attr("d", d => line(d.data));
  paths.exit().remove();

  d3.select("#legend").html("");
  filtered.forEach(d => {
    d3.select("#legend").append("div").style("color", color(d.label)).text(d.label);
  });
}
