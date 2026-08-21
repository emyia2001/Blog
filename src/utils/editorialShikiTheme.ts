// Editorial light syntax theme — derived from the site palette so code blocks
// sit on warm paper instead of a dark background.
export const editorialLight = {
  name: "editorial-light",
  type: "light",
  colors: {
    "editor.background": "#F2EFEA",
    "editor.foreground": "#1C1C1C",
  },
  settings: [
    { settings: { foreground: "#1C1C1C", background: "#F2EFEA" } },
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "#9C968C", fontStyle: "italic" },
    },
    {
      scope: ["string", "string.quoted", "string.regexp", "string.template"],
      settings: { foreground: "#5E6B4C" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#B5654A" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage.type",
        "storage.modifier",
        "keyword.other.unit",
      ],
      settings: { foreground: "#A63A2B" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call",
        "variable.function",
      ],
      settings: { foreground: "#2F6B73" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.class",
        "support.type",
        "entity.name.namespace",
      ],
      settings: { foreground: "#2F6B73" },
    },
    {
      scope: ["entity.name.tag", "meta.tag"],
      settings: { foreground: "#A63A2B" },
    },
    {
      scope: ["entity.other.attribute-name", "meta.attribute"],
      settings: { foreground: "#2F6B73" },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "punctuation.separator",
        "punctuation.definition",
      ],
      settings: { foreground: "#6B655C" },
    },
    {
      scope: ["variable", "meta.definition.variable", "variable.parameter"],
      settings: { foreground: "#1C1C1C" },
    },
    {
      scope: ["markup.heading", "markup.bold"],
      settings: { foreground: "#A63A2B", fontStyle: "bold" },
    },
    {
      scope: ["markup.italic"],
      settings: { fontStyle: "italic" },
    },
    {
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#A63A2B" },
    },
  ],
};
