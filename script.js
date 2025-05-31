const WIDTH = 880;
const HEIGHT = 250;
const CHUNK_MS = 10 * 60 * 1000; // 10 minutes

const svgVitals = d3.select("#chart")
  .attr("width", WIDTH)
  .attr("height", HEIGHT);

const svgInterventions = d3.select("#intervention-chart")
  .attr("width", WIDTH)
  .attr("height", HEIGHT);

const xScale = d3.scaleTime().range([50, WIDTH - 50]);
const yVitals = d3.scaleLinear().range([HEIGHT - 40, 20]);
const yInterv = d3.scaleLinear().range([HEIGHT - 40, 20]);

const lineVitals = d3.line()
  .x(d => xScale(new Date(d.time)))
  .y(d => yVitals(d.value));

const lineInterv = d3.line()
  .x(d => xScale(new Date(d.time)))
  .y(d => yInterv(d.value));

let allChunks = [];
let vitalsData, interventionsData;
let minTime, maxTime;

d3.json("vital_data.json").then(vitalJSON => {
  d3.json("proxy_drug_data.json").then(drugJSON => {
    const caseID = "25";
    vitalsData = vitalJSON[caseID];
    interventionsData = drugJSON[caseID];

    const allTimes = [
      ...Object.values(vitalsData).flatMap(arr => arr.map(d => new Date(d.time))),
      ...Object.values(interventionsData).flatMap(arr => arr.map(d => new Date(d.time)))
    ];
    minTime = d3.min(allTimes);
    maxTime = d3.max(allTimes);

    // Create chunks from real data range
    allChunks = [];
    for (let t = +minTime; t < +maxTime; t += CHUNK_MS) {
      allChunks.push([new Date(t), new Date(t + CHUNK_MS)]);
    }

    d3.select("#timeline-slider")
      .attr("max", allChunks.length - 1)
      .attr("value", 0)
      .on("input", function () {
        const idx = +this.value;
        drawChunk(idx);
      });

    drawChunk(0); // initial view
  });
});

function drawChunk(idx) {
  const [start, end] = allChunks[idx];
  xScale.domain([start, end]);

  svgVitals.selectAll("*").remove();
  svgInterventions.selectAll("*").remove();

  const allVitalValues = Object.values(vitalsData).flatMap(d => d.map(x => x.value));
  const allIntervValues = Object.values(interventionsData).flatMap(d => d.map(x => x.value));

  yVitals.domain([d3.min(allVitalValues), d3.max(allVitalValues)]);
  yInterv.domain([d3.min(allIntervValues), d3.max(allIntervValues)]);

  Object.entries(vitalsData).forEach(([key, arr], i) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= start && t <= end;
    });
    svgVitals.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeTableau10[i % 10])
      .attr("stroke-width", 1.5)
      .attr("d", lineVitals);
  });

  Object.entries(interventionsData).forEach(([key, arr], i) => {
    const filtered = arr.filter(d => {
      const t = new Date(d.time);
      return t >= start && t <= end;
    });
    svgInterventions.append("path")
      .datum(filtered)
      .attr("fill", "none")
      .attr("stroke", d3.schemeSet2[i % 8])
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 2")
      .attr("d", lineInterv);
  });

  svgVitals.append("g")
    .attr("transform", `translate(0,${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(5));

  svgVitals.append("g")
    .attr("transform", "translate(50,0)")
    .call(d3.axisLeft(yVitals));

  svgInterventions.append("g")
    .attr("transform", `translate(0,${HEIGHT - 40})`)
    .call(d3.axisBottom(xScale).ticks(5));

  svgInterventions.append("g")
    .attr("transform", "translate(50,0)")
    .call(d3.axisLeft(yInterv));
}
