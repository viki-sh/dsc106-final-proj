const margin = { top: 50, right: 200, bottom: 100, left: 50 };
const width = 3000;
const height = 300;

let vitalsData, interventionsData;
let currentCase = "1";
let playing = false;
let speed = 1;
let interval;
let currentIndex = 0;

const svgVitals = d3.select("#chart")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const svgInterventions = d3.select("#intervention-chart")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleTime().range([0, width]);
const yVitals = d3.scaleLinear().range([height, 0]);
const yInterventions = d3.scaleLinear().range([height, 0]);
const color = d3.scaleOrdinal(d3.schemeCategory10);

const lineVitals = d3.line()
  .x(d => x(new Date(d.time)))
  .y(d => yVitals(d.value));

const lineInterventions = d3.line()
  .x(d => x(new Date(d.time)))
  .y(d => yInterventions(d.value));

d3.json("vital_data.json").then(vData => {
  vitalsData = vData;
  d3.json("proxy_drug_data.json").then(iData => {
    interventionsData = iData;
    init();
  });
});

function init() {
  const caseVitals = vitalsData[currentCase];
  const caseInterventions = interventionsData[currentCase];

  const allVitals = Object.keys(caseVitals);
  const allIntervs = Object.keys(caseInterventions);

  const allVitalTimes = allVitals.flatMap(k => caseVitals[k].map(d => new Date(d.time)));
  const allIntervTimes = allIntervs.flatMap(k => caseInterventions[k].map(d => new Date(d.time)));
  const allTimes = allVitalTimes.concat(allIntervTimes);

  const allVitalValues = allVitals.flatMap(k => caseVitals[k].map(d => d.value));
  const allIntervValues = allIntervs.flatMap(k => caseInterventions[k].map(d => d.value));

  const minTime = d3.min(allTimes);
  const maxTime = new Date(minTime.getTime() + 20 * 60 * 1000);  // stretch to 20 minutes

  x.domain([minTime, maxTime]);
  yVitals.domain([0, d3.max(allVitalValues)]);
  yInterventions.domain([0, d3.max(allIntervValues)]);
  color.domain([...allVitals, ...allIntervs]);

  allVitals.forEach(key => {
    svgVitals.append("path")
      .datum(caseVitals[key])
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 1.5)
      .attr("class", `line ${key}`);
  });

  allIntervs.forEach(key => {
    svgInterventions.append("path")
      .datum(caseInterventions[key])
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 1.5)
      .attr("class", `line ${key}`);
  });

  svgVitals.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svgVitals.append("g").call(d3.axisLeft(yVitals));

  svgInterventions.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svgInterventions.append("g").call(d3.axisLeft(yInterventions));
}

function updateChart() {
  const t0 = x.domain()[0].getTime();
  const tNow = t0 + currentIndex * 10000;  // 10s per tick

  const caseVitals = vitalsData[currentCase];
  const caseInterventions = interventionsData[currentCase];

  Object.keys(caseVitals).forEach(key => {
    const data = caseVitals[key].filter(d => new Date(d.time).getTime() <= tNow);
    svgVitals.select(`.line.${key}`).attr("d", lineVitals(data));
  });

  Object.keys(caseInterventions).forEach(key => {
    const data = caseInterventions[key].filter(d => new Date(d.time).getTime() <= tNow);
    svgInterventions.select(`.line.${key}`).attr("d", lineInterventions(data));
  });

  currentIndex++;
}

d3.select("#play").on("click", () => {
  if (!playing) {
    playing = true;
    interval = setInterval(updateChart, 500);  // smoother steps
  }
});

d3.select("#pause").on("click", () => {
  playing = false;
  clearInterval(interval);
});

d3.select("#speed").on("click", () => {
  speed = speed === 1 ? 2 : 1;
  if (playing) {
    clearInterval(interval);
    interval = setInterval(updateChart, 1000 / speed);
  }
});

d3.select("#case-select").on("change", function () {
  currentCase = this.value;
  svgVitals.selectAll("*").remove();
  svgInterventions.selectAll("*").remove();
  currentIndex = 0;
  init();
});
