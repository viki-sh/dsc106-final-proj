## 📁 Project Files Overview

| File/Folder                        | Description |
|-----------------------------------|-------------|
| `index.html`                      | Webpage structure |
| `styles.css`                      | Styling |
| `script.js`                       | Contains D3.js logic for loading JSON data, drawing the chart, and handling interactions. |
| `vital_data.json`                 | Preprocessed second-by-second vital signs for the top 20 selected surgeries. |
| `patient_info.json`               | JSON file storing additional patient metadata (not used in prototype). |
| `finding_highest_correlated_cases.ipynb` | Jupyter notebook that analyzes correlations between heart rate and other vitals to find top cases. |
| `generate_vitals_json.ipynb`     | Jupyter notebook that collects and formats raw time-series data into the `vital_data.json` format. |
| `trks.csv`                        | List of all parameter track IDs per case from VitalDB. |
| `case_15min_avg_trends/`         | Sample trend plots averaged every 15 minutes (for seeing trends - research purposes). |
