/* 页注 · PageNote — in-page UI styles, injected into a shadow root. */
(() => {
  "use strict";

  const SHADOW_CSS = String.raw`
    :host {
      all: initial;
      --pn-ink: #1d2b26;
      --pn-ink-soft: #44534c;
      --pn-muted: #7b857e;
      --pn-faint: #9da69f;
      --pn-paper: #fbf8f1;
      --pn-card: #fffdf8;
      --pn-line: #e8dfcf;
      --pn-line-strong: #dbcfba;
      --pn-accent: #f4c84b;
      --pn-accent-deep: #a87209;
      --pn-danger: #a95057;
      --pn-panel-width: 370px;
      --pn-serif: "Iowan Old Style", "Palatino Linotype", "Songti SC", "Noto Serif SC", Georgia, serif;
      --pn-sans: "Avenir Next", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }

    .pn-ui,
    .pn-ui *,
    .pn-ui *::before,
    .pn-ui *::after {
      box-sizing: border-box;
    }

    .pn-ui {
      position: relative;
      z-index: 2147483647;
      color: var(--pn-ink);
      font-family: var(--pn-sans);
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      pointer-events: none;
    }

    .pn-ui [hidden] {
      display: none !important;
    }

    .pn-ui button {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      line-height: 1;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .pn-ui button:focus-visible,
    .pn-ui [tabindex]:focus-visible {
      outline: 2px solid var(--pn-accent);
      outline-offset: 2px;
    }

    .pn-ui svg {
      display: block;
      flex: none;
    }

    /* ── Floating selection toolbar ─────────────────────────────── */

    .pn-selection {
      position: fixed;
      inset: 0;
      z-index: 30;
      pointer-events: none;
    }

    .pn-toolbar {
      position: fixed;
      left: 0;
      top: 0;
      display: flex;
      align-items: center;
      gap: 7px;
      max-width: calc(100vw - 16px);
      padding: 6px 7px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px;
      background: rgba(27, 39, 34, 0.97);
      color: #f7f1e4;
      box-shadow:
        0 12px 30px rgba(10, 18, 14, 0.26),
        0 2px 7px rgba(10, 18, 14, 0.22),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      opacity: 0;
      transform: translateY(4px) scale(0.97);
      transform-origin: center bottom;
      transition: opacity 130ms ease, transform 160ms cubic-bezier(0.2, 0.8, 0.25, 1);
      pointer-events: auto;
      user-select: none;
      white-space: nowrap;
    }

    .pn-toolbar.is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .pn-swatches {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .pn-swatch {
      position: relative;
      display: grid;
      width: 24px;
      height: 26px;
      place-items: center;
      border-radius: 7px;
      transition: background 120ms ease;
    }

    .pn-swatch:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .pn-swatch-fill {
      width: 16px;
      height: 16px;
      border-radius: 5px;
      background: var(--pn-swatch);
      box-shadow:
        inset 0 0 0 1px rgba(0, 0, 0, 0.1),
        0 1px 2px rgba(0, 0, 0, 0.15);
      transition: transform 130ms cubic-bezier(0.2, 0.8, 0.25, 1);
    }

    .pn-swatch:hover .pn-swatch-fill {
      transform: scale(1.16);
    }

    .pn-divider {
      width: 1px;
      height: 18px;
      margin: 0 1px;
      background: rgba(255, 255, 255, 0.14);
    }

    .pn-tool {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 9px;
      border-radius: 8px;
      color: #eee7d9;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 28px;
      transition: background 120ms ease, color 120ms ease;
    }

    .pn-tool:hover {
      background: rgba(255, 255, 255, 0.11);
      color: #fffaf0;
    }

    .pn-tool-note {
      padding: 0 10px;
      background: var(--pn-accent);
      color: #2a2410;
      font-weight: 650;
    }

    .pn-tool-note:hover {
      background: #f8d46a;
      color: #241f0e;
    }

    .pn-toolbar-close {
      display: grid;
      width: 25px;
      height: 25px;
      place-items: center;
      border-radius: 7px;
      color: rgba(246, 240, 226, 0.58);
      transition: background 120ms ease, color 120ms ease;
    }

    .pn-toolbar-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff8ea;
    }

    @media (max-width: 420px) {
      .pn-toolbar {
        gap: 5px;
        padding: 5px 6px;
      }

      .pn-tool {
        padding: 0 7px;
      }

      .pn-tool span {
        display: none;
      }

      .pn-toolbar-close {
        display: none;
      }
    }

    /* ── Right-side annotation panel ────────────────────────────── */

    .pn-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      width: min(var(--pn-panel-width), 100vw);
      height: 100vh;
      height: 100dvh;
      flex-direction: column;
      overflow: hidden;
      border-left: 1px solid rgba(214, 202, 181, 0.85);
      background:
        radial-gradient(120% 55% at 100% 0%, rgba(244, 200, 75, 0.17), transparent 58%),
        radial-gradient(90% 42% at 0% 100%, rgba(145, 196, 155, 0.09), transparent 60%),
        var(--pn-paper);
      box-shadow:
        -26px 0 70px rgba(35, 45, 38, 0.14),
        -2px 0 8px rgba(35, 45, 38, 0.05);
      visibility: hidden;
      transform: translateX(calc(100% + 24px));
      transition:
        transform 300ms cubic-bezier(0.22, 0.8, 0.24, 1),
        visibility 0s linear 300ms;
      pointer-events: auto;
      user-select: none;
    }

    .pn-panel.is-open {
      visibility: visible;
      transform: translateX(0);
      transition:
        transform 300ms cubic-bezier(0.22, 0.8, 0.24, 1),
        visibility 0s linear 0s;
    }

    .pn-panel::before {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      pointer-events: none;
    }

    .pn-panel-head {
      flex: none;
      padding: 20px 20px 15px;
    }

    .pn-brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .pn-brand {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 9px;
    }

    .pn-logo {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      box-shadow: 0 3px 9px rgba(24, 38, 31, 0.16);
    }

    .pn-brand-copy {
      display: flex;
      min-width: 0;
      align-items: baseline;
      gap: 7px;
    }

    .pn-brand-name {
      font-family: var(--pn-serif);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.03em;
      line-height: 1;
    }

    .pn-brand-en {
      color: var(--pn-faint);
      font-size: 8px;
      font-weight: 650;
      letter-spacing: 0.2em;
      line-height: 1;
    }

    .pn-icon-btn {
      display: grid;
      width: 30px;
      height: 30px;
      flex: none;
      place-items: center;
      border-radius: 9px;
      color: var(--pn-muted);
      transition: background 130ms ease, color 130ms ease, transform 130ms ease;
    }

    .pn-icon-btn:hover {
      background: rgba(35, 51, 43, 0.07);
      color: var(--pn-ink);
    }

    .pn-panel-title-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-top: 22px;
    }

    .pn-panel-title-row h2 {
      margin: 0;
      font-family: var(--pn-serif);
      font-size: 25px;
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 1.2;
    }

    .pn-page-host {
      max-width: 250px;
      margin: 5px 0 0;
      overflow: hidden;
      color: var(--pn-muted);
      font-size: 11.5px;
      letter-spacing: 0.015em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pn-total {
      display: inline-flex;
      align-items: baseline;
      gap: 3px;
      flex: none;
      padding: 5px 9px 4px;
      border: 1px solid rgba(190, 151, 52, 0.22);
      border-radius: 999px;
      background: rgba(244, 200, 75, 0.14);
      color: #7b5b15;
      font-size: 10px;
      letter-spacing: 0.04em;
    }

    .pn-total b {
      font-family: var(--pn-serif);
      font-size: 15px;
      font-weight: 600;
      line-height: 1;
    }

    /* Composer */

    .pn-composer {
      position: relative;
      flex: none;
      margin: 0 16px 13px;
      padding: 14px;
      border: 1px solid #e4d3ae;
      border-radius: 15px;
      background:
        linear-gradient(155deg, rgba(255, 255, 255, 0.86), rgba(255, 251, 241, 0.96)),
        var(--pn-card);
      box-shadow:
        0 10px 24px rgba(87, 66, 30, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
      animation: pn-composer-in 220ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
    }

    @keyframes pn-composer-in {
      from {
        transform: translateY(-4px);
      }
      to {
        transform: translateY(0);
      }
    }

    .pn-composer::after {
      content: "";
      position: absolute;
      top: 0;
      right: 18px;
      left: 18px;
      height: 2px;
      border-radius: 2px;
      background: var(--pn-composer-accent, var(--pn-accent));
      opacity: 0.7;
    }

    .pn-composer-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .pn-composer-kicker {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--pn-ink-soft);
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.14em;
    }

    .pn-composer-kicker::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--pn-composer-accent, var(--pn-accent));
    }

    .pn-composer-close {
      display: grid;
      width: 23px;
      height: 23px;
      place-items: center;
      border-radius: 6px;
      color: var(--pn-faint);
    }

    .pn-composer-close:hover {
      background: rgba(35, 51, 43, 0.06);
      color: var(--pn-ink);
    }

    .pn-composer-quote {
      display: -webkit-box;
      max-height: 58px;
      margin: 10px 0 11px;
      padding: 1px 0 1px 9px;
      overflow: hidden;
      border-left: 2px solid var(--pn-composer-accent, var(--pn-accent));
      color: var(--pn-muted);
      font-family: var(--pn-serif);
      font-size: 12px;
      line-height: 1.55;
      user-select: text;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .pn-composer textarea {
      display: block;
      width: 100%;
      height: 88px;
      max-height: 180px;
      margin: 0;
      padding: 9px 10px;
      resize: vertical;
      border: 1px solid #e5d9c4;
      border-radius: 9px;
      outline: none;
      background: rgba(255, 255, 255, 0.7);
      color: var(--pn-ink);
      font-family: var(--pn-sans);
      font-size: 13px;
      line-height: 1.62;
      transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
    }

    .pn-composer textarea::placeholder {
      color: #a9afa8;
    }

    .pn-composer textarea:focus {
      border-color: rgba(190, 148, 42, 0.62);
      background: #fffefb;
      box-shadow: 0 0 0 3px rgba(244, 200, 75, 0.16);
    }

    .pn-composer.is-invalid textarea {
      border-color: rgba(169, 80, 87, 0.7);
      box-shadow: 0 0 0 3px rgba(169, 80, 87, 0.11);
      animation: pn-nudge 180ms ease;
    }

    @keyframes pn-nudge {
      0%, 100% { transform: translateX(0); }
      35% { transform: translateX(-2px); }
      70% { transform: translateX(2px); }
    }

    .pn-composer-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 9px;
    }

    .pn-palette {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .pn-palette-label {
      margin-right: 1px;
      color: var(--pn-faint);
      font-size: 10px;
    }

    .pn-palette-dot {
      position: relative;
      display: grid;
      width: 20px;
      height: 20px;
      place-items: center;
      border-radius: 50%;
    }

    .pn-palette-dot::before {
      content: "";
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--pn-swatch);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.09);
      transition: transform 120ms ease;
    }

    .pn-palette-dot:hover::before {
      transform: scale(1.15);
    }

    .pn-palette-dot.is-selected {
      box-shadow: inset 0 0 0 1.5px var(--pn-swatch);
    }

    .pn-counter {
      color: var(--pn-faint);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    .pn-composer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 7px;
      margin-top: 11px;
    }

    .pn-btn {
      height: 31px;
      padding: 0 13px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      line-height: 31px;
      transition: background 130ms ease, color 130ms ease, border-color 130ms ease;
    }

    .pn-btn-ghost {
      border: 1px solid transparent;
      color: var(--pn-muted);
    }

    .pn-btn-ghost:hover {
      background: rgba(35, 51, 43, 0.06);
      color: var(--pn-ink);
    }

    .pn-btn-ghost.is-danger {
      border-color: rgba(169, 80, 87, 0.22);
      background: rgba(169, 80, 87, 0.07);
      color: var(--pn-danger);
    }

    .pn-btn-primary {
      background: var(--pn-ink);
      color: #fbf5e7;
      box-shadow: 0 3px 8px rgba(29, 43, 38, 0.16);
    }

    .pn-btn-primary:hover {
      background: #2b3e37;
    }

    /* Filters and list */

    .pn-filter-bar {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      padding: 0 20px 11px;
    }

    .pn-filters {
      display: flex;
      gap: 4px;
    }

    .pn-filter {
      display: flex;
      align-items: center;
      gap: 5px;
      height: 27px;
      padding: 0 9px;
      border-radius: 7px;
      color: var(--pn-muted);
      font-size: 11.5px;
      font-weight: 500;
      transition: background 130ms ease, color 130ms ease;
    }

    .pn-filter:hover {
      background: rgba(35, 51, 43, 0.055);
      color: var(--pn-ink);
    }

    .pn-filter[aria-pressed="true"] {
      background: var(--pn-ink);
      color: #fbf5e7;
    }

    .pn-filter-count {
      min-width: 13px;
      color: var(--pn-faint);
      font-size: 9.5px;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }

    .pn-filter[aria-pressed="true"] .pn-filter-count {
      color: rgba(251, 245, 231, 0.62);
    }

    .pn-list {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      gap: 9px;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 1px 16px 20px;
      overscroll-behavior: contain;
      scrollbar-color: #d8cdbb transparent;
      scrollbar-width: thin;
    }

    .pn-list::-webkit-scrollbar {
      width: 10px;
    }

    .pn-list::-webkit-scrollbar-thumb {
      border: 3px solid transparent;
      border-radius: 999px;
      background: #d8cdbb;
      background-clip: content-box;
    }

    .pn-card {
      position: relative;
      flex: none;
      padding: 12px 13px 12px 15px;
      overflow: hidden;
      border: 1px solid var(--pn-line);
      border-radius: 12px;
      background: var(--pn-card);
      box-shadow: 0 1px 0 rgba(46, 55, 48, 0.02);
      cursor: pointer;
      transition:
        transform 150ms ease,
        border-color 150ms ease,
        box-shadow 150ms ease;
    }

    .pn-card::before {
      content: "";
      position: absolute;
      top: 12px;
      bottom: 12px;
      left: 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--pn-card-accent);
      opacity: 0.82;
    }

    .pn-card[data-kind="note"] {
      background:
        linear-gradient(120deg, var(--pn-card-wash), rgba(255, 253, 248, 0.9) 62%),
        var(--pn-card);
    }

    .pn-card:hover {
      border-color: var(--pn-line-strong);
      box-shadow: 0 5px 16px rgba(41, 52, 44, 0.075);
      transform: translateY(-1px);
    }

    .pn-card.is-active {
      border-color: var(--pn-card-accent);
      box-shadow:
        0 0 0 2px rgba(244, 200, 75, 0.24),
        0 6px 18px rgba(41, 52, 44, 0.08);
      box-shadow:
        0 0 0 2px color-mix(in srgb, var(--pn-card-accent) 28%, transparent),
        0 6px 18px rgba(41, 52, 44, 0.08);
    }

    .pn-card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 20px;
      padding-right: 42px;
      color: var(--pn-faint);
      font-size: 10px;
      letter-spacing: 0.015em;
    }

    .pn-card-dot {
      width: 7px;
      height: 7px;
      flex: none;
      border-radius: 50%;
      background: var(--pn-card-accent);
      box-shadow: 0 0 0 2px var(--pn-card-wash);
    }

    .pn-card-kind {
      overflow: hidden;
      color: var(--pn-ink-soft);
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pn-card-time {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: opacity 120ms ease;
    }

    .pn-card-time::before {
      content: "·";
      margin-right: 5px;
      color: #c2b9aa;
    }

    .pn-card-actions {
      position: absolute;
      top: 7px;
      right: 7px;
      display: flex;
      gap: 1px;
      padding: 1px;
      border-radius: 7px;
      background: var(--pn-card);
      opacity: 0;
      transition: opacity 130ms ease;
    }

    .pn-card:hover .pn-card-actions,
    .pn-card:focus-within .pn-card-actions {
      opacity: 1;
    }

    .pn-card:hover .pn-card-time,
    .pn-card:focus-within .pn-card-time {
      opacity: 0;
    }

    .pn-card-action {
      display: grid;
      width: 24px;
      height: 24px;
      place-items: center;
      border-radius: 6px;
      color: var(--pn-faint);
      transition: background 120ms ease, color 120ms ease;
    }

    .pn-card-action:hover {
      background: rgba(35, 51, 43, 0.065);
      color: var(--pn-ink);
    }

    .pn-card-action.is-delete:hover {
      background: rgba(169, 80, 87, 0.08);
      color: var(--pn-danger);
    }

    .pn-card-quote {
      display: -webkit-box;
      margin: 6px 0 0;
      overflow: hidden;
      color: #33423b;
      font-family: var(--pn-serif);
      font-size: 14px;
      line-height: 1.58;
      overflow-wrap: anywhere;
      user-select: text;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .pn-card[data-kind="note"] .pn-card-quote {
      margin-top: 7px;
      padding: 5px 8px;
      border-radius: 6px;
      background: rgba(35, 51, 43, 0.035);
      color: #68746d;
      font-size: 12px;
      line-height: 1.55;
      -webkit-line-clamp: 2;
    }

    .pn-card-note {
      margin: 8px 0 0;
      color: #2d3b34;
      font-size: 12.5px;
      line-height: 1.68;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      user-select: text;
    }

    .pn-orphan {
      display: inline-flex;
      align-items: center;
      height: 17px;
      margin-top: 7px;
      padding: 0 6px;
      border-radius: 4px;
      background: rgba(169, 80, 87, 0.07);
      color: #9b6266;
      font-size: 9px;
      letter-spacing: 0.03em;
    }

    .pn-empty {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 250px;
      padding: 20px 18px 56px;
      text-align: center;
    }

    .pn-empty-art {
      width: 144px;
      height: auto;
      margin-bottom: 13px;
      filter: drop-shadow(0 8px 14px rgba(65, 57, 38, 0.08));
    }

    .pn-empty h3 {
      margin: 0;
      font-family: var(--pn-serif);
      font-size: 18px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    .pn-empty p {
      max-width: 245px;
      margin: 7px 0 0;
      color: var(--pn-muted);
      font-size: 11.5px;
      line-height: 1.7;
    }

    .pn-empty kbd {
      padding: 1px 5px;
      border: 1px solid var(--pn-line-strong);
      border-bottom-width: 2px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.5);
      color: var(--pn-ink-soft);
      font-family: var(--pn-sans);
      font-size: 9px;
    }

    .pn-panel-foot {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 20px;
      border-top: 1px solid rgba(224, 213, 194, 0.76);
      background: rgba(251, 248, 241, 0.72);
    }

    .pn-local {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--pn-faint);
      font-size: 9.5px;
      letter-spacing: 0.02em;
    }

    .pn-local svg {
      opacity: 0.8;
    }

    .pn-clear {
      height: 24px;
      padding: 0 6px;
      border-radius: 5px;
      color: var(--pn-faint);
      font-size: 9.5px;
      transition: background 120ms ease, color 120ms ease;
    }

    .pn-clear:hover {
      background: rgba(169, 80, 87, 0.065);
      color: var(--pn-danger);
    }

    .pn-clear.is-armed {
      background: rgba(169, 80, 87, 0.08);
      color: var(--pn-danger);
    }

    /* ── Edge tab ───────────────────────────────────────────────── */

    .pn-edge {
      position: fixed;
      top: 39%;
      right: 0;
      z-index: 15;
      display: flex;
      width: 42px;
      padding: 10px 0 11px;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      border: 1px solid #e2d8c6;
      border-right: 0;
      border-radius: 14px 0 0 14px;
      background:
        linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(247, 241, 230, 0.98));
      color: var(--pn-ink-soft);
      box-shadow:
        -6px 8px 22px rgba(34, 46, 38, 0.11),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      pointer-events: auto;
      transition: width 150ms ease, transform 150ms ease, box-shadow 150ms ease;
    }

    .pn-edge:hover {
      width: 45px;
      transform: translateX(-1px);
      box-shadow:
        -8px 10px 26px rgba(34, 46, 38, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .pn-edge-icon {
      color: #8b6917;
    }

    .pn-edge-count {
      font-family: var(--pn-serif);
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      color: var(--pn-ink);
      font-variant-numeric: tabular-nums;
    }

    .pn-edge-label {
      color: var(--pn-muted);
      font-size: 9.5px;
      letter-spacing: 0.12em;
      line-height: 1;
      writing-mode: vertical-rl;
      text-orientation: upright;
    }

    /* ── Toast ──────────────────────────────────────────────────── */

    .pn-toast {
      position: fixed;
      bottom: 22px;
      left: 50%;
      z-index: 40;
      display: flex;
      max-width: min(420px, calc(100vw - 32px));
      min-height: 42px;
      align-items: center;
      gap: 9px;
      padding: 8px 10px 8px 13px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(29, 43, 38, 0.97);
      color: #f7f1e4;
      box-shadow:
        0 14px 34px rgba(12, 20, 16, 0.24),
        0 2px 8px rgba(12, 20, 16, 0.17);
      backdrop-filter: blur(10px);
      transform: translateX(-50%);
      animation: pn-toast-in 180ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
      pointer-events: auto;
    }

    .pn-ui.has-panel .pn-toast {
      right: calc(min(var(--pn-panel-width), 100vw) + 18px);
      left: auto;
      transform: none;
    }

    @keyframes pn-toast-in {
      from {
        opacity: 0;
        transform: translate(-50%, 5px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }

    .pn-ui.has-panel .pn-toast {
      animation-name: pn-toast-in-right;
    }

    @keyframes pn-toast-in-right {
      from {
        opacity: 0;
        transform: translateY(5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .pn-toast-dot {
      width: 7px;
      height: 7px;
      flex: none;
      border-radius: 50%;
      background: var(--pn-accent);
      box-shadow: 0 0 0 3px rgba(244, 200, 75, 0.12);
    }

    .pn-toast-message {
      min-width: 0;
      flex: 1;
      font-size: 11.5px;
      line-height: 1.45;
    }

    .pn-toast-action {
      flex: none;
      height: 27px;
      padding: 0 9px;
      border-radius: 6px;
      background: rgba(244, 200, 75, 0.12);
      color: #f1ca61;
      font-size: 11px;
      font-weight: 600;
      transition: background 120ms ease;
    }

    .pn-toast-action:hover {
      background: rgba(244, 200, 75, 0.2);
    }

    .pn-toast-close {
      display: grid;
      width: 25px;
      height: 25px;
      flex: none;
      place-items: center;
      border-radius: 6px;
      color: rgba(247, 241, 228, 0.42);
    }

    .pn-toast-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f7f1e4;
    }

    /* ── Reveal flash ───────────────────────────────────────────── */

    .pn-flash-layer {
      position: fixed;
      inset: 0;
      z-index: 10;
      overflow: hidden;
      pointer-events: none;
    }

    .pn-flash {
      position: absolute;
      border: 1.5px solid rgba(168, 114, 9, 0.58);
      border-radius: 4px;
      background: rgba(244, 200, 75, 0.19);
      box-shadow: 0 0 0 4px rgba(244, 200, 75, 0.1);
      animation: pn-flash 1.35s ease forwards;
    }

    @keyframes pn-flash {
      0% { opacity: 0; transform: scale(0.985); }
      18% { opacity: 1; transform: scale(1); }
      72% { opacity: 1; }
      100% { opacity: 0; transform: scale(1.008); }
    }

    /* ── Narrow screens ─────────────────────────────────────────── */

    @media (max-width: 620px) {
      .pn-panel {
        width: 100vw;
        border-left: 0;
      }

      .pn-ui.has-panel .pn-toast {
        right: 16px;
        bottom: 16px;
        left: 16px;
        max-width: none;
        transform: none;
        animation-name: pn-toast-in-mobile;
      }

      @keyframes pn-toast-in-mobile {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .pn-page-host {
        max-width: 68vw;
      }
    }

    @media (hover: none) {
      .pn-card-actions {
        opacity: 1;
      }

      .pn-card-time {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pn-ui,
      .pn-ui *,
      .pn-ui *::before,
      .pn-ui *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  `;

  globalThis.PageNoteStyles = { SHADOW_CSS };
})();
