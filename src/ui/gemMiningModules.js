const MODULES = Object.freeze({
  exploration: {
    label: "EXPLORATION",
    layers: ["global-satellite-mining", "anm-free-areas"],
  },
  geology: {
    label: "GEOLOGY",
    layers: ["gem-prospectivity"],
  },
  geochemistry: {
    label: "GEOCHEMISTRY",
    layers: ["gem-prospectivity"],
  },
  spectral: {
    label: "SPECTRAL",
    layers: ["global-satellite-mining"],
  },
  geophysics: {
    label: "GEOPHYSICS",
    layers: ["geophysics-subsurface"],
  },
  targets: {
    label: "AI TARGETS",
    layers: ["gem-prospectivity", "geophysics-subsurface"],
  },
  resources: {
    label: "RESOURCES",
    layers: ["mining-economics", "global-precious-metals", "critical-minerals"],
  },
  planning: {
    label: "MINE PLANNING",
    layers: ["mining-economics", "anm-free-areas"],
  },
  environment: {
    label: "ENVIRONMENT",
    layers: ["anm-area-intelligence"],
  },
  concessions: {
    label: "CONCESSIONS",
    layers: ["anm-mining-cadastre", "anm-free-areas"],
  },
});

function installStyles() {
  if (document.getElementById("gem-mining-main-styles")) return;
  const style = document.createElement("style");
  style.id = "gem-mining-main-styles";
  style.textContent = `
    .gem-main-mining-modules {
      position: relative;
      width: min(900px, 100%);
      margin: 12px auto 0;
      padding: 10px;
      box-sizing: border-box;
      border: 1px solid rgba(44, 220, 243, .22);
      border-radius: 10px;
      background: rgba(2, 18, 27, .72);
      box-shadow: inset 0 0 28px rgba(34, 214, 239, .035);
    }
    .gem-main-mining-modules-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .gem-main-mining-modules-head strong {
      color: #f2c45a;
      font: 800 8px JetBrains Mono, monospace;
      letter-spacing: .14em;
    }
    .gem-main-mining-modules-head span {
      color: #668b94;
      font: 700 6px JetBrains Mono, monospace;
      letter-spacing: .08em;
    }
    .gem-main-mining-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 5px;
    }
    .gem-main-mining-grid button {
      min-height: 52px;
      padding: 7px 6px;
      display: grid;
      grid-template-columns: 20px 1fr;
      grid-template-rows: auto auto;
      gap: 2px 5px;
      text-align: left;
      border: 1px solid rgba(47, 208, 231, .18);
      border-radius: 6px;
      background: linear-gradient(145deg, rgba(6, 36, 49, .9), rgba(3, 20, 29, .92));
      color: #e4f6f9;
      cursor: pointer;
    }
    .gem-main-mining-grid button:hover,
    .gem-main-mining-grid button.is-active {
      border-color: #31dcf2;
      background: linear-gradient(145deg, rgba(10, 83, 101, .92), rgba(3, 28, 38, .96));
      box-shadow: 0 0 14px rgba(36, 215, 240, .12), inset 0 0 18px rgba(36, 215, 240, .06);
    }
    .gem-main-mining-grid button:disabled { cursor: wait; opacity: .78; }
    .gem-main-mining-grid b {
      grid-row: 1 / span 2;
      color: #35dff4;
      font: 800 7px JetBrains Mono, monospace;
      border-right: 1px solid rgba(54, 205, 226, .14);
      padding-right: 4px;
    }
    .gem-main-mining-grid button strong {
      color: #f0fbfd;
      font: 800 7px Inter, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gem-main-mining-grid button small {
      color: #71979f;
      font: 600 5.5px JetBrains Mono, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gem-module-live {
      margin-top: 8px;
      padding: 7px 9px;
      border: 1px solid rgba(47, 224, 179, .16);
      border-radius: 6px;
      color: #8fe7d2;
      font: 700 7px JetBrains Mono, monospace;
      letter-spacing: .05em;
      background: rgba(10, 78, 66, .12);
    }
    @media (max-width: 1200px) {
      .gem-main-mining-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `;
  document.head.appendChild(style);
}

function panelLauncher(dataManager, layerId) {
  const entry = dataManager?.layers?.get?.(layerId);
  const module = entry?.module;
  const chips = module?.getRowControls?.()?.chips || [];
  const chip = chips.find((item) =>
    /SATELLITE|GEOPHYSICS|PRECIOUS|INTELLIGENCE|OPEN TARGET|ECONOM|CRITICAL/i.test(item.label || ""),
  );
  try { chip?.onClick?.(); } catch {}
}

async function activateMiningModule(dataManager, id, button, status) {
  const config = MODULES[id];
  if (!config || !dataManager) {
    status.textContent = "GEM CORE · DATA MANAGER NOT READY";
    return;
  }
  button.disabled = true;
  status.textContent = config.label + " · ACTIVATING…";
  const results = [];
  try {
    for (const layerId of config.layers) {
      try {
        const result = await dataManager.setEnabled(layerId, true, { origin: "user" });
        results.push({ layerId, ok: result !== false });
        panelLauncher(dataManager, layerId);
      } catch (error) {
        results.push({ layerId, ok: false, error: String(error?.message || error) });
      }
    }
    const failed = results.filter((result) => !result.ok);
    status.textContent = failed.length
      ? config.label + " · DEGRADED · " + failed.length + " LAYER ERROR"
      : config.label + " · ONLINE";
    document.dispatchEvent(new CustomEvent("gem:mining-module", {
      detail: { module: id, label: config.label, layers: config.layers, results },
    }));
  } finally {
    button.disabled = false;
  }
}

export function installGemMiningModules(dataManager) {
  if (!dataManager || typeof document === "undefined") return () => {};
  const wire = () => {
    const shell = document.querySelector(".gem-command-center-force");
    const hero = shell?.querySelector(".gcf-hero-card");
    const init = shell?.querySelector(".gcf-init");
    if (!shell || !hero || !init || document.getElementById("gem-main-mining-modules")) return false;

    installStyles();

    const section = document.createElement("section");
    section.id = "gem-main-mining-modules";
    section.className = "gem-main-mining-modules";
    section.innerHTML = `
      <div class="gem-main-mining-modules-head">
        <strong>MINING INTELLIGENCE MODULES</strong>
        <span>LIVE GEM ENGINE · FUNCTIONAL LAYERS</span>
      </div>
      <div class="gem-main-mining-grid">
        ${Object.entries(MODULES).map(([id, config], index) => `
          <button type="button" data-gem-mining-module="${id}">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <strong>${config.label}</strong>
            <small>${config.layers.join(" · ")}</small>
          </button>
        `).join("")}
      </div>
      <div class="gem-module-live">SELECT A MODULE TO ACTIVATE ITS REAL GEM LAYERS AND OPEN ITS ANALYSIS PANEL.</div>
    `;

    init.before(section);
    const status = section.querySelector(".gem-module-live");
    section.querySelectorAll("[data-gem-mining-module]").forEach((button) => {
      button.addEventListener("click", () => {
        section.querySelectorAll("button").forEach((node) => node.classList.remove("is-active"));
        button.classList.add("is-active");
        void activateMiningModule(dataManager, button.dataset.gemMiningModule, button, status);
      });
    });
    return true;
  };

  if (wire()) return () => {};
  const observer = new MutationObserver(() => {
    if (wire()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
