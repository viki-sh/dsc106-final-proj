// Enhanced script with legend, checkbox filtering, and tooltips
// script.js

d3.json('vital_data.json').then(data => {
    const caseSelect = d3.select('#case-select');
    const chart = d3.select('#chart');
    const controls = d3.select('body').append('div').attr('id', 'controls');

    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background', '#fff')
        .style('border', '1px solid #ccc')
        .style('padding', '5px')
        .style('display', 'none');

    const caseIds = Object.keys(data);
    caseSelect.selectAll('option')
        .data(caseIds)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => `Case ${d}`);

    const svg = chart.append('svg')
        .attr('width', 900)
        .attr('height', 500);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    let selectedParams = new Set();

    function updateControls(params) {
        controls.selectAll('*').remove();
        controls.append('p').text('Select parameters to display:');
        params.forEach(param => {
            controls.append('label')
                .text(param)
                .append('input')
                .attr('type', 'checkbox')
                .attr('checked', true)
                .on('change', function() {
                    if (this.checked) selectedParams.add(param);
                    else selectedParams.delete(param);
                    updateChart(caseSelect.property('value'));
                });
            selectedParams.add(param);
            controls.append('br');
        });
    }

    function updateChart(caseId) {
        const caseData = data[caseId];
        svg.selectAll("*").remove();

        const params = Object.keys(caseData);
        const allPoints = params.flatMap(p => caseData[p]);
        const xExtent = d3.extent(allPoints, d => d.time);
        const yExtent = d3.extent(allPoints, d => d.value);

        const xScale = d3.scaleLinear().domain(xExtent).range([50, 850]);
        const yScale = d3.scaleLinear().domain([0, yExtent[1]]).range([450, 50]);

        svg.append('g')
            .attr('transform', 'translate(0,450)')
            .call(d3.axisBottom(xScale));

        svg.append('g')
            .attr('transform', 'translate(50,0)')
            .call(d3.axisLeft(yScale));

        const line = d3.line()
            .x(d => xScale(d.time))
            .y(d => yScale(d.value));

        let legendY = 10;
        params.forEach((param, idx) => {
            if (!selectedParams.has(param)) return;
            const values = caseData[param];

            svg.append('path')
                .datum(values)
                .attr('fill', 'none')
                .attr('stroke', color(param))
                .attr('stroke-width', 1.5)
                .attr('d', line);

            svg.selectAll(`.dot-${idx}`)
                .data(values)
                .enter()
                .append('circle')
                .attr('class', `dot-${idx}`)
                .attr('cx', d => xScale(d.time))
                .attr('cy', d => yScale(d.value))
                .attr('r', 3)
                .attr('fill', color(param))
                .on('mouseover', (event, d) => {
                    tooltip.style('display', 'block')
                        .html(`Time: ${d.time}s<br/>Value: ${d.value}`)
                        .style('left', `${event.pageX + 10}px`)
                        .style('top', `${event.pageY - 20}px`);
                })
                .on('mouseout', () => {
                    tooltip.style('display', 'none');
                });

            svg.append('text')
                .attr('x', 860)
                .attr('y', legendY)
                .attr('fill', color(param))
                .text(param);
            legendY += 20;
        });
    }

    caseSelect.on('change', () => {
        const selectedCase = caseSelect.property('value');
        updateChart(selectedCase);
    });

    // Initial render
    const initialCase = caseIds[0];
    updateControls(Object.keys(data[initialCase]));
    updateChart(initialCase);
});
