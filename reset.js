module.exports = {
  version: "1.0",
  title: "Reset GEM",
  description: "Remove the local GEM dependency state and reinstall",
  run: [
    {
      method: "shell.run",
      params: {
        path: "app",
        message: [
          "if exist node_modules rmdir /s /q node_modules",
          "if exist pinokio\\.installed del /q pinokio\\.installed",
          "node scripts/pinokio-install.mjs"
        ]
      }
    }
  ]
}
