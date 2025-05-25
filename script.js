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
