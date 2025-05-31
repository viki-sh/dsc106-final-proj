const WIDTH = 900;
const HEIGHT = 300;
const CHUNK_MIN = 10;

let vitals, drugs;
let minTime, maxTime, chunks = [];

const svgVitals = d3.select("#chart");
const svgDrugs = d3.select("#intervention-chart");

const x = d3.scaleTime().range([60, WIDTH - 60]);
const yVitals = d3.scaleLinear().range([HEIGHT - 40, 20]);
const yDrugs = d3.scaleLinear().range([HEIGHT - 40, 20]);

const lineVitals = d3.line()
  .x(d => x(new Date(d.time)))
  .y(d => yVitals(d.value));

const lineDrugs = d3.line()
  .x(d => x(new Date(d.time)))
  .y(d => yDrugs(d.value));

Promise.all([
  d3.json("vital_data.json"),
  d3.json("proxy_drug_data.json")
]).then(([vData, dData]) => {
  const caseID = "25"; // default case
  vitals = vData[caseID];
  drugs = dData[caseID];

  const times = [
    ...Object.values(vitals).flatMap(arr => arr.map(d => new Date(d.time))),
    ...Object.values(drugs).flatMap(arr => arr.map(d => new Date(d.time)))
  ];
  minTime = d3.min(times);
  maxTime = d3.max(times);

  const chunkSize = CHUNK_MIN * 60000;
  for (let t = +minTime; t < +maxTime; t += chunkSize) {
    chunks.push([new Date(t), new Date(t + chunkSize)]);
  }

  const slider = d3.select("#chunk-slider")
    .attr("max", chunks.length - 1)
    .on("input", function () {
      renderWindow(+this.value);
    });

  renderWindow(0);
});

function renderWindow(i) {
  const [start, end] = chunks[i];
  x.domain([start, end]);

  svgVitals.selectAll("*").remove();
  svgDrugs.selectAll("*").remove();

  const allVitals = Object.values(vitals).flatMap(d => d.map(p => p.value));
  const allDrugs = Object.values(drugs).flatMap(d => d.map(p => p.value));
  yVitals.domain(d3.extent(allVitals));
  yDrugs.domain(d3.extent(allDrugs));

  Object.entries(vitals).forEach(([key, arr], idx) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= start && t <= end;
    });
    svgVitals.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeTableau10[idx % 10])
      .attr("stroke-width", 1.5)
      .attr("d", lineVitals);
  });

  Object.entries(drugs).forEach(([key, arr], idx) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= start && t <= end;
    });
    svgDrugs.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeSet2[idx % 8])
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 2")
      .attr("d", lineDrugs);
  });

  svgVitals.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(x));
  svgVitals.append("g")
    .attr("transform", "translate(60, 0)")
    .call(d3.axisLeft(yVitals));

  svgDrugs.append("g")
    .attr("transform", `translate(0, ${HEIGHT - 40})`)
    .call(d3.axisBottom(x));
  svgDrugs.append("g")
    .attr("transform", "translate(60, 0)")
    .call(d3.axisLeft(yDrugs));

  d3.select("#chunk-label").text(`🕒 Window: ${format(start)} → ${format(end)}`);
}

function format(d) {
  const mins = Math.floor((d - minTime) / 60000);
  const mm = String(mins).padStart(2, "0");
  return `${mm}:00`;
}
