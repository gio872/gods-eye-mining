module.exports = {
  version: "1.0",
  title: "Update GEM",
  description: "Update the GEM checkout and reinstall dependencies",
  run: [
    {
      method: "shell.run",
      params: {
        path: "app",
        message: [
          "git fetch origin",
          "git checkout feature/global-mineral-intelligence",
          "git pull --ff-only origin feature/global-mineral-intelligence",
          "node scripts/pinokio-install.mjs"
        ]
      }
    }
  ]
}
