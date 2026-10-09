module.exports = {
  version: "1.0",
  title: "Reset GEM",
  description: "Reset the local GEM dependency state and reinstall",
  run: [
    {
      method: "shell.run",
      params: {
        message: "node scripts/pinokio-reset.mjs"
      }
    }
  ]
}
