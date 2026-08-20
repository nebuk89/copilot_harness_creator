const STAGES = [
    {
        id: "design",
        number: "01",
        name: "Design",
        eyebrow: "Shape the mission",
        icon: "✦",
        accent: "violet",
        owner: "Designer agent",
        status: "partial",
        summary: "Turn intent into a bounded, testable plan before anyone writes code.",
        trigger: "New feature, changed scope, or an invalidated assumption",
        artifact: "artifacts/design.md",
        gate: "Human approval of scope, risks, and acceptance criteria",
        guide: [
            "Create .github/agents/designer.agent.md with read-only repository tools.",
            "Add a design-gate skill that outputs scope, constraints, risks, and acceptance criteria.",
            "Require an explicit approval comment or issue status before Build starts.",
        ],
        files: [".github/agents/designer.agent.md", ".github/skills/design-gate/SKILL.md"],
    },
    {
        id: "build",
        number: "02",
        name: "Build",
        eyebrow: "Execute with focus",
        icon: "⌘",
        accent: "blue",
        owner: "Builder agent",
        status: "missing",
        summary: "Implement the approved design in an isolated worktree with bounded permissions.",
        trigger: "Design gate is approved",
        artifact: "Code + implementation summary",
        gate: "No scope drift; targeted validation passes",
        guide: [
            "Create a builder agent with edit, test, and repository-search tools.",
            "Make the approved design artifact mandatory context.",
            "Stop and return to Design when requirements or architecture assumptions change.",
        ],
        files: [".github/agents/builder.agent.md", ".github/copilot-instructions.md"],
    },
    {
        id: "test",
        number: "03",
        name: "Test",
        eyebrow: "Prove the change",
        icon: "✓",
        accent: "mint",
        owner: "Test agent + CI",
        status: "missing",
        summary: "Generate evidence against the acceptance criteria, tied to the exact commit.",
        trigger: "Builder declares implementation complete",
        artifact: "Test evidence linked to commit SHA",
        gate: "Required unit and integration suites pass",
        guide: [
            "Create a test-evidence skill with exact commands and output schema.",
            "Publish results as required GitHub checks rather than chat-only claims.",
            "Record the commit SHA; any later code change invalidates this gate.",
        ],
        files: [".github/agents/tester.agent.md", ".github/skills/test-evidence/SKILL.md", ".github/workflows/agent-gates.yml"],
    },
    {
        id: "review",
        number: "04",
        name: "Review",
        eyebrow: "Challenge the work",
        icon: "⌁",
        accent: "amber",
        owner: "Independent reviewer",
        status: "partial",
        summary: "Inspect correctness, architecture, maintainability, and security without self-approval.",
        trigger: "First test gate passes",
        artifact: "Structured findings with severity and evidence",
        gate: "No unresolved blocking findings",
        guide: [
            "Use a reviewer agent that cannot edit or approve its own findings.",
            "Define blocking severities and require file/line evidence.",
            "Route fixes to Build, then rerun every downstream gate.",
        ],
        files: [".github/agents/reviewer.agent.md", "CODEOWNERS"],
    },
    {
        id: "ux",
        number: "05",
        name: "UX pass",
        eyebrow: "Make it feel right",
        icon: "◒",
        accent: "rose",
        owner: "UX reviewer",
        status: "missing",
        summary: "Assess interaction, accessibility, content, and visual quality for user-facing changes.",
        trigger: "Changed paths include UI, styling, content, or design tokens",
        artifact: "Screenshots + accessibility and interaction report",
        gate: "UX checklist passes or a human accepts exceptions",
        guide: [
            "Create a UX skill with precise changed-path triggers.",
            "Capture before/after states at representative viewports.",
            "Check keyboard flow, contrast, empty states, errors, loading, and responsive behavior.",
        ],
        files: [".github/agents/ux-reviewer.agent.md", ".github/skills/ux-audit/SKILL.md"],
    },
    {
        id: "final-test",
        number: "06",
        name: "Final test",
        eyebrow: "Re-certify",
        icon: "↻",
        accent: "cyan",
        owner: "Test agent + CI",
        status: "missing",
        summary: "Rerun the authoritative suite after review and UX changes have landed.",
        trigger: "Review and conditional UX gates pass",
        artifact: "Fresh full-suite evidence for the final SHA",
        gate: "Every required check is green on the merge candidate",
        guide: [
            "Run the full required suite, not only tests related to the original patch.",
            "Require a fresh SHA match for all evidence.",
            "Block approval when a downstream artifact is stale.",
        ],
        files: [".github/workflows/agent-gates.yml", "Branch protection rules"],
    },
    {
        id: "approve",
        number: "07",
        name: "Approve",
        eyebrow: "Human accountability",
        icon: "◇",
        accent: "lime",
        owner: "Human code owner",
        status: "missing",
        summary: "Make the final risk decision with a complete evidence packet.",
        trigger: "All applicable gates pass for the final SHA",
        artifact: "Approval record + release notes",
        gate: "Human approval and protected merge",
        guide: [
            "Configure required reviews, checks, and branch protection.",
            "Never let the builder approve or merge its own output.",
            "Present one concise packet: intent, risk, evidence, exceptions, and rollback.",
        ],
        files: ["Repository ruleset", "CODEOWNERS", "Pull request template"],
    },
];

export function createDefaultState(repository = "Your next repository") {
    return {
        repository,
        profile: "Balanced",
        objective: "A trustworthy, human-supervised path from idea to approved change.",
        retries: 2,
        updatedAt: new Date().toISOString(),
        stages: structuredClone(STAGES),
    };
}

export function mergeState(current, update) {
    return {
        ...current,
        ...update,
        updatedAt: new Date().toISOString(),
        stages: update.stages ? update.stages : current.stages,
    };
}

export function summarizeState(state) {
    const weights = { ready: 1, partial: 0.5, missing: 0 };
    const score = Math.round(
        (state.stages.reduce((sum, stage) => sum + weights[stage.status], 0) / state.stages.length) * 100,
    );
    return {
        repository: state.repository,
        score,
        ready: state.stages.filter((stage) => stage.status === "ready").map((stage) => stage.name),
        partial: state.stages.filter((stage) => stage.status === "partial").map((stage) => stage.name),
        missing: state.stages.filter((stage) => stage.status === "missing").map((stage) => stage.name),
        nextAction:
            state.stages.find((stage) => stage.status === "missing")?.guide[0] ||
            state.stages.find((stage) => stage.status === "partial")?.guide[0] ||
            "Your harness is ready for a supervised trial run.",
    };
}

function escapeJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function renderHtml(state) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Harness Studio</title>
  <style>
    :root {
      color-scheme: light dark;
      --ink: var(--text-color-default, #18201f);
      --muted: var(--text-color-muted, #68716f);
      --surface: color-mix(in srgb, var(--background-color-default, #fbfaf7) 93%, transparent);
      --surface-strong: color-mix(in srgb, var(--background-color-default, #fff) 97%, var(--ink) 3%);
      --line: color-mix(in srgb, var(--border-color-default, #d8dcda) 80%, transparent);
      --shadow: 0 24px 80px rgba(16, 29, 25, .12);
      --violet: #7567f8;
      --blue: #3287f5;
      --mint: #1fa77d;
      --amber: #c77b18;
      --rose: #dc6581;
      --cyan: #1597aa;
      --lime: #6b9825;
    }

    * { box-sizing: border-box; }
    html { min-width: 320px; background: var(--background-color-default, #f6f5f1); }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at 18% 4%, color-mix(in srgb, var(--violet) 12%, transparent), transparent 28rem),
        radial-gradient(circle at 95% 24%, color-mix(in srgb, var(--mint) 10%, transparent), transparent 26rem),
        var(--background-color-default, #f6f5f1);
      font: var(--text-body-medium, 14px)/var(--leading-body-medium, 1.5) var(--font-sans, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    }

    button, input, select { font: inherit; }
    button { color: inherit; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 246px minmax(0, 1fr); }
    .rail {
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px 18px;
      border-right: 1px solid var(--line);
      background: color-mix(in srgb, var(--background-color-default, #f6f5f1) 84%, transparent);
      backdrop-filter: blur(24px);
      z-index: 5;
    }

    .brand { display: flex; align-items: center; gap: 11px; padding: 0 8px 24px; }
    .brand-mark {
      width: 35px; height: 35px; border-radius: 12px; display: grid; place-items: center;
      color: white; font-size: 18px; background: linear-gradient(145deg, #232927, #6460df);
      box-shadow: 0 9px 22px rgba(72, 65, 177, .28);
    }
    .brand strong { display: block; font-size: 13px; letter-spacing: -.01em; }
    .brand span { display: block; color: var(--muted); font-size: 11px; margin-top: 1px; }
    .nav-label {
      padding: 12px 10px 7px; font-size: 10px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; color: var(--muted);
    }
    .nav-item {
      width: 100%; border: 0; background: transparent; border-radius: 11px; padding: 9px 10px;
      display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; color: var(--muted);
    }
    .nav-item:hover, .nav-item.active { background: var(--surface-strong); color: var(--ink); }
    .nav-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--stage-color); box-shadow: 0 0 0 4px color-mix(in srgb, var(--stage-color) 12%, transparent); }
    .nav-item small { margin-left: auto; font: 10px var(--font-mono, monospace); }
    .rail-footer { margin-top: auto; padding: 16px 10px 4px; }
    .rail-footer p { font-size: 11px; color: var(--muted); margin: 0 0 12px; }

    .main { min-width: 0; padding: 22px 28px 72px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    .repo-picker { display: flex; align-items: center; gap: 8px; color: var(--muted); min-width: 0; }
    .repo-picker svg { flex: none; }
    .repo-input {
      width: min(340px, 52vw); border: 0; outline: 0; color: var(--ink); font-weight: 650;
      background: transparent; padding: 7px 3px; border-bottom: 1px solid transparent;
    }
    .repo-input:focus { border-color: var(--violet); }
    .top-actions { display: flex; gap: 8px; }
    .button {
      border: 1px solid var(--line); background: var(--surface-strong); padding: 8px 12px; border-radius: 10px;
      cursor: pointer; font-weight: 650; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.03);
    }
    .button:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--violet) 45%, var(--line)); }
    .button.primary { background: var(--ink); color: var(--background-color-default, #fff); border-color: var(--ink); }

    .hero {
      position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 26px;
      background: var(--surface); box-shadow: var(--shadow); padding: 34px;
    }
    .hero::after {
      content: ""; position: absolute; width: 360px; height: 360px; border-radius: 50%; right: -160px; top: -190px;
      border: 68px solid color-mix(in srgb, var(--violet) 9%, transparent);
    }
    .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 188px; gap: 38px; align-items: center; }
    .kicker { display: flex; align-items: center; gap: 8px; color: var(--violet); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    .kicker::before { content: ""; width: 24px; height: 1px; background: currentColor; }
    h1 {
      max-width: 740px; margin: 14px 0 13px; font-family: var(--font-sans-display, var(--font-sans, sans-serif));
      font-size: clamp(32px, 4.7vw, 58px); line-height: .99; letter-spacing: -.055em; font-weight: 650;
    }
    h1 em { font-family: Georgia, serif; font-weight: 400; color: var(--violet); }
    .lede { max-width: 650px; margin: 0; color: var(--muted); font-size: 15px; line-height: 1.65; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .pill { border: 1px solid var(--line); background: var(--surface-strong); padding: 7px 10px; border-radius: 999px; font-size: 11px; color: var(--muted); }
    .pill strong { color: var(--ink); }
    .score-wrap { display: grid; place-items: center; gap: 11px; }
    .score {
      width: 148px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; position: relative;
      background: conic-gradient(var(--violet) calc(var(--score) * 1%), color-mix(in srgb, var(--line) 72%, transparent) 0);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--violet) 12%, transparent);
    }
    .score::before { content: ""; position: absolute; inset: 9px; border-radius: 50%; background: var(--surface-strong); }
    .score-value { position: relative; text-align: center; }
    .score-value strong { display: block; font-size: 34px; letter-spacing: -.06em; line-height: 1; }
    .score-value span { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }
    .score-wrap > span { color: var(--muted); font-size: 11px; }

    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin: 34px 2px 16px; }
    .section-head h2 { font-size: 20px; letter-spacing: -.025em; margin: 0 0 4px; }
    .section-head p { color: var(--muted); margin: 0; font-size: 12px; }
    .legend { display: flex; gap: 14px; color: var(--muted); font-size: 10px; }
    .legend span::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: currentColor; }
    .legend .ready { color: var(--mint); } .legend .partial { color: var(--amber); } .legend .missing { color: var(--muted); }

    .flow {
      display: grid; grid-template-columns: repeat(7, minmax(148px, 1fr)); gap: 12px; overflow-x: auto;
      padding: 5px 3px 22px; scroll-snap-type: x proximity;
    }
    .stage-card {
      --stage-color: var(--violet);
      position: relative; min-width: 148px; min-height: 278px; scroll-snap-align: start; overflow: hidden;
      border: 1px solid var(--line); border-radius: 19px; background: var(--surface-strong); padding: 17px;
      cursor: pointer; text-align: left; transition: .24s ease; box-shadow: 0 6px 24px rgba(21, 28, 26, .045);
    }
    .stage-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--stage-color) 48%, var(--line)); box-shadow: 0 16px 38px color-mix(in srgb, var(--stage-color) 11%, transparent); }
    .stage-card::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--stage-color); opacity: .85; }
    .stage-card::after { content: ""; position: absolute; width: 90px; height: 90px; right: -48px; top: 22px; border-radius: 50%; background: color-mix(in srgb, var(--stage-color) 9%, transparent); }
    .stage-top { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; }
    .stage-number { color: var(--muted); font: 10px var(--font-mono, monospace); letter-spacing: .08em; }
    .stage-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 10px; color: var(--stage-color); background: color-mix(in srgb, var(--stage-color) 11%, transparent); font-weight: 700; }
    .stage-card h3 { font-size: 18px; margin: 37px 0 2px; letter-spacing: -.03em; }
    .stage-eyebrow { color: var(--stage-color); font-size: 10px; font-weight: 700; }
    .stage-summary { color: var(--muted); font-size: 11px; line-height: 1.55; margin: 16px 0 20px; }
    .stage-bottom { position: absolute; left: 17px; right: 17px; bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .status { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--status-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-color) 12%, transparent); }
    .status.ready { --status-color: var(--mint); } .status.partial { --status-color: var(--amber); } .status.missing { --status-color: #8d9693; }
    .open-arrow { color: var(--muted); font-size: 17px; }

    .lower-grid { display: grid; grid-template-columns: 1.18fr .82fr; gap: 16px; margin-top: 2px; }
    .panel { border: 1px solid var(--line); background: var(--surface); border-radius: 20px; padding: 22px; }
    .panel-title { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 20px; }
    .panel-title h3 { margin: 0 0 4px; font-size: 15px; }
    .panel-title p { margin: 0; color: var(--muted); font-size: 11px; }
    .layers { display: grid; gap: 8px; }
    .layer { display: grid; grid-template-columns: 38px 1fr auto; gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--surface-strong); }
    .layer-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet); }
    .layer strong { display: block; font-size: 12px; } .layer small { color: var(--muted); font-size: 10px; }
    .layer code { color: var(--violet); font: 10px var(--font-mono, monospace); }
    .rule { display: grid; grid-template-columns: 30px 1fr; gap: 12px; position: relative; padding-bottom: 17px; }
    .rule:not(:last-child)::after { content: ""; position: absolute; left: 14px; top: 31px; bottom: 2px; width: 1px; background: var(--line); }
    .rule-index { width: 29px; height: 29px; border: 1px solid var(--line); border-radius: 50%; display: grid; place-items: center; background: var(--surface-strong); font: 10px var(--font-mono, monospace); }
    .rule strong { display: block; font-size: 12px; margin: 1px 0 3px; }
    .rule p { color: var(--muted); font-size: 10px; margin: 0; line-height: 1.5; }

    .scrim { position: fixed; inset: 0; z-index: 20; background: rgba(15, 19, 18, .38); backdrop-filter: blur(8px); opacity: 0; pointer-events: none; transition: .24s ease; }
    .scrim.open { opacity: 1; pointer-events: auto; }
    .drawer {
      position: fixed; z-index: 21; right: 0; top: 0; width: min(540px, 93vw); height: 100vh; overflow: auto;
      background: var(--background-color-default, #fbfaf7); border-left: 1px solid var(--line); box-shadow: -32px 0 90px rgba(0,0,0,.17);
      transform: translateX(102%); transition: .3s cubic-bezier(.2,.8,.2,1); padding: 28px;
    }
    .drawer.open { transform: translateX(0); }
    .drawer-close { float: right; width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface-strong); cursor: pointer; }
    .drawer-kicker { color: var(--stage-color); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .1em; margin-top: 24px; }
    .drawer h2 { margin: 8px 0 8px; font-size: 34px; letter-spacing: -.05em; }
    .drawer .summary { color: var(--muted); margin: 0 0 22px; line-height: 1.65; }
    .status-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 13px 0; border-block: 1px solid var(--line); }
    .status-row span { font-size: 11px; color: var(--muted); }
    .status-select { border: 1px solid var(--line); border-radius: 9px; padding: 7px 9px; background: var(--surface-strong); color: var(--ink); }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0 25px; }
    .detail { border: 1px solid var(--line); border-radius: 13px; padding: 12px; background: var(--surface-strong); }
    .detail span { display: block; color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .09em; margin-bottom: 5px; }
    .detail strong { font-size: 11px; line-height: 1.45; }
    .guide-title { font-size: 13px; margin: 25px 0 13px; }
    .guide-step { display: grid; grid-template-columns: 29px 1fr; gap: 12px; align-items: start; padding: 11px 0; }
    .guide-step b { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--stage-color) 11%, transparent); color: var(--stage-color); font: 10px var(--font-mono, monospace); }
    .guide-step p { margin: 2px 0 0; font-size: 12px; line-height: 1.55; }
    .file-list { display: flex; flex-wrap: wrap; gap: 7px; }
    .file-list code { padding: 7px 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-strong); color: var(--muted); font: 10px var(--font-mono, monospace); }
    .export-view { display: none; position: fixed; inset: 8vh 8vw; z-index: 30; overflow: auto; background: var(--background-color-default, #fbfaf7); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 30px 100px rgba(0,0,0,.28); padding: 28px; }
    .export-view.open { display: block; }
    .export-view pre { white-space: pre-wrap; color: var(--muted); font: 11px/1.65 var(--font-mono, monospace); }

    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; } .rail { display: none; } .main { padding: 16px; }
      .hero { padding: 25px; } .hero-grid { grid-template-columns: 1fr; } .score-wrap { display: none; }
      .lower-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .topbar { align-items: flex-start; } .top-actions .button:first-child { display: none; }
      .hero { border-radius: 20px; } .detail-grid { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="rail">
      <div class="brand">
        <div class="brand-mark">✣</div>
        <div><strong>Harness Studio</strong><span>Agent team architect</span></div>
      </div>
      <div class="nav-label">Mission flow</div>
      <nav id="nav"></nav>
      <div class="rail-footer">
        <p>Prompts coordinate.<br>Checks enforce.</p>
        <button class="button" id="reset">Reset blueprint</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <label class="repo-picker">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 2.5h4l1.2 1.4h5.8v9.6h-11z" stroke="currentColor" stroke-width="1.3"/></svg>
          <input class="repo-input" id="repository" aria-label="Repository" spellcheck="false">
        </label>
        <div class="top-actions">
          <button class="button" id="blueprint">View blueprint</button>
          <button class="button primary" id="next-gap">Configure next gap</button>
        </div>
      </header>

      <section class="hero">
        <div class="hero-grid">
          <div>
            <div class="kicker">Your agent operating system</div>
            <h1>Build a team that knows <em>when to stop.</em></h1>
            <p class="lede">Shape a dependable flow from intent to approval. Every agent has a narrow job, every gate creates evidence, and humans stay accountable for risk.</p>
            <div class="meta">
              <span class="pill"><strong>7</strong> deliberate gates</span>
              <span class="pill"><strong id="ready-count">0</strong> production ready</span>
              <span class="pill"><strong id="retry-count">2</strong> attempts before escalation</span>
              <span class="pill">Profile · <strong id="profile">Balanced</strong></span>
            </div>
          </div>
          <div class="score-wrap">
            <div class="score" id="score-ring"><div class="score-value"><strong id="score">0%</strong><span>readiness</span></div></div>
            <span id="score-label">A blueprint taking shape</span>
          </div>
        </div>
      </section>

      <div class="section-head">
        <div><h2>Your delivery choreography</h2><p>Select a gate to configure its owner, trigger, evidence, and enforcement.</p></div>
        <div class="legend"><span class="ready">Ready</span><span class="partial">Partial</span><span class="missing">Missing</span></div>
      </div>
      <section class="flow" id="flow"></section>

      <section class="lower-grid">
        <article class="panel">
          <div class="panel-title"><div><h3>Configuration layers</h3><p>Defaults flow down; repository policy wins.</p></div><span class="pill">Versioned where it matters</span></div>
          <div class="layers">
            <div class="layer"><div class="layer-icon">◎</div><div><strong>Your working style</strong><small>Planning habits, presentation preferences, safety boundaries</small></div><code>App settings</code></div>
            <div class="layer"><div class="layer-icon">↗</div><div><strong>Reusable craft</strong><small>Personal procedures that travel with you across repositories</small></div><code>~/.copilot/skills</code></div>
            <div class="layer"><div class="layer-icon">⌂</div><div><strong>Team contract</strong><small>Architecture, validation, agents, skills, and path-specific rules</small></div><code>.github/</code></div>
            <div class="layer"><div class="layer-icon">◆</div><div><strong>Hard enforcement</strong><small>Checks, code owners, rulesets, environments, and approvals</small></div><code>GitHub</code></div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-title"><div><h3>Harness laws</h3><p>The non-negotiables that keep autonomy trustworthy.</p></div></div>
          <div>
            <div class="rule"><div class="rule-index">01</div><div><strong>Durable state, not chat memory</strong><p>Issues, PRs, checks, and artifacts hold the truth.</p></div></div>
            <div class="rule"><div class="rule-index">02</div><div><strong>No self-approval</strong><p>Builders never own review or final risk acceptance.</p></div></div>
            <div class="rule"><div class="rule-index">03</div><div><strong>Evidence follows the SHA</strong><p>A code change invalidates every downstream verdict.</p></div></div>
            <div class="rule"><div class="rule-index">04</div><div><strong>Retries are finite</strong><p>Two quality attempts, then a useful human escalation.</p></div></div>
          </div>
        </article>
      </section>
    </main>
  </div>

  <div class="scrim" id="scrim"></div>
  <aside class="drawer" id="drawer" aria-label="Gate guide"></aside>
  <section class="export-view" id="export-view">
    <button class="drawer-close" id="export-close" aria-label="Close">×</button>
    <div class="kicker">Portable contract</div>
    <h2>Starter harness blueprint</h2>
    <p class="lede">Commit an equivalent contract and enforce its gates through GitHub checks.</p>
    <pre id="blueprint-code"></pre>
  </section>

  <script>
    let state = ${escapeJson(state)};
    const colors = { violet: "var(--violet)", blue: "var(--blue)", mint: "var(--mint)", amber: "var(--amber)", rose: "var(--rose)", cyan: "var(--cyan)", lime: "var(--lime)" };
    const weights = { ready: 1, partial: .5, missing: 0 };

    function score() {
      return Math.round(state.stages.reduce((sum, stage) => sum + weights[stage.status], 0) / state.stages.length * 100);
    }

    function label(status) {
      return status === "ready" ? "Ready" : status === "partial" ? "Partial setup" : "Not configured";
    }

    function render() {
      const value = score();
      document.getElementById("repository").value = state.repository;
      document.getElementById("profile").textContent = state.profile;
      document.getElementById("retry-count").textContent = state.retries;
      document.getElementById("ready-count").textContent = state.stages.filter(s => s.status === "ready").length;
      document.getElementById("score").textContent = value + "%";
      document.getElementById("score-ring").style.setProperty("--score", value);
      document.getElementById("score-label").textContent = value === 100 ? "Ready for a supervised run" : value >= 60 ? "The operating model is forming" : "A blueprint taking shape";

      document.getElementById("nav").innerHTML = state.stages.map(stage => \`
        <button class="nav-item" data-stage="\${stage.id}" style="--stage-color:\${colors[stage.accent]}">
          <span class="nav-dot"></span><span>\${stage.name}</span><small>\${stage.number}</small>
        </button>\`).join("");

      document.getElementById("flow").innerHTML = state.stages.map(stage => \`
        <button class="stage-card" data-stage="\${stage.id}" style="--stage-color:\${colors[stage.accent]}">
          <div class="stage-top"><span class="stage-number">\${stage.number}</span><span class="stage-icon">\${stage.icon}</span></div>
          <h3>\${stage.name}</h3><div class="stage-eyebrow">\${stage.eyebrow}</div>
          <p class="stage-summary">\${stage.summary}</p>
          <div class="stage-bottom"><span class="status \${stage.status}">\${label(stage.status)}</span><span class="open-arrow">→</span></div>
        </button>\`).join("");

      document.querySelectorAll("[data-stage]").forEach(button => button.onclick = () => openStage(button.dataset.stage));
    }

    function openStage(id) {
      const stage = state.stages.find(item => item.id === id);
      if (!stage) return;
      const drawer = document.getElementById("drawer");
      drawer.style.setProperty("--stage-color", colors[stage.accent]);
      drawer.innerHTML = \`
        <button class="drawer-close" id="drawer-close" aria-label="Close">×</button>
        <div class="drawer-kicker">Gate \${stage.number} · \${stage.eyebrow}</div>
        <h2>\${stage.name}</h2>
        <p class="summary">\${stage.summary}</p>
        <div class="status-row"><span>Repository readiness</span>
          <select class="status-select" id="stage-status">
            <option value="missing" \${stage.status === "missing" ? "selected" : ""}>Not configured</option>
            <option value="partial" \${stage.status === "partial" ? "selected" : ""}>Partial setup</option>
            <option value="ready" \${stage.status === "ready" ? "selected" : ""}>Ready</option>
          </select>
        </div>
        <div class="detail-grid">
          <div class="detail"><span>Owner</span><strong>\${stage.owner}</strong></div>
          <div class="detail"><span>Trigger</span><strong>\${stage.trigger}</strong></div>
          <div class="detail"><span>Evidence</span><strong>\${stage.artifact}</strong></div>
          <div class="detail"><span>Pass condition</span><strong>\${stage.gate}</strong></div>
        </div>
        <h3 class="guide-title">Make this gate real</h3>
        \${stage.guide.map((step, index) => \`<div class="guide-step"><b>0\${index + 1}</b><p>\${step}</p></div>\`).join("")}
        <h3 class="guide-title">Likely touchpoints</h3>
        <div class="file-list">\${stage.files.map(file => \`<code>\${file}</code>\`).join("")}</div>
      \`;
      drawer.classList.add("open");
      document.getElementById("scrim").classList.add("open");
      document.getElementById("drawer-close").onclick = closeDrawer;
      document.getElementById("stage-status").onchange = event => {
        state.stages = state.stages.map(item => item.id === id ? { ...item, status: event.target.value } : item);
        save({ stages: state.stages });
      };
    }

    function closeDrawer() {
      document.getElementById("drawer").classList.remove("open");
      document.getElementById("scrim").classList.remove("open");
    }

    async function save(update) {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update)
      });
      if (!response.ok) throw new Error("Could not save harness state");
      state = await response.json();
      render();
    }

    function blueprint() {
      return \`version: 1
repository: \${state.repository}
state: github-issue-and-pr
profile: \${state.profile.toLowerCase()}

stages:
\${state.stages.map(stage => \`  - id: \${stage.id}
    agent: \${stage.owner.toLowerCase().replaceAll(" ", "-")}
    status: \${stage.status}
    trigger: "\${stage.trigger}"
    produces: "\${stage.artifact}"
    gate: "\${stage.gate}"\`).join("\\n\\n")}

policy:
  max_attempts: \${state.retries}
  repeated_failure: escalate
  invalidate_downstream_on_change: true
  builder_may_approve: false
  merge_requires_human: true\`;
    }

    document.getElementById("repository").addEventListener("change", event => save({ repository: event.target.value.trim() || "Your next repository" }));
    document.getElementById("scrim").onclick = closeDrawer;
    document.addEventListener("keydown", event => { if (event.key === "Escape") { closeDrawer(); document.getElementById("export-view").classList.remove("open"); } });
    document.getElementById("next-gap").onclick = () => openStage((state.stages.find(stage => stage.status === "missing") || state.stages.find(stage => stage.status === "partial") || state.stages[0]).id);
    document.getElementById("blueprint").onclick = () => {
      document.getElementById("blueprint-code").textContent = blueprint();
      document.getElementById("scrim").classList.add("open");
      document.getElementById("export-view").classList.add("open");
    };
    document.getElementById("export-close").onclick = () => { document.getElementById("export-view").classList.remove("open"); document.getElementById("scrim").classList.remove("open"); };
    document.getElementById("reset").onclick = async () => {
      if (!confirm("Reset this harness blueprint?")) return;
      const response = await fetch("/api/reset", { method: "POST" });
      state = await response.json();
      render();
    };
    new EventSource("/events").onmessage = event => { state = JSON.parse(event.data); render(); };
    render();
  </script>
</body>
</html>`;
}
