const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 10, right: 10, bottom: 20, left: 40 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

let timer = null;
const duration = 60000; // 1 minute total
const interval = 100; // ms per frame

document.getElementById("start").addEventListener("click", () => {
  const caseid = document.getElementById("caseid").value;
  if (!caseid) return alert("Select a case ID.");

  fetch(`https://api.vitaldb.net/trks?caseid=${caseid}`)
    .then(res => res.json())
    .then(tracks => {
      const ekgTrack = tracks.find(t => t.tname === "SNUADC/ECG_II");
      if (!ekgTrack) return alert("No ECG data for this case.");

      fetch(`https://api.vitaldb.net/${ekgTrack.tid}`)
        .then(res => res.text())
        .then(text => {
          const data = text.trim().split("\n").map(row => {
            const [time, value] = row.split(',').map(parseFloat);
            return { time, value };
          }).filter(d => !isNaN(d.time) && !isNaN(d.value));

          const maxTime = d3.max(data, d => d.time);
          const scaleTime = d3.scaleLinear().domain([0, 10]).range([0, plotWidth]);
          const scaleValue = d3.scaleLinear().domain([-2, 2]).range([plotHeight, 0]);

          g.selectAll("*").remove();
          const path = g.append("path").attr("fill", "none").attr("stroke", "red");

          let startTime = 0;
          let frame = 0;

          timer = setInterval(() => {
            const segment = data.filter(d => d.time >= startTime && d.time < startTime + 10);
            const line = d3.line()
              .x(d => scaleTime(d.time - startTime))
              .y(d => scaleValue(d.value));

            path.datum(segment).attr("d", line);
            document.getElementById("clock").textContent = `Time: ${Math.round(startTime)}s`;

            startTime += 0.5;
            frame += interval;
            if (frame >= duration || startTime >= maxTime) clearInterval(timer);
          }, interval);
        });
    });
});
