export default function ApiGuidePage() {
  return (
    <div className="container">
      <div className="card">
        <h1>API Quick Guide</h1>
        <p className="muted">Enterprise TOEIC IP test APIs in this MVP:</p>
        <ul>
          <li>
            <code>POST /api/v1/ip/campaigns</code>
          </li>
          <li>
            <code>POST /api/v1/ip/campaigns/:campaignId/candidates/import</code>
          </li>
          <li>
            <code>POST /api/v1/ip/campaigns/:campaignId/sessions</code>
          </li>
          <li>
            <code>POST /api/v1/ip/sessions/:sessionId/check-in</code>
          </li>
          <li>
            <code>POST /api/v1/ip/sessions/:sessionId/submit</code>
          </li>
          <li>
            <code>POST /api/v1/ip/campaigns/:campaignId/results/import</code>
          </li>
          <li>
            <code>GET /api/v1/ip/campaigns/:campaignId/reports</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
