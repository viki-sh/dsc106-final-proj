Promise.all([
  d3.json('vital_data.json'),
  d3.json('proxy_drug_data.json')
]).then(([vitalData, interventionData]) => {
  const caseSelect = d3.select('#case-select');
  const vitalSVG = d3.select('#vital-chart');
  const interventionSVG = d3.select('#intervention-chart');
  const legend = d3.select('#legend');
  const iLegend = d3.select('#intervention-legend');
  const nav = d3.select('#nav');

  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const iColor = d3.scaleOrdinal(d3.schemeSet2);
  const caseIds = Object.keys(vitalData);

  let selectedParams = new Set();
  let selectedIParams = new Set();
  let timeRange = [0, 300];
  let autoplayInterval = null;
  let slider = null;
  let maxTime = 0;

  const guideX = 450;

  function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateLegend(params, container, set, colorScale, updateFn) {
    container.selectAll('*').remove();
    params.forEach(param => {
      const row = container.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '0.3rem');
      row.append('input')
        .attr('type', 'checkbox')
        .property('checked', true)
        .on('change', function () {
          this.checked ? set.add(param) : set.delete(param);
          updateFn(caseSelect.property('value'));
        });
      row.append('span')
        .style('color', colorScale(param))
        .style('font-weight', 'bold')
        .text(param);
      set.add(param);
    });
  }

  function updateLiveReadout(time, caseData, proxyData) {
    let html = `<strong>${formatTime(time)}</strong><br/>`;
    selectedParams.forEach(p => {
      const v = caseData[p].reduce((a, b) =>
        Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a);
      html += `<div><span style='color:${color(p)}'>${p}</span>: ${v.value.toFixed(1)}</div>`;
    });
    selectedIParams.forEach(p => {
      const v = proxyData[p].reduce((a, b) =>
        Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a);
      html += `<div><span style='color:${iColor(p)}'>${p}</span>: ${v.value.toFixed(1)}</div>`;
    });
    d3.select('#live-data').html(html);
  }

  function updateSlider(caseData) {
    maxTime = Math.max(...Object.values(caseData).flat().map(d => d.time));
    nav.selectAll('*').remove();
    let currentSpeed = 50;

    const wrapper = nav.append('div')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('align-items', 'center')
      .style('gap', '10px');

    slider = wrapper.append('input')
      .attr('type', 'range')
      .style('width', '900px')
      .attr('min', 0)
      .attr('max', maxTime - 300)
      .attr('step', 1)
      .attr('value', timeRange[0])
      .on('input', function () {
        timeRange = [+this.value, +this.value + 300];
        updateChart(caseSelect.property('value'));
      });

    const buttons = wrapper.append('div');
    buttons.append('button').text('▶️ Play').on('click', () => {
      if (autoplayInterval) return;
      autoplayInterval = setInterval(() => {
        let next = timeRange[0] + 1;
        if (next > maxTime - 300) return clearInterval(autoplayInterval);
        timeRange = [next, next + 300];
        slider.property('value', next);
        updateChart(caseSelect.property('value'));
      }, currentSpeed);
    });

    buttons.append('button').text('⏸ Pause').style('margin-left', '10px').on('click', () => {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    });

    buttons.append('button').text('⏩ Speed it Up!').style('margin-left', '10px').on('click', () => {
      currentSpeed = Math.max(1, Math.floor(currentSpeed / 10));
      if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = setInterval(() => {
          let next = timeRange[0] + 1;
          if (next > maxTime - 300) return clearInterval(autoplayInterval);
          timeRange = [next, next + 300];
          slider.property('value', next);
          updateChart(caseSelect.property('value'));
        }, currentSpeed);
      }
    });
  }

  function updateChart(caseId) {
    const caseData = vitalData[caseId];
    const proxyData = interventionData[caseId] || {};

    vitalSVG.selectAll('*').remove();
    interventionSVG.selectAll('*').remove();

    const xScale = d3.scaleLinear().domain(timeRange).range([50, 850]);

    // VITAL CHART
    const params = Object.keys(caseData);
    const yExtent = d3.extent(
      params.filter(p => selectedParams.has(p)).flatMap(p =>
        caseData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]).map(d => d.value)
      )
    );
    const yScale = d3.scaleLinear().domain(yExtent).range([450, 50]);
    const line = d3.line().x(d => xScale(d.time)).y(d => yScale(d.value));

    vitalSVG.append('g').attr('transform', 'translate(0,450)').call(d3.axisBottom(xScale).tickFormat(formatTime));
    vitalSVG.append('g').attr('transform', 'translate(50,0)').call(d3.axisLeft(yScale));

    vitalSVG.append('line')
      .attr('x1', guideX).attr('x2', guideX)
      .attr('y1', 0).attr('y2', 450)
      .attr('stroke', 'gray').attr('stroke-width', 1.5);

    params.forEach(p => {
      if (!selectedParams.has(p)) return;
      const values = caseData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
      vitalSVG.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', color(p))
        .attr('stroke-width', 1.5)
        .attr('d', line);
    });

    // INTERVENTION CHART
    const iParams = Object.keys(proxyData);
    const iXScale = xScale.copy();
    const iExtent = d3.extent(
      iParams.filter(p => selectedIParams.has(p)).flatMap(p =>
        proxyData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]).map(d => d.value)
      )
    );
    const iYScale = d3.scaleLinear().domain(iExtent).range([180, 20]);
    const iLine = d3.line().x(d => iXScale(d.time)).y(d => iYScale(d.value));

    interventionSVG.append('g').attr('transform', 'translate(0,180)').call(d3.axisBottom(iXScale).tickFormat(formatTime));
    interventionSVG.append('g').attr('transform', 'translate(50,0)').call(d3.axisLeft(iYScale));

    interventionSVG.append('line')
      .attr('x1', guideX).attr('x2', guideX)
      .attr('y1', 0).attr('y2', 180)
      .attr('stroke', 'gray').attr('stroke-width', 1.5);

    iParams.forEach(p => {
      if (!selectedIParams.has(p)) return;
      const values = proxyData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
      interventionSVG.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', iColor(p))
        .attr('stroke-width', 2)
        .attr('d', iLine);
    });

    const centerTime = Math.round(xScale.invert(guideX));
    updateLiveReadout(centerTime, caseData, proxyData);
  }

  // Initialize UI
  const selector = d3.select('#case-select');
  selector.selectAll('option')
    .data(caseIds)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => `Case ${d}`);

  selector.on('change', () => {
    const selected = selector.property('value');
    const params = Object.keys(vitalData[selected]);
    const iParams = Object.keys(interventionData[selected] || {});
    selectedParams = new Set(params);
    selectedIParams = new Set(iParams);
    updateLegend(params, legend, selectedParams, color, updateChart);
    updateLegend(iParams, iLegend, selectedIParams, iColor, updateChart);
    updateSlider(vitalData[selected]);
    updateChart(selected);
  });

  const initialCase = caseIds[0];
  selectedParams = new Set(Object.keys(vitalData[initialCase]));
  selectedIParams = new Set(Object.keys(interventionData[initialCase] || {}));
  updateLegend(Array.from(selectedParams), legend, selectedParams, color, updateChart);
  updateLegend(Array.from(selectedIParams), iLegend, selectedIParams, iColor, updateChart);
  updateSlider(vitalData[initialCase]);
  updateChart(initialCase);
});
