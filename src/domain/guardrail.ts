// A bounded application check, not a PRISM result or a complete injection detector.
export function checkInput(text: string) {
  const pattern =
    /ignore\s+(all\s+|previous\s+|prior\s+)*(instructions|rules)|system\s*prompt|auto[ -]?approve|(?:set|change|override)\s+(?:the\s+)?(?:markup|pricing|policy)|reveal\s+(?:api|secret)|<\|(?:system|im_start)/i;
  return {
    passed: !pattern.test(text),
    detail: pattern.test(text)
      ? "Embedded instructions detected. Document text cannot change pricing policy, review gates, or server configuration."
      : "Application input check completed. RFQ content is handled only as untrusted source data.",
  };
}
