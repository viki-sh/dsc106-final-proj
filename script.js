d3.json('vital_data.json').then(data => {
    const header = d3.select('#header');
    header.append('h1').text('Vital Sign Viewer');
    const selectorDiv = header.append('div');
    selectorDiv.append('label').text('Select Case ID: ');
    selectorDiv.append('select').attr('id', 'case-select');

    const caseSelect = d3.select('#case-select');
    const svg = d3.select('svg').attr('width', 900).attr('height', 500);
    const legend = d3.select('#legend');
    const nav = d3.select('#nav');
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

    const color = d3.scaleOrdinal()
        .domain([
            'Diastolic BP', 'Arterial BP', 'Systolic BP',
            'End-Tidal CO2', 'Heart Rate',
            'NIBP Mean BP', 'Pleth HR', 'Oxygen Saturation'
        ])
        .range([
            '#1f77b4', '#ff7f0e', '#2ca02c',
            '#9467bd', '#d62728',
            '#8c564b', '#e377c2', '#7f7f7f'
        ]);

    const caseIds = Object.keys(data);
    caseSelect.selectAll('option')
        .data(caseIds)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => `Case ${d}`);

    let selectedParams = new Set();
    let timeRange = [0, 300];
    let autoplayInterval = null;
    let speed = 100;
    let maxTime = 0;
    let slider = null;

    function formatTime(seconds) {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function updateSlider(caseData) {
        maxTime = Math.max(...Object.values(caseData).flat().map(d => d.time));
        nav.selectAll('*').remove();

        let currentSpeed = 50;  // faster default speed

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


    function updateLegend(params) {
        legend.selectAll('*').remove();
        params.forEach(param => {
            const row = legend.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '0.3rem');
            row.append('input')
                .attr('type', 'checkbox')
                .property('checked', true)
                .on('change', function () {
                    this.checked ? selectedParams.add(param) : selectedParams.delete(param);
                    updateChart(caseSelect.property('value'));
                });
            row.append('span').style('color', color(param)).style('font-weight', 'bold').text(param);
            selectedParams.add(param);
        });
    }

    function updateChart(caseId) {
        const caseData = data[caseId];
        svg.selectAll('*').remove();

        const params = Object.keys(caseData);
        const points = params.filter(p => selectedParams.has(p)).flatMap(p => caseData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]));
        const yExtent = d3.extent(points, d => d.value);
        const xScale = d3.scaleLinear().domain(timeRange).range([50, 850]);
        const yScale = d3.scaleLinear().domain(yExtent).range([450, 50]);

        svg.append('g').attr('transform', 'translate(0,450)').call(d3.axisBottom(xScale).tickFormat(formatTime));
        svg.append('g').attr('transform', 'translate(50,0)').call(d3.axisLeft(yScale));

        const line = d3.line().x(d => xScale(d.time)).y(d => yScale(d.value));

        const guide = svg.append('line').attr('y1', 0).attr('y2', 450).attr('stroke', '#999').attr('stroke-width', 1).style('display', 'none');

        svg.append('rect')
            .attr('x', 50).attr('y', 0).attr('width', 800).attr('height', 450)
            .attr('fill', 'transparent')
            .on('mousemove', function (event) {
                const [x] = d3.pointer(event);
                const t = Math.round(xScale.invert(x));
                guide.attr('x1', x).attr('x2', x).style('display', 'block');
                let html = `Time: ${formatTime(t)}<br/>`;
                selectedParams.forEach(p => {
                    const closest = caseData[p].reduce((a, b) => Math.abs(b.time - t) < Math.abs(a.time - t) ? b : a);
                    html += `<span style='color:${color(p)}'>${p}</span>: ${closest.value.toFixed(1)}<br/>`;
                });
                tooltip.html(html).style('display', 'block').style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 40}px`);
            })
            .on('mouseout', () => {
                tooltip.style('display', 'none');
                guide.style('display', 'none');
            });

        params.forEach(p => {
            if (!selectedParams.has(p)) return;
            const values = caseData[p].filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
            svg.append('path').datum(values).attr('fill', 'none').attr('stroke', color(p)).attr('stroke-width', 1.5).attr('d', line);
        });
    }

    caseSelect.on('change', () => {
        const selected = caseSelect.property('value');
        const params = Object.keys(data[selected]);
        selectedParams = new Set(params);
        updateLegend(params);
        updateSlider(data[selected]);
        updateChart(selected);
    });

    const initialCase = caseIds[0];
    selectedParams = new Set(Object.keys(data[initialCase]));
    updateLegend(Array.from(selectedParams));
    updateSlider(data[initialCase]);
    updateChart(initialCase);
});
