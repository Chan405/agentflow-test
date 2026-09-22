async function run(input) {
  const message = input && typeof input === "object" ? input.message : input;
  const text = String(message || "").toLowerCase();

  if (
    text.includes("internet") ||
    text.includes("connection") ||
    text.includes("wifi") ||
    text.includes("network")
  ) {
    return {
      output: "I'll troubleshoot your connection.",
      trace: [
        { type: "agent", name: "orchestrator" },
        { type: "agent", name: "troubleshooting_agent" },
        {
          type: "tool",
          name: "diagnostic_tool",
          arguments: { connection: "internet" },
        },
      ],
    };
  }

  if (
    text.includes("plan") ||
    text.includes("pricing") ||
    text.includes("subscribe") ||
    text.includes("upgrade")
  ) {
    return {
      output: "Let me show you our available plans.",
      trace: [
        { type: "agent", name: "orchestrator" },
        { type: "agent", name: "sales_agent" },
        { type: "tool", name: "plans_tool" },
      ],
    };
  }

  return {
    output: "I'm not sure how to help with that.",
    trace: [{ type: "agent", name: "orchestrator" }],
  };
}

module.exports = { run };
