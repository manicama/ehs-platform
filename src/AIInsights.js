import { useState } from 'react';

export default function AIInsights({ incidents }) {
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRun, setLastRun] = useState(null);

  async function generateInsights() {
    if (incidents.length === 0) {
      setError('No incident data available to analyze.');
      return;
    }

    setLoading(true);
    setError('');

    const summary = incidents.map(i => ({
      title: i.title,
      type: i.incident_type,
      location: i.location,
      occurred: i.occurred_at,
      description: i.description,
      osha_recordable: i.is_osha_recordable,
      dart: i.is_dart,
      status: i.status,
    }));

    const prompt = `You are an EHS (Environmental Health & Safety) analyst. Analyze the following incident data and provide actionable insights.

Incident Data:
${JSON.stringify(summary, null, 2)}

Please provide:
1. Key Trends - What patterns do you see in the incident types, locations, or timing?
2. Risk Areas - What areas or activities appear to be highest risk?
3. Recommendations - What specific actions should the safety team take to prevent future incidents?
4. OSHA Compliance - Any notes on recordable incidents and compliance considerations?

Important: Do not use markdown formatting like ## or ** in your response. Use plain text only. For section headers just write the title followed by a colon. For bullet points use a dash followed by a space.

Keep your response concise, practical, and actionable.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error.message);
      } else {
        setInsights(data.content[0].text);
        setLastRun(new Date());
      }
    } catch (err) {
      setError('Failed to connect to AI. Check your API key.');
    }

    setLoading(false);
  }

  function formatInsights(text) {
    const lines = text.split('\n');
    const elements = [];
    let key = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<div key={key++} className="ai-spacer" />);
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        elements.push(
          <div key={key++} className="ai-bullet">
            {trimmed.substring(2)}
          </div>
        );
        continue;
      }

      if (
        (trimmed.match(/^\d+\.\s/) && trimmed.endsWith(':')) ||
        (trimmed.endsWith(':') && trimmed.length < 40 && !trimmed.startsWith('-'))
      ) {
        elements.push(
          <div key={key++} className="ai-section-title">
            {trimmed.replace(/^\d+\.\s/, '')}
          </div>
        );
        continue;
      }

      elements.push(
        <div key={key++} className="ai-line">{trimmed}</div>
      );
    }

    return elements;
  }

  return (
    <div className="ai-insights-panel">
      <div className="ai-insights-header">
        <div>
          <div className="ai-insights-title">
            <span className="ai-icon">✦</span>
            AI Safety Insights
          </div>
          <div className="ai-insights-sub">
            Powered by Claude — analyzes your incident data to surface trends and recommendations
          </div>
        </div>
        <button
          className="ai-generate-btn"
          onClick={generateInsights}
          disabled={loading}
        >
          {loading ? (
            <><span className="ai-btn-spinner"></span> Analyzing...</>
          ) : (
            <><span>✦</span> {insights ? 'Regenerate' : 'Generate Insights'}</>
          )}
        </button>
      </div>

      {error && <div className="ai-error">{error}</div>}

      {!insights && !loading && !error && (
        <div className="ai-empty">
          <div className="ai-empty-icon">✦</div>
          <p>Click "Generate Insights" to analyze your incident data with AI</p>
          <p className="ai-empty-sub">Claude will identify trends, risk areas, and recommendations based on your incidents</p>
        </div>
      )}

      {loading && (
        <div className="ai-loading">
          <div className="ai-loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Analyzing {incidents.length} incident{incidents.length !== 1 ? 's' : ''}...</p>
        </div>
      )}

      {insights && !loading && (
        <div className="ai-insights-content">
          {formatInsights(insights)}
          {lastRun && (
            <div className="ai-timestamp">
              Last analyzed: {lastRun.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}