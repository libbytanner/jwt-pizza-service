const os = require("os");
const config = require("./config");

let requests = {};
let authRequests = {};
sendMetricsPeriodically(1000);
reset();

let activeUsers = 0;
let totalLatency = 0;
let requestsCompleted = 0;

function requestTracker(req, res, next) {
  if (process.env.NODE_ENV !== "test") {
    const start = performance.now()
    const endpoint = `${req.method}`.toLocaleLowerCase();
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    res.on("finish", () => {
      totalLatency += performance.now() - start
      requestsCompleted++;
      const success = /^[23]/.test(String(res.statusCode)) ? true : false;
      if (success) {
        if (req.originalUrl === "/api/auth") {
          if (req.method === "DELETE") {
            activeUsers--;
          } else if (req.method === "POST" || req.method === "PUT") {
            activeUsers++;
          }
        }
      }
    });
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

let pizzasSold = 0;
let creationFailures = 0;
let revenue = 0;
let pizzaTotalLatency = 0;
let pizzaOrders = 0;

function pizzaPurchase(success, latency, price) {
  pizzaTotalLatency += latency;
  pizzaOrders++;
  if (!success) {
    creationFailures++;
  } else {
    pizzasSold++;
    revenue += price;
  }
}

function reset() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  setInterval(() => {
    totalLatency = 0;
    requestsCompleted = 0;
    pizzaTotalLatency = 0;
    pizzaOrders = 0
    revenue = 0;
  }, 600000)
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
      metrics.push(
        createMetric("pizzas_sold", pizzasSold, "1", "sum", "asInt", {
          result: "pizzas purchased",
        })
      );
      metrics.push(
        createMetric(
          "pizza_creation_failures",
          creationFailures,
          "1",
          "sum",
          "asInt",
          { result: "failed creation" }
        )
      );
      metrics.push(createMetric("revenue", revenue, "1", "sum", "asDouble"));
      const pizzaLatency = pizzaOrders > 0 ? pizzaTotalLatency / pizzaOrders : 0
      metrics.push(createMetric("pizza_latency", pizzaLatency, 'ms', 'gauge', 'asDouble'));
      metrics.push(
        createMetric("active_users", activeUsers.size, "1", "gauge", "asInt")
      );
      const latency = requestsCompleted > 0 ? totalLatency / requestsCompleted : 0
      metrics.push(createMetric("request_latency", latency, 'ms', 'gauge', 'asDouble'));
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
    pizzaPurchase,
  },
};
