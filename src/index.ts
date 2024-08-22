import axios from 'axios';
import { AxiosClone } from './axiosClone';

const axiosClone = new AxiosClone({ retries: 3, delay: 1000 });

axios.get('https://nekonode.net/api/latest', {
  headers: { 'Content-Type': 'application/json' },
  params: {
    page: 1,
    type: 2,
    limit: 10,
  },
})

axiosClone.get('https://nekonode.net/api/latest', {
  headers: { 'Content-Type': 'application/json' },
  params: {
    page: 1,
    type: 2,
    limit: 10,
  },
})
  
interface Metrics {
  totalTime: number;
  minTime: number;
  maxTime: number;
  responseTimes: number[];
  responseSizes: number[];
  statuses: Record<number, number>;
  errors: Record<string, number>;
}

interface AnalyzedMetrics {
  averageTime: number;
  minTime: number;
  maxTime: number;
  avgResponseSize: number;
  statuses: Record<number, number>;
  errors: Record<string, number>;
  responseTimes: number[];
}

async function testAxios(iterations: number): Promise<Metrics> {
  let totalTime = 0;
  let minTime = Infinity;
  let maxTime = 0;
  const responseTimes: number[] = [];
  const responseSizes: number[] = [];
  const statuses: Record<number, number> = {};
  const errors: Record<string, number> = {};

  for (let i = 0; i < iterations; i++) {
    console.time('axios');
    const start = performance.now();
    try {
      const response = await axios.get<{ [key: string]: any }>('https://nekonode.net/api/latest', {
        headers: { 'Content-Type': 'application/json' },
        params: {
          page: 1,
          type: 2,
          limit: 10,
        },
      });

      const duration = performance.now() - start;
      totalTime += duration;
      responseTimes.push(duration);
      minTime = Math.min(minTime, duration);
      maxTime = Math.max(maxTime, duration);

      const responseSize = JSON.stringify(response.data).length;
      responseSizes.push(responseSize);

      const statusCode = response.status;
      statuses[statusCode] = (statuses[statusCode] || 0) + 1;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Axios request failed:', errorMessage);
      errors[errorMessage] = (errors[errorMessage] || 0) + 1;
    } finally {
      console.timeEnd('axios');
    }
  }

  return { totalTime, minTime, maxTime, responseTimes, responseSizes, statuses, errors };
}

async function testAxiosClone(iterations: number): Promise<Metrics> {
  let totalTime = 0;
  let minTime = Infinity;
  let maxTime = 0;
  const responseTimes: number[] = [];
  const responseSizes: number[] = [];
  const statuses: Record<number, number> = {};
  const errors: Record<string, number> = {};

  for (let i = 0; i < iterations; i++) {
    console.time('axiosClone');
    const start = performance.now();
    try {
      const response = await axiosClone.get<{ [key: string]: any }>('https://nekonode.net/api/latest', {
        headers: { 'Content-Type': 'application/json' },
        params: {
          page: 1,
          type: 2,
          limit: 10,
        },
      });

      const duration = performance.now() - start;
      totalTime += duration;
      responseTimes.push(duration);
      minTime = Math.min(minTime, duration);
      maxTime = Math.max(maxTime, duration);

      const responseSize = JSON.stringify(response.data).length;
      responseSizes.push(responseSize);

      const statusCode = response.status;
      statuses[statusCode] = (statuses[statusCode] || 0) + 1;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('AxiosClone request failed:', errorMessage);
      errors[errorMessage] = (errors[errorMessage] || 0) + 1;
    } finally {
      console.timeEnd('axiosClone');
    }
  }

  return { totalTime, minTime, maxTime, responseTimes, responseSizes, statuses, errors };
}

function analyzeMetrics(metrics: Metrics, libraryName: string): AnalyzedMetrics {
  const { totalTime, minTime, maxTime, responseTimes, responseSizes, statuses, errors } = metrics;
  const averageTime = totalTime / responseSizes.length;
  const totalResponses = responseSizes.length;
  const totalSize = responseSizes.reduce((acc, size) => acc + size, 0);
  const avgResponseSize = totalSize / totalResponses;

  return {
    averageTime,
    minTime,
    maxTime,
    avgResponseSize,
    statuses,
    errors,
    responseTimes,
  };
}

function generateHTMLReport(
  axiosMetrics: AnalyzedMetrics,
  axiosCloneMetrics: AnalyzedMetrics,
  timeDifference: number,
  percentageDifference: string
) {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #121212;
            color: #e0e0e0;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 20px auto;
            background: #1e1e1e;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
        }
        h1, h2 {
            color: #ffffff;
        }
        h1 {
            text-align: center;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .section p {
            line-height: 1.6;
        }
        #chart-container {
            width: 100%;
            height: 400px;
        }
        .chart-wrapper {
            margin-bottom: 40px;
        }
        .comparison {
            font-weight: bold;
            text-align: center;
            padding: 20px;
            background-color: #2d2d2d;
            border: 1px solid #444;
            color: #76ff03;
        }
        .comparison.bad {
            color: #ff5252;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Performance Report</h1>

        <div class="section">
            <h2>Axios Metrics</h2>
            <p><strong>Average Time:</strong> ${axiosMetrics.averageTime.toFixed(2)} ms</p>
            <p><strong>Min Time:</strong> ${axiosMetrics.minTime.toFixed(2)} ms</p>
            <p><strong>Max Time:</strong> ${axiosMetrics.maxTime.toFixed(2)} ms</p>
            <p><strong>Average Response Size:</strong> ${axiosMetrics.avgResponseSize.toFixed(2)} bytes</p>
        </div>

        <div class="section">
            <h2>AxiosClone Metrics</h2>
            <p><strong>Average Time:</strong> ${axiosCloneMetrics.averageTime.toFixed(2)} ms</p>
            <p><strong>Min Time:</strong> ${axiosCloneMetrics.minTime.toFixed(2)} ms</p>
            <p><strong>Max Time:</strong> ${axiosCloneMetrics.maxTime.toFixed(2)} ms</p>
            <p><strong>Average Response Size:</strong> ${axiosCloneMetrics.avgResponseSize.toFixed(2)} bytes</p>
        </div>

        <div class="comparison ${timeDifference > 0 ? '' : 'bad'}">
            ${timeDifference > 0 
                ? `AxiosClone is faster than Axios by ${Math.abs(Number(timeDifference.toFixed(2)))}ms (${percentageDifference}%).`
                : `Axios is faster than AxiosClone by ${Math.abs(Number(timeDifference.toFixed(2)))}ms (${percentageDifference}%).`}
        </div>

        <div class="chart-wrapper">
            <h2>Response Time Comparison</h2>
            <canvas id="responseTimeChart"></canvas>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        const ctx = document.getElementById('responseTimeChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: ${axiosMetrics.responseTimes.length} }, (_, i) => 'Request ' + (i + 1)),
                datasets: [
                    {
                        label: 'Axios',
                        data: ${JSON.stringify(axiosMetrics.responseTimes)},
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: true,
                    },
                    {
                        label: 'AxiosClone',
                        data: ${JSON.stringify(axiosCloneMetrics.responseTimes)},
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            color: '#e0e0e0',
                        },
                        ticks: {
                            color: '#e0e0e0',
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Request Number',
                            color: '#e0e0e0',
                        },
                        ticks: {
                            color: '#e0e0e0',
                        },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0',
                        }
                    }
                }
            },
        });
    </script>
</body>
</html>
`;

  //writeFileSync('performance-report.html', htmlContent, 'utf8');
  Bun.write('performance-report.html', htmlContent);
}

async function runTests() {
  const iterations = 10;

  console.log('Running Axios tests...');
  const axiosMetrics = await testAxios(iterations);
  const analyzedAxiosMetrics = analyzeMetrics(axiosMetrics, 'Axios');

  console.log('Running AxiosClone tests...');
  const axiosCloneMetrics = await testAxiosClone(iterations);
  const analyzedAxiosCloneMetrics = analyzeMetrics(axiosCloneMetrics, 'AxiosClone');

  // Calculate and display the performance difference
  const timeDifference = analyzedAxiosMetrics.averageTime - analyzedAxiosCloneMetrics.averageTime;
  const percentageDifference = ((timeDifference / analyzedAxiosMetrics.averageTime) * 100).toFixed(2);

  // Generate the HTML report
  generateHTMLReport(analyzedAxiosMetrics, analyzedAxiosCloneMetrics, timeDifference, percentageDifference);

  console.log('Performance report generated: performance-report.html');
}

runTests();
