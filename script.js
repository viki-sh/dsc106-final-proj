d3.json('vital_data.json').then(data => {
    d3.select('h1').remove();

    const header = d3.select('body').insert('div', ':first-child');
    header.append('h1').text('Vital Sign Viewer');
    const selectorDiv = header.append('div');
    selectorDiv.append('label').text('Select Case ID: ');
    selectorDiv.append('select').attr('id', 'case-select');

    const caseSelect = d3.select('#case-select');
    const chart = d3.select('#chart');
    const nav = d3.select('body').append('div').attr('id', 'nav');
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

    const caseIds = Object.keys(data);
    caseSelect.selectAll('option')
        .data(caseIds)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => `Case ${d}`);

    const svg = d3.select('#chart svg')
        .attr('width', 900)
        .attr('height', 500);

    const legend = d3.select('#legend');

    let selectedParams = new Set();
    let timeRange = [0, 300];
    let autoplayInterval = null;
    let maxTime = 0;
    let slider = null;
    let speed = 100;

    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

function updateSlider(caseData) {
    const allPoints = Object.values(caseData).flat();
    maxTime = Math.max(...allPoints.map(d => d.time));

    nav.selectAll('*').remove();

    // Slider container
    const sliderWrapper = nav.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('gap', '10px');

    // Slider
    slider = sliderWrapper.append('input')
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

    // Button row
    const buttonRow = sliderWrapper.append('div')
        .style('margin-top', '5px');

    buttonRow.append('button')
        .text('▶️ Play')
        .on('click', () => {
            if (autoplayInterval) return;
            autoplayInterval = setInterval(() => {
                let next = timeRange[0] + 1;
                if (next > maxTime - 300) {
                    clearInterval(autoplayInterval);
                    autoplayInterval = null;
                    return;
                }
                timeRange = [next, next + 300];
                slider.property('value', next);
                updateChart(caseSelect.property('value'));
            }, speed);
        });

    buttonRow.append('button')
        .text('⏸ Pause')
        .style('margin-left', '10px')
        .on('click', () => {
            clearInterval(autoplayInterval);
            autoplayInterval = null;
        });

    buttonRow.append('button')
        .text('⏩ Speed it Up!')
        .style('margin-left', '10px')
        .on('click', () => {
            speed = Math.max(10, speed - 10);
            if (autoplayInterval) {
                clearInterval(autoplayInterval);
                autoplayInterval = setInterval(() => {
                    let next = timeRange[0] + 1;
                    if (next > maxTime - 300) {
                        clearInterval(autoplayInterval);
                        autoplayInterval = null;
                        return;
                    }
                    timeRange = [next, next + 300];
                    slider.property('value', next);
                    updateChart(caseSelect.property('value'));
                }, speed);
            }
        });
}
    const color = d3.scaleOrdinal()
    .domain([
        'Diastolic BP', 'Arterial BP', 'Systolic BP',
        'End-Tidal CO2', 'Heart Rate',
        'NIBP Mean BP', 'Pleth HR', 'Oxygen Saturation'
    ])
    .range([
        '#1f77b4',  // Diastolic BP - blue
        '#ff7f0e',  // Arterial BP - orange
        '#2ca02c',  // Systolic BP - green
        '#9467bd',  // End-Tidal CO2 - purple
        '#d62728',  // Heart Rate - red
        '#8c564b',  // NIBP Mean BP - brown
        '#e377c2',  // Pleth HR - pink
        '#7f7f7f'   // Oxygen Saturation - gray
    ]);


    function updateLegend(params) {
        legend.selectAll("*").remove();
        params.forEach(param => {
            const entry = legend.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('gap', '0.3rem');

            entry.append('input')
                .attr('type', 'checkbox')
                .attr('checked', true)
                .on('change', function () {
                    if (this.checked) selectedParams.add(param);
                    else selectedParams.delete(param);
                    updateChart(caseSelect.property('value'));
                });

            entry.append('span')
                .style('color', color(param))
                .style('font-weight', 'bold')
                .text(param);

            selectedParams.add(param);
        });
    }

    function updateChart(caseId) {
        const caseData = data[caseId];
        svg.selectAll("*").remove();

        const params = Object.keys(caseData);
        const visiblePoints = params
            .filter(p => selectedParams.has(p))
            .flatMap(p => caseData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]));
        const yExtent = d3.extent(visiblePoints, d => d.value);

        const xScale = d3.scaleLinear().domain(timeRange).range([50, 850]);
        const yScale = d3.scaleLinear().domain(yExtent).range([450, 50]);

        svg.append('g')
            .attr('transform', 'translate(0,450)')
            .call(d3.axisBottom(xScale).tickFormat(formatTime));

        svg.append('g')
            .attr('transform', 'translate(50,0)')
            .call(d3.axisLeft(yScale));

        const line = d3.line()
            .x(d => xScale(d.time))
            .y(d => yScale(d.value));

        const guideLine = svg.append('line')
            .attr('y1', 0)
            .attr('y2', 450)
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .style('display', 'none');

        svg.append('rect')
            .attr('x', 50)
            .attr('y', 0)
            .attr('width', 800)
            .attr('height', 450)
            .attr('fill', 'transparent')
            .on('mousemove', function (event) {
                const [x] = d3.pointer(event);
                const time = Math.round(xScale.invert(x));
                guideLine
                    .attr('x1', x)
                    .attr('x2', x)
                    .style('display', 'block');
                let tooltipHtml = `Time: ${formatTime(time)}<br/>`;
                selectedParams.forEach(param => {
                    const nearest = caseData[param].reduce((prev, curr) => {
                        return Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev;
                    });
                    tooltipHtml += `<span style='color:${color(param)}'>${param}:</span> ${nearest.value.toFixed(1)}<br/>`;
                });
                tooltip
                    .html(tooltipHtml)
                    .style('display', 'block')
                    .style('left', `${event.pageX + 10}px`)
                    .style('top', `${event.pageY - 40}px`);
            })
            .on('mouseout', () => {
                tooltip.style('display', 'none');
                guideLine.style('display', 'none');
            });

        params.forEach(param => {
            if (!selectedParams.has(param)) return;
            const values = caseData[param].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
            svg.append('path')
                .datum(values)
                .attr('fill', 'none')
                .attr('stroke', color(param))
                .attr('stroke-width', 1.5)
                .attr('d', line);
        });
    }

    caseSelect.on('change', () => {
        const selectedCase = caseSelect.property('value');
        const params = Object.keys(data[selectedCase]);
        selectedParams = new Set(params);
        updateLegend(params);
        updateSlider(data[selectedCase]);
        updateChart(selectedCase);
    });

    const initialCase = caseIds[0];
    const params = Object.keys(data[initialCase]);
    selectedParams = new Set(params);
    updateLegend(params);
    updateSlider(data[initialCase]);
    updateChart(initialCase);
});
