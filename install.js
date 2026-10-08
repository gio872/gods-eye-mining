module.exports = {
  version: "1.0",
  title: "Install GEM",
  description: "Install GEM — Global Exploration & Mineral Intelligence System",
  run: [
    {
      method: "shell.run",
      params: {
        message: "node scripts/pinokio-install.mjs"
      }
    }
  ]
}
