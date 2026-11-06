const os = require("os");
const config = require("./config");

const requests = {};
const authRequests = {};
sendMetricsPeriodically(5000);

function requestTracker(req, res, next) {
  if (process.env.NODE_ENV !== "test") {
    const endpoint = `${req.method}`.toLocaleLowerCase();
    requests[endpoint] = (requests[endpoint] || 0) + 1;
  }
  next();
}

function authTracker(req, res, next) {
  if (process.env.NODE_ENV !== "test") {
    res.on("finish", () => {
      const status = /^[23]/.test(String(res.statusCode))
        ? "success"
        : "failure";
      authRequests[status] = (authRequests[status] || 0) + 1;
    });
  }
  next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function sendMetricsPeriodically(period) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  setInterval(() => {
    try {
      const metrics = [];
      let total = 0;
      Object.keys(requests).forEach((endpoint) => {
        total += requests[endpoint];
        metrics.push(
          createMetric("requests", requests[endpoint], "1", "sum", "asInt", {
            endpoint,
          })
        );
      });
      metrics.push(
        createMetric("all_http_requests", total, "1", "sum", "asInt", {
          endpoint: "total",
        })
      );

      Object.keys(authRequests).forEach((status) => {
        metrics.push(
          createMetric(
            "authRequests",
            authRequests[status],
            "1",
            "sum",
            "asInt",
            { status }
          )
        );
      });

      metrics.push(
        createMetric(
          "cpu_usage",
          getCpuUsagePercentage(),
          "%",
          "gauge",
          "asDouble"
        )
      );
      metrics.push(
        createMetric(
          "memory_usage",
          getMemoryUsagePercentage(),
          "%",
          "gauge",
          "asDouble"
        )
      );
      sendToGrafana(metrics);
    } catch (error) {
      console.log("Error sending metrics", error);
    }
  }, period);
}

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes
) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };
  fetch(`${config.metrics.endpointUrl}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

module.exports = {
  metrics: {
    requestTracker,
    authTracker,
  },
};
