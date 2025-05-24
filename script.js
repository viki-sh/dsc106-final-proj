d3.json('vital_data.json').then(data => {
    const caseSelect = d3.select('#case-select');
    const timeSlider = d3.select('#time-slider');
    const chart = d3.select('#chart');

    const caseIds = Object.keys(data);
    caseSelect.selectAll('option')
        .data(caseIds)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => `Case ${d}`);

    const svg = chart.append('svg')
        .attr('width', 800)
        .attr('height', 400);

    function updateChart(caseId, sliderValue) {
        const caseData = data[caseId];

        if (!caseData) return;

        svg.selectAll("*").remove();

        const parameters = Object.keys(caseData);
        const timeIndex = Math.floor(sliderValue);

        const values = parameters.map(param => ({
            label: param,
            value: caseData[param][timeIndex]?.value ?? null
        }));

        const x = d3.scaleBand()
            .domain(values.map(d => d.label))
            .range([50, 750])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(values, d => d.value || 0) * 1.1])
            .range([350, 50]);

        svg.append('g')
            .attr('transform', 'translate(0,350)')
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append('g')
            .attr('transform', 'translate(50,0)')
            .call(d3.axisLeft(y));

        svg.selectAll('.bar')
            .data(values)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.label))
            .attr('y', d => d.value ? y(d.value) : 350)
            .attr('width', x.bandwidth())
            .attr('height', d => d.value ? 350 - y(d.value) : 0)
            .attr('fill', 'steelblue');
    }

    const initialCase = caseIds[0];
    caseSelect.property('value', initialCase);
    updateChart(initialCase, timeSlider.property('value'));

    caseSelect.on('change', () => {
        updateChart(caseSelect.property('value'), timeSlider.property('value'));
    });

    timeSlider.on('input', () => {
        updateChart(caseSelect.property('value'), timeSlider.property('value'));
    });
});
