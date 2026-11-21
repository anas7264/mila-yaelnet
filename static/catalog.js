(function attachCatalog(root) {
  const stages = [
    {
      id: "stage-1",
      number: 1,
      title: "أساسيات درس اليوم",
      subtitle: "مفردات وروابط من تدريب יעלנט",
      description: "المرحلة الأولى — الأساسيات والكلمات التي ظهرت في تدريبنا الأخير.",
      color: "gold",
      words: [
        { id: "w-focus", he: "להתרכז", ar: "يُركّز / التركيز", category: "أفعال", level: "أساسي" },
        { id: "w-period", he: "בתקופת", ar: "خلال فترة", category: "تعبيرات", level: "أساسي" },
        { id: "w-integrate", he: "לשלב", ar: "يدمج / يجمع بين", category: "أفعال", level: "أساسي" },
        { id: "w-because", he: "מכיוון ש", ar: "لأن / بما أن", category: "روابط منطقية", level: "متوسط", conceptGroup: "causal-connector" },
        { id: "w-reason", he: "סיבה", ar: "سبب", category: "أسماء", level: "أساسي" },
        { id: "w-first", he: "ראשית", ar: "أولًا", category: "روابط منطقية", level: "أساسي" },
        { id: "w-not-they", he: "אינם", ar: "ليسوا", category: "قواعد", level: "متوسط" },
        { id: "w-easy", he: "קל", ar: "سهل / خفيف", category: "صفات", level: "أساسي" },
        { id: "w-level", he: "רמה", ar: "مستوى", category: "أسماء", level: "أساسي" },
        { id: "w-however", he: "אולם", ar: "لكن / إلا أن", category: "روابط منطقية", level: "أساسي", conceptGroup: "contrast-connector" },
        { id: "w-therefore", he: "לכן", ar: "لذلك", category: "روابط منطقية", level: "أساسي", conceptGroup: "result-connector" },
        { id: "w-since", he: "משום ש", ar: "لأن", category: "روابط منطقية", level: "متوسط", conceptGroup: "causal-connector" },
        { id: "w-purpose", he: "כדי ש", ar: "لكي", category: "روابط منطقية", level: "متوسط" },
        { id: "w-prepare", he: "להתכונן", ar: "يستعد", category: "أفعال", level: "أساسي" },
        { id: "w-traffic", he: "עומסי תנועה", ar: "ازدحامات مرورية", category: "تعبيرات", level: "متوسط" }
      ]
    }
  ];

  const api = {
    stages,
    officialWords: () => stages.flatMap((stage) => stage.words.map((word) => ({
      ...word, stageId: stage.id, stageTitle: stage.title, source: "stage"
    })))
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YaelCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
