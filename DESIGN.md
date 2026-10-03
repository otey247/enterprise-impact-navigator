# Design

## Product language

Use concise, ordinary product language throughout the application.

UI copy describes what the user can see, decide, or do. It does not explain the product's internal architecture, reasoning process, semantic model, or business philosophy unless the user asks for that detail.

The test: **don't name the system's internal thought process when you can name the user's task instead.**

### Avoid

- Thesis-like page headings and slogans above functional content
- Documentation, architecture, or consulting language in product copy
- Technical implementation terms (semantic artifacts, canonical entities, typed predicates, cross-domain dependencies)
- AI or agent terminology unless it is directly relevant to the user's task
- Descriptions of internal reasoning steps ("Resolving canonical entities...")
- Redundant subtitles under self-explanatory metrics
- Cards that need a paragraph to explain why they exist
- Copy whose only job is to make a feature sound more sophisticated
- Raw internal identifiers as labels (`OPERATES_SITE`, `SalesOrder`)

### Prefer

`Suppliers` · `Impact` · `Sources` · `Needs review` · `Ask a question` · `View relationships` · `Affected contracts` · `Why this changed` · `Supporting evidence`

### Rules of thumb

- Page and card headings are 1 to 5 words and fit on one line.
- Supporting copy is one short sentence, or absent. If a sentence can be removed without changing what the user understands or can do, remove it.
- A number labelled `Sources 11` does not need "Cross-domain inputs" under it.
- A user should know what a screen is for from its nouns, numbers, controls, and layout, without reading paragraphs.
- Technical detail belongs in configuration screens, advanced views, tooltips, or docs.
- Copy that fills the layout is a sign the layout is not doing its job.

### Before and after

| Before | After |
| --- | --- |
| FROM DISCONNECTED RECORDS TO GOVERNED ACTION / Trace enterprise impact across suppliers, products, customers, contracts, and owners. | Explore impact / Ask a question about your business data. |
| How the ontology operates (Profile, Resolve, Compile, Reason, Act) | Removed. Users don't configure the ontology here. |
| Guided enterprise scenarios / Each scenario demonstrates a different ontology capability. | Example questions |
| Evidence paths / Each claim is linked to typed entities, relationships, and source systems. | Supporting evidence |
| Governed definitions / The formulas and owners used for this answer. | Definitions |
| Resolving canonical entities and definitions | Finding affected suppliers and parts |

### Before shipping UI

1. Read every heading aloud. Would a real product say this?
2. Delete each subtitle, then put back only the ones whose absence loses information.
3. Replace any term the user would have to learn with the thing they are trying to do.
