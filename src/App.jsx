import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

/* -----------------------------
   Circular Meter (Real Gauge)
------------------------------*/
function CircularMeter({ title, value = 0, signal, unit = "" }) {
  const max = 300;
  const percentage = Math.min(value / max, 1);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - percentage * circumference;

  return (
    <div className="widget circular">
      <h3>{title}</h3>

      <div className="gauge-wrapper">
        <svg width="180" height="180">
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="#222"
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="#00ff99"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 90 90)"
          />
        </svg>

        <div className="gauge-value">
          {Math.round(value)} {unit}
        </div>
      </div>

      <div className="signal-label">{signal}</div>
    </div>
  );
}

/* -----------------------------
   Panel Container
------------------------------*/
function PanelContainer({ title, value, signal, unit = "" }) {
  return (
    <div className="widget panel">
      <h3>{title}</h3>

      <div className="panel-content">
        <div className="metric-row">
          <strong>Signal:</strong> {signal}
        </div>
        <div className="metric-row">
          <strong>Value:</strong> {Math.round(value ?? 0)} {unit}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Linear Bar
------------------------------*/
function LinearBar({ title, value = 0, signal, unit = "" }) {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className="widget">
      <h3>{title}</h3>

      <div className="bar-background">
        <div
          className="bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="bar-value">
        {Math.round(value)} {unit}
      </div>

      <div className="signal-label">{signal}</div>
    </div>
  );
}

/* -----------------------------
   Status Indicator (FIXED)
------------------------------*/
function StatusIndicator({ widget, value }) {
  const { title, signal_binding, alert_condition } = widget;

  const numericValue = Number(value);
  let isActive = false;

  if (
    alert_condition &&
    !isNaN(numericValue) &&
    alert_condition.threshold !== undefined
  ) {
    const { operator, threshold } = alert_condition;

    switch (operator) {
      case "<":
        isActive = numericValue < threshold;
        break;
      case ">":
        isActive = numericValue > threshold;
        break;
      case "<=":
        isActive = numericValue <= threshold;
        break;
      case ">=":
        isActive = numericValue >= threshold;
        break;
      default:
        isActive = false;
    }
  }

  return (
    <div className="widget">
      <h3>{title}</h3>

      <div className={`alert-light ${isActive ? "active" : ""}`} />

      <div className="signal-label">
        {signal_binding} (
        {!isNaN(numericValue) ? Math.round(numericValue) : value})
      </div>
    </div>
  );
}

function MapContainer({ title, lat, lon }) {
  return (
    <div className="widget panel">
      <h3>{title}</h3>

      <div className="panel-content">
        <div className="metric-row">
          <strong>Latitude:</strong> {lat?.toFixed(6)}
        </div>
        <div className="metric-row">
          <strong>Longitude:</strong> {lon?.toFixed(6)}
        </div>

        <div style={{ marginTop: "10px" }}>
          <a
            href={`https://www.google.com/maps?q=${lat},${lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Widget Renderer
------------------------------*/
function WidgetRenderer({ widget, signalValues }) {
  const { representation, title, signal_binding } = widget;
  const value = signalValues[signal_binding];

  const unit =
    widget.unit ||
    widget.data_model?.unit ||
    "";

  switch (representation) {
    case "circular_meter":
      return (
        <CircularMeter
          title={title}
          signal={signal_binding}
          value={value}
          unit={unit}
        />
      );

    case "panel_container":
      return (
        <PanelContainer
          title={title}
          signal={signal_binding}
          value={value}
          unit={unit}
        />
      );

    case "linear_bar":
      return (
        <LinearBar
          title={title}
          signal={signal_binding}
          value={value}
          unit={unit}
        />
      );

    case "status_indicator":
      return (
        <StatusIndicator
          widget={widget}
          value={value}
        />
      );
    
    case "map_container":
      return (
        <MapContainer
          title={title}
          lat={signalValues["vehicle_latitude"]}
          lon={signalValues["vehicle_longitude"]}
        />
      );

    default:
      return (
        <div className="widget">
          <h3>{title}</h3>
          <div>Unsupported: {representation}</div>
        </div>
      );
  }
}

/* -----------------------------
   Main App
------------------------------*/
function App() {
  const [sessionId] = useState(uuidv4());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [schema, setSchema] = useState(null);
  const [traceability, setTraceability] = useState(null);
  const [signalValues, setSignalValues] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schema) return;

    const signals = schema.widgets.map(w => w.signal_binding);

    const socket = new WebSocket("ws://localhost:8000/ws/telemetry");

    socket.onopen = () => {
      socket.send(JSON.stringify({ signals }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSignalValues(data);
    };

    return () => socket.close();
  }, [schema]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: input
        })
      });

      const data = await response.json();

      const aiMessage = { role: "assistant", content: data.reply };
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  const finalizeDashboard = async () => {
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      const data = await response.json();
      setSchema(data.dashboard_schema);

      const traceRes = await fetch(
        `http://localhost:8000/traceability?session_id=${sessionId}`
      );

      const traceData = await traceRes.json();
      setTraceability(traceData);

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="container">
      <h1>GENAI AUTOMOTIVE DASHBOARD</h1>

      <div className="chat-container">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === "user" ? "user" : "assistant"}`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="assistant message">Thinking...</div>}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe dashboard requirements..."
        />
        <button onClick={sendMessage}>Send</button>
        <button onClick={finalizeDashboard}>Finalize</button>
      </div>

      {schema && (
        <div
          className="dashboard"
          style={{
            gridTemplateColumns: `repeat(${schema.layout.columns}, 1fr)`
          }}
        >
          {schema.widgets
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(widget => (
              <WidgetRenderer
                key={widget.id}
                widget={widget}
                signalValues={signalValues}
              />
            ))}
        </div>
      )}

      {traceability && traceability.traceability_matrix && (
        <div className="traceability">
          <h2>Requirement Traceability Matrix</h2>

          <div className="coverage">
            Total: {traceability.coverage_summary.total_requirements} |
            Verified: {traceability.coverage_summary.verified} |
            Failed: {traceability.coverage_summary.failed}
          </div>

          {traceability.traceability_matrix.map((req, index) => (
            <div key={index} className="trace-card">
              <div><strong>ID:</strong> {req.requirement_id}</div>
              <div><strong>Description:</strong> {req.description}</div>
              <div><strong>Signal:</strong> {req.signal}</div>
              <div><strong>Widget:</strong> {req.widget_id}</div>
              <div><strong>Status:</strong> {req.verification_status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;