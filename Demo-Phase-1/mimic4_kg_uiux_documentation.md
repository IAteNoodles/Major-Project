# UI/UX Documentation for a MIMIC-IV to Knowledge Graph Clinical Explorer

## Overview

This document defines a top-quality frontend and UX strategy for a responsive clinical knowledge graph application built from a 1:1 transformation of MIMIC-IV into a knowledge graph. The primary design goal is to make complex graph-backed clinical data feel calm, readable, and safe for doctors and non-technical users, while still giving researchers and AI/ML students powerful exploration tools.[1][2]

The product should not behave like a generic graph demo. It should behave like a polished healthcare web app with a graph engine behind it, using progressive disclosure, role-specific rendering, high accessibility, and carefully chosen frontend libraries that support performance, maintainability, and clinical-grade clarity.[3][1][4]

## Frontend stack

The frontend stack should prioritize maturity, accessibility, performance, and composability over novelty. React remains the safest choice for scalable web applications, while graph-specific rendering and healthcare UX requirements are best served by a layered stack rather than one “do everything” library.[5][6][2]

### Recommended stack

| Layer | Recommended library | Why this is the right choice |
|---|---|---|
| App framework | React + TypeScript + Next.js App Router | React remains the safe, scalable choice for modern web apps, and TypeScript is essential for a complex multi-view clinical product.[5] |
| UI components | Radix UI + shadcn/ui | Radix gives accessible, headless primitives; this is ideal for building high-quality custom healthcare UI without fighting a rigid visual system.[2] |
| Styling | Tailwind CSS + CSS variables design tokens | Supports fast responsive implementation and tight control over a calm, consistent design system.[2] |
| Data fetching | TanStack Query | Best fit for subgraph loading, caching, optimistic state, and partial refresh patterns in an exploratory app.[6] |
| Tables | TanStack Table | Essential for research mode, evidence lists, lineage tables, and mobile-safe tabular fallbacks. |
| Graph engine | Graphology | Strong graph data model and a good companion for Sigma-based graph rendering.[6][7] |
| Graph rendering | Sigma.js with React Sigma | High-performance graph rendering and good fit for interactive, large-scale graph exploration in React.[6][7] |
| Charts and small analytics views | Visx for custom visuals, ECharts for dense/high-volume charts | Visx is excellent for custom React-native visual primitives; ECharts is strong for high-performance charting with large datasets.[8][9] |
| Motion | Framer Motion | Best for polished panel transitions, staged reveals, and continuity animations without overcomplicating the graph engine. |
| Forms | React Hook Form + Zod | Reduces friction and improves correctness for advanced search, filters, and saved-query workflows. |
| Icons | Lucide | Clean and neutral visual language that fits clinical interfaces better than decorative icon packs. |
| Accessibility testing | axe-core + Storybook | Critical for maintaining WCAG-grade components in a high-stakes product.[1] |

### Library decisions

#### 1. React + TypeScript + Next.js

Use React with TypeScript as the base application layer. For a product with multiple synchronized panes, role-based modes, evidence drawers, saved state, and reusable domain components, this stack gives the best balance of team familiarity, long-term maintainability, and ecosystem support.[5]

Next.js is recommended mainly for app structure, route organization, server components where useful, and controlled data fetching. Even if the graph canvas itself is a highly interactive client component, the rest of the app benefits from a stable application shell and strong performance patterns.

#### 2. Radix UI + shadcn/ui, not a generic dashboard kit

For top-quality UI/UX, avoid heavy pre-styled admin templates. Clinical products need custom hierarchy, calm density, large targets, and trustworthy interaction patterns, so accessible headless primitives are a better foundation than a flashy component suite.[2][1]

Use Radix UI primitives for dialogs, drawers, popovers, tabs, tooltips, switches, accordions, and navigation. Build a custom design system on top, using shadcn/ui only as a starting structure, not as an unedited visual identity.

#### 3. Sigma.js + Graphology for graph work

For graph visualization, Sigma with Graphology is the strongest fit for your use case. Sigma is positioned as a high-performance graph visualization option for React applications, and Graphology complements it as the underlying graph data structure layer.[6][7]

This pairing is better than forcing a generic flowchart or diagram library into a medical knowledge graph product. It allows you to support clustering, level-of-detail rendering, grouped expansion, dynamic sizing, and more serious graph interaction patterns required for large KGs.[6]

#### 4. Visx and ECharts for non-graph visuals

A clinical KG interface should not force everything into a node-link diagram. Visx is useful when you need highly custom React-native visual components such as compact timelines, event strips, evidence distributions, or path explanation views, while ECharts is well suited for large, responsive, high-performance charts.[8][9]

This split matters because top-tier UX comes from choosing the clearest visual form for the task, not from showing the graph everywhere. Timeline, matrix, Sankey, and statistical trend views should be first-class citizens.[3][1]

## Top-quality UX direction

### Product character

The application should feel calm, clinical, modern, and deliberate. In healthcare UX, calm visual hierarchy, guided choice, and progressive disclosure are not stylistic preferences; they are directly tied to comprehension, trust, and safe interpretation.[2][1]

The experience should feel closer to a premium medical workstation than to a research toy. Every layout choice should reduce ambiguity, every interaction should preserve orientation, and every panel should answer “what does this mean?” before asking the user to manipulate graph structure.[3][1]

### UX priorities

1. Make the first screen understandable in 5 seconds.[1]
2. Never show a full graph by default.[3][2]
3. Keep critical information in plain language.[1]
4. Make every relation explainable and traceable.[3][1]
5. Design separate experiences for doctor, researcher, and AI/ML student.[2][3]

## Design system

The UI should use a healthcare-safe design system with restrained color, excellent contrast, readable spacing, and role-aware density. Calm visual hierarchy is a core healthtech pattern, especially when the interface displays complex or sensitive information.[2][1]

### Design tokens

- Body text minimum: 16 px.[1][2]
- Touch targets minimum: 44 x 44 px.[1][2]
- Contrast target: WCAG AA minimum across all views.[1][2]
- Spacing: 4 px token scale.
- Radius: soft but restrained; avoid overly rounded “consumer SaaS” styling.
- Motion: 120 to 200 ms for interface transitions; slower only when helping orientation.

### Color system

Use a neutral foundation with one trust-building accent such as teal or deep blue. In healthtech UX, alert colors should be reserved for consistent clinical meaning rather than decoration, because visual weight must escalate only when the user genuinely needs to act.[2]

Recommended semantic colors:

- Primary action: teal / deep blue.
- Diagnosis: muted plum or indigo.
- Medication: blue.
- Labs: amber.
- Procedure: cyan.
- Encounter/context: gray.
- High-severity alert: red, used sparingly and consistently.[2]

### Typography

Use a high-legibility sans serif such as Inter, Manrope, or Source Sans 3 for body and controls. Avoid ornamental fonts, compressed headers, or tiny metadata because healthcare products must stay readable under fatigue, stress, and lower digital confidence.[1][2]

## Layout and interaction architecture

### Recommended shell

Use a three-region shell on desktop:

- Left rail: search, filters, mode toggle, saved views.
- Main content: summary, timeline, graph, or analysis canvas.
- Right rail: details drawer, evidence, provenance, and next-step actions.

This is the right structure because it separates navigation, interpretation, and evidence while preserving orientation.[3][1]

### Responsive behavior

Top-quality UX here means designing mobile and tablet intentionally, not shrinking the desktop graph. Healthcare interfaces should collapse and reframe complexity rather than simply scale it down.[1][2]

#### Desktop

- Keep graph and evidence visible together.
- Allow keyboard-driven traversal for power users.
- Use resizable side panels.

#### Tablet

- Convert right rail into a detachable evidence tray.
- Use tabbed switching between graph and timeline when width is constrained.

#### Mobile

- Default to summary cards and timeline.
- Hide full graph behind an “Explain connections” action.
- Use bottom sheets for node details and relation provenance.[1]

## Visualization architecture

Top-quality UI/UX requires multiple coordinated visualization modes rather than one overloaded canvas. Research on graph-based healthcare interfaces and medical record visualization supports synchronized multi-view exploration because no single representation fits all users or tasks.[3][1]

### 1. Doctor mode

Doctor mode should be the most simplified and safest mode. The graph is secondary and explanation-focused, not exploratory-first.[1][4]

#### Default views

- Clinical summary cards.
- Patient timeline.
- Key diagnosis / medication / lab clusters.
- “Why connected?” mini path cards.

#### UI rules

- Hide schema jargon.
- Natural language edge labels only.
- Cap visible nodes tightly.
- Strong relevance sorting.
- One-click evidence access.
- Large typography and reduced control density.[3][1]

### 2. Research mode

Research mode can expose complexity, but still needs good UX discipline. The difference is not “show everything”; it is “show more, with stronger control.”[3][6]

#### Default views

- Instance graph.
- Schema/metagraph toggle.
- Table + graph sync.
- Path finder.
- Cohort compare.
- Lineage inspector.

#### UI rules

- Surface filters and depth controls up front.
- Support bookmarkable states.
- Use adjacency matrix and timeline alternatives for dense queries.
- Provide exports and copyable provenance.

### 3. AI/ML student mode

Student mode should teach the transformation from MIMIC-IV rows to KG objects. This is where UX should become explanatory and annotated instead of purely task-driven.[1]

#### Default views

- Source row to node-edge mapping.
- Schema legend with examples.
- Guided expansion steps.
- ETL rationale panel.
- Synthetic tutorial cases.

#### UI rules

- Use callouts and annotations.
- Animate staged transformations.
- Keep visible graph small but well-labeled.
- Explain modeling choices in plain language.

## Graph UX patterns

### Core graph rules

- Never open with an unbounded graph.[3][2]
- Always anchor on a task, patient, event, or question.[3]
- Expand by semantic group, not raw adjacency.[3][6]
- Preserve node position across updates to avoid disorientation.[3]
- Use semantic zoom and grouped neighbors for larger neighborhoods.[3][6]

### Best interaction patterns

- Single click opens summary preview.
- Double click or explicit focus button makes node primary.
- Hover gives lightweight metadata only.
- Edge click opens explanation + provenance.
- “Expand related labs,” “Expand medications,” and “Expand preceding events” are better than generic “expand node.”[3]

### Alternative visual forms

Use the graph only when it is the clearest representation. For top-quality UX, include:

- Timeline for event sequences.[1]
- Sankey or flow for diagnosis-to-intervention-to-outcome chains.[3]
- Matrix for dense relation comparisons.[3]
- Table for evidence-heavy review.[1]
- Mini story path for explaining one relationship path.[3]

## Frontend component blueprint

### Foundational components

Build a reusable design system with these components:

- AppShell
- ModeSwitcher
- SearchCommandBar
- SummaryCard
- TimelineStrip
- GraphCanvas
- GraphLegend
- NodeDetailDrawer
- EdgeEvidenceDrawer
- SubgraphRecommendationPanel
- ProvenanceTable
- MappingInspector
- CohortCompareTable
- EmptyState
- SkeletonState
- ErrorBoundaryPanel

These components should be tested in isolation and then composed into mode-specific screens. High-quality UX in regulated domains depends on consistent component behavior more than on isolated page mockups.[1][2]

### Interaction components from Radix UI

Use accessible primitives for:

- Dialogs.
- Drawers.
- Tooltips.
- Tabs.
- Accordion sections.
- Context menus.
- Popovers.
- Switches.
- Toasts for non-critical feedback only.

Use inline banners or anchored feedback for critical warnings instead of relying on transient notifications, because high-stakes health interactions should not depend on disappearable UI.[1][2]

## Loader and performance UX

Top-quality UX depends as much on perceived stability as on visual styling. Graph-heavy apps feel broken when the layout jumps, graph loads blank, or users wait without knowing what is happening.[6][3]

### Loader strategy

- Load summary first.
- Then load timeline.
- Then render graph neighborhood incrementally.
- Use skeleton UI instead of blank panels.
- Show meaningful stage text such as “Loading diagnoses,” “Grouping medications,” or “Tracing supporting events.”[6]

### Performance implementation

- Server-generate initial task-specific subgraphs.
- Cache common ego graphs and path queries.
- Use TanStack Query for stale-while-revalidate behavior.
- Virtualize long tables and evidence lists.
- Use level-of-detail rendering for larger graphs, especially over 1000 nodes.[6]
- Adapt graph detail to device capability.[6]

## Accessibility and safety

High-quality healthcare UX must treat accessibility and trust as core product quality, not as an afterthought. Healthtech UX guidance emphasizes that WCAG, role-specific rendering, progressive disclosure, and calm hierarchy are foundational to product safety and trust.[2][1]

### Accessibility requirements

- WCAG 2.2 AA target for all new builds.[2]
- Full keyboard support for all navigation and drawers.[1]
- Visible focus states.
- Screen-reader friendly labels for graph controls and evidence panels.
- Non-color cues for severity and relation status.[2]
- Reduced motion mode.
- 200 percent zoom without functional loss.[2]

### Trust patterns

- Every edge has provenance.
- Every summary has supporting evidence access.
- Every model-derived or inferred relation is labeled clearly.
- Every export or share flow confirms what data is included.
- Every persona sees only what is relevant to their role.[2][1]

## What to avoid

For truly top-quality UI/UX, avoid patterns that make graph products look clever but unusable:

- Massive node-link splash screens.
- Tiny labels and dense legends.
- Generic admin-dashboard aesthetics.
- Bright gradient-heavy visual styling.
- Over-animated graph motion.
- Tooltip-dependent critical information.
- Mixed clinical and research jargon on the same default screen.[3][2]

## Final recommendation

If the goal is top-quality frontend UX, the strongest direction is a React + TypeScript + Next.js application with Radix-based custom UI, Sigma + Graphology for graph exploration, Visx and ECharts for alternate views, TanStack Query for graph loading, and a calm healthcare-specific design system built around progressive disclosure and role-specific modes.[5][6][8][1]

Most importantly, the product should not market the graph as the hero. The hero should be comprehension. The graph should appear only when it helps the user understand something better, and the frontend should be designed to make that transition feel smooth, trustworthy, and clinically safe.[3][1][2]
