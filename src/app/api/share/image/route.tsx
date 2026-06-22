import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { APP_NAME } from "@/lib/brand";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const score = parseInt(searchParams.get("score") || "0", 10);
  const percentile = parseInt(searchParams.get("percentile") || "0", 10);
  const authority = parseInt(searchParams.get("authority") || "0", 10);
  const clarity = parseInt(searchParams.get("clarity") || "0", 10);
  const energy = parseInt(searchParams.get("energy") || "0", 10);
  const confidence = parseInt(searchParams.get("confidence") || "0", 10);
  const userName = searchParams.get("name") || "Founder";
  const mode = searchParams.get("mode") || "free_pitch";
  const signalsOnly = searchParams.get("signalsOnly") === "true";

  const modeLabels: Record<string, string> = {
    free_pitch: "Free Pitch",
    one_minute_challenge: "1-Minute Challenge",
    qa_practice: "Q&A Practice",
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return "#22c55e";
    if (s >= 60) return "#eab308";
    return "#ef4444";
  };

  const scoreColor = getScoreColor(score);

  // If signalsOnly, show a simplified card without the breakdown
  if (signalsOnly) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0f172a",
            padding: "60px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "48px",
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              🎯 {APP_NAME}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "24px",
                color: "#94a3b8",
                backgroundColor: "#1e293b",
                padding: "12px 24px",
                borderRadius: "12px",
              }}
            >
              {modeLabels[mode] || "Pitch Practice"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                color: "#94a3b8",
                marginBottom: "16px",
              }}
            >
              {userName}&apos;s Social Signals Analysis
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "240px",
                height: "240px",
                borderRadius: "120px",
                border: `10px solid ${scoreColor}`,
                backgroundColor: "#1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "96px",
                  fontWeight: "bold",
                  color: scoreColor,
                }}
              >
                {score}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "22px",
                  color: "#94a3b8",
                }}
              >
                Signal Score
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "20px",
                fontSize: "22px",
                color: "#64748b",
                textAlign: "center",
              }}
            >
              Based on detected confidence and hesitation signals
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: "24px",
              paddingTop: "24px",
              borderTop: "1px solid #334155",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "18px",
                color: "#64748b",
              }}
            >
              Powered by Interhuman AI
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "48px",
              fontWeight: "bold",
              color: "#ffffff",
            }}
          >
            🎯 {APP_NAME}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              color: "#94a3b8",
              backgroundColor: "#1e293b",
              padding: "12px 24px",
              borderRadius: "12px",
            }}
          >
            {modeLabels[mode] || "Pitch Practice"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "60px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "400px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "280px",
                height: "280px",
                borderRadius: "140px",
                border: `12px solid ${scoreColor}`,
                backgroundColor: "#1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "96px",
                  fontWeight: "bold",
                  color: scoreColor,
                }}
              >
                {score}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  color: "#94a3b8",
                }}
              >
                Overall Score
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "24px",
                fontSize: "28px",
                color: "#ffffff",
              }}
            >
              Top {Math.max(1, 100 - percentile)}% of founders
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "32px",
                fontWeight: "bold",
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              {userName}&apos;s Pitch Breakdown
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px" }}>
                <div style={{ display: "flex", color: "#e2e8f0" }}>Authority</div>
                <div style={{ display: "flex", color: getScoreColor(authority), fontWeight: "bold" }}>{authority}</div>
              </div>
              <div style={{ display: "flex", height: "16px", backgroundColor: "#334155", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", width: `${authority}%`, backgroundColor: getScoreColor(authority), borderRadius: "8px" }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px" }}>
                <div style={{ display: "flex", color: "#e2e8f0" }}>Clarity</div>
                <div style={{ display: "flex", color: getScoreColor(clarity), fontWeight: "bold" }}>{clarity}</div>
              </div>
              <div style={{ display: "flex", height: "16px", backgroundColor: "#334155", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", width: `${clarity}%`, backgroundColor: getScoreColor(clarity), borderRadius: "8px" }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px" }}>
                <div style={{ display: "flex", color: "#e2e8f0" }}>Energy</div>
                <div style={{ display: "flex", color: getScoreColor(energy), fontWeight: "bold" }}>{energy}</div>
              </div>
              <div style={{ display: "flex", height: "16px", backgroundColor: "#334155", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", width: `${energy}%`, backgroundColor: getScoreColor(energy), borderRadius: "8px" }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px" }}>
                <div style={{ display: "flex", color: "#e2e8f0" }}>Confidence</div>
                <div style={{ display: "flex", color: getScoreColor(confidence), fontWeight: "bold" }}>{confidence}</div>
              </div>
              <div style={{ display: "flex", height: "16px", backgroundColor: "#334155", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", width: `${confidence}%`, backgroundColor: getScoreColor(confidence), borderRadius: "8px" }} />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: "#64748b",
            }}
          >
            Powered by Interhuman AI
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
